#!/usr/bin/env python3
"""Which file of the same model reads and writes fastest on a phone-like ARM CPU without getting worse? (v6.30)
Ali's log (HONOR, 8 Elite Gen 5): Core Lite (Qwen3.5 4B IQ4_XS) read a prompt at only 26 tokens/s, and the engine said
"kleidiai: kernels available for Q4_0 and Q8_0". So: the same model in several formats, the engine built like the app's
(KleidiAI on), 4 threads like a phone.
  python3 tests/models/quant_bench.py <llama.cpp bin dir> <dir with Qwen3.5-4B-*.gguf> <text file> Q8_0 IQ4_XS Q4_0 ...
The first quant is the reference (near lossless). For each: size, prompt reading t/s (512 tokens), writing t/s (128),
and how far its answers drift from the reference: mean KL divergence and how often the top word is the same.
Writes quant-bench.md and appends to $GITHUB_STEP_SUMMARY."""
import os, re, subprocess, sys, json

BIN, DIR, TEXT, REF, QUANTS = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
env = dict(os.environ, LD_LIBRARY_PATH=BIN)
f = lambda q: os.path.join(DIR, f"Qwen3.5-4B-{q}.gguf")
out = []
def say(s=""): print(s, flush=True); out.append(s)

def bench(q, threads):
    r = subprocess.run([os.path.join(BIN, "llama-bench"), "-m", f(q), "-p", "512", "-n", "128", "-t", str(threads), "-r", "2", "-o", "json"],
                       env=env, capture_output=True, text=True, timeout=3600)
    pp = tg = 0.0
    try:
        for row in json.loads(r.stdout):
            if row.get("n_prompt", 0) > 0 and row.get("n_gen", 0) == 0: pp = row["avg_ts"]
            if row.get("n_gen", 0) > 0 and row.get("n_prompt", 0) == 0: tg = row["avg_ts"]
    except Exception:
        say(f"(llama-bench {q}: {r.stderr[-300:]})")
    return pp, tg

def kld(q, base):
    args = [os.path.join(BIN, "llama-perplexity"), "-m", f(q), "-f", TEXT, "-c", "512", "-t", str(os.cpu_count()), "--chunks", "40"]
    args += ["--kl-divergence-base", base] + ([] if q == REF else ["--kl-divergence"])
    r = subprocess.run(args, env=env, capture_output=True, text=True, timeout=7200)
    s = r.stdout + r.stderr
    mean = re.search(r"Mean\s+KLD:\s+([0-9.]+)", s); top = re.search(r"Same top p:\s+([0-9.]+)", s)
    ppl = re.search(r"Final estimate: PPL = ([0-9.]+)", s) or re.search(r"Mean PPL\(Q\)\s*:\s*([0-9.]+)", s)
    if q != REF and not mean: say(f"(perplexity {q}: {s[-300:]})")
    return (float(mean.group(1)) if mean else None, float(top.group(1)) if top else None, float(ppl.group(1)) if ppl else None)

say("## Same model, different files: speed on ARM (KleidiAI on) and drift from the 8-bit file")
say(f"CPU: {subprocess.run(['sh', '-c', 'lscpu | grep -E \"Model name|Flags\" | head -2'], capture_output=True, text=True).stdout.strip()[:300]}")
base = "/tmp/kld-base.bin"
kld(REF, base)
say("| File | Size GB | Reading t/s (4 threads) | Reading t/s (6 threads) | Writing t/s (4 threads) | Mean KLD vs 8-bit (lower = closer) | Same top word |")
say("|---|---|---|---|---|---|---|")
for q in [REF] + QUANTS:
    pp4, tg4 = bench(q, 4); pp6, _ = bench(q, 6)
    m, top, _ = kld(q, base) if q != REF else (0.0, 100.0, None)
    say(f"| {q} | {os.path.getsize(f(q))/1e9:.2f} | {pp4:.1f} | {pp6:.1f} | {tg4:.1f} | {m if m is not None else '?'} | {top if top is not None else '?'}% |")
say()
say("Phone reading speed scales with these numbers; a bigger KLD means the answers drift further from the full model.")
if os.environ.get("GITHUB_STEP_SUMMARY"): open(os.environ["GITHUB_STEP_SUMMARY"], "a").write("\n".join(out) + "\n")
open("quant-bench.md", "w").write("\n".join(out) + "\n")
