"""Every command-line flag Engine.kt gives llama-server must exist in the
pinned llama-server — an unknown flag stops the engine from starting at all
("invalid argument"), which on the phone looks like a model that never loads.
Checked against the desktop build of the same commit (tests/setup.sh)."""
import os, re, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "..", "app/src/main/java/com/aldibiki/attune/Engine.kt"), encoding="utf-8").read()
body = src[src.index("private fun buildArgs"):src.index("private fun startBlocking")]
flags = sorted(set(re.findall(r'"(--?[a-zA-Z][\w-]*)"', body)))
env = dict(os.environ, LD_LIBRARY_PATH=HERE + "/build-dl/bin")
helptext = subprocess.run([HERE + "/build-dl/bin/llama-server", "--help"], env=env, capture_output=True, text=True).stdout
known = set(re.findall(r"(?<![\w-])(--?[a-zA-Z][\w-]*)", helptext))
bad = [f for f in flags if f not in known]
for f in flags: print(("PASS " if f in known else "FAIL ") + f)
if bad: print("UNKNOWN FLAGS: " + " ".join(bad)); sys.exit(1)

# And the values: start the server with each argument set the phone uses.
import time, urllib.request, signal
common = ["-m", HERE + "/tiny-a.gguf", "--host", "127.0.0.1", "--api-key", "k", "-c", "2048", "-t", "2", "-tb", "2", "-np", "1",
          "--load-mode", "none", "--cache-reuse", "256", "--cache-ram", "0", "--jinja", "--no-ui", "--no-slots", "--threads-http", "2",
          "--cors-headers", "Authorization,Content-Type", "--cors-origins", "https://appassets.androidplatform.net"]
sets = {
    "CPU": ["-ngl", "0", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0", "--spec-type", "ngram-mod"],
    "GPU": ["-ngl", "99", "-fa", "auto", "--spec-type", "ngram-mod"],
    "CPU + draft": ["-ngl", "0", "-fa", "on", "-ctk", "q8_0", "-ctv", "q8_0", "-md", HERE + "/tiny-a.gguf",
                    "--spec-type", "draft-simple,ngram-mod", "--spec-draft-n-max", "12", "-td", "2", "-ngld", "0"],
}
fails = 0
for i, (name, extra) in enumerate(sets.items()):
    port = 18780 + i
    p = subprocess.Popen([HERE + "/build-dl/bin/llama-server", "--port", str(port)] + common + extra, env=env,
                         stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    ok = False
    for _ in range(60):
        if p.poll() is not None: break
        try:
            ok = urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1).status == 200
            if ok: break
        except Exception: time.sleep(0.25)
    if not ok and p.poll() is not None: print("   ", (p.stderr.read() or "")[-300:])
    print(("PASS " if ok else "FAIL ") + "engine starts with the %s arguments" % name)
    fails += 0 if ok else 1
    p.send_signal(signal.SIGINT)
    try: p.wait(timeout=10)
    except Exception: p.kill()
print("ALL PASSED" if not fails else "%d FAILED" % fails)
sys.exit(1 if fails else 0)
