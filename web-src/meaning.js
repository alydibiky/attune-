/* ---- v6.45 Recall phase 2 — search by MEANING, Arabic ↔ English (Ali: "do it", 20 Oct 2026; choice A of NEXT_SESSION AM).
   An optional 438 MB download: bge-m3 (BAAI, MIT licence), the only embedder that found every passage in our test
   (RESEARCH_STORAGE_2026-10.md: 104/104 vs 85/104 for words alone). It runs on the phone (Embedder.kt + attune-embed.cpp);
   nothing leaves it. Each thing Recall can find becomes a list of 1024 numbers once (kept 8-bit in IndexedDB, ~1 KB each,
   redone only when its text changes); a question becomes one too, and the nearest ones are found — so «فاتورة الكهربا»
   finds "electricity bill" and "where did I park" finds «ركنت العربية». The word search still runs; the two lists are
   merged (reciprocal-rank fusion), so an exact code or number is never lost. Pure parts here; tests: v745meaning.         */
import { cosine, packVector, unpackVector } from "./knowpack.js";

export const MODEL = { id: "bge-m3", label: "bge-m3", bytes: 437778496, dims: 1024, licence: "MIT" };
/** A close-enough meaning (cosine, bge-m3): below this a vector-only hit is noise. Measured on tests/trials/meaning.mjs. */
export const MIN_SIM = 0.42;

/** The text a thing is understood by: its title and the start of its text (the model reads 512 tokens at most). */
export const textOf = (d) => (String(d.title || "").trim() + "\n" + String(d.text || "").replace(/\s+/g, " ").trim()).trim().slice(0, 700);
/** A short fingerprint of that text, so a thing is embedded again only when it changed. */
export function keyOf(d) {
  const t = textOf(d); let h = 2166136261;
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return d.id + "#" + (h >>> 0).toString(36);
}
/** Which things still need their numbers: [doc] (stored = a Map or object of key → vector). */
export const missing = (docs, stored) => docs.filter((d) => textOf(d).length >= 3 && !(stored instanceof Map ? stored.has(keyOf(d)) : stored[keyOf(d)]));

/** Nearest things to the question's vector: [{ doc, sim }] above MIN_SIM, best first. */
export function nearest(docs, vecOf, qv, { limit = 40, min = MIN_SIM } = {}) {
  const out = [];
  for (const d of docs) { const v = vecOf(d); if (!v) continue; const sim = cosine(v, qv); if (sim >= min) out.push({ doc: d, sim }); }
  return out.sort((a, b) => b.sim - a.sim).slice(0, limit);
}

/**
 * Words + meaning, one list: reciprocal-rank fusion of the word hits ({ doc, score, snip }) and the meaning hits
 * ({ doc, sim }). A thing found both ways comes first; a meaning-only hit shows its best line as the snippet.
 */
export function fuseHits(wordHits, meanHits, { limit = 40, snip = (d) => String(d.text || d.title || "").slice(0, 160) } = {}) {
  const m = new Map();
  wordHits.forEach((h, r) => m.set(h.doc.id, { ...h, rrf: 1 / (60 + r), by: "words" }));
  meanHits.forEach((h, r) => { const x = m.get(h.doc.id);
    if (x) { x.rrf += 1 / (60 + r); x.by = "both"; x.sim = h.sim; }
    else m.set(h.doc.id, { doc: h.doc, score: 0, snip: snip(h.doc), rrf: 1 / (60 + r), by: "meaning", sim: h.sim }); });
  return [...m.values()].sort((a, b) => b.rrf - a.rrf || b.doc.ts - a.doc.ts).slice(0, limit);
}

// ---- storage: key → 8-bit vector, in IndexedDB "attune-meaning" (the page only; a test passes a Map) ----------------------------
const DB = "attune-meaning", ST = "v";
function db() {
  return new Promise((ok) => {
    try { if (typeof indexedDB === "undefined") return ok(null);
      const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); }
  });
}
/** Every stored vector: Map key → Float32Array. */
export async function loadVectors() {
  const d = await db(), out = new Map(); if (!d) return out;
  return new Promise((ok) => { try { const tx = d.transaction(ST, "readonly"), c = tx.objectStore(ST).openCursor();
    c.onsuccess = () => { const cur = c.result; if (!cur) return ok(out); try { out.set(cur.key, unpackVector({ s: cur.value.s, q: new Int8Array(cur.value.q) })); } catch (e) {} cur.continue(); };
    c.onerror = () => ok(out); } catch (e) { ok(out); } });
}
/** Store vectors: [[key, Float32Array]]; keys no longer in `keep` (a Set) are dropped. */
export async function saveVectors(pairs, keep = null) {
  const d = await db(); if (!d) return false;
  return new Promise((ok) => { try { const tx = d.transaction(ST, "readwrite"), s = tx.objectStore(ST);
    for (const [k, v] of pairs) { const p = packVector(v); s.put({ s: p.s, q: p.q.buffer }, k); }
    if (keep) { const c = s.openCursor(); c.onsuccess = () => { const cur = c.result; if (!cur) return; if (!keep.has(cur.key)) cur.delete(); cur.continue(); }; }
    tx.oncomplete = () => ok(true); tx.onerror = () => ok(false); } catch (e) { ok(false); } });
}
export async function clearVectors() { const d = await db(); if (!d) return; try { d.transaction(ST, "readwrite").objectStore(ST).clear(); } catch (e) {} }

/** The phone's embedder through the bridge: texts → Float32Array[] (null when it isn't installed or failed). */
export function nativeEmbed(native, call) {
  if (!native || !native.embedStatus) return null;
  return async (texts) => { const r = await call("embed", { texts }); return (r && r.vecs || []).map((v) => Float32Array.from(v)); };
}
