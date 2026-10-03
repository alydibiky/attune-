/* ---- Studio: pictures drawn on the phone ------------------------------------------------
   The model packs, the picture sizes, and the two things that make a small
   picture model look good: a rich English description (written from a short
   idea — in any language — by the chat model), and a ×4 sharpening pass.      */

export const STUDIO_KEY = "attune:studio:v1";

// FLUX.2 [klein] 4B (Black Forest Labs, Apache-2.0): 4 steps per picture,
// 1024 px, photo-real, and it can also EDIT a photo from an instruction.
// Its text reader is Qwen3 4B; the VAE is FLUX.2's. All three: Apache-2.0.
export const PACKS = {
  // v5.28 — Ali: "13 minutes on the CPU and nothing was created". The 4B picture model needs
  // a working graphics chip; on a phone CPU one picture takes 10–20+ minutes. Turbo is a
  // small distilled model (SD-Turbo, one file, 2 steps at 512 px): about a minute on the
  // CPU, seconds on a graphics chip. It is used by itself whenever the graphics chip isn't
  // working. Several links are listed: one that doesn't exist (404) moves on to the next.
  // Licence: Stability AI Community License (free for commercial use under $1M a year).
  "turbo": {
    id: "turbo", kind: "draw", label: "Studio Turbo", sizeGB: 2.2, needRam: 4, license: "Stability AI Community",
    defaults: { steps: 4, cfg: 1 }, side: 512, fast: true,   // v5.33: 4 steps — sharper, still about a minute on the CPU
    quality: "Fast pictures on any phone: about a minute without a graphics chip, seconds with one. 512 px — great for ideas, drafts and posts.",
    files: [
      { role: "model", what: "fast picture model", name: "studio-turbo.gguf", approx: 2352000000,
        url: "https://huggingface.co/gpustack/stable-diffusion-v2-1-turbo-GGUF/resolve/main/stable-diffusion-v2-1-turbo-Q4_0.gguf",
        urls: [
          "https://huggingface.co/gpustack/stable-diffusion-v2-1-turbo-GGUF/resolve/main/stable-diffusion-v2-1-turbo-Q4_0.gguf",
          "https://huggingface.co/gpustack/stable-diffusion-v2-1-turbo-GGUF/resolve/main/stable-diffusion-v2-1-turbo-Q8_0.gguf",
          "https://huggingface.co/gpustack/stable-diffusion-xl-1.0-turbo-GGUF/resolve/main/stable-diffusion-xl-1.0-turbo-Q4_1.gguf",
        ] },
      // v6.19 — tiny colour decoder: Studio lab (4-core ARM, 512 px) 63 s → 37 s a picture,
      // prompt match (CLIP) 31.2 → 32.1. 10 MB, MIT.
      { role: "taesd", what: "fast colour decoder", name: "taesd.safetensors", size: 9793292,
        url: "https://huggingface.co/madebyollin/taesd/resolve/main/diffusion_pytorch_model.safetensors" },
    ],
  },
  // v6.19 — Ali (Option A): an optional faster AND better pack for phones with 8 GB or more.
  // SDXL-Turbo (4-bit, one file) drawn in ONE step with the tiny SDXL colour decoder.
  // Studio lab (4-core ARM CPU, 512 px): prompt match (CLIP) 33.4 vs Turbo's 32.1, 18 s vs 37 s.
  // Working name "Turbo+" — the name is Ali's to choose. Licence: Stability AI Community.
  "turbo-xl": {
    id: "turbo-xl", kind: "draw", label: "Studio Turbo+", sizeGB: 3.95, needRam: 8, license: "Stability AI Community",
    defaults: { steps: 1, cfg: 1 }, side: 512, fast: true,
    quality: "Faster and sharper than Turbo, with a better match to what you ask for: about 20 seconds a picture on the CPU. 512 px. For phones with 8 GB RAM or more.",
    files: [
      { role: "model", what: "fast picture model (XL)", name: "studio-turbo-xl.gguf", size: 3940010720,
        url: "https://huggingface.co/gpustack/stable-diffusion-xl-1.0-turbo-GGUF/resolve/main/stable-diffusion-xl-1.0-turbo-Q4_0.gguf" },
      { role: "taesd", what: "fast colour decoder (XL)", name: "taesdxl.safetensors", size: 9793292,
        url: "https://huggingface.co/madebyollin/taesdxl/resolve/main/diffusion_pytorch_model.safetensors" },
    ],
  },
  "klein-4b": {
    id: "klein-4b", kind: "draw", label: "Studio Pro", sizeGB: 5.29, needRam: 8, license: "Apache-2.0",
    defaults: { steps: 4 },
    quality: "The best photo quality: people, places, products and text in pictures, 1024 px. Also edits a photo you give it (“make it night”, “remove the car”). Needs a working graphics chip — on the CPU a picture takes 10–20 minutes.",
    files: [
      { role: "diffusion", what: "drawing model", name: "flux-2-klein-4b-Q4_0.gguf", size: 2460378560,
        url: "https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q4_0.gguf" },
      { role: "llm", what: "text reader", name: "Qwen3-4B-Q4_K_M.gguf", size: 2497281312,
        url: "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf" },
      { role: "vae", what: "colour decoder", name: "flux2-vae.safetensors", size: 336211292,
        url: "https://huggingface.co/Comfy-Org/flux2-klein-4B/resolve/main/split_files/vae/flux2-vae.safetensors" },
    ],
  },
  // The same model at 8-bit: visibly finer detail, skin, text and edges than
  // 4-bit (image models lose more to 4-bit than chat models do). For phones
  // with 12 GB or more — Studio picks it for them.
  "klein-4b-hq": {
    id: "klein-4b-hq", kind: "draw", label: "Studio Pro HD", sizeGB: 7.13, needRam: 12, license: "Apache-2.0",
    defaults: { steps: 4 },
    quality: "Studio Pro at full precision: finer detail, cleaner faces, hands and text. Also edits your photos by instruction. Needs a working graphics chip and 12 GB RAM.",
    files: [
      { role: "diffusion", what: "drawing model (8-bit)", name: "flux-2-klein-4b-Q8_0.gguf", size: 4300629440,
        url: "https://huggingface.co/leejet/FLUX.2-klein-4B-GGUF/resolve/main/flux-2-klein-4b-Q8_0.gguf" },
      { role: "llm", what: "text reader", name: "Qwen3-4B-Q4_K_M.gguf", size: 2497281312,
        url: "https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf" },
      { role: "vae", what: "colour decoder", name: "flux2-vae.safetensors", size: 336211292,
        url: "https://huggingface.co/Comfy-Org/flux2-klein-4B/resolve/main/split_files/vae/flux2-vae.safetensors" },
    ],
  },
  // Real-ESRGAN ×4 (BSD-3): 1024 px → 4096 px, sharper edges and textures.
  "esrgan-x4": {
    id: "esrgan-x4", kind: "upscale", label: "Real-ESRGAN ×4", sizeGB: 0.07, license: "BSD-3-Clause",
    quality: "Makes a finished picture four times bigger and sharper — for printing or zooming in.",
    files: [{ role: "upscaler", what: "sharpening model", name: "RealESRGAN_x4plus.pth", size: 67040989,
      url: "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth" }],
  },
};

export const SIZES = [
  { id: "square", label: "Square", w: 1024, h: 1024 },
  { id: "portrait", label: "Portrait", w: 832, h: 1216 },
  { id: "landscape", label: "Landscape", w: 1216, h: 832 },
  { id: "quick", label: "Quick draft", w: 512, h: 512 },
];

const VERB = /^(?:please\s+)?(?:can you\s+|could you\s+)?(draw|paint|sketch|illustrate|imagine|generate|create|make|render|design)\b(?:\s+me)?\s*/i;
const THING = /\b(image|picture|photo|photograph|drawing|illustration|logo|poster|wallpaper|painting|artwork|sketch|render|icon|banner|cover)\b/i;
const AR = /^(?:من فضلك\s+|لو سمحت\s+)?(ارسم(?:لي)?|ارسملي|تخيل(?:لي)?|صمم(?:لي)?|اعمل(?:لي)?\s+(?:صورة|رسمة|لوجو|بوستر)|اعملي\s+(?:صورة|رسمة)|عايز\s+(?:صورة|رسمة)|ولّد\s+صورة|انشئ\s+صورة|أنشئ\s+صورة)/;

/** "draw a crane at sunset" / "ارسم ونش وقت الغروب" → a picture request. */
export function looksLikeImageRequest(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 400) return false;
  if (AR.test(t)) return true;
  if (/^(draw|paint|sketch|illustrate)\b/i.test(t)) return !/\b(conclusion|diagram of the code|up a (plan|contract)|a line under)\b/i.test(t);
  const m = t.match(VERB);
  return !!(m && THING.test(t.slice(0, 80)) && !/\b(of (this|the) (code|text|table|data)|chart of|graph of|spreadsheet)\b/i.test(t));
}

/** The subject of a picture request, without "draw me a picture of". */
export function pictureSubject(text) {
  let t = String(text || "").trim();
  t = t.replace(AR, "").trim();
  t = t.replace(VERB, "");
  t = t.replace(/^(?:an?\s+|the\s+)?(?:\w+\s+)?(image|picture|photo|photograph|drawing|illustration|painting|render|artwork)\s+(of|showing|with)\s+/i, "");
  t = t.replace(/^(?:an?\s+)?(image|picture|photo|drawing|illustration)\s*[:,-]?\s*/i, "");
  return t.replace(/^[:,\-–\s]+/, "").trim() || String(text || "").trim();
}

/** Ask the chat model for a rich English description (the picture model reads English best). */
export function enhanceMessages(idea) {
  return [
    { role: "system", content: "You write descriptions for an image generator. Turn the user's idea (in any language) into ONE English description of 40 to 70 words: the subject, what it is doing, the setting, the light, the camera or art style, colours and mood. Photorealistic unless the idea asks for another style. Keep every detail the user gave (names, text to show, colours, numbers). Reply with the description only — no quotes, no lists, no preface." },
    { role: "user", content: String(idea || "").trim() },
  ];
}

/** Tidy what the model wrote: one paragraph, no quotes, no "Here is…". */
export function cleanPrompt(s, fallback) {
  let t = String(s || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  t = t.replace(/^(here(?:'s| is)[^:\n]*:|description:|prompt:)\s*/i, "").replace(/^["“'`]+|["”'`]+$/g, "").replace(/\s+/g, " ").trim();
  if (t.length < 12 || t.length > 1200) return String(fallback || "").trim();
  return t;
}

export function packReady(info, id) { return !!(info && (info.packs || []).some((p) => p.id === id)); }
const GPU_KEY = "attune:studio:gpu";
/** Does the graphics chip work for pictures? true / false / null (not known yet). Remembered between runs. */
export function gpuWorks(info) {
  const st = info && info.gpuState;
  try { if (st) localStorage.setItem(GPU_KEY, st); } catch (e) {}
  let k = st;
  if (!k) { try { k = localStorage.getItem(GPU_KEY) || ""; } catch (e) { k = ""; } }
  return k === "gpu" ? true : k === "cpu" ? false : null;
}
const PRO = ["klein-4b-hq", "klein-4b"];
/**
 * The drawing pack to use. `choice`: what the person picked ("turbo" | "pro" | null).
 * Without a working graphics chip the Pro model takes 10–20 minutes a picture, so Turbo is
 * used (or offered) unless the person chose Pro. Editing a photo needs Pro.
 * → { id, ready, why? }
 */
export function drawPack(info, choice = null, mode = "create") {
  const ready = (id) => packReady(info, id);
  const pro = PRO.find(ready);
  const proOffer = info && info.ramGB >= 12 ? "klein-4b-hq" : "klein-4b";
  if (mode === "edit") return pro ? { id: pro, ready: true } : { id: proOffer, ready: false };
  if (choice === "pro") return pro ? { id: pro, ready: true } : { id: proOffer, ready: false };
  if (choice === "turbo") return { id: "turbo", ready: ready("turbo") };
  // Turbo+ only on phones with enough memory (8 GB or more); otherwise it falls back to Turbo
  const xlOk = !!(info && info.ramGB >= PACKS["turbo-xl"].needRam);
  if (choice === "turbo-xl" && xlOk) return { id: "turbo-xl", ready: ready("turbo-xl") };
  const fast = xlOk && ready("turbo-xl") ? "turbo-xl" : "turbo";
  const gpu = gpuWorks(info);
  if (gpu === false) return { id: fast, ready: ready(fast), why: "cpu" };
  if (pro) return { id: pro, ready: true };
  if (ready(fast)) return { id: fast, ready: true };
  return { id: gpu === true ? proOffer : "turbo", ready: false };
}
/** The size to draw at: Turbo draws at 512 px on its long side (what it was trained for). */
export function drawSize(packId, sz) {
  const p = PACKS[packId];
  if (!p || !p.side) return { w: sz.w, h: sz.h };
  const k = p.side / Math.max(sz.w, sz.h);
  return { w: Math.max(256, Math.round(sz.w * k / 64) * 64), h: Math.max(256, Math.round(sz.h * k / 64) * 64) };
}

export function loadStudio() { try { const v = JSON.parse(localStorage.getItem(STUDIO_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
export function saveStudio(list) { try { localStorage.setItem(STUDIO_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {} }
