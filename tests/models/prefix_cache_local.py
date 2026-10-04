#!/usr/bin/env python3
"""Prefix-only prompt cache on storage, quick local check.
   python3 tests/models/prefix_cache_local.py <model.gguf> [bin dir] [--no-slots|""]
Reads a ~5k-token document, saves the slot (after an answer, or right after the prefix with n_predict 0),
restarts the server, restores, asks a new question about the same document and reports how many tokens were re-read."""
import sys, os, json, time, subprocess, urllib.request, tempfile
M = sys.argv[1]
BIN = sys.argv[2] if len(sys.argv) > 2 else "tests/build-dl/bin"
NS = sys.argv[3] if len(sys.argv) > 3 else "--no-slots"
PORT = 8195
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
S = tempfile.mkdtemp()

def post(p, b):
    r = urllib.request.Request(f"http://127.0.0.1:{PORT}{p}", data=json.dumps(b).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(r, timeout=3000) as x: return json.load(x)

def serve():
    p = subprocess.Popen([BIN + "/llama-server", "-m", M, "--port", str(PORT), "-c", "8192", "-t", "4", "-np", "1", "-fa", "on",
                          "-ctk", "q8_0", "-ctv", "q8_0", "--load-mode", "none", "--cache-ram", "0", "--slot-save-path", S]
                         + ([NS] if NS else []), env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    while True:
        if p.poll() is not None: raise RuntimeError("server exited")
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): return p
        except Exception: time.sleep(.5)

LONG = " ".join(f"Line {i}: the crane at site {i % 17} lifted {i * 3 % 50} tonnes on day {i % 28 + 1}." for i in range(330))
DOC = "Document:\n" + LONG + "\n\nQuestion: "
def raw(t, n): return post("/completion", {"prompt": t, "n_predict": n, "temperature": 0, "cache_prompt": True})
for lab, n in [("after-answer", 16), ("prefix-only", 0)]:
    p = serve(); raw(DOC, n); post("/slots/0?action=save", {"filename": "s.bin"}); sz = os.path.getsize(S + "/s.bin") / 1e6
    c = raw(DOC + "Which site lifted the most on day 5?", 16)["timings"]; p.terminate(); p.wait()
    p = serve(); t = time.time(); post("/slots/0?action=restore", {"filename": "s.bin"}); r = (time.time() - t) * 1000
    w = raw(DOC + "Which site lifted the most on day 5?", 16)["timings"]; p.terminate(); p.wait()
    print(f"{lab}: saved {sz:.1f} MB | cold read {c['prompt_ms']:.0f} ms ({c['prompt_n']} tok) | restore {r:.0f} ms | "
          f"after restore read {w['prompt_n']} tok in {w['prompt_ms']:.0f} ms", flush=True)
