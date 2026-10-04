// Knowledge packs: small downloaded (or the person's own) collections of short passages that the model can look
// things up in before it answers. Measured on tests/trials/factpack.mjs (104 questions): the word index below finds
// the right passage in the top 3 for 85/104 questions with no extra download; a multilingual embedder finds 104/104.
// Passages: [{ id, text, src }]. Everything here is pure (no I/O) so it runs in the page, in a worker and in node.
import { words } from "./docqa.js";

/** Word index over passages: per-passage word sets + document frequency. */
export function buildPackIndex(passages) {
  const docs = passages.map((p) => new Set(words(p.text)));
  const df = new Map();
  for (const d of docs) for (const w of d) df.set(w, (df.get(w) || 0) + 1);
  const avg = docs.reduce((s, d) => s + d.size, 0) / (docs.length || 1);
  return { passages, docs, df, avg };
}

/** Top-k passages by idf-weighted word overlap: [{ i, score }] (score > 0 only). */
export function searchWords(index, query, k = 3) {
  const qs = [...new Set(words(query))], n = index.docs.length;
  const out = [];
  index.docs.forEach((d, i) => {
    let s = 0;
    const norm = 1.2 * (0.25 + 0.75 * d.size / (index.avg || 1));   // BM25 length normalisation (k1 1.2, b 0.75), word presence only
    for (const w of qs) if (d.has(w)) s += Math.log(1 + n / index.df.get(w)) * 2.2 / (1 + norm);
    if (s > 0) out.push({ i, score: s });
  });
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

export function cosine(a, b) {
  let s = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i++) { s += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return x && y ? s / Math.sqrt(x * y) : 0;
}

/** Top-k passages by embedding similarity; vectors[i] belongs to passages[i]. */
export function searchVectors(vectors, qvec, k = 3, min = 0) {
  return vectors.map((v, i) => ({ i, score: cosine(v, qvec) })).filter((x) => x.score > min).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Merge two ranked lists (reciprocal-rank fusion), keeping the best k. */
export function fuse(lists, k = 3) {
  const s = new Map();
  for (const l of lists) l.forEach((h, r) => s.set(h.i, (s.get(h.i) || 0) + 1 / (60 + r)));
  return [...s].map(([i, score]) => ({ i, score })).sort((a, b) => b.score - a.score).slice(0, k);
}

/** System-prompt addition with the found passages, within a character budget. */
export function packNote(index, hits, budget = 1800) {
  const lines = []; let used = 0;
  for (const h of hits) {
    const p = index.passages[h.i]; if (!p) continue;
    const line = "- " + p.text.trim();
    if (used + line.length > budget) break;
    lines.push(line); used += line.length;
  }
  return lines.length ? "Reference notes (use them if they help; they may not be relevant):\n" + lines.join("\n") : "";
}

/** Vectors as compact bytes for storage (8-bit, per-vector scale): 384-d → 388 bytes, 1024-d → 1028 bytes. */
export function packVector(v) {
  let m = 0; for (const x of v) m = Math.max(m, Math.abs(x));
  const q = new Int8Array(v.length), sc = m / 127 || 1;
  for (let i = 0; i < v.length; i++) q[i] = Math.round(v[i] / sc);
  return { s: sc, q };
}
export const unpackVector = ({ s, q }) => Float32Array.from(q, (x) => x * s);
