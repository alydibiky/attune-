/* ---- the offline food pack: 1,000,000+ packaged foods on the phone (v6.18) -------------------------------------------------------
   Ali: "the food database the app knows and recognizes no less than a million".
   The pack is built from Open Food Facts by tools/build_food_pack.py (a GitHub job) and downloaded on demand in shards of 60,000 rows,
   Egyptian / Arab-region products first, then the most scanned. It is stored in IndexedDB (a phone can hold it; localStorage cannot):
     - one record per product, keyed by barcode  → a barcode scan is one lookup, offline;
     - a multi-entry index on word starts ("coc" "cola" …) → a name search touches only the products that share a word.
   Every number is the product's own label (the builder drops incomplete labels and labels whose energy disagrees with their macros).
   "Recognise" = a typed name, a spoken name, a barcode or a photo's food names are all matched against these names by code.
   The same code runs on an in-memory store in tests (tests/unit/v618foodpack.test.mjs) and on IndexedDB on the phone (e2e).      */

const COLS = ["code", "en", "ar", "brand", "kcal", "p", "c", "f", "fib", "sug", "sat", "salt", "serving", "egypt", "grade", "nova"];
const num = (x) => { if (x === "" || x == null) return null; const n = parseFloat(x); return isFinite(n) ? n : null; };
export const norm = (s) => String(s || "").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const PREFIX = 5;
/** The word starts a product is found by: "Coca-Cola Zero 330ml" → coca, cola, zero, 330ml→330ml… (first 5 letters of every word of 2+ letters). */
export function tokensOf(...texts) {
  const out = new Set();
  for (const t of texts) for (const w of norm(t).split(" ")) if (w.length >= 2) out.add(w.slice(0, PREFIX));
  return [...out];
}

/** One TSV line → a record (a compact array, not an object: a million of them must be small). */
export function parseLine(line) {
  const c = line.split("\t");
  if (c.length < 14 || !c[0] || !(c[1] || c[2])) return null;
  const kcal = num(c[4]); if (kcal == null) return null;
  return { code: c[0], en: c[1], ar: c[2], brand: c[3], kcal, p: num(c[5]) || 0, c: num(c[6]) || 0, f: num(c[7]) || 0, fib: num(c[8]) || 0,
    sug: num(c[9]), sat: num(c[10]), salt: num(c[11]), serving: num(c[12]), egypt: c[13] === "1", grade: c[14] || "", nova: c[15] ? +c[15] : 0, tk: tokensOf(c[1], c[2], c[3]) };
}
export const parseShard = (text) => String(text || "").split("\n").map((l) => (l ? parseLine(l) : null)).filter(Boolean);

/** A pack record → the app's food shape (same fields fitdb.fromOFF gives), so the rest of Fit needs no change. */
export function toFood(r) {
  const name = r.en || r.ar;
  const food = { id: "off:" + r.code, src: "pack", barcode: r.code, en: r.brand && !norm(name).includes(norm(r.brand)) ? `${name} (${r.brand})` : name, ar: r.ar || name, brand: r.brand,
    names: [name, r.ar, r.brand ? `${r.brand} ${name}` : ""].filter(Boolean), kcal: r.kcal, p: r.p, c: r.c, f: r.f, fib: r.fib,
    portions: r.serving ? { serving: r.serving } : {}, group: "packaged", egypt: !!r.egypt };
  if (r.sug != null) food.sug = r.sug; if (r.sat != null) food.sat = r.sat; if (r.salt != null) food.salt = r.salt;
  if (r.grade) food.grade = r.grade; if (r.nova) food.nova = r.nova;
  return food;
}

// ---- stores: the same four methods on memory (tests) and on IndexedDB (the phone) ---------------------------------------------------
export function memoryStore() {
  const rows = new Map(), idx = new Map(); let meta = {};
  return {
    kind: "memory",
    async putMany(list) { for (const r of list) { rows.set(r.code, r); for (const t of r.tk) { let a = idx.get(t); if (!a) idx.set(t, (a = [])); a.push(r.code); } } },
    async get(code) { return rows.get(code) || null; },
    async byToken(tok, limit = 3000) {   // a word start shorter than 5 letters matches every longer start that begins with it
      let codes = idx.get(tok) || [];
      if (tok.length < PREFIX) { codes = []; for (const [k, v] of idx) if (k.startsWith(tok)) { codes = codes.concat(v); if (codes.length >= limit) break; } }
      return codes.slice(0, limit).map((c) => rows.get(c)).filter(Boolean);
    },
    async count() { return rows.size; },
    async getMeta() { return meta; }, async setMeta(m) { meta = m; },
    async clear() { rows.clear(); idx.clear(); meta = {}; },
  };
}
export function idbStore(name = "attune-foodpack") {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(name, 1);
    rq.onupgradeneeded = () => { const db = rq.result; const s = db.createObjectStore("foods", { keyPath: "code" }); s.createIndex("tk", "tk", { multiEntry: true }); db.createObjectStore("meta"); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  const tx = async (stores, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(stores, mode); let out; Promise.resolve(fn(t)).then((v) => { out = v; }, rej); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    kind: "idb",
    putMany: (list) => tx(["foods"], "readwrite", (t) => { const s = t.objectStore("foods"); for (const r of list) s.put(r); }),
    get: (code) => tx(["foods"], "readonly", (t) => req(t.objectStore("foods").get(code))).then((v) => v || null),
    byToken: (tok, limit = 3000) => tx(["foods"], "readonly", (t) => req(t.objectStore("foods").index("tk").getAll(tok.length < PREFIX ? IDBKeyRange.bound(tok, tok + "\uffff") : tok, limit))),
    count: () => tx(["foods"], "readonly", (t) => req(t.objectStore("foods").count())),
    getMeta: () => tx(["meta"], "readonly", (t) => req(t.objectStore("meta").get("m"))).then((v) => v || {}),
    setMeta: (m) => tx(["meta"], "readwrite", (t) => { t.objectStore("meta").put(m, "m"); }),
    clear: () => tx(["foods", "meta"], "readwrite", (t) => { t.objectStore("foods").clear(); t.objectStore("meta").clear(); }),
  };
}

// ---- search --------------------------------------------------------------------------------------------------------------------------
/** Every word of the query must start a word of the product's name / brand; best matches first (exact name, starts with, Egyptian, shorter name). */
export async function searchPack(store, q, n = 30) {
  const words = norm(q).split(" ").filter((w) => w.length >= 2);
  if (!words.length) return [];
  // the longest word is the rarest: ask the index for it, then check the others in code
  const lead = [...words].sort((a, b) => b.length - a.length)[0];
  const cand = await store.byToken(lead.slice(0, PREFIX), 6000);
  const qn = words.join(" ");
  const scored = [];
  for (const r of cand) {
    const hay = norm(`${r.en} ${r.ar} ${r.brand}`);
    const hw = hay.split(" ");
    if (!words.every((w) => hw.some((h) => h.startsWith(w)))) continue;
    const name = norm(r.en || r.ar);
    scored.push([r, (name === qn ? 30 : 0) + (name.startsWith(qn) ? 8 : 0) + (r.egypt ? 3 : 0) - Math.min(name.length, 80) / 40]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return scored.slice(0, n).map(([r]) => toFood(r));
}
export async function packByBarcode(store, code) {
  const c = String(code || "").replace(/\D/g, "");
  if (!c) return null;
  // the same product is written with or without leading zeros (UPC-A 12 digits, EAN-13, GTIN-14)
  const bare = c.replace(/^0+/, "");
  let r = await store.get(c);
  for (let pad = 0; !r && pad <= 6; pad++) r = await store.get("0".repeat(pad) + bare);
  return r ? toFood(r) : null;
}

// ---- download and install -------------------------------------------------------------------------------------------------------------
export const PACK_BASE = "https://github.com/alydibiky/attune-/releases/download/food-pack-v1/";
/**
 * Installs shards one after another. `getText(name)` → the shard's text (the phone downloads it and unzips it);
 * `shards` = how many to install (the first ones hold the most useful products). Progress and resumable: a shard already
 * installed is skipped, so a stop in the middle keeps everything done so far.
 */
export async function installPack({ store, manifest, getText, shards = Infinity, onProgress = () => {}, isStopped = () => false }) {
  const meta = await store.getMeta(); const done = new Set(meta.done || []);
  const list = manifest.shards.slice(0, shards);
  let installed = await store.count();
  for (let i = 0; i < list.length; i++) {
    if (isStopped()) break;
    const s = list[i];
    if (done.has(s.name)) { onProgress({ shard: i + 1, of: list.length, count: installed, skipped: true }); continue; }
    const rows = parseShard(await getText(s.name));
    for (let k = 0; k < rows.length; k += 4000) await store.putMany(rows.slice(k, k + 4000));
    done.add(s.name); installed = await store.count();
    await store.setMeta({ done: [...done], version: manifest.version, built: manifest.built, total: manifest.count });
    onProgress({ shard: i + 1, of: list.length, count: installed });
  }
  return { count: installed, shards: done.size };
}
export const packSizeMB = (manifest, shards = Infinity) => Math.round(manifest.shards.slice(0, shards).reduce((a, s) => a + s.bytes, 0) / 1e5) / 10;
