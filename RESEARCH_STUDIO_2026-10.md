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

## Qwen-Image 2.1 in plain words (Oct 2026)
- **What it is:** an open picture model (Apache-style open weights) built from three parts: a 7-billion-parameter "drawing" network
  (a single-stream diffusion transformer, 32 layers — text and picture pieces go through the same layers together), a
  **Qwen3-VL 8B** language-and-vision model that reads the prompt (and reference photos), and its own colour decoder (VAE).
  Native 2K pictures, text rendering, transparent pictures, editing with up to 10 reference images. On the chart Ali saw it
  scores 60.3, next to GPT Image 1.5 (59.7) and Nano Banana 2.0 (59.8); GPT Image 2 is 64.7.
- **Why it writes text well:** the prompt is read by a full 8B language model (not a small CLIP encoder) and the drawing
  network attends to every prompt token at every layer, so spelling and layout of words survive; it was also trained on
  lots of posters/signs, including Chinese — Arabic is untested and must be measured before promising it.
- **What it could give the app later:** "edit my photo" by instruction, product pictures from a few photos of the item
  (multi-reference), signs/posters/menus with real words, transparent stickers/logos.
- **Engine support:** our pinned stable-diffusion.cpp (88411ef) already has it (docs/qwen_image_2.1.md exists at that
  commit): `--diffusion-model qwen_image_2.1-Q4_0.gguf --llm Qwen3VL-8B-Instruct-Q4_K_M.gguf --vae qwen_image_2.1_vae_bf16.safetensors
  --sampling-method euler --fa`, cfg 6 at ~20+ steps; 4-step accelerators exist (alibaba-pai Fun-Acc-4Step LoRA; a merged
  4-step "viggle turbo" GGUF), cfg 1.
- **Files:** DiT Q4_0 4.20 GB (Q4_K 4.6, Q8_0 7.6), text reader Q4_K_M 5.03 GB, VAE 0.68 GB → ~9.9 GB download.
- **Memory plan for 12 GB devices:** the engine loads weights lazily, can memory-map them (`--mmap`) and can keep a model
  on storage and read it when used (`--params-backend te=disk`, already used by the app in low-memory mode). The text reader
  runs once per picture, then the DiT runs the steps, then the VAE decodes (`--vae-tiling`). So only one big part needs
  to be in RAM at a time; the lab measures peak memory inside 12 GB and 8 GB cages with no swap.
- **Can the app's chat model be the text reader?** No: it must be exactly the Qwen3-VL 8B the model was trained with;
  a different Qwen3 / Qwen3.5 chat GGUF gives wrong conditioning (same family, different weights).
- **Desktop builds:** CUDA / Vulkan / Metal builds of the engine run it in seconds-to-tens-of-seconds with 8–24 GB of
  graphics memory (`--offload-to-cpu` and `--max-vram` let smaller cards stream weights); that is for the desktop shell.
- Sources: github.com/leejet/stable-diffusion.cpp/blob/master/docs/qwen_image_2.1.md, huggingface.co/leejet/Qwen-Image-2.1-GGUF,
  huggingface.co/Comfy-Org/Qwen-Image-2.1, huggingface.co/alibaba-pai/Qwen-Image-2.1-Fun-Acc-LoRAs,
  huggingface.co/Abiray/Qwen-Image-2.1-viggle-4-steps-turbo-GGUF.

## Fast preview (engine feature found)
The pinned engine can write a preview picture during drawing: `--preview tae --preview-path p.png --preview-interval 1`
(tiny-decoder preview of each step). The app could show it within seconds and swap in the final picture.
