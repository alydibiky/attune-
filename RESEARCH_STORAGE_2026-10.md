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

## Measurements (ARM runner, 4 cores, run https://github.com/alydibiky/attune-/actions/runs/37141630061)

### 1. Copied vs mapped weights under a hard memory cap (cold start, context 4k, KV q8)
| Model (file) | Weights | Cap | RSS after load MB | Peak MB | Writing t/s | Storage reads (major faults) |
|---|---|---|---|---|---|---|
| Qwen3.5 4B Q4_K_M (2.74 GB) | copied | none | 3353 | 3581 | 10.33 | 126 |
| | mapped | none | 5441 | 5669 | 10.29 | 126 |
| | copied | 4 GB | 3353 | 3581 | 10.40 | 132 |
| | mapped | 4 GB | 4079 | 4090 | 10.40 | 484 |
| | copied | 3 GB | **killed** | | | |
| | mapped | 3 GB | 3047 | 3069 | **6.52** | 14529 |
| Gemma 4 E4B Q4_0 (4.59 GB) | copied | none | 5253 | 5393 | 11.05 | 125 |
| | mapped | none | 7355 | 7509 | 11.09 | 125 |
| | copied | 5 GB | **killed** | | | |
| | mapped | 5 GB | 5106 | 5113 | **10.82** | 411 |
| | copied / mapped | 3 GB | killed / killed | | | |

Reading: "mapped" RSS looks bigger without a cap because the CPU backend repacks most weights into its own memory
and the file pages stay cached too — but those file pages are reclaimable, so under a cap the mapped model fits
where the copy is killed. Gemma E-models gain most (their per-layer embedding table is only looked up, so it can stay
on storage): full speed under a cap 0.3 GB below the copied peak. Below that, speed falls (4B at 3 GB: 63 %).
**Implemented:** Engine starts a model up to 12 % over the copy budget mapped instead of refusing it (mappedFallback).
Copied stays the default (MagicOS drops mapped pages eagerly, which made 20 words/s fall below 1 on Ali's phone).

### 2. Context length vs memory (copied, 7.4k-token prompt)
| Model | 8k q8 | 8k q4 | 32k q8 | 32k q4 | 64k q8 | 64k q4 | 128k q8 | 128k q4 | Reading t/s q8 / q4 |
|---|---|---|---|---|---|---|---|---|---|
| Qwen3.5 4B (hybrid) MB | 3421 | 3357 | 3829 | 3573 | 4374 | 3862 | 5465 | 4441 | 26.3 / 25.6 |
| Gemma 4 E4B (sliding window) MB | 5287 | 5234 | 5491 | 5342 | 5763 | 5486 | 6307 | 5774 | 27.0 / 26.1 |

Reading: long input is cheap on both families: 8k→128k costs +2.0 GB (4B) / +1.0 GB (E4B) with the 8-bit cache,
+1.1 GB / +0.5 GB with the 4-bit cache, and reading speed does not change (−3 % with q4). The app's phone context
is 4–16k, where q4 saves only 50–250 MB → not switched; a "long input" mode (64k on a 12 GB phone) should use q4.

### 3. Prompt cache on storage (ARM): NO reuse after restore on either family
| Model | Saved | Live follow-up | After restart + restore |
|---|---|---|---|
| Qwen3.5 4B | 183 MB | 13 tokens re-read | all 7,454 re-read (284 s), both ways |
| Gemma 4 E4B | 76 MB | 10 tokens re-read | all 7,455 re-read (277 s), both ways |


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

### Other candidates (from sources; not measured here)
- **(d) LoRA / skill adapters** (`--lora file.gguf`, `--lora-scaled`): llama.cpp applies an adapter on top of the
  base at load time; a rank-16 adapter for a 4B model is ~30–60 MB. There are almost no public GGUF adapters for the
  current hybrid 3.5-family models, and adapters are tied to one exact base file. A cheap training plan on Ali's
  RTX 3050 8 GB: QLoRA (4-bit base, rank 16, seq 2k) on a 2–4B model fits in 8 GB with Unsloth/PEFT; 1–3 h for
  ~5k Egyptian-Arabic chat pairs; convert with `convert_lora_to_gguf.py`. Expected gain: style/dialect (Egyptian
  Arabic 4/6 → better) — not facts (packs do facts far better per MB, see above). Measure before shipping.
- **(b) speed packs**: the app already ships MTP heads (+17 MB on the 0.8B file, +~90 MB on the 4B Q4_K_M: 2.74 → 2.83 GB) and a 0.8B draft
  (0.55 GB). Measured earlier (HANDOFF): MTP/draft gains depend on acceptance; draft is auto-off below 0.6 acceptance.
- **(f) image packs** (Studio lab, same ARM runner, see PLANS_2026-10-02.md): tiny decoder +10 MB: 63 → 37 s and
  CLIP 31.2 → 32.1 (adopted); SDXL-Turbo q4 + tiny XL decoder, 1 step: 3.94 GB, 18 s, CLIP 33.4 (Ali to decide; ~6 GB RAM).
- **(g) Android storage facts**: models live in app-private storage (`filesDir`), removed with the app, no permission
  needed; free space via `StatFs(filesDir).availableBytes` (DeviceInfo already reads it). Rules for a download:
  refuse when free − size < 1.5 GB (Android slows down and may fail updates below ~1 GB free); show
  "Attune uses X GB" split by model / photo reader / packs / caches; caches (slot files, thumbnails) are deletable in
  one tap; Android's own "Clear cache" only wipes `cacheDir`, so packs/models must not live there.
