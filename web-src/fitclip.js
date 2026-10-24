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
export const CLIP_BASE = "https://github.com/alydibiky/attune-/releases/download/food-clip-v2/";   // v6.17: two models (v1 stays for older apps)

/** The bank file → what ranking needs: unit vectors (dequantised from int8) and the per-name bias already weighted. */
export function parseBank(j) {
  if (j && j.v === 2) return parseBank2(j);
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

// ---- v6.17: two image models and the user's own cuisine first ------------------------------------------------------------
// Ali: "53 percent is not accurate at all". Measured on the same 2,316 photos (tools/eval_food_clip.py): CLIP B/32 alone
// 58 % / 51 % / 43 % (Food-101 / Middle-Eastern plates / Arab dishes); CLIP + SigLIP with the user's region first 76 / 56 / 74 %,
// the right dish among the first five 91 / 84 / 88 %; about half the photos are sure enough to log at once, 92 % of those right. Each model's scores are standardised over the whole bank (so the two
// add up fairly), then the dish's country moves it up or down (prior), then a softmax at `temp` gives the confidence.
const ARAB = new Set("eg sa ae ma dz tn lb sy jo iq sd ly kw qa bh om ye ps".split(" "));
/** The country bonus of a bank entry for a user in `cc`: own country +own, same region (the Arab world) +region, a far
 *  cuisine `other` (negative); international dishes, plain foods and Egypt's base table ("base", Egyptian) are neutral or own. */
export function priorOf(entryCc, userCc, prior) {
  if (!prior || !entryCc) return 0;
  const u = String(userCc || "").toLowerCase();
  if (entryCc === "base") return u === "eg" ? prior.own : 0;
  if (["intl", "plain", "not"].includes(entryCc)) return 0;
  if (entryCc === u) return prior.own;
  if (ARAB.has(entryCc) && ARAB.has(u)) return prior.region;
  return prior.other;
}
function dequant(n, dim, b64, scale) {
  const raw = typeof b64 === "string" ? b64bytes(b64) : b64;
  const q = new Int8Array(raw.buffer, raw.byteOffset, n * dim), vec = new Float32Array(n * dim);
  for (let i = 0; i < n; i++) {
    let s = 0; const sc = scale ? scale[i] : 1;
    for (let d = 0; d < dim; d++) { const v = q[i * dim + d] * sc; vec[i * dim + d] = v; s += v * v; }
    const inv = 1 / Math.sqrt(s || 1);
    for (let d = 0; d < dim; d++) vec[i * dim + d] *= inv;
  }
  return vec;
}
function parseBank2(j) {
  if (!Array.isArray(j.items) || !Array.isArray(j.encoders) || !j.encoders.length) throw new Error("bank");
  const n = j.items.length;
  const encoders = j.encoders.map((e) => {
    if (!e.vec || !e.dim || !e.file) throw new Error("bank");
    return { file: e.file, dim: e.dim, output: e.output || "", image: e.image, vec: dequant(n, e.dim, e.vec, e.scale) };
  });
  const first = encoders[0];
  return { v: 2, n, encoders, prior: j.prior || null, temp: j.temp || 2, auto: j.auto || 0.6,
    // the single-model fields keep older callers (and rank) working on the first model
    dim: first.dim, vec: first.vec, bias: new Float32Array(n), image: first.image, file: first.file,
    items: j.items.map(([kind, id, en, ar, cc]) => ({ kind, id, en, ar, cc: cc || "" })) };
}
/** One model's scores for a photo vector, standardised over the bank (mean 0, spread 1). */
export function zScores(vec, n, dim, emb) {
  let norm = 0; for (let d = 0; d < dim; d++) norm += emb[d] * emb[d];
  const inv = 1 / Math.sqrt(norm || 1), sc = new Float32Array(n);
  let m = 0;
  for (let i = 0; i < n; i++) { let s = 0; const o = i * dim; for (let d = 0; d < dim; d++) s += vec[o + d] * emb[d]; sc[i] = s * inv; m += sc[i]; }
  m /= n; let v = 0; for (let i = 0; i < n; i++) v += (sc[i] - m) * (sc[i] - m);
  const sd = Math.sqrt(v / n) || 1;
  for (let i = 0; i < n; i++) sc[i] = (sc[i] - m) / sd;
  return sc;
}
// ---- v6.17: the phone learns from your own photos ------------------------------------------------------------------------
// Each photo meal you save keeps the photo's vectors (int8, ≈ 1.3 KB) with the dish you chose. A new photo that looks like one
// of them (both models' similarity above MEM_TH) moves that dish up. Measured (3 earlier photos of each dish): Arab dishes
// 75 → 92 %, Middle-Eastern plates 54 → 98 %, Food-101 75 → 78 %. Only on this phone; nothing is sent anywhere.
export const MEM_KEY = "attune:fit:photomem", MEM_MAX = 200, MEM_TH = 0.8, MEM_W = 3;
const memKey = (it) => (it.id || "") + "|" + it.en;
function packVec(v) {
  let m = 0; for (const x of v) m = Math.max(m, Math.abs(x));
  const sc = m / 127 || 1, q = new Int8Array(v.length);
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / sc);
  let s = ""; for (let i = 0; i < q.length; i++) s += String.fromCharCode(q[i] & 255);
  return { q: typeof btoa === "function" ? btoa(s) : Buffer.from(q.buffer).toString("base64"), sc };
}
function unpackVec(p) {
  const b = b64bytes(p.q), q = new Int8Array(b.buffer, b.byteOffset, b.length), v = new Float32Array(q.length);
  let n = 0; for (let i = 0; i < q.length; i++) { v[i] = q[i] * p.sc; n += v[i] * v[i]; }
  n = 1 / Math.sqrt(n || 1); for (let i = 0; i < v.length; i++) v[i] *= n;
  return v;
}
export function loadMemory(store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const a = JSON.parse((store && store.getItem(MEM_KEY)) || "[]"); return a.map((m) => ({ key: m.key, v: m.v.map(unpackVec) })); } catch (e) { return []; }
}
/** Remembers this photo as the dish `foodId` / `name` (the bank entry it is). → true when kept. */
export function remember(bank, embs, foodId, name, store = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!bank || bank.v !== 2 || !embs || embs.length !== bank.encoders.length || !store) return false;
  const nm = String(name || "").toLowerCase();
  const it = (nm && bank.items.find((x) => x.kind !== "not" && x.en.toLowerCase() === nm))          // the dish the matcher named (Kibbeh, not the kofta it is estimated from)
    || bank.items.find((x) => foodId && x.kind === "id" && x.id === foodId)                            // or the table food you picked
    || bank.items.find((x) => foodId && x.kind === "like" && x.id === foodId);
  if (!it) return false;
  let a = []; try { a = JSON.parse(store.getItem(MEM_KEY) || "[]"); } catch (e) {}
  a.push({ key: memKey(it), v: embs.map((e) => packVec(Array.from(e))) });
  try { store.setItem(MEM_KEY, JSON.stringify(a.slice(-MEM_MAX))); return true; } catch (e) { return false; }
}
function cosine(a, b) { let s = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return s / Math.sqrt((na || 1) * (nb || 1)); }

/** v2: the photo's vector from each model → the k best names [{i, score, p}], the user's country first. */
export function rankAll(bank, embs, k = 5, userCc = "", memory = null) {
  if (bank.v !== 2) return rank(bank, embs[0], k);
  const { n } = bank, tot = new Float32Array(n);
  bank.encoders.forEach((e, x) => { if (!embs[x]) return; const z = zScores(e.vec, n, e.dim, embs[x]); for (let i = 0; i < n; i++) tot[i] += z[i]; });
  if (bank.prior) for (let i = 0; i < n; i++) tot[i] += priorOf(bank.items[i].cc, userCc, bank.prior);
  if (memory && memory.length) {
    if (!bank.keyIndex) { bank.keyIndex = new Map(); bank.items.forEach((it, i) => bank.keyIndex.set(memKey(it), i)); }
    for (const m of memory) {
      const i = bank.keyIndex.get(m.key); if (i == null || m.v.length !== embs.length) continue;
      let c = 0; for (let x = 0; x < embs.length; x++) c += cosine(m.v[x], embs[x]);
      c /= embs.length;
      if (c > MEM_TH) tot[i] = Math.max(tot[i], tot[i] + MEM_W * (c - MEM_TH) / (1 - MEM_TH));
    }
  }
  let max = -Infinity; for (let i = 0; i < n; i++) if (tot[i] > max) max = tot[i];
  let sum = 0; for (let i = 0; i < n; i++) sum += Math.exp(bank.temp * (tot[i] - max));
  const order = Array.from(tot.keys()).sort((a, b) => tot[b] - tot[a]).slice(0, k);
  return order.map((i) => ({ i, score: tot[i], p: Math.exp(bank.temp * (tot[i] - max)) / sum }));
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
  // v6.19: a dish the app's own table now knows by this exact name wins over an estimate in an older downloaded bank
  // (Ali's phone: the first bank's «eggs with tomatoes» = a tomato, 123 g = 22 kcal; the table says shakshuka)
  { const ex = F.exactFood(e.en); if (ex && ex.id !== e.id) return ex; }
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
export function decide(bank, ranked, auto = (bank && bank.auto) || AUTO) {
  if (!ranked || !ranked.length) return { status: "notfood", items: [] };
  const top = bank.items[ranked[0].i];
  if (top.kind === "not") return { status: "notfood", items: [], top };
  let alts = F.uniqAlts(ranked.map((r) => entryFood(bank.items[r.i])).filter(Boolean).map((fd) => ({ label: fd.en, food: fd })));   // v6.12: no "Fried egg · Fried egg"
  // v7.9 (Ali's mango cake): a dish and a flavour among the guesses → the dish with its flavour ("Mango cake") first
  const comp = F.composeDish(alts);
  if (comp) alts = F.uniqAlts([{ label: comp.food.en, food: comp.food }, ...alts]);
  const p = ranked[0].p, conf = Math.round(Math.min(0.99, Math.max(0.3, p)) * 100) / 100;
  const status = p >= auto ? "auto" : "guess";
  // v6.18: what the person corrected last time (the food they chose, their usual amount) is used for this dish at once
  const lf = F.learned(top.en), lfd = lf ? (F.food(lf.id) || lf.food) : null;
  const fd0 = lfd || entryFood(top), fd = !lfd && comp && fd0 && fd0.id === comp.dishId ? comp.food : fd0;
  let item;
  if (fd) {
    const base = defaultItem(fd), g = lf ? Math.max(1, Math.round(base.grams * lf.ratio)) : base.grams;
    const it0 = g !== base.grams ? F.scaleItem({ ...base, base: base.grams }, g / base.grams) : base;
    item = { ...it0, k: 1, said: top.en, conf, alts, base: g, fast: true, ...(lf ? { learned: true, learnedN: lf.n } : {}), ...(!lfd && top.kind === "like" ? { estimate: true, like: fd.like } : {}) };
  } else {
    item = { ...unknownItem(top.en, null, { ar: top.ar }), conf, alts, fast: true };
  }
  return { status, items: [item], top, p };
}

// ---- the runtime: onnxruntime-web (wasm, one thread) from the downloaded files ------------------------------------------------
let loading = null;
/** v6.19: is today's quiet check for a newer name bank due? (once a day; `store` = localStorage) */
export function updateDue(now = Date.now(), store = typeof localStorage !== "undefined" ? localStorage : null) {
  try { const t = +(store && store.getItem("attune:fit:clipcheck")) || 0; if (now - t < 20 * 3600e3) return false; store && store.setItem("attune:fit:clipcheck", String(now)); return true; } catch (e) { return false; }
}
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
    const opts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
    const sessions = [];
    for (const e of bank.encoders || [{ file: bank.file }]) sessions.push(await ort.InferenceSession.create(base + e.file, opts));   // one after the other: less memory at once
    return { ort, bank, session: sessions[0], sessions };
  })();
  loading.catch(() => { loading = null; });
  return loading;
}
export function resetClip() { loading = null; }

/** A photo (a data: or blob: URL) → its pixels, centre square, size×size. */
export function photoPixels(url, size, doc = document, fit = "crop", region = null) {
  return new Promise((ok, bad) => {
    const img = new Image();
    img.onload = () => {
      // v6.35: a part of the photo (fractions 0–1) — the plate scan looks at each quarter on its own
      const ox = region ? Math.floor(region.x * (img.naturalWidth || img.width)) : 0, oy = region ? Math.floor(region.y * (img.naturalHeight || img.height)) : 0;
      const w = region ? Math.max(1, Math.floor(region.w * (img.naturalWidth || img.width))) : img.naturalWidth || img.width, h = region ? Math.max(1, Math.floor(region.h * (img.naturalHeight || img.height))) : img.naturalHeight || img.height;
      const { sx, sy, s } = fit === "stretch" ? { sx: 0, sy: 0, s: 0 } : centerSquare(w, h);   // SigLIP looks at the whole photo, squeezed
      const c = doc.createElement("canvas"); c.width = size; c.height = size;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
      if (fit === "stretch") g.drawImage(img, ox, oy, w, h, 0, 0, size, size); else g.drawImage(img, ox + sx, oy + sy, s, s, 0, 0, size, size);
      ok(g.getImageData(0, 0, size, size).data);
    };
    img.onerror = () => bad(new Error("photo"));
    img.src = url;
  });
}

/** The whole fast look: photo → ranking. ≈ 0.1 s on a desktop core; a phone ≈ 0.3–1 s after the first load. */
export async function classify(clip, url, k = 5, userCc = F.getCountry ? F.getCountry() : "", memory = loadMemory()) {
  const { ort, bank, session } = clip, sz = bank.image.size;
  if (bank.v === 2) {
    if (clip.test) { const embs = await Promise.all(bank.encoders.map((e, x) => clip.test.embed(url, x))); clip.lastEmbs = embs; return rankAll(bank, embs, k, userCc, memory); }
    const embs = [];
    for (let x = 0; x < bank.encoders.length; x++) {
      const e = bank.encoders[x], ses = clip.sessions[x], im = e.image;
      const px = await photoPixels(url, im.size, document, im.fit || "crop");
      const t = new ort.Tensor("float32", toTensor(px, im.size, im.mean, im.std), [1, 3, im.size, im.size]);
      const out = await ses.run({ [ses.inputNames[0]]: t });
      embs.push(out[e.output && out[e.output] ? e.output : ses.outputNames[ses.outputNames.length - 1]].data);
    }
    clip.lastEmbs = embs;   // remembered with the dish when the meal is saved (remember())
    return rankAll(bank, embs, k, userCc, memory);
  }
  if (clip.test) return rank(bank, await clip.test.embed(url), k);
  const px = await photoPixels(url, sz);
  const x = new ort.Tensor("float32", toTensor(px, sz, bank.image.mean, bank.image.std), [1, 3, sz, sz]);
  const out = await session.run({ [session.inputNames[0]]: x });
  return rank(bank, out[session.outputNames[0]].data, k);
}

// ---- v6.35 the plate scan (Ali: "it does not do more than 1 meal, the proportions are wrong, it is not good in seeing sizes") ----
// The fast look saw only the middle of the photo and called one dish "sure" — the AI never looked again, and the amount was one
// default serving. Now the four overlapping quarters are looked at too (the first encoder only: ≈ 4 × 0.3 s on a phone):
//   - a different food that wins a quarter is a second (third…) item, placed where it was seen;
//   - each food's share of the quarters is its share of the plate, and the grams follow from it;
//   - "sure" (no AI check) only for ONE dish that fills the photo and is not counted in pieces (pieces are counted by the AI).
export const REGIONS = [{ x: 0, y: 0, w: 0.6, h: 0.6 }, { x: 0.4, y: 0, w: 0.6, h: 0.6 }, { x: 0, y: 0.4, w: 0.6, h: 0.6 }, { x: 0.4, y: 0.4, w: 0.6, h: 0.6 }];
export const REGION_MIN_P = 0.3;     // a quarter's answer counts from this share up
export const PLATE_G = 420;          // a full dinner plate of one cooked dish, eaten — when the food has no "plate" portion
/** Each quarter → its ranking (the first encoder; [] when it fails). */
export async function classifyRegions(clip, url, k = 3, userCc = F.getCountry ? F.getCountry() : "") {
  const { ort, bank } = clip, out = [];
  for (let r = 0; r < REGIONS.length; r++) {
    try {
      if (bank.v === 2) {
        if (clip.test) { out.push(rankAll(bank, [await clip.test.embed(url, 0, REGIONS[r])], k, userCc)); continue; }
        const e = bank.encoders[0], ses = clip.sessions[0], im = e.image;
        const px = await photoPixels(url, im.size, document, im.fit || "crop", REGIONS[r]);
        const t = new ort.Tensor("float32", toTensor(px, im.size, im.mean, im.std), [1, 3, im.size, im.size]);
        const o = await ses.run({ [ses.inputNames[0]]: t });
        out.push(rankAll(bank, [o[e.output && o[e.output] ? e.output : ses.outputNames[ses.outputNames.length - 1]].data], k, userCc));
      } else {
        if (clip.test) { out.push(rank(bank, await clip.test.embed(url, 0, REGIONS[r]), k)); continue; }
        const sz = bank.image.size, px = await photoPixels(url, sz, document, "crop", REGIONS[r]);
        const o = await clip.session.run({ [clip.session.inputNames[0]]: new ort.Tensor("float32", toTensor(px, sz, bank.image.mean, bank.image.std), [1, 3, sz, sz]) });
        out.push(rank(bank, o[clip.session.outputNames[0]].data, k));
      }
    } catch (e) { out.push([]); }
  }
  return out;
}
const keyOfFood = (fd) => (fd && (fd.like ? fd.en : fd.id)) || "";
/** A food's grams for a share of the plate: its own "plate" portion if it has one, else PLATE_G — never under 40 g. */
export function gramsForShare(fd, share) {
  const plate = fd && fd.portions && (fd.portions.plate || fd.portions["dinner plate"]);
  const full = plate ? (typeof plate === "number" ? plate : plate.g || plate.grams || PLATE_G) : PLATE_G;
  return Math.max(40, Math.round(full * Math.max(0.1, Math.min(1, share)) / 5) * 5);
}
/** decide() + the quarters → the plate: { status, items, foods: n }. Pure; tests in tests/unit/v738plate.test.mjs. */
export function plateScan(bank, ranked, regions) {
  const main = decide(bank, ranked);
  if (main.status === "notfood" || !main.items.length || !Array.isArray(regions) || !regions.length) return main;
  const mainFd = entryFood(main.top), mainKey = keyOfFood(mainFd) || main.top.en;
  const seen = new Map();   // food key → { fd, entry, quarters: [r], best p }
  regions.forEach((rk, r) => {
    const top = rk && rk[0]; if (!top || top.p < REGION_MIN_P) return;
    const e = bank.items[top.i]; if (!e || e.kind === "not") return;
    const fd = entryFood(e); const key = keyOfFood(fd) || e.en;
    const x = seen.get(key) || { fd, e, quarters: [], p: 0 }; x.quarters.push(r); x.p = Math.max(x.p, top.p); seen.set(key, x);
  });
  const others = [...seen.entries()].filter(([k]) => k !== mainKey).sort((a, b) => b[1].quarters.length - a[1].quarters.length || b[1].p - a[1].p).slice(0, 3);
  const mainQ = (seen.get(mainKey) || { quarters: [] }).quarters.length;
  const unitOf = (fd) => Object.keys((fd && fd.portions) || {})[0] || "g";
  const countable = (fd) => /^(piece|pieces|slice|loaf|egg|skewer|roll|stick|cup|glass|can|bottle|sandwich)$/i.test(unitOf(fd));
  const boxOf = (qs) => { const xs = qs.map((q) => REGIONS[q]); const x = Math.min(...xs.map((b) => b.x)), y = Math.min(...xs.map((b) => b.y));
    return [x, y, Math.max(...xs.map((b) => b.x + b.w)) - x, Math.max(...xs.map((b) => b.y + b.h)) - y]; };
  if (!others.length) {
    // one dish: "sure" only when every quarter agrees and it is not counted in pieces (the AI counts them)
    let one = main;
    // a dish counted in pieces that fills the plate starts at the plate's share, not at one piece (mahshi: 1 piece = 60 g)
    const m0 = main.items[0], plateG = mainFd && mainFd.portions && mainFd.portions.plate;
    if (countable(mainFd) && plateG && mainQ >= 2 && m0.grams && !m0.learned) {
      const g = gramsForShare(mainFd, mainQ / 4);
      if (g > m0.grams) one = { ...main, items: [{ ...F.scaleItem({ ...m0, base: m0.grams }, g / m0.grams), base: g }] };
    }
    if (main.status === "auto" && (mainQ < 3 || countable(mainFd))) return { ...one, status: "guess", foods: 1 };
    return { ...one, foods: 1 };
  }
  // several foods: each gets its share of the plate (the quarters it won; the main dish at least one quarter)
  const total = Math.max(4, mainQ + others.reduce((a, [, o]) => a + o.quarters.length, 0));
  const items = [];
  const m0 = main.items[0];
  if (mainFd && m0.grams && !m0.learned) {
    const g = gramsForShare(mainFd, Math.max(1, mainQ) / total);
    items.push({ ...F.scaleItem({ ...m0, base: m0.grams }, g / m0.grams), base: g, ...(mainQ ? { box: boxOf((seen.get(mainKey) || { quarters: [] }).quarters) } : {}) });
  } else items.push(m0);
  for (const [, o] of others) {
    const conf = Math.round(Math.min(0.9, Math.max(0.3, o.p)) * 100) / 100;
    if (o.fd) {
      const share = o.quarters.length / total, g = countable(o.fd) ? null : gramsForShare(o.fd, share);
      const it = g ? F.itemFromFood(o.fd, g, "g") : defaultItem(o.fd);
      items.push({ ...it, k: 1, said: o.e.en, conf, alts: [], base: it.grams, fast: true, plate: true, box: boxOf(o.quarters), ...(o.e.kind === "like" ? { estimate: true, like: o.fd.like } : {}) });
    } else items.push({ ...unknownItem(o.e.en, null, { ar: o.e.ar }), conf, alts: [], fast: true, plate: true, box: boxOf(o.quarters) });
  }
  return { ...main, status: "guess", items, foods: items.length };
}
