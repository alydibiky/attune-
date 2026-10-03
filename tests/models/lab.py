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
for label, extra in [("mapped (mmap, the default)", []), ("copied into RAM (--no-mmap)", ["--no-mmap"])]:
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
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open(f"lab-{NAME}.md", "w").write("\n".join(out) + "\n")
