#!/usr/bin/env python3
"""The model lab: what a model really costs on this machine, and which phone-side tricks pay off.
   python3 tests/models/lab.py <model.gguf> <llama.cpp build/bin dir> [name]  → markdown on stdout (and $GITHUB_STEP_SUMMARY)
Measures (all with llama.cpp, the engine the app ships):
  1. speed: reading (prompt) and writing (generation) tokens/s — default, flash attention, flash attention + 8-bit KV cache (what the phone uses),
     and with half the threads (heat proxy: how much speed does a cooler setting cost)
  2. memory: resident memory right after loading and after a 1,800-token prompt, with the file mapped (mmap, default) and without
  3. the prompt cache on storage: time to read the same 1,800-token prompt fresh vs restored from a saved slot (what 'instant reload' would save)
Nothing here is a claim: every number is printed with the command that made it."""
import sys, os, json, time, subprocess, urllib.request, tempfile, shutil, re

M, BIN = sys.argv[1], sys.argv[2]
NAME = sys.argv[3] if len(sys.argv) > 3 else os.path.basename(M)
NPROC = os.cpu_count() or 4
PORT = 8123
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
out = []
def say(s=""): print(s, flush=True); out.append(s)

def bench(extra, label):
    cmd = [os.path.join(BIN, "llama-bench"), "-m", M, "-p", "512", "-n", "64", "-r", "2", "-o", "json"] + extra
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, env=env, timeout=1800)
        d = json.loads(r.stdout)
        pp = [x["avg_ts"] for x in d if x.get("n_prompt", 0) > 0 and x.get("n_gen", 0) == 0]
        tg = [x["avg_ts"] for x in d if x.get("n_gen", 0) > 0 and x.get("n_prompt", 0) == 0]
        say(f"| {label} | {pp[0]:.1f} | {tg[0]:.1f} | `{' '.join(extra) or '(defaults)'}` |")
        return pp[0], tg[0]
    except Exception as e:
        say(f"| {label} | ? | ? | failed: {str(e)[:80]} |"); return None, None

say(f"## {NAME}"); say(f"{os.path.getsize(M)/1e9:.2f} GB file · {NPROC} cores · llama.cpp at `{BIN}`"); say()
say("### 1. Speed (tokens per second)"); say("| Setup | Reading t/s | Writing t/s | Flags |"); say("|---|---|---|---|")
base = bench(["-t", str(NPROC)], "defaults, all cores")
bench(["-t", str(NPROC), "-fa", "1"], "flash attention")
phone = bench(["-t", str(NPROC), "-fa", "1", "-ctk", "q8_0", "-ctv", "q8_0"], "flash attention + 8-bit KV (the phone's setup)")
half = bench(["-t", str(max(1, NPROC // 2)), "-fa", "1", "-ctk", "q8_0", "-ctv", "q8_0"], f"…with half the threads ({max(1, NPROC // 2)})")
if phone[1] and half[1]: say(); say(f"Half the threads keeps **{100*half[1]/phone[1]:.0f}%** of the writing speed and **{100*half[0]/phone[0]:.0f}%** of the reading speed (fewer cores = less heat).")
say()

def rss_kb(pid):
    try:
        for l in open(f"/proc/{pid}/status"):
            if l.startswith("VmRSS:"): return int(l.split()[1])
    except Exception: pass
    return 0
def post(path, body, timeout=900):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
def serve(extra):
    cmd = [os.path.join(BIN, "llama-server"), "-m", M, "--host", "127.0.0.1", "--port", str(PORT), "-c", "4096", "-t", str(NPROC), "-np", "1", "--jinja", "--no-ui", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0", "--cache-ram", "0"] + extra
    p = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(600):
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): return p
        except Exception: time.sleep(1)
    p.kill(); raise RuntimeError("server did not start")
PROMPT = ("You are Attune, an assistant on the person's phone. Rules: answer briefly, use the person's language, never invent numbers. " * 45)[:7000]
def ask(n=8, cache=True):
    return post("/v1/chat/completions", {"messages": [{"role": "system", "content": PROMPT}, {"role": "user", "content": "Say hello in one short sentence."}], "max_tokens": n, "temperature": 0, "cache_prompt": cache, "chat_template_kwargs": {"enable_thinking": False}})

say("### 2. Memory (resident, MB)"); say("| File access | After loading | After a ~1,800-token prompt |"); say("|---|---|---|")
for label, extra in [("mapped (mmap, the default)", []), ("copied into RAM (--no-mmap)", ["--load-mode", "none"])]:
    try:
        p = serve(extra); a = rss_kb(p.pid) / 1024; ask(); b = rss_kb(p.pid) / 1024; p.terminate(); p.wait(timeout=30)
        say(f"| {label} | {a:.0f} | {b:.0f} |")
    except Exception as e: say(f"| {label} | ? | failed: {str(e)[:60]} |")
say()

say("### 3. Prompt cache on storage (read the same long start of a chat again)")
slots = tempfile.mkdtemp(prefix="slots")
try:
    p = serve(["--slot-save-path", slots])
    r1 = ask(cache=True); t1 = r1.get("timings", {}); n1 = t1.get("prompt_n", 0); ms1 = t1.get("prompt_ms", 0)
    sv = post("/slots/0?action=save", {"filename": "s.bin"}); size = os.path.getsize(os.path.join(slots, "s.bin")) / 1e6 if os.path.exists(os.path.join(slots, "s.bin")) else 0
    p.terminate(); p.wait(timeout=30)
    p = serve(["--slot-save-path", slots])
    cold = ask(cache=False).get("timings", {}); 
    p.terminate(); p.wait(timeout=30)
    p = serve(["--slot-save-path", slots])
    t0 = time.time(); post("/slots/0?action=restore", {"filename": "s.bin"}); rest_ms = (time.time() - t0) * 1000
    warm = ask(cache=True).get("timings", {})
    p.terminate(); p.wait(timeout=30)
    say(f"- Fresh start: read **{cold.get('prompt_n', n1)} tokens in {cold.get('prompt_ms', ms1):.0f} ms**.")
    say(f"- Saved slot: **{size:.1f} MB** on storage. After a restart, restoring it took **{rest_ms:.0f} ms**, then the same prompt only needed **{warm.get('prompt_n', '?')} new tokens ({warm.get('prompt_ms', 0):.0f} ms)**.")
    tot = rest_ms + warm.get("prompt_ms", 0)
    say(f"- Time to the first word after a reload: **{cold.get('prompt_ms', ms1):.0f} ms → {tot:.0f} ms** ({'faster' if tot < cold.get('prompt_ms', ms1) else 'NOT faster'}).")
except Exception as e:
    say(f"- failed: {str(e)[:200]}")
finally:
    shutil.rmtree(slots, ignore_errors=True)
    subprocess.run(["pkill", "-f", f"port {PORT}"], capture_output=True)
# ---- 4. speculative decoding: faster writing with the SAME answers ------------------------------------------------------------------
say(); say("### 4. Speculative decoding (the answer is identical; only the speed changes)")
TASKS = [
  ("code", "Write a Python function that returns the n-th Fibonacci number with memoisation, and three asserts that test it. Reply with one code block only."),
  ("json", 'Extract the data as JSON with keys name, company, amount, date: "Ahmed Ali from Adrighem Cranes paid 18,000 EGP on 3 March 2026 for the 50 t crane rental." Reply with the JSON only.'),
  ("arabic", "اشرح بالعربي المصري في 5 جمل إزاي الونش المتحرك بيرفع حمل تقيل بأمان."),
  ("edit", "Rewrite this paragraph in a more formal tone, keeping every number: 'hey, the crane is coming on monday at 8, it costs 9,000 a day and we need 3 days, pls send the money before friday and tell the driver where the gate is.'"),
]
def spec_run(label, extra):
    try:
        p = serve(extra)
    except Exception as e:
        say(f"| {label} | not supported here: {str(e)[:60]} | | | |"); return None
    try:
        speeds = []; acc = []
        for name, q in TASKS:
            r = post("/v1/chat/completions", {"messages": [{"role": "user", "content": q}], "max_tokens": 160, "temperature": 0, "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": False}})
            t = r.get("timings", {}); speeds.append(t.get("predicted_per_second", 0))
            dn, da = t.get("draft_n", 0), t.get("draft_n_accepted", 0)
            acc.append((da / dn * 100) if dn else None)
        p.terminate(); p.wait(timeout=30)
        a = [x for x in acc if x is not None]
        say(f"| {label} | " + " | ".join(f"{x:.1f}" for x in speeds) + f" | {sum(speeds)/len(speeds):.1f} | {('%.0f%%' % (sum(a)/len(a))) if a else '—'} |")
        return sum(speeds) / len(speeds)
    except Exception as e:
        try: p.kill()
        except Exception: pass
        say(f"| {label} | failed: {str(e)[:70]} | | | |"); return None
say("| Mode | code t/s | json t/s | Arabic t/s | edit t/s | Mean t/s | Guesses accepted |"); say("|---|---|---|---|---|---|---|")
b0 = spec_run("off", [])
b1 = spec_run("copy-ahead (ngram-mod) — the app's default", ["--spec-type", "ngram-mod"])
b2 = spec_run("multi-token prediction (draft-mtp)", ["--spec-type", "draft-mtp", "--spec-draft-n-max", "3"])
b3 = spec_run("n-gram map (ngram-map-k)", ["--spec-type", "ngram-map-k"])
b5 = spec_run("MTP, 2 guesses (draft-mtp n-max 2)", ["--spec-type", "draft-mtp", "--spec-draft-n-max", "2"])
b6 = spec_run("MTP, 4 guesses (draft-mtp n-max 4)", ["--spec-type", "draft-mtp", "--spec-draft-n-max", "4"])
b7 = spec_run("MTP 2 + n-gram map", ["--spec-type", "draft-mtp,ngram-map-k", "--spec-draft-n-max", "2"])
b8 = spec_run("MTP 3 + copy-ahead", ["--spec-type", "draft-mtp,ngram-mod", "--spec-draft-n-max", "3"])
b4 = None
if os.environ.get("DRAFT_MODEL") and os.path.exists(os.environ["DRAFT_MODEL"]):
    b4 = spec_run("0.8B draft model + copy-ahead (the app's opt-in)", ["-md", os.environ["DRAFT_MODEL"], "--spec-type", "draft-simple,ngram-mod", "--spec-draft-n-max", "12", "-td", str(NPROC), "-ngld", "0"])
if b0:
    say(); best = max([(v, n) for v, n in [(b1, "copy-ahead"), (b2, "multi-token prediction"), (b3, "n-gram map"), (b4, "draft model"), (b5, "MTP n-max 2"), (b6, "MTP n-max 4"), (b7, "MTP 2 + n-gram map"), (b8, "MTP 3 + copy-ahead")] if v], default=None)
    if best: say(f"Best: **{best[1]}** — {100*best[0]/b0-100:+.0f}% writing speed vs off ({b0:.1f} → {best[0]:.1f} t/s).")
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open(f"lab-{NAME}.md", "w").write("\n".join(out) + "\n")
