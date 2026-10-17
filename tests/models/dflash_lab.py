#!/usr/bin/env python3
"""v6.34 (Ali: "top-notch models on lighter devices without compromising anything"): DFlash — a small block-diffusion draft
that guesses a whole block of words per step, checked by the real model, so the answer is IDENTICAL and only the speed changes.
   python3 tests/models/dflash_lab.py <target.gguf> <draft.gguf> <llama.cpp bin dir> [name]  → dflash-<name>.md
Compares, on the app's own kinds of task (code, JSON, Arabic, an edit, an explanation), at temperature 0:
  off · MTP (the app's default for Qwen 3.5) · DFlash (n-max 8 / 15) · DFlash + copy-ahead,
and checks every answer is the same text as "off" (the proof that nothing is compromised)."""
import sys, os, json, time, subprocess, urllib.request
T, D, BIN = sys.argv[1], sys.argv[2], sys.argv[3]
NAME = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(T)
NPROC = os.cpu_count() or 4; PORT = 8131
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
out = []
def say(s=""): print(s, flush=True); out.append(s)
def post(body, timeout=1200):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}/v1/chat/completions", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)
def serve(extra):
    cmd = [os.path.join(BIN, "llama-server"), "-m", T, "--host", "127.0.0.1", "--port", str(PORT), "-c", "4096", "-t", str(NPROC), "-np", "1", "--jinja", "--no-ui", "-fa", "on", "--cache-ram", "0"] + extra
    log = open(f"/tmp/dflash-{len(out)}.log", "w")
    p = subprocess.Popen(cmd, env=env, stdout=log, stderr=subprocess.STDOUT)
    for _ in range(600):
        if p.poll() is not None: raise RuntimeError("exited: " + open(log.name).read()[-300:].replace("\n", " "))
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): return p
        except Exception: time.sleep(1)
    p.kill(); raise RuntimeError("did not start")
TASKS = [
  ("code", "Write a Python function that returns the n-th Fibonacci number with memoisation, and three asserts that test it. Reply with one code block only."),
  ("json", 'Extract the data as JSON with keys name, company, amount, date: "Ahmed Ali from Adrighem Cranes paid 18,000 EGP on 3 March 2026 for the 50 t crane rental." Reply with the JSON only.'),
  ("arabic", "اشرح بالعربي المصري في 5 جمل إزاي الونش المتحرك بيرفع حمل تقيل بأمان."),
  ("edit", "Rewrite this paragraph in a more formal tone, keeping every number: 'hey, the crane is coming on monday at 8, it costs 9,000 a day and we need 3 days, pls send the money before friday and tell the driver where the gate is.'"),
  ("explain", "Explain in 6 short sentences why a hydraulic system can lift heavy loads."),
]
ref = {}
def run(label, extra):
    try: p = serve(extra)
    except Exception as e: say(f"| {label} | not supported: {str(e)[:90]} | | | | | | |"); return None
    try:
        sp, same, acc = [], 0, []
        for name, q in TASKS:
            r = post({"messages": [{"role": "user", "content": q}], "max_tokens": 200, "temperature": 0, "seed": 1, "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": False}})
            t = r.get("timings", {}); sp.append(t.get("predicted_per_second", 0))
            c = r["choices"][0]["message"]["content"]
            if label == "off": ref[name] = c
            same += int(ref.get(name) == c)
            dn, da = t.get("draft_n", 0), t.get("draft_n_accepted", 0); acc.append(da / dn * 100 if dn else None)
        p.terminate(); p.wait(timeout=30)
        a = [x for x in acc if x is not None]
        say(f"| {label} | " + " | ".join(f"{x:.1f}" for x in sp) + f" | **{sum(sp)/len(sp):.1f}** | {('%.0f%%' % (sum(a)/len(a))) if a else '—'} | {same}/{len(TASKS)} |")
        return sum(sp) / len(sp)
    except Exception as e:
        try: p.kill()
        except Exception: pass
        say(f"| {label} | failed: {str(e)[:90]} | | | | | | |"); return None
say(f"## DFlash on {NAME}"); say(f"target {os.path.getsize(T)/1e9:.2f} GB · draft {os.path.getsize(D)/1e9:.2f} GB · {NPROC} cores (ARM)"); say()
say("| Mode | code | json | Arabic | edit | explain | Mean t/s | Guesses accepted | Same answer as off |"); say("|---|---|---|---|---|---|---|---|---|")
b0 = run("off", [])
b1 = run("MTP (the app's default)", ["--spec-type", "draft-mtp", "--spec-draft-n-max", "3"])
b2 = run("DFlash, 8 per block", ["-md", D, "--spec-type", "draft-dflash", "--spec-draft-n-max", "8", "-td", str(NPROC)])
b3 = run("DFlash, 15 per block", ["-md", D, "--spec-type", "draft-dflash", "--spec-draft-n-max", "15", "-td", str(NPROC)])
b4 = run("DFlash 8 + copy-ahead", ["-md", D, "--spec-type", "draft-dflash,ngram-mod", "--spec-draft-n-max", "8", "-td", str(NPROC)])
if b0:
    say(); best = max([(v, n) for v, n in [(b1, "MTP"), (b2, "DFlash 8"), (b3, "DFlash 15"), (b4, "DFlash 8 + copy-ahead")] if v], default=None)
    if best: say(f"Best: **{best[1]}** — {100*best[0]/b0-100:+.0f}% writing speed vs off ({b0:.1f} → {best[0]:.1f} t/s).")
if os.environ.get("GITHUB_STEP_SUMMARY"): open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open(f"dflash-{NAME}.md", "w").write("\n".join(out) + "\n")
