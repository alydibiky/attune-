#!/usr/bin/env python3
"""RAM levers: peak resident memory of llama-server for each switch, one at a time from the app's defaults.
   python3 tests/models/ram_levers.py <model.gguf> [bin dir] [ctx]
Peak RSS is split into anonymous (cannot be reclaimed) and file-backed (mapped weights: Android can drop and re-read them)."""
import sys, os, json, time, subprocess, urllib.request
M = sys.argv[1]
BIN = sys.argv[2] if len(sys.argv) > 2 else "tests/build-dl/bin"
CTX = int(sys.argv[3]) if len(sys.argv) > 3 else 8192
PORT = 8192
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
BASE = {"--load-mode": "none", "-ctk": "q8_0", "-ctv": "q8_0", "-fa": "on", "-c": str(CTX), "-ub": "512", "-b": "2048", "-t": "4"}
LEVERS = [("app default (copied, KV q8, fa on, ub 512)", {}),
          ("mapped weights (mmap)", {"--load-mode": "mmap"}),
          ("KV q4_0", {"-ctk": "q4_0", "-ctv": "q4_0"}),
          ("KV f16", {"-ctk": "f16", "-ctv": "f16"}),
          ("flash attention off (KV f16)", {"-fa": "off", "-ctk": "f16", "-ctv": "f16"}),
          ("ubatch 128 / batch 512", {"-ub": "128", "-b": "512"}),
          ("ubatch 1024 / batch 2048", {"-ub": "1024"}),
          ("context x4", {"-c": str(CTX * 4)}),
          ("2 threads", {"-t": "2"})]

def mem(pid):
    d = {}
    for l in open(f"/proc/{pid}/status"):
        k, _, v = l.partition(":")
        if k in ("VmHWM", "VmRSS", "RssAnon", "RssFile"): d[k] = int(v.split()[0]) // 1024
    return d

def post(b):
    r = urllib.request.Request(f"http://127.0.0.1:{PORT}/completion", data=json.dumps(b).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(r, timeout=3000) as x: return json.load(x)

LONG = " ".join(f"Line {i}: the crane at site {i % 17} lifted {i * 3 % 50} tonnes on day {i % 28 + 1}." for i in range(120))
print(f"| Lever | Peak RSS MB | Anon MB | File-mapped MB | Reading t/s | Writing t/s |\n|---|---|---|---|---|---|")
for name, ch in LEVERS:
    o = dict(BASE, **ch)
    cmd = [BIN + "/llama-server", "-m", M, "--port", str(PORT), "-np", "1", "--cache-ram", "0", "--no-warmup"] + [x for kv in o.items() for x in kv]
    p = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        while True:
            if p.poll() is not None: raise RuntimeError("exited")
            try:
                if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): break
            except Exception: time.sleep(.5)
        t = post({"prompt": LONG + "\nWhich site lifted most on day 5?", "n_predict": 32, "temperature": 0}).get("timings", {})
        m = mem(p.pid)
        print(f"| {name} | {m['VmHWM']} | {m.get('RssAnon')} | {m.get('RssFile')} | {t.get('prompt_per_second', 0):.1f} | {t.get('predicted_per_second', 0):.2f} |", flush=True)
    except Exception as e:
        print(f"| {name} | failed {e} | | | | |", flush=True)
    p.terminate(); p.wait()
