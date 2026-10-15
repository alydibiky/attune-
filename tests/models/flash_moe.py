#!/usr/bin/env python3
"""Flash-MoE lab — Ali (15 Oct 2026): "make Everest XL run on a phone by using the storage instead of RAM".
   python3 tests/models/flash_moe.py <model.gguf> <llama.cpp bin dir> <name> [caps, e.g. "none,10G,8G,6G,4G"]

Everest = Qwen3.6 35B-A3B, a mixture-of-experts model: 35B parameters stored, only ~3B used for each word. So the idea is to keep
the file on the phone's storage (mapped, --load-mode mmap) and let the OS keep only the experts in use in RAM. This measures, on an
ARM runner with hard memory caps that act like phones (cgroup v2, no swap):
  - the storage itself: sequential and random-chunk read speed (to scale the result to a phone's UFS 4 storage)
  - for each cap: load time, first answer, WRITING speed (cold, then warm), READING speed (a ~1,500-token prompt),
    resident memory, reads from storage (major page faults), and with/without the CPU backend's weight repacking
  - a 6-question sanity check of the answers (a low-bit file can go wrong): maths, facts, Arabic
Writes flash-<name>.md and appends to $GITHUB_STEP_SUMMARY."""
import sys, os, json, time, subprocess, urllib.request, random

M, BIN, NAME = sys.argv[1], sys.argv[2], sys.argv[3]
CAPS = (sys.argv[4] if len(sys.argv) > 4 else "none,10G,8G,6G,4G").split(",")
NPROC = os.cpu_count() or 4
PORT = 8131
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
out = []
def say(s=""): print(s, flush=True); out.append(s)

def post(path, body, timeout=2400):
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

HELP = subprocess.run([os.path.join(BIN, "llama-server"), "--help"], env=env, capture_output=True, text=True).stdout
HAS_NOREPACK = "--no-repack" in HELP

LOG = "/tmp/flash-lab-server.log"
def serve(extra, cap="none", ctx=4096):
    cmd = [os.path.join(BIN, "llama-server"), "-m", M, "--host", "127.0.0.1", "--port", str(PORT), "-c", str(ctx), "-t", str(NPROC),
           "-np", "1", "--jinja", "--no-ui", "-fa", "on", "--cache-ram", "0", "-ctk", "q8_0", "-ctv", "q8_0", "--load-mode", "mmap"] + extra
    if cap != "none":
        cmd = ["sudo", "systemd-run", "--scope", "--quiet", "-p", f"MemoryMax={cap}", "-p", "MemorySwapMax=0",
               "--setenv", f"LD_LIBRARY_PATH={BIN}"] + cmd
    t0 = time.time()
    p = subprocess.Popen(cmd, env=env, stdout=open(LOG, "w"), stderr=subprocess.STDOUT)
    while time.time() - t0 < 2400:
        if p.poll() is not None: raise RuntimeError(f"server exited ({p.returncode}) — " + open(LOG).read()[-200:].replace("\n", " "))
        try:
            if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health", timeout=2).read(): return p, time.time() - t0
        except Exception: time.sleep(0.5)
    stop(p); raise RuntimeError("server did not start")

def stop(p):
    subprocess.run(["sudo", "pkill", "-f", f"llama-server.*--port {PORT}"], capture_output=True)
    try: p.wait(timeout=60)
    except Exception: p.kill()
    time.sleep(2)

def chat(q, n=200, think=False):
    return post("/v1/chat/completions", {"messages": [{"role": "user", "content": q}], "max_tokens": n, "temperature": 0,
                                         "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": think}})

say(f"## Flash-MoE lab: {NAME}")
size = os.path.getsize(M)
say(f"{size/1e9:.2f} GB file · {NPROC} cores · RAM {os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_PHYS_PAGES')/1e9:.1f} GB · caps {CAPS} · --no-repack available: {HAS_NOREPACK}")

# ---- the storage itself ----
drop_caches()
t0 = time.time(); n = 0
with open(M, "rb", buffering=0) as f:
    while n < 2_000_000_000:
        b = f.read(8 << 20)
        if not b: break
        n += len(b)
seq = n / (time.time() - t0) / 1e6
drop_caches()
rnd = random.Random(7); CH = 2_600_000; t0 = time.time(); n = 0
with open(M, "rb", buffering=0) as f:
    for _ in range(300):
        f.seek(rnd.randrange(0, size - CH)); n += len(f.read(CH))
rch = n / (time.time() - t0) / 1e6
say(f"Storage: sequential {seq:.0f} MB/s · random 2.6 MB chunks (≈ one expert of one layer) {rch:.0f} MB/s. "
    "(A flagship phone's UFS 4 storage reads ~3,000–4,000 MB/s sequential.)")
say()

# ---- speed under caps ----
PROMPT = " ".join(f"Line {i}: the crane at site {i % 17} lifted {i * 3 % 50} tonnes on day {i % 28 + 1}." for i in range(110))
say("### Speed and memory with the weights read from storage (mmap), cold start")
say("| Cap | Repack | Load s | First answer s | Writing t/s (cold) | Writing t/s (warm) | Reading t/s (~1.5k tokens) | Peak RSS MB | Storage reads (major faults) |")
say("|---|---|---|---|---|---|---|---|---|")
variants = [("default", [])] + ([("off", ["--no-repack"])] if HAS_NOREPACK else [])
for cap in CAPS:
    for vname, vextra in variants:
        if vname == "off" and cap not in ("8G", "6G"): continue
        drop_caches()
        try:
            p, load = serve(vextra, cap)
            pid = server_pid()
            t0 = time.time(); chat("Say hello in one short sentence.", n=16); first = time.time() - t0
            r1 = chat("Write a short paragraph about why cranes need outriggers.", n=200)
            r2 = chat("Write a short paragraph about safe lifting in strong wind.", n=200)
            r3 = post("/v1/chat/completions", {"messages": [{"role": "user", "content": PROMPT + "\nWhich site lifted the most on day 5? One line."}],
                                               "max_tokens": 24, "temperature": 0, "cache_prompt": False, "chat_template_kwargs": {"enable_thinking": False}})
            b = stats(pid)
            t1, t2, t3 = r1.get("timings", {}), r2.get("timings", {}), r3.get("timings", {})
            say(f"| {cap} | {vname} | {load:.0f} | {first:.1f} | {t1.get('predicted_per_second', 0):.2f} | {t2.get('predicted_per_second', 0):.2f} | "
                f"{t3.get('prompt_per_second', 0):.1f} ({t3.get('prompt_n', 0)} tok) | {b[1]} | {b[2]} |")
            stop(p)
        except Exception as e:
            say(f"| {cap} | {vname} | failed: {str(e)[:140]} | | | | | | |")
            subprocess.run(["sudo", "pkill", "-f", f"port {PORT}"], capture_output=True); time.sleep(2)
say()

# ---- are the answers still right? (the smallest cap that ran is used, like a phone) ----
QS = [("What is 17 × 23? Answer with the number only.", ["391"]),
      ("What is the capital of Egypt? One word.", ["cairo", "القاهرة"]),
      ("A crane lifts 12 tonnes at 10 m radius. Moment in tonne-metres? Number only.", ["120"]),
      ("ما عاصمة السعودية؟ أجب بكلمة واحدة.", ["الرياض"]),
      ("If 3 workers build a wall in 6 days, how many days for 9 workers at the same rate? Number only.", ["2"]),
      ("Translate to English: «السيارة سريعة جدا»", ["car", "fast"])]
cap = next((c for c in reversed(CAPS) if c != "none"), "none")
for c in [cap, "8G", "none"]:
    try:
        drop_caches(); p, _ = serve([], c); ok = 0; rows = []
        for q, want in QS:
            r = chat(q, n=400, think=False)
            a = (r["choices"][0]["message"].get("content") or "").strip().lower()
            good = all(w in a for w in want) if len(want) > 1 and want[0] == "car" else any(w in a for w in want)
            ok += good; rows.append(f"- {'✓' if good else '✗'} {q[:60]} → {a[:80]}")
        stop(p)
        say(f"### Answers under the {c} cap: {ok}/{len(QS)} right")
        for x in rows: say(x)
        break
    except Exception as e:
        say(f"(sanity check under {c} failed: {str(e)[:120]})")
        subprocess.run(["sudo", "pkill", "-f", f"port {PORT}"], capture_output=True); time.sleep(2)

if os.environ.get("GITHUB_STEP_SUMMARY"):
    open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open(f"flash-{NAME}.md", "w").write("\n".join(out) + "\n")
