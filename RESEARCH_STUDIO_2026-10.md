# Studio research — faster, better pictures on a phone (Oct 2026)

Goal: beat today's Turbo (SD 2.1-turbo q4, CLIP 31.2, 63 s / 512px on a 4-core ARM runner) on prompt match and/or time.
Engine: stable-diffusion.cpp pinned at 88411ef (same in the app and in `.github/workflows/studio-lab.yml`).

## What the field says (sources at the end)
| Idea | What it is | Expected effect on our engine |
|---|---|---|
| TAESD / TAESDXL (`--taesd`) | Tiny decoder replacing the full VAE decode | Decode is a large share of a 4-step SD2.1 picture on CPU; TAESD cuts it several-fold, small softness cost |
| Fewer steps (Turbo 1–2) | SD-turbo is adversarially distilled for 1–4 steps | ~linear time saving in the UNet part; quality drop to measure |
| SDXL-Turbo q4 | Bigger UNet (2.6B) distilled for 1–4 steps at 512px | Better prompt match/detail, 2–3× slower per step |
| SDXL-Lightning / Hyper-SDXL / DMD2 | 4-step SDXL distillations; DMD2 reports FID 19.3 vs Lightning 24.5 at 4 steps | Same cost as SDXL-Turbo but trained for 1024px (too slow on CPU); DMD2 is the best of these if SDXL is adopted |
| SD1.5 + Hyper-SD / LCM LoRA | 4-step LoRA on the small 0.9B UNet | Similar cost to SD2.1-turbo, older base, weaker prompt match expected |
| SANA-Sprint 0.6B/1.6B | 1–4 step consistency-distilled linear-attention DiT | Not supported by sd.cpp at our pin (no SANA architecture) — cannot test without a new engine |
| FLUX.2 klein 4B | 4-step distilled, Qwen3-4B text encoder | Already measured: CLIP 32.9 but 464 s; sd.cpp issue #1215 reports it ~5× slower than ComfyUI on GPU |
| Z-Image-Turbo 6B | 8-step | CLIP 33.5, 1952 s — not phone-viable on CPU |
| SnapGen / MobileDiffusion | Purpose-built mobile models (≈1 s on phone NPU) | Weights not released in a form sd.cpp loads |
| Qwen-Image Lightning | 4-step, 20B | Far too big for a phone |
| Prompt enhancer | Expand short prompt with an LLM, or add a fixed quality suffix | Papers find strong LLM expansion helps, weak LLMs can hurt; measure. Cheap variant: fixed suffix |
| Small upscaler (ESRGAN-type) | Draw 384/512, upscale ×2 | sd.cpp supports `--upscale-model` (ESRGAN); cheaper than drawing at 768+ |
| GPU on Android | sd.cpp Vulkan / OpenCL | Local-Diffusion (sd.cpp on Android) reports Vulkan ~2× SLOWER than CPU; OpenCL only for Adreno 7xx with Q4_0. Honor phones are mostly Mali → stay on CPU |
| Flash attention, VAE tiling | `--diffusion-fa`, `--vae-tiling` | Memory savings; small speed gain on CPU |

## Measured on the Studio lab (ARM 4-core, 512px, 5 prompts, CLIP ViT-B/32)
Runs: 37106087635 (baseline), 37141391984, and a second run for the suffix and 1-step entries.
Results: the "Studio image models — measured" table in PLANS_2026-10-02.md. Headline: tiny decoder on Turbo 63 s → 37 s with CLIP 31.2 → 32.1 (adopted); SDXL-Turbo q4 1 step + tiny XL decoder CLIP 33.4 in 18 s (best overall; 3.9 GB, Ali to decide). The app already has an LLM prompt enhancer (studio.js enhanceMessages); a fixed suffix gave +0.4 CLIP (noise level), not adopted.

## Sources
- stable-diffusion.cpp acceleration paper: https://arxiv.org/html/2412.05781
- Local-Diffusion (sd.cpp on Android; Vulkan/OpenCL notes): https://github.com/rmatif/Local-Diffusion
- FLUX.2 klein slowness in sd.cpp: https://github.com/leejet/stable-diffusion.cpp/issues/1215
- SANA-Sprint: https://huggingface.co/Efficient-Large-Model/Sana_Sprint_0.6B_1024px
- DMD2: https://arxiv.org/html/2405.14867v1 ; few-step comparison: https://www.baseten.co/blog/comparing-few-step-image-generation-models/
- Hyper-SD: https://stable-diffusion-art.com/hyper-sdxl/ ; SDXL-Lightning: https://www.felixsanz.dev/articles/sdxl-lightning-quick-look-and-comparison
- SnapGen: https://pith.science/paper/2412.09619 ; MobileDiffusion: https://research.google/blog/mobilediffusion-rapid-text-to-image-generation-on-device/
- Prompt extension with LLMs (strong helps, weak can hurt): https://arxiv.org/pdf/2406.05814 ; ELLA: https://arxiv.org/html/2403.05135v1
- TAESD: https://huggingface.co/madebyollin/taesd
