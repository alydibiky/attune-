# Making every model stronger without making it heavier — research, 3 Oct 2026

Status: research notes plus the measurements that could be run in this session. The CI container was shared
with another 4B llama-server using all 4 cores, so local runs were ~5x slower than usual and only category
subsets could be measured. Treat numbers here as small-sample.

## (a) Quantisation per tier
- Gemma 4 (Blaze/Blaze+/Sense/Zenith+): the official QAT checkpoints re-quantised as Unsloth "UD-Q4_K_XL" are the
  best quality per GB. Reported E2B mean KLD 0.0017 vs 0.051 for a naive Q4_0 of the QAT weights, and ~20% smaller.
  Unsloth ships only that one file because higher precisions of a QAT model are *worse*, so do not move Gemma
  QAT tiers to Q5/Q6/Q8. Source: https://unsloth.ai/docs/models/gemma-4/qat ,
  https://github.com/unslothai/unsloth/discussions/7270
- Non-QAT families (Qwen 3.5/3.6): imatrix K-quants (Q4_K_M) or UD-Q4_K_XL beat Q4_0 at the same size.
  For 0.8B-2B tiers the quality cliff below Q5 is steeper; Q6_K/Q8_0 of a 0.8B is ~0.6-0.9 GB and fits the
  55%-of-RAM rule on any 4 GB+ phone, so the smallest tiers should ship Q6_K/Q8_0, not Q4.
  Source: https://unsloth.ai/docs/models/qwen3.5
- Action: check each MODEL_TIERS url: Gemma tiers -> "-qat-" UD-Q4_K_XL; Spark (0.8B) -> Q8_0; Glow (2B) -> Q6_K
  where RAM allows (needs Ali's OK: bigger download).

## (b) Sampling and templates the model makers publish
| Family | Mode | temp | top_p | top_k | min_p | presence |
|---|---|---|---|---|---|---|
| Qwen 3.5 | non-thinking, general | 0.7 | 0.8 | 20 | 0 | 1.5 |
| Qwen 3.5 | non-thinking, reasoning | 1.0 | 0.95 | 20 | 0 | 1.5 |
| Qwen 3.5 | thinking, coding | 0.6 | 0.95 | 20 | 0 | 0 |
| Qwen 3.5 | thinking, general | 1.0 | 0.95 | 20 | 0 | 1.5 |
| Gemma 4 | all | 1.0 | 0.95 | 64 | - | - |
Sources: https://huggingface.co/Qwen/Qwen3.5-4B , https://unsloth.ai/docs/models/qwen3.5 ,
https://unsloth.ai/docs/models/gemma-4
- boost.js already uses the makers' top_p/top_k but lower temperature plus min_p 0.05-0.1 (deliberate: graded
  facts/maths favour low temperature; vendor numbers are tuned for open-ended benchmarks). The app's thinking
  settings (0.6/0.95/20/0) match the Qwen coding-thinking row exactly.
- The one vendor setting the app does not use is Qwen's presence_penalty 1.5, which Qwen recommends mainly
  against endless repetition in small quantised models. Measured below.

## (c) Cheap test-time compute
- Self-consistency (majority of N samples) gives +1-3 points on GSM8K-type maths for ~3B models but costs N x the
  time, and a 2026 study finds it *hurts* small models on hard science questions where the majority is wrong
  (https://arxiv.org/pdf/2608.11403). On a phone at ~10 tok/s, N=3 on a 300-token answer is 90 s: only worth it
  as an opt-in "double-check" for short numeric answers. Cheaper and already in the app: program-aided maths
  (verify.js runs Python) which is the stronger, deterministic check for 2-10B models.
- Confidence-based early stopping (DeepConf, https://arxiv.org/pdf/2508.15260) cuts voting cost by stopping
  once the first answers agree; recommended form for the app: run 2, stop if they agree, run a 3rd only if not.
- Self-verification/correction (SETS, https://arxiv.org/html/2501.19306v3) saturates quickly; one verify pass
  (already in verify.js / reason.js) is the right budget.

## (d) Speculative decoding
- Qwen 3.5/3.6 have MTP heads trained in (our q*mtp.gguf builds); llama.cpp `--spec-type draft-mtp`.
- Gemma 4 E2B/E4B official "assistant" drafters (Gemma4AssistantForCausalLM) are supported in llama.cpp since
  PR #24282 (8 Jun 2026); phone reports show ~48% acceptance with n-draft 3 and only +1-2 tok/s
  (https://aiweekly.co/alerts/llamacpp-adds-gemma-4-e2be4b-mtp-assistant-support,
  https://github.com/ggml-org/llama.cpp/discussions/22735). Check whether the pinned commit 7ab4ee7 includes it
  before relying on it; Blaze tiers run on LiteRT anyway.
- ngram/lookup speculation is free and helps code edits and document Q&A where output copies input.

## (e) Arabic / Egyptian Arabic
- DialectalArabicMMLU (LREC 2026): Fanar-1-9B-Instruct scores 84.2% on Egyptian vs Falcon-H1-7B 63.5% and
  Gemma-3-12B 36.0% (https://aclanthology.org/2026.lrec-1.251/). Fanar is the strongest Egyptian model at
  Zenith size, but check its licence (Fanar has a custom licence) before shipping.
- Falcon-H1-Arabic 7B tops OALL among ~10B models (71.5%) — hybrid Mamba architecture; verify llama.cpp support
  at the pinned commit. (https://www.promptquorum.com/local-llms/best-arabic-local-llms-2026)
- Prompt tricks: telling the model the dialect explicitly plus one short Egyptian example sentence is the
  cheapest proven lever; the app's language rule already names the dialect.

## (f) Fine-tuning on Ali's PC (RTX 3050 8 GB, 16 GB RAM)
- QLoRA of a 2-4B model needs ~4-6 GB VRAM at 2k sequence length with Unsloth; feasible on the 3050
  (https://unsloth.ai/docs/get-started/fine-tuning-for-beginners/unsloth-requirements).
- Plan: base = the Glow/Core model; data = 2-5k Egyptian-Arabic instruction pairs (e.g. translated + rewritten
  app tasks, crane/business Q&A written from Ali's own documents, plus a public Egyptian dialect set), LoRA r=16,
  1-2 epochs, ~2-4 h; merge, convert to GGUF, quantise with an imatrix from the same data.
  Expected gain: noticeable dialect fluency and domain vocabulary; little change to reasoning. Always re-run
  tests/trials/full.mjs to catch forgetting.

## (g) Newer models
- Not tested here; candidates to evaluate in the model-lab workflow: Falcon-H1-Arabic 7B (Arabic), Fanar 9B
  (licence check), Qwen 3.6 small sizes if released with GGUF.

## Measurements in this session
All on GitHub ARM runners (ubuntu-24.04-arm, 4 cores, the phone's chip family), pinned llama.cpp 7ab4ee7,
`-c 8192 -fa on -ctk q8_0 -ctv q8_0`. The local container was shared with other agents' servers (0.3 tok/s), so
nothing local was usable. Workflow: `.github/workflows/model-lab.yml`, `only=quant` (full test + peak RSS) and
`only=codebench` (coding loop, hidden tests). Peak RSS = the whole llama-server process (weights + 8k KV + buffers).

### Quality per GB — full test (173 cases, 15 categories), one run each
| Model file | File GB | Peak RSS MB | Score | write tok/s |
|---|---|---|---|---|
| 0.8B Q4_K_M (catalogue) | 0.55 | 1302 | 134/173 (77%) | 43.8 |
| 0.8B Q6_K | 0.66 | 1501 | 140/173 (81%) | 35.2 |
| 0.8B Q8_0 | 0.83 | 1830 | 135/173 (78%) | 58.6 |
| 2B UD-Q4_K_XL (catalogue) | 1.38 | 2844 | 155/173 (90%) | 20.9 |
| 2B Q6_K | 1.63 | 3292 | 158/173 (91%) | 15.6 |
| 2B Q8_0 | 2.08 | 4124 | 157/173 (91%) | 29.1 |
| 4B Q4_K_M (catalogue Core) | 2.83 | 5753 | 167/173 (97%) | 10.9 |
| 4B Q5_K_S (catalogue Core+) | 3.12 | 6292 | 165/173 (95%) | 8.8 |

Reading: within one run the noise is about ±3 cases (Q8_0 of the 0.8B scored *below* Q6_K). No higher quant gives
a clear win: the biggest gap (0.8B Q6_K +6 cases) costs +200 MB RSS and 20% speed and is not confirmed by Q8_0.
The 4B Q5_K_S (Core+) is NOT better than Q4_K_M here (165 vs 167) while using +540 MB and writing 20% slower —
Core+ is a candidate for removal (decision for Ali). Q8_0 writes faster than Q6_K/Q4 on ARM for small models
(simpler dequantisation), at much more memory. **Decision: keep the catalogue quants.**

### Sampling (FULL_SAMPLING), same files
| Variant | Score |
|---|---|
| 4B Q4_K_M, app defaults | 167/173 |
| 4B + presence_penalty 1.5 | 163/173 |
| 4B + vendor non-thinking set (0.7 / 0.8 / 20 / min_p 0 / presence 1.5) | 165/173 |
| 2B UD-Q4_K_XL, app defaults | 155/173 |
| 2B + presence_penalty 1.5 | 154/173 |
**Decision: keep the app's sampling (no presence penalty).**
