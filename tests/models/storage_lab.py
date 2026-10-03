#!/usr/bin/env python3
"""Storage lab: can the phone's flash storage make models lighter, and how long can the input get?
   python3 tests/models/storage_lab.py <model.gguf> <llama.cpp bin dir> <name> [cap list, e.g. "none,8G,6G"]
Every server run can be put under a hard memory cap (cgroup v2 via `sudo systemd-run --scope -p MemoryMax=.. -p MemorySwapMax=0`)
to act like a small phone. Sections:
  1. weights copied into RAM (--load-mode none, the app today) vs mapped from storage (mmap), with and without a cap:
     load time, resident memory, first-answer time, writing speed, major page faults (= reads from storage)
  2. context length vs memory: 8k/32k/64k/128k with the 8-bit and the 4-bit KV cache (memory after load + a 4k-token read speed)
  3. prompt cache on storage (slot save -> restart -> restore): the old way (saved after an answer) vs prefix-only save
Writes storage-<name>.md and appends to $GITHUB_STEP_SUMMARY."""
import sys, os, json, time, subprocess, urllib.request, tempfile, shutil

M, BIN, NAME = sys.argv[1], sys.argv[2], sys.argv[3]
CAPS = (sys.argv[4] if len(sys.argv) > 4 else "none,8G,6G").split(",")
NPROC = os.cpu_count() or 4
PORT = 8124
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
out = []
def say(s=""): print(s, flush=True); out.append(s)

def post(path, body, timeout=1800):
    req = urllib.request.Request(f"http://127.0.0.1:{PORT}{path}", data=json.dumps(body).encode(), headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r: return json.load(r)

def server_pid():
    r = subprocess.run(["pgrep", "-f", f"llama-server.*--port {PORT}"], capture_output=True, text=True)
    pids = [int(x) for x in r.stdout.split()]
    return pids[-1] if pids else None

def stats(pid):
    rss = hwm = 0; majflt = 0
    try:
        for l in open(f"/proc/{pid}/status"):
            if l.startswith("VmRSS:"): rss = int(l.split()[1]) // 1024
            if l.startswith("VmHWM:"): hwm = int(l.split()[1]) // 1024
        majflt = int(open(f"/proc/{pid}/stat").read().rsplit(")", 1)[1].split()[9])
    except Exception: pass
    return rss, hwm, majflt

def drop_caches():
    subprocess.run(["sudo", "sh", "-c", "sync; echo 3 > /proc/sys/vm/drop_caches"], capture_output=True)

LOG = "/tmp/storage-lab-server.log"
def serve(extra, cap="none", ctx=4096):
    cmd = [os.path.join(BIN, "llama-server"), "-m", M, "--host", "127.0.0.1", "--port", str(PORT), "-c", str(ctx), "-t", str(NPROC),
           "-np", "1", "--jinja", "--no-ui", "-fa", "on", "--cache-ram", "0"] + extra
    if cap != "none":
        cmd = ["sudo", "systemd-run", "--scope", "--quiet", "-p", f"MemoryMax={cap}", "-p", "MemorySwapMax=0",
               "--setenv", f"LD_LIBRARY_PATH={BIN}"] + cmd
    t0 = time.time()
    p = subprocess.Popen(cmd, env=env, stdout=open(LOG, "w"), stderr=subprocess.STDOUT)
    while time.time() - t0 < 1500:
        if p.poll() is not None: raise RuntimeError(f"server exited ({p.returncode}) — " + open(LOG).read()[-160:].replace("\n", " "))
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): return p, time.time() - t0
        except Exception: time.sleep(0.5)
    stop(p); raise RuntimeError("server did not start")

def stop(p):
    subprocess.run(["sudo", "pkill", "-f", f"llama-server.*--port {PORT}"], capture_output=True)
    try: p.wait(timeout=60)
    except Exception: p.kill()
    time.sleep(2)

SYS = ("You are Attune, an assistant on the person's phone. Rules: answer briefly, use the person's language, never invent numbers. " * 45)[:7000]
def chat(q="Say hello in one short sentence.", n=48, cache=True):
    return post("/v1/chat/completions", {"messages": [{"role": "system", "content": SYS}, {"role": "user", "content": q}], "max_tokens": n,
                                         "temperature": 0, "cache_prompt": cache, "chat_template_kwargs": {"enable_thinking": False}})

say(f"## Storage lab: {NAME}")
say(f"{os.path.getsize(M)/1e9:.2f} GB file · {NPROC} cores · RAM {os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_PHYS_PAGES')/1e9:.1f} GB · caps {CAPS}")
r = subprocess.run(["sudo", "systemd-run", "--scope", "--quiet", "-p", "MemoryMax=300M", "-p", "MemorySwapMax=0", "python3", "-c", "b=bytearray(600*1024*1024); print('NOT CAPPED')"], capture_output=True, text=True)
say(f"Cap check (a 600 MB allocation under a 300 MB cap): {'cap works — the process was killed' if 'NOT CAPPED' not in r.stdout else 'CAP DOES NOT WORK HERE'} (exit {r.returncode})")
say()

# ---- 1 ----
say("### 1. Copied into RAM vs mapped from storage (cold start: file cache dropped first)")
say("| Weights | Cap | Load s | RSS after load MB | First answer s | Writing t/s | Peak RSS MB | Storage reads (major faults) |")
say("|---|---|---|---|---|---|---|---|")
for cap in CAPS:
    for label, extra in [("copied (--load-mode none)", ["--load-mode", "none"]), ("mapped (mmap)", ["--load-mode", "mmap"])]:
        drop_caches()
        try:
            p, load = serve(extra + ["-ctk", "q8_0", "-ctv", "q8_0"], cap)
            pid = server_pid(); a = stats(pid)
            t0 = time.time(); r1 = chat(); first = time.time() - t0
            r2 = chat("Write four sentences about cranes.", n=96, cache=True)
            b = stats(pid)
            say(f"| {label} | {cap} | {load:.1f} | {a[0]} | {first:.1f} | {r2.get('timings', {}).get('predicted_per_second', 0):.2f} | {b[1]} | {b[2]} |")
            stop(p)
        except Exception as e:
            say(f"| {label} | {cap} | failed: {str(e)[:110]} | | | | | |")
            subprocess.run(["sudo", "pkill", "-f", f"port {PORT}"], capture_output=True); time.sleep(2)
say()

# ---- 2 ----
say("### 2. Context length vs memory (copied weights, no cap)")
say("| Context | KV cache | RSS after load MB | Reading t/s (4k-token prompt) | Writing t/s |"); say("|---|---|---|---|---|")
LONG = " ".join(f"Line {i}: the crane at site {i % 17} lifted {i * 3 % 50} tonnes on day {i % 28 + 1}." for i in range(330))
for ctx in [8192, 32768, 65536, 131072]:
    for kv in ["q8_0", "q4_0"]:
        try:
            p, _ = serve(["--load-mode", "none", "-ctk", kv, "-ctv", kv], "none", ctx)
            a = stats(server_pid())
            r = post("/v1/chat/completions", {"messages": [{"role": "user", "content": LONG + "\nWhich site lifted the most on day 5? Answer in one line."}],
                                              "max_tokens": 32, "temperature": 0, "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": False}})
            t = r.get("timings", {})
            say(f"| {ctx//1024}k | {kv} | {a[0]} | {t.get('prompt_per_second', 0):.1f} ({t.get('prompt_n', 0)} tok) | {t.get('predicted_per_second', 0):.2f} |")
            stop(p)
        except Exception as e:
            say(f"| {ctx//1024}k | {kv} | failed: {str(e)[:100]} | | |")
            subprocess.run(["sudo", "pkill", "-f", f"port {PORT}"], capture_output=True); time.sleep(2)
say()

# ---- 3 ----
say("### 3. Prompt cache on storage: save -> restart -> restore -> same document, new question")
slots = tempfile.mkdtemp(prefix="slots")
def raw(prompt, n): return post("/completion", {"prompt": prompt, "n_predict": n, "temperature": 0, "cache_prompt": True})
DOC = "Document:\n" + LONG + "\n\nQuestion: "
say("| Way | Saved MB | Fresh read ms (tokens) | Restore ms | After restore: tokens read (ms) | Faster? |"); say("|---|---|---|---|---|---|")
for label, n_save in [("old: saved after an answer (prompt + reply)", 16), ("prefix only: saved right after reading (n_predict 0)", 0)]:
    try:
        p, _ = serve(["--load-mode", "none", "-ctk", "q8_0", "-ctv", "q8_0", "--slot-save-path", slots], "none", 8192)
        raw(DOC, n_save); post("/slots/0?action=save", {"filename": "s.bin"})
        size = os.path.getsize(os.path.join(slots, "s.bin")) / 1e6
        cold = raw(DOC + "Which site lifted the most on day 5?", 16).get("timings", {})
        stop(p)
        p, _ = serve(["--load-mode", "none", "-ctk", "q8_0", "-ctv", "q8_0", "--slot-save-path", slots], "none", 8192)
        t0 = time.time(); post("/slots/0?action=restore", {"filename": "s.bin"}); rest = (time.time() - t0) * 1000
        warm = raw(DOC + "Which site lifted the most on day 5?", 16).get("timings", {})
        stop(p)
        tot = rest + warm.get("prompt_ms", 0)
        say(f"| {label} | {size:.1f} | {cold.get('prompt_ms', 0):.0f} ({cold.get('prompt_n', 0)}) | {rest:.0f} | {warm.get('prompt_n', '?')} ({warm.get('prompt_ms', 0):.0f}) | {'yes, ' + str(round(cold.get('prompt_ms', 1) / max(tot, 1), 1)) + 'x' if tot < cold.get('prompt_ms', 0) else 'NO'} |")
    except Exception as e:
        say(f"| {label} | failed: {str(e)[:120]} | | | | |")
        subprocess.run(["sudo", "pkill", "-f", f"port {PORT}"], capture_output=True); time.sleep(2)
shutil.rmtree(slots, ignore_errors=True)
if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open(f"storage-{NAME}.md", "w").write("\n".join(out) + "\n")
