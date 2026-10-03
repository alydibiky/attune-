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
