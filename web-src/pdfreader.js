/* ---- Ask a PDF, the reader's logic (v6.20) -------------------------------------------------------------------------------------------
   Pure functions and a small store, no screen (the screen is pdfchat-ui.jsx):
     · word boxes → highlight rectangles on the page picture (search hits, and the evidence for an answer's [p. N]);
     · the documents kept between sessions (IndexedDB): text per page, the file itself when ≤ 25 MB, last page and zoom,
       the chat, the annotations — with a size cap that removes the oldest documents first;
     · annotations (highlights, notes, bookmarks) → a Markdown export, and the list the app sends to have them drawn into the PDF;
     · zoom, lazy reading plan, a small picture cache.
   Word boxes come from the app (DocTools.pdfWords): [x, y, w, h, text] as fractions of the page, top-left origin.
   Tests: tests/unit/v620pdfreader.test.mjs.                                                                                           */
import { norm, words as qwords } from "./docqa.js";

const hasAr = (s) => /[؀-ۿ]/.test(String(s || ""));

// ---- words and rectangles ------------------------------------------------------------------------------------------------------------
/** Raw boxes → [{ i, x, y, w, h, t, n (normalised), line }] in reading order (lines top to bottom; an Arabic line right to left). */
export function orderWords(raw) {
  const ws = (raw || []).map((a) => Array.isArray(a) ? { x: +a[0], y: +a[1], w: +a[2], h: +a[3], t: String(a[4] || "") } : { ...a })
    .filter((w) => w.t.trim() && w.w >= 0 && w.h > 0);
  ws.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2));
  const lines = [];
  for (const w of ws) {
    const c = w.y + w.h / 2, L = lines[lines.length - 1];
    if (L && Math.abs(c - L.c) < Math.min(w.h, L.h) * 0.55) { L.ws.push(w); L.c = (L.c * (L.ws.length - 1) + c) / L.ws.length; }
    else lines.push({ c, h: w.h, ws: [w] });
  }
  const out = [];
  lines.forEach((L, li) => {
    const ar = L.ws.filter((w) => hasAr(w.t)).length * 2 > L.ws.length;
    L.ws.sort((a, b) => ar ? b.x - a.x : a.x - b.x);
    for (const w of L.ws) out.push({ ...w, line: li, n: norm(w.t), i: out.length });
  });
  return out;
}

/** Boxes of one hit → one rectangle per line (neighbouring words on a line join into one bar). */
export function mergeRects(ws, pad = 0.002) {
  const byLine = new Map();
  for (const w of ws) { const k = w.line != null ? w.line : Math.round((w.y + w.h / 2) * 200); if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(w); }
  const out = [];
  for (const g of byLine.values()) {
    const x0 = Math.min(...g.map((w) => w.x)), x1 = Math.max(...g.map((w) => w.x + w.w));
    const y0 = Math.min(...g.map((w) => w.y)), y1 = Math.max(...g.map((w) => w.y + w.h));
    out.push({ x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: Math.min(1, x1 - x0 + 2 * pad), h: Math.min(1, y1 - y0 + 2 * pad) });
  }
  return out.sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Every place the query appears on the page → [{ rects, from, to }] (word indexes). Words are compared normalised (Arabic too). */
export function findRects(ordered, query, { max = 60 } = {}) {
  const qt = norm(query).split(" ").filter(Boolean); if (!qt.length || norm(query).length < 2) return [];
  // a page word may hold punctuation or two pieces: compare token by token
  const toks = []; ordered.forEach((w) => { for (const t of w.n.split(" ").filter(Boolean)) toks.push({ t, w }); });
  const hits = [];
  for (let i = 0; i < toks.length && hits.length < max; i++) {
    let ok = true;
    for (let k = 0; k < qt.length; k++) {
      const a = toks[i + k]; if (!a) { ok = false; break; }
      const last = k === qt.length - 1, first = k === 0;
      if (qt.length === 1 ? !a.t.includes(qt[0]) : (first ? !a.t.endsWith(qt[k]) : last ? !a.t.startsWith(qt[k]) : a.t !== qt[k])) { ok = false; break; }
    }
    if (!ok) continue;
    const span = [...new Set(toks.slice(i, i + qt.length).map((x) => x.w))];
    hits.push({ rects: mergeRects(span), from: span[0].i, to: span[span.length - 1].i });
    i += qt.length - 1;
  }
  return hits;
}

/** The page's words cut into sentences: [{ from, to, text }]. */
export function sentencesOf(ordered) {
  const out = []; let cur = [];
  const flush = () => { if (cur.length) out.push({ from: cur[0].i, to: cur[cur.length - 1].i, text: cur.map((w) => w.t).join(" ") }); cur = []; };
  ordered.forEach((w, k) => {
    const nx = ordered[k + 1];
    cur.push(w);
    if (/[.!?؟۔:]$/.test(w.t) || (nx && nx.line !== w.line && nx.y - (w.y + w.h) > w.h * 1.3)) flush();   // a full stop, or a paragraph gap
    else if (cur.length >= 45) flush();
  });
  flush();
  return out;
}

/**
 * The evidence for a claim on this page: the sentence(s) sharing the most meaningful words with the claim (and the question).
 * → { rects, from, to, score } or null when nothing on the page clearly supports it.
 */
export function evidenceRects(ordered, claim, question = "") {
  const cw = new Set(qwords(claim)), qw = new Set(qwords(question));
  if (!cw.size && !qw.size) return null;
  const nums = (String(claim).match(/\d[\d,.]*%?/g) || []).map((x) => x.replace(/[,.]$/, ""));
  let best = null;
  const sents = sentencesOf(ordered);
  for (const s of sents) {
    const sw = new Set(qwords(s.text)); let sc = 0;
    for (const w of cw) if (sw.has(w)) sc += 1;
    for (const w of qw) if (sw.has(w) && !cw.has(w)) sc += 0.5;
    for (const n of nums) if (s.text.includes(n)) sc += 1.5;
    if (!best || sc > best.score) best = { ...s, score: sc };
  }
  const need = Math.max(1.5, Math.min(3, cw.size * 0.25));
  if (!best || best.score < need) return null;
  const span = ordered.slice(best.from, best.to + 1);
  return { rects: mergeRects(span), from: best.from, to: best.to, score: best.score, text: best.text };
}

/** In an answer, the words that each cited page is meant to support: { page: "claim text" } (the text before its [p. N]). */
export function claimsByPage(answer) {
  const out = {}; const s = String(answer || "");
  const re = /\[\s*(?:p{1,2}\.?|pages?|ص|صفحه|صفحة)\s*([\d٠-٩][\d٠-٩,\s\-–و]*)\]/gi;
  let last = 0, m;
  while ((m = re.exec(s))) {
    const before = s.slice(last, m.index); last = m.index + m[0].length;
    const sent = before.split(/(?<=[.!?؟\n])\s+/).filter((x) => x.trim()).pop() || before;
    const list = m[1].replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    for (const part of list.split(/[,،و]/)) { const r = /(\d+)\s*[-–]\s*(\d+)/.exec(part); const ps = r ? Array.from({ length: Math.min(+r[2] - +r[1], 30) + 1 }, (_, k) => +r[1] + k) : [parseInt(part, 10)];
      for (const p of ps) if (p > 0) out[p] = ((out[p] ? out[p] + " " : "") + sent.trim()).trim(); }
  }
  return out;
}

/** Selected word indexes (from the text layer) → the quote and its rectangles. */
export function selectionFrom(ordered, from, to) {
  const a = Math.max(0, Math.min(from, to)), b = Math.min(ordered.length - 1, Math.max(from, to));
  const span = ordered.slice(a, b + 1);
  return { quote: span.map((w) => w.t).join(" "), rects: mergeRects(span), from: a, to: b };
}

// ---- view ---------------------------------------------------------------------------------------------------------------------------------
/** Zoom for "fit width" (1) and "fit page" (the whole page in the box). aspect = width / height of the page. */
export function fitZoom(mode, boxW, boxH, aspect) {
  if (mode === "page" && boxW > 0 && boxH > 0 && aspect > 0) return Math.max(0.3, Math.min(1, (boxH * aspect) / boxW));
  return 1;
}
export const clampZoom = (z) => Math.max(0.5, Math.min(5, Math.round((+z || 1) * 100) / 100));
/** The width to ask the page picture at: sharp at this zoom, but never more than the phone can hold comfortably. */
export function renderWidth(cssW, zoom, dpr = 2) { const w = Math.round((cssW || 360) * (zoom || 1) * Math.min(dpr || 1, 2.5)); return Math.max(400, Math.min(2400, Math.ceil(w / 200) * 200)); }
/** A long file is read in parts: the first few pages first (seen at once), then bigger parts. → [{ from, max }]. */
export function readPlan(count, first = 10, step = 40) {
  const out = []; if (!(count > 0)) return [{ from: 1, max: first }];
  out.push({ from: 1, max: Math.min(first, count) });
  for (let p = first + 1; p <= count; p += step) out.push({ from: p, max: Math.min(step, count - p + 1) });
  return out;
}
/** Pages whose small pictures to have ready around the current one. */
export const thumbWindow = (page, count, r = 6) => { const out = []; for (let p = Math.max(1, page - r); p <= Math.min(count, page + r); p++) out.push(p); return out; };
/** A small most-recently-used cache (page pictures): keeps memory bounded on a 300-page file. */
export function lru(max = 12) {
  const m = new Map();
  return { get(k) { if (!m.has(k)) return undefined; const v = m.get(k); m.delete(k); m.set(k, v); return v; }, has: (k) => m.has(k),
    set(k, v) { m.delete(k); m.set(k, v); while (m.size > max) m.delete(m.keys().next().value); }, get size() { return m.size; }, clear: () => m.clear(), keys: () => [...m.keys()] };
}

// ---- documents kept between sessions --------------------------------------------------------------------------------------------------------
export const KEEP_FILE_MAX = 25 * 1024 * 1024;     // the original file is kept only up to this size
export const STORE_CAP = 120 * 1024 * 1024;        // everything kept, together (oldest documents go first)
/** A stable id for a file: name + size + a hash of its first bytes. */
export function docId(name, size, head = "") {
  let h = 5381; const s = String(name) + "|" + size + "|" + String(head).slice(0, 4096);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return "d" + h.toString(36) + "-" + (+size || 0).toString(36);
}
const sizeOf = (v) => { try { return JSON.stringify(v).length; } catch (e) { return 0; } };

/** A key-value store in memory (tests, and the fallback when IndexedDB is missing). */
export function memKV() { const m = new Map(); return { async get(k) { return m.has(k) ? JSON.parse(m.get(k)) : undefined; }, async set(k, v) { m.set(k, JSON.stringify(v)); }, async del(k) { m.delete(k); }, async keys() { return [...m.keys()]; }, _m: m }; }
/** The same in IndexedDB (one object store). */
export function idbKV(name = "attune-reader") {
  if (typeof indexedDB === "undefined") return memKV();
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((ok, bad) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error); }));
  const tx = async (mode, fn) => { const d = await db(); return new Promise((ok, bad) => { const t = d.transaction("kv", mode); const st = t.objectStore("kv"); const r = fn(st); t.oncomplete = () => ok(r && "result" in r ? r.result : undefined); t.onerror = () => bad(t.error); t.onabort = () => bad(t.error); }); };
  return { get: (k) => tx("readonly", (s) => s.get(k)), set: (k, v) => tx("readwrite", (s) => s.put(v, k)), del: (k) => tx("readwrite", (s) => s.delete(k)), keys: () => tx("readonly", (s) => s.getAllKeys()) };
}

/**
 * The library: meta list + per document its text, chat and annotations.
 * meta: [{ id, name, kind, count, size, bytes, t (last opened), lastPage, zoom, hasFile }]
 */
export function library(kv, { cap = STORE_CAP, keepFileMax = KEEP_FILE_MAX } = {}) {
  const meta = async () => (await kv.get("meta")) || [];
  const setMeta = (m) => kv.set("meta", m);
  const usage = (m) => m.reduce((a, x) => a + (x.bytes || 0), 0);
  const drop = async (id) => { await kv.del("doc:" + id); await kv.del("chat:" + id); await kv.del("ann:" + id); };
  const self = {
    list: async () => (await meta()).slice().sort((a, b) => b.t - a.t),
    usage: async () => usage(await meta()),
    /** Keep a document (and evict the oldest others until everything fits the cap). Returns { kept, evicted: [ids], fileKept }. */
    async save(d, now = Date.now()) {
      const fileKept = !!(d.b64 && (d.size || d.b64.length * 0.75) <= keepFileMax);
      const rec = { pages: d.pages, outline: d.outline || [], b64: fileKept ? d.b64 : null, words: d.words || {} };
      const bytes = sizeOf(rec);
      let m = await meta(); const old = m.find((x) => x.id === d.id);
      const row = { id: d.id, name: d.name, kind: d.kind, count: d.count, size: d.size || 0, bytes, t: now, lastPage: old ? old.lastPage : 1, zoom: old ? old.zoom : 1, hasFile: fileKept, scans: d.scans || 0 };
      m = m.filter((x) => x.id !== d.id);
      const evicted = [];
      const others = m.slice().sort((a, b) => a.t - b.t);           // oldest first
      while (others.length && usage(others) + bytes > cap) { const x = others.shift(); evicted.push(x.id); await drop(x.id); }
      if (bytes > cap) return { kept: false, evicted, fileKept: false };
      await kv.set("doc:" + d.id, rec);
      await setMeta([row, ...others]);
      return { kept: true, evicted, fileKept };
    },
    get: (id) => kv.get("doc:" + id),
    async touch(id, patch, now = Date.now()) { const m = await meta(); const r = m.find((x) => x.id === id); if (!r) return null; Object.assign(r, patch || {}, { t: now }); await setMeta(m); return r; },
    async info(id) { return (await meta()).find((x) => x.id === id) || null; },
    chat: async (id) => (await kv.get("chat:" + id)) || [],
    saveChat: (id, msgs) => kv.set("chat:" + id, (msgs || []).slice(-80)),
    anns: async (id) => (await kv.get("ann:" + id)) || [],
    saveAnns: (id, list) => kv.set("ann:" + id, list || []),
    async saveWords(id, n, words) { const r = await kv.get("doc:" + id); if (!r) return; r.words = r.words || {}; r.words[n] = words; await kv.set("doc:" + id, r); },
    async remove(id) { await drop(id); await setMeta((await meta()).filter((x) => x.id !== id)); },
    async clear() { for (const x of await meta()) await drop(x.id); await setMeta([]); },
  };
  return self;
}

// ---- annotations ---------------------------------------------------------------------------------------------------------------------------
export const COLOURS = { yellow: "#fde047", green: "#86efac", blue: "#93c5fd", pink: "#f9a8d4" };
let seq = 0;
/** kind: "highlight" { page, rects, quote, color } | "note" { page, text, x, y, quote? } | "bookmark" { page, title } */
export function addAnn(list, a, now = Date.now()) {
  if (!a || !a.kind || !(a.page >= 1)) return list;
  if (a.kind === "bookmark" && list.some((x) => x.kind === "bookmark" && x.page === a.page)) return list;   // one bookmark a page
  const item = { id: "a" + now.toString(36) + (seq++).toString(36), t: now, ...a };
  if (item.kind === "highlight" && !item.color) item.color = "yellow";
  return [...list, item].sort((x, y) => x.page - y.page || x.t - y.t);
}
export const removeAnn = (list, id) => list.filter((x) => x.id !== id);
export const updateAnn = (list, id, patch) => list.map((x) => x.id === id ? { ...x, ...patch } : x);
export const annsOn = (list, page) => list.filter((x) => x.page === page);
export const toggleBookmark = (list, page, title = "", now = Date.now()) => list.some((x) => x.kind === "bookmark" && x.page === page) ? list.filter((x) => !(x.kind === "bookmark" && x.page === page)) : addAnn(list, { kind: "bookmark", page, title }, now);

/** Annotations → a Markdown file (headings in the app's language). */
export function annsToMarkdown(name, list, ar = false) {
  const L = ar ? { t: "ملاحظات على", b: "العلامات", h: "التظليل", n: "الملاحظات", p: "صفحة" } : { t: "Notes on", b: "Bookmarks", h: "Highlights", n: "Notes", p: "Page" };
  const by = (k) => list.filter((x) => x.kind === k);
  const out = [`# ${L.t} ${name}`, ""];
  const bm = by("bookmark"); if (bm.length) { out.push(`## ${L.b}`, ""); for (const x of bm) out.push(`- ${L.p} ${x.page}${x.title ? " — " + x.title : ""}`); out.push(""); }
  const hl = by("highlight"); if (hl.length) { out.push(`## ${L.h}`, ""); for (const x of hl) out.push(`- **${L.p} ${x.page}** — > ${String(x.quote || "").replace(/\s+/g, " ").trim()}${x.text ? "\n  - " + x.text : ""}`); out.push(""); }
  const nt = by("note"); if (nt.length) { out.push(`## ${L.n}`, ""); for (const x of nt) out.push(`- **${L.p} ${x.page}**${x.quote ? ` (“${String(x.quote).slice(0, 80)}”)` : ""}: ${String(x.text || "").trim()}`); out.push(""); }
  return out.join("\n").trim() + "\n";
}
/** Annotations → what the app's PDF tool draws into the file (pdfEdit "annotate"). */
export function flattenPayload(list) {
  const out = [];
  for (const x of list) {
    if (x.kind === "highlight" && x.rects && x.rects.length) out.push({ page: x.page, kind: "highlight", color: COLOURS[x.color] || x.color || COLOURS.yellow, rects: x.rects.map((r) => [r.x, r.y, r.w, r.h]) });
    else if (x.kind === "note") out.push({ page: x.page, kind: "note", color: "#f59e0b", x: x.x != null ? x.x : 0.03, y: x.y != null ? x.y : 0.03, text: String(x.text || "") });
  }
  return out;
}

// ---- selection → chat ----------------------------------------------------------------------------------------------------------------------
/** "explain" | "ask" | "translate" on a piece of the page → the messages for the model (the piece is the only source). */
export function selectionMessages(kind, sel, page, { to = "ar", question = "" } = {}) {
  const t = String(sel || "").trim().slice(0, 3000);
  if (kind === "translate") {
    const lang = to === "ar" ? "Arabic (clear, natural; keep names, numbers and units as written)" : "English (clear, natural; keep names, numbers and units as written)";
    return [{ role: "system", content: `Translate the text the user gives into ${lang}. Reply with the translation only.` }, { role: "user", content: t }];
  }
  const ar = hasAr(question || t) || to === "ar";
  const ask = kind === "explain" ? "Explain this passage simply: what it means and why it matters. Keep it short." : String(question || "").trim();
  return [{ role: "system", content: `You help someone read a document. Use the passage from page ${page} below; you may add general background knowledge, but say so when you do. Cite the page like [p. ${page}] after facts from the passage. Answer in ${ar ? "Egyptian Arabic" : "English"}.` },
    { role: "user", content: `Passage [p. ${page}]:\n${t}\n\n${ask}` }];
}
