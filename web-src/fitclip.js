/* ---- Fit & Food: the photo fast path (v6.10) ------------------------------------------------------------------------
   Ali: "I want the photo recognition to be as fast as Yazio". The chat model needs 20–60 s to look at a photo; this
   needs about a second and no chat model at all:
     1. a small image encoder (int8, ≈ 85 MB, downloaded once like the food pack) turns the photo into one vector;
     2. the name bank (tools/build_food_clip_bank.py) holds one vector per food — every food of the table, Egyptian
        dishes first, Food-101 and common international dishes, and a few "not food" names;
     3. a dot product per name ranks them; the best one goes into the meal with its calories at once, the next ones
        are the one-tap "Is it:" alternatives.
   Measured on real photos (tools/eval_food_clip.py): Food-101 top-1 69 %, top-5 88 % against the whole bank;
   Middle-Eastern home plates 51 % / 73 %. Above AUTO (0.5) the first answer was right 85 % of the time.
   Below it — or for "not food" — the usual chain runs (the chat model when it can see, the note, search).
   Pure logic here (tests/unit/v622fitclip.test.mjs); loading the runtime is the last section. */
import * as F from "./fit.js";
import { unknownItem } from "./fitphoto.js";

export const AUTO = 0.5;          // the first answer's share at or above this → taken as the answer (85 % right on Food-101, measured)
export const LOGIT_SCALE = 100;   // the encoder's own temperature
export const CLIP_BASE = "https://github.com/alydibiky/attune-/releases/download/food-clip-v1/";

/** The bank file → what ranking needs: unit vectors (dequantised from int8) and the per-name bias already weighted. */
export function parseBank(j) {
  if (!j || !j.items || !j.vec || !j.dim) throw new Error("bank");
  const n = j.items.length, dim = j.dim;
  const raw = typeof j.vec === "string" ? b64bytes(j.vec) : j.vec;
  const q = new Int8Array(raw.buffer, raw.byteOffset, n * dim);
  const vec = new Float32Array(n * dim);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const sc = j.scale ? j.scale[i] : 1;
    for (let d = 0; d < dim; d++) { const v = q[i * dim + d] * sc; vec[i * dim + d] = v; s += v * v; }
    const inv = 1 / Math.sqrt(s || 1);
    for (let d = 0; d < dim; d++) vec[i * dim + d] *= inv;
  }
  const w = j.biasWeight || 0;
  const bias = new Float32Array(n);
  if (j.bias && w) for (let i = 0; i < n; i++) bias[i] = w * (j.bias[i] || 0);
  return { n, dim, vec, bias, image: j.image || { size: 224, mean: [0.48145466, 0.4578275, 0.40821073], std: [0.26862954, 0.26130258, 0.27577711] },
    items: j.items.map(([kind, id, en, ar]) => ({ kind, id, en, ar })), file: j.file || "food-clip-vision.onnx" };
}
function b64bytes(s) {
  if (typeof atob === "function") { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  return new Uint8Array(Buffer.from(s, "base64"));
}

/** The centred square of a w×h photo (the encoder looks at a square). */
export function centerSquare(w, h) {
  const s = Math.min(w, h);
  return { sx: Math.floor((w - s) / 2), sy: Math.floor((h - s) / 2), s };
}

/** RGBA pixels (size×size, from a canvas) → the encoder's input: channels first, scaled and normalised. */
export function toTensor(rgba, size, mean, std) {
  const n = size * size, out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = (rgba[i * 4] / 255 - mean[0]) / std[0];
    out[n + i] = (rgba[i * 4 + 1] / 255 - mean[1]) / std[1];
    out[2 * n + i] = (rgba[i * 4 + 2] / 255 - mean[2]) / std[2];
  }
  return out;
}

/** A photo's vector → the k best names: [{i, score, p}] (p = its share of the softmax over the whole bank). */
export function rank(bank, emb, k = 5) {
  const { n, dim, vec, bias } = bank;
  let norm = 0; for (let d = 0; d < dim; d++) norm += emb[d] * emb[d];
  const inv = 1 / Math.sqrt(norm || 1);
  const sc = new Float32Array(n);
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    let s = 0; const o = i * dim;
    for (let d = 0; d < dim; d++) s += vec[o + d] * emb[d];
    sc[i] = s * inv - bias[i];
    if (sc[i] > max) max = sc[i];
  }
  let sum = 0; for (let i = 0; i < n; i++) sum += Math.exp(LOGIT_SCALE * (sc[i] - max));
  const order = Array.from(sc.keys()).sort((a, b) => sc[b] - sc[a]).slice(0, k);
  return order.map((i) => ({ i, score: sc[i], p: Math.exp(LOGIT_SCALE * (sc[i] - max)) / sum }));
}

/** A bank entry → a food the meal screen can use (a table food, or a dish estimated from one), or null (found by name / not food). */
export function entryFood(e) {
  if (!e || (e.kind !== "id" && e.kind !== "like")) return null;
  const fd = F.food(e.id); if (!fd) return null;
  return e.kind === "id" ? fd : { ...fd, en: e.en, ar: e.ar || fd.ar, names: [e.en, e.ar].filter(Boolean), like: fd.id };
}

/** How much of a food one plate usually holds: its first portion (plate, piece, bowl…), else 100 g — same as picking it in search. */
export function defaultItem(fd) {
  const unit = Object.keys(fd.portions || {})[0] || "g";
  return F.itemFromFood(fd, unit === "g" ? 100 : 1, unit);
}

/**
 * The ranking → what the meal screen shows.
 *   {status: "auto"}     the first answer is sure enough: it is the meal item, the others are its alternatives
 *   {status: "guess"}    not sure: the same item, but the usual chain should try to do better first
 *   {status: "notfood"}  a face, a page, a label… → the usual chain
 * The item is an ordinary draft item (conf = the dot colour, alts = "Is it:" chips, base = the portion buttons).
 */
export function decide(bank, ranked, auto = AUTO) {
  if (!ranked || !ranked.length) return { status: "notfood", items: [] };
  const top = bank.items[ranked[0].i];
  if (top.kind === "not") return { status: "notfood", items: [], top };
  const alts = F.uniqAlts(ranked.map((r) => entryFood(bank.items[r.i])).filter(Boolean).map((fd) => ({ label: fd.en, food: fd })));   // v6.12: no "Fried egg · Fried egg"
  const p = ranked[0].p, conf = Math.round(Math.min(0.99, Math.max(0.3, p)) * 100) / 100;
  const status = p >= auto ? "auto" : "guess";
  const fd = entryFood(top);
  let item;
  if (fd) {
    const base = defaultItem(fd);
    item = { ...base, said: top.en, conf, alts, base: base.grams, fast: true, ...(top.kind === "like" ? { estimate: true, like: fd.like } : {}) };
  } else {
    item = { ...unknownItem(top.en, null, { ar: top.ar }), conf, alts, fast: true };
  }
  return { status, items: [item], top, p };
}

// ---- the runtime: onnxruntime-web (wasm, one thread) from the downloaded files ------------------------------------------------
let loading = null;
/** Loads the runtime, the encoder and the bank from `base` (a folder the WebView can read). Once per app run. */
export function loadClip(base, { fetchImpl = (u) => fetch(u), win = typeof window !== "undefined" ? window : null } = {}) {
  if (loading) return loading;
  loading = (async () => {
    if (!win) throw new Error("no window");
    // tests: window.__attuneClipTest = {bank, embed(url) → vector} stands in for the runtime + encoder; ranking and the rest are the real code
    if (win.__attuneClipTest) return { test: win.__attuneClipTest, bank: parseBank(win.__attuneClipTest.bank) };
    if (!win.ort) await new Promise((ok, bad) => {
      const s = win.document.createElement("script"); s.src = base + "ort.wasm.min.js"; s.onload = ok; s.onerror = () => bad(new Error("runtime"));
      win.document.head.appendChild(s);
    });
    const ort = win.ort;
    ort.env.wasm.wasmPaths = base; ort.env.wasm.numThreads = 1; ort.env.wasm.proxy = false;
    const bank = parseBank(await (await fetchImpl(base + "food-clip-bank.json")).json());
    const session = await ort.InferenceSession.create(base + bank.file, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return { ort, bank, session };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
export function resetClip() { loading = null; }

/** A photo (a data: or blob: URL) → its pixels, centre square, size×size. */
export function photoPixels(url, size, doc = document) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      const { sx, sy, s } = centerSquare(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const c = doc.createElement("canvas"); c.width = size; c.height = size;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      g.drawImage(img, sx, sy, s, s, 0, 0, size, size);
      ok(g.getImageData(0, 0, size, size).data);
    };
    img.onerror = () => bad(new Error("photo"));
    img.src = url;
  });
}

/** The whole fast look: photo → ranking. ≈ 0.1 s on a desktop core; a phone ≈ 0.3–1 s after the first load. */
export async function classify(clip, url, k = 5) {
  const { ort, bank, session } = clip, sz = bank.image.size;
  if (clip.test) return rank(bank, await clip.test.embed(url), k);
  const px = await photoPixels(url, sz);
  const x = new ort.Tensor("float32", toTensor(px, sz, bank.image.mean, bank.image.std), [1, 3, sz, sz]);
  const out = await session.run({ [session.inputNames[0]]: x });
  return rank(bank, out[session.outputNames[0]].data, k);
}
