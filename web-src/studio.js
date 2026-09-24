/* ---- Studio: pictures drawn on the phone ------------------------------------------------
   The model packs, the picture sizes, and the two things that make a small
   picture model look good: a rich English description (written from a short
   idea — in any language — by the chat model), and a ×4 sharpening pass.      */

export const STUDIO_KEY = "attune:studio:v1";

// FLUX.2 [klein] 4B (Black Forest Labs, Apache-2.0): 4 steps per picture,
// 1024 px, photo-real, and it can also EDIT a photo from an instruction.
// Its text reader is Qwen3 4B; the VAE is FLUX.2's. All three: Apache-2.0.
export const PACKS = {
  "klein-4b": {
    id: "klein-4b", kind: "draw", label: "FLUX.2 klein 4B", sizeGB: 5.29, needRam: 8, license: "Apache-2.0",
    defaults: { steps: 4 },
    quality: "Current photo quality in 4 steps: people, places, products and text in pictures. Also edits a photo you give it (“make it night”, “remove the car”).",
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
    id: "klein-4b-hq", kind: "draw", label: "FLUX.2 klein 4B · high quality", sizeGB: 7.13, needRam: 12, license: "Apache-2.0",
    defaults: { steps: 4 },
    quality: "The best pictures this phone can make: the 8-bit build of FLUX.2 klein — finer detail, cleaner faces, hands and text. Also edits your photos by instruction.",
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
/** The drawing pack to use: an installed one (high quality first), else the one to offer for this phone. */
export function drawPack(info) {
  if (packReady(info, "klein-4b-hq")) return { id: "klein-4b-hq", ready: true };
  if (packReady(info, "klein-4b")) return { id: "klein-4b", ready: true };
  return { id: info && info.ramGB >= 12 ? "klein-4b-hq" : "klein-4b", ready: false };
}

export function loadStudio() { try { const v = JSON.parse(localStorage.getItem(STUDIO_KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
export function saveStudio(list) { try { localStorage.setItem(STUDIO_KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {} }
