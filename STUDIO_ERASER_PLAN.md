# Studio like the Honor Gallery — eraser + fast pictures (research 18 Oct 2026, batch 4 of BUILD_PLAN_2026-10-18.md)

Ali: "remove people easily, smooth, generates images easily without making the phone hotter, without internet, for free".
Licences checked on the model pages (commercial use must be allowed). Timings = Qualcomm AI Hub, Snapdragon 8 Elite NPU.

## Eraser (tap → gone in under a second)
- **Tap to select:** MediaPipe MagicTouch (Interactive Segmenter, 6.2 MB tflite, Apache-2.0, ~67 ms GPU)
  https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite —
  then MobileSAM (Apache-2.0; encoder 26.6 MB once per photo ~0.4 s NPU, decoder 23.7 MB ~3 ms per tap) for clean edges.
- **Fill the hole:** LaMa-Dilated (Apache-2.0, 174 MB fp32, ~42 ms NPU; TFLite/ONNX/QNN) https://huggingface.co/qualcomm/LaMa-Dilated.
  Fallback for other chips: MI-GAN (MIT code + weights, 28 MB ONNX) https://huggingface.co/andraniksargsyan/migan.
- **Remove all people:** MediaPipe person detector / selfie-multiclass (Apache-2.0) → boxes → MobileSAM decoder. Not YOLO (AGPL).
- Avoid: MAT, EdgeSAM (non-commercial), ML Kit subject segmentation (Play services only, no tap).
- Pipeline: crop around the mask with a margin → 512 → inpaint → blend back at full size; dilate/feather the mask 8–15 px.

## Fast generation
- **SD 1.5 w8a16 on the NPU** (OpenRAIL-M, commercial OK, pass its use rules to users): UNet 58 ms/step → 512×512, 20 steps ≈ 1.5–3 s,
  barely warm. Prebuilt QNN context binaries for "8 Elite Gen5" on AI Hub (built for the Samsung edition — must be tried on the Honor).
- Next: SDXS-512-DreamShaper (openrail++, 1 step, < 0.5 s estimated) via our own AI Hub export.
- FLUX.2 klein on CPU (today) stays as an optional "high quality, slow" mode.
- Not: SD/SDXL-Turbo (Stability licence: revenue cap + registration), MobileDiffusion (no weights).

## Runtime
- LiteRT 2.3.0 (`litert` 7.6 MB, `litert-gpu` 4.7 MB, `litert-npu-runtime-qualcomm` 0.5 MB) — same family as LiteRT-LM; NPU → GPU → CPU.
- ONNX Runtime QNN (`onnxruntime-android-qnn` 1.29.0 + qnn-runtime, trim to HTP v81) for SD.
- Models as downloadable packs (not in the APK); arm64 only.
- Unknowns to test on the phone: Galaxy-labelled binaries on Honor's SM8850; whether MagicOS lets apps use the Hexagon NPU
  (the v6.35 NPU log says why it failed — fix that first).
