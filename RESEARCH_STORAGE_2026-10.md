# Storage, memory and long-input research (Oct 2026)

Branch `storage-lab-research`. Repeatable: `.github/workflows/storage-lab.yml` → `tests/models/storage_lab.py`
(ARM runner, 4 cores, 16 GB; small phones simulated with a cgroup v2 cap: `sudo systemd-run --scope -p MemoryMax=… -p MemorySwapMax=0`).

## Findings from sources
- **Why the earlier lab saw NO reuse after slot restore**: for hybrid/recurrent (Qwen3.5/3.6 Gated DeltaNet) and SWA (Gemma)
  models the server can only rewind the state using *context checkpoints*, and `/slots save` does not persist them
  (llama.cpp issues #25913, #28194; PR #26004 not in our pinned commit). The old lab saved the slot *after an answer*, so the
  next prompt diverged from the saved tokens (the reply) → rewind needed → no checkpoint → full re-read.
  **Fix without engine changes:** save the slot right after reading the shared prefix only (`n_predict: 0`), so the next
  request only *extends* the state and needs no rewind. Measured in section 3 below.
- MoE expert streaming from flash: mainline has only mmap; a dedicated streamer is an open PR (#25294) / discussion #27149
  (Qwen3-30B-A3B ~4.7 t/s in ~2 GB on a laptop SSD in a prototype). Not in our pinned engine.
- KV q8_0 ≈ lossless; q4_0 adds small quality loss but halves KV again. On hybrid models only the ~1/4 full-attention layers
  hold a KV cache, so long context is cheap there.

## Measurements
(filled from CI run https://github.com/alydibiky/attune-/actions/runs/37141630061)

## Storage boost — measured (branch `storage-boost`)

### Knowledge pack + on-device retrieval (tests/trials/factpack.mjs, 104 code-graded questions: 40 Egypt, 35 cranes/engineering, 29 general; 20 asked in Egyptian Arabic over an English pack)
Pack = 97 short passages, 8.7 KB. Retrieval = top 3 passages put in the system prompt. Local x86 run, 0.8B model (Q8_0, 0.53 GB).

| Retriever | Extra storage | Right passage in top 3 | 0.8B answers correct | Egypt | Cranes | General | Arabic qs |
|---|---|---|---|---|---|---|---|
| none (model alone) | 0 | – | **31/104** | 3/40 | 15/35 | 13/29 | 2/20 |
| word index (docqa words, BM25-style) | 0 (index ≈ pack size) | 85/104 | **84/104** | 29 | 31 | 24 | 3 |
| small multilingual embedder (e5-small, 384-d, Q8_0, 132 MB, MIT) | 132 MB | 58/104 | not run (retrieval too weak) | | | | |
| multilingual embedder bge-m3 (1024-d, Q4_K_M, 438 MB, MIT) | 438 MB (+~1 KB per passage at 8-bit) | **104/104** | **99/104** | 39 | 33 | 27 | 17 |

Reading: a pack turns a 0.8B model from 30% to 95% right on facts the pack holds. Word matching cannot cross languages
(Arabic question → English passage: 3/20); the embedder fixes that (17/20). The 438 MB embedder is the single best
"GB → gain" buy for fact questions — but only for facts that are IN a pack. (Sources: bge-m3 https://huggingface.co/BAAI/bge-m3 (MIT),
GGUF https://huggingface.co/gpustack/bge-m3-GGUF; e5-small https://huggingface.co/intfloat/multilingual-e5-small (MIT).)
Pack content sources: Wikipedia text is CC BY-SA 4.0 (attribution + share-alike → the pack must carry the licence and credits;
fine for a free download). en/ar.wikipedia.org are blocked from this sandbox; the HF dataset `wikimedia/wikipedia` (parquet,
same licence) is the build source for a real pack. Egyptian laws: official texts are public-domain-like government works but
there is no clean machine-readable source — a pack needs manual curation. Crane manuals are copyrighted by makers → only the
person's own manuals ("my documents" pack).

### Persisted prompt cache (slot save → restart → restore), local, hybrid 0.8B, 7.4k-token document
`tests/models/prefix_cache_local.py`. Slot save/restore works with `--no-slots` (only `--slot-save-path` is needed).

| Way | Saved file | Same-process follow-up (no restart) | After restart + restore |
|---|---|---|---|
| saved after an answer | 69 MB | re-read 13 tokens | **re-read all 7,454 tokens** (98 s) |
| prefix only (n_predict 0) | 69 MB | re-read 13 tokens | **re-read all 7,454 tokens** (102 s) |

Result: on hybrid (recurrent-state) models the pinned engine cannot reuse a restored slot at all — even the prefix-only
trick fails, because the server always rewinds at least one token and a recurrent state cannot rewind without the
in-memory context checkpoints that are not saved (llama.cpp #25913/#28194; fix needs an engine bump, PR #26004).
**Not implemented.** In-process reuse (cache_prompt / --cache-reuse, already on) works: follow-ups re-read 13 tokens, not 7.4k.
Ask-a-PDF already sends only ~1.2k tokens of retrieved excerpts per question, so it never needs a 7k-token re-read.

### RAM levers, local x86 (shared, noisy 4 cores), 4B hybrid Q4_K_M + MTP head (2.83 GB file), context 8k
`tests/models/ram_levers.py` — one switch at a time from the app's defaults; peak RSS split into anonymous (cannot be reclaimed) and file-mapped.

| Lever | Peak RSS MB | Anon MB | File-mapped MB | Reading t/s | Writing t/s |
|---|---|---|---|---|---|
| app default (copied, KV q8, fa on, ub 512) | 3118 | 3103 | 15 | 24.2 | 2.68* |
| mapped weights (mmap) | 4540 | 1909 | 2630 | 27.5 | 5.78 |
| KV q4_0 | 3054 | 3039 | 15 | 27.5 | 6.07 |
| KV f16 | 3235 | 3220 | 15 | 31.9 | 6.20 |
| flash attention off (KV f16) | 3350 | 3335 | 15 | 31.6 | 6.06 |
| ubatch 128 / batch 512 | 3047 | 3032 | 15 | 27.4 | 5.56 |
| ubatch 1024 / batch 2048 | 3213 | 3198 | 15 | 27.3 | 5.60 |
| context ×4 (32k) | 3546 | 3531 | 15 | 27.3 | 6.29 |
| 2 threads | 3118 | 3103 | 15 | 14.9 | 3.73 |
(*first run of the series, machine busy.)

Reading: on hybrid models the weights ARE the RAM bill (peak ≈ file + 0.3 GB at 8k). KV q4 saves only 64 MB at 8k
(only ~1/4 of layers keep KV); 32k context costs +430 MB with q8. **mmap is worse here**: the CPU backend repacks
the weights into an anonymous buffer (1.9 GB) while the file pages stay mapped too (2.6 GB) — so "mapped" does not
save RAM unless repacking is off for that quant. Smaller ubatch saves ~70 MB. ARM numbers from the CI run decide.
