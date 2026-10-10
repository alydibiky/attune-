/* ---- Knowledge («معرفة»): the person's own facts, looked up before the model answers (v6.20) -------------------------------------
   Measured (RESEARCH_STORAGE_2026-10.md, tests/trials/factpack.mjs): giving a small model the right passage turns wrong answers
   into right ones (0.8B 31→99 of 104, 2B 47→104, 4B 69→104). So the person can keep sources here — their own documents (from Ask a
   PDF), pasted text, text / Markdown / PDF / Word files, their Mind notes (and Shelf notes later, through the same adapter) and
   downloadable public packs — and Chat looks them up when a question asks for a fact:
     1. the sources are cut into passages that remember their source, title and page (docqa.js chunking);
     2. a question that looks like a lookup (not chit-chat, not code) gets the best few passages by the word index (docqa.js BM25 with
        English + Arabic normalisation) — only passages that share enough of the question's words, so an unrelated question adds nothing;
     3. they go to the model as a short "Facts from your Knowledge" block with tags [K1] [K2]…, and it is told to answer from them
        only when they answer the question, and to say so when they don't;
     4. code then checks the tags: a tag the model was never shown is removed, and a chip is shown under the answer only for a passage
        the answer really uses (a tag on a sentence that shares a number or words with it, or — when the model wrote no tags — a
        sentence that clearly repeats it).
   Pure logic and the two stores (memory for tests, IndexedDB on the phone). Tests: tests/unit/knowledge.test.mjs. Screen: knowledge-ui.jsx. */
import { norm, words, rank, hasArabic } from "./docqa.js";

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, ".");

// ---- chunking ----------------------------------------------------------------------------------------------------------------------
/** Text with no pages → "pages" of about 2,400 characters cut at paragraph ends (same as Ask a PDF does for Word files). */
export function textToPages(text, size = 2400) {
  const paras = String(text || "").replace(/\r/g, "").split(/\n\s*\n/); const pages = []; let cur = "";
  for (const p of paras) { if (cur && (cur + "\n\n" + p).length > size) { pages.push(cur); cur = p; } else cur = cur ? cur + "\n\n" + p : p; }
  if (cur.trim()) pages.push(cur);
  return pages.map((t, i) => ({ n: i + 1, text: t.trim() })).filter((p) => p.text);
}
/**
 * A source → passages of about `size` characters, cut at paragraphs and sentences. `pages` (from a PDF) keep their page numbers;
 * plain text has none (page 0). → [{ page, text }]
 */
export function chunkSource({ text, pages }, { size = 600 } = {}) {
  const pg = pages && pages.length ? pages : textToPages(text).map((p) => ({ n: 0, text: p.text }));
  const out = [];
  for (const p of pg) {
    const t = String(p.text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(); if (!t) continue;
    const paras = t.split(/\n\s*\n|\n(?=[-•*#]|\d+[.)] )/).map((x) => x.trim()).filter(Boolean);
    let cur = "";
    const push = (x) => { x = x.trim(); if (x.length >= 2) out.push({ page: p.n || 0, text: x }); };
    for (const para of paras) {
      if (para.length > size * 1.5) {
        if (cur) { push(cur); cur = ""; }
        let s = "";
        for (const x of para.split(/(?<=[.!?؟۔])\s+/)) { if (s && (s + " " + x).length > size) { push(s); s = x; } else s = s ? s + " " + x : x; }
        if (s) push(s);
      } else if (cur && (cur + "\n" + para).length > size) { push(cur); cur = para; }
      else cur = cur ? cur + "\n" + para : para;
    }
    if (cur) push(cur);
  }
  return out;
}

// ---- the index (the same BM25 as Ask a PDF, over passages from many sources) ------------------------------------------------------
/** chunks: [{ id, src, title, page, text, kind }] → an index docqa.rank can search. */
export function indexChunks(chunks) {
  const list = []; const df = new Map(); let total = 0;
  for (const c of chunks) {
    // the title is searched too ("Aswan High Dam" in the title, "it was completed in 1970" in the text)
    const ws = words((c.title ? c.title + " " : "") + c.text); if (!ws.length) continue;
    const tf = new Map(); for (const w of ws) tf.set(w, (tf.get(w) || 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
    total += ws.length;
    list.push({ ...c, tf, len: ws.length, norm: norm((c.title ? c.title + " " : "") + c.text) });
  }
  return { chunks: list, df, avg: list.length ? total / list.length : 1, N: list.length };
}

// ---- which questions look things up -------------------------------------------------------------------------------------------------
const CHAT = /^\s*(hi|hello|hey|thanks|thank you|thx|ok(ay)?|good (morning|night|evening)|how are you|who are you|what can you do|bye|lol|yes|no|sure|great|cool|nice|السلام عليكم|سلام|اهلا|أهلا|مرحبا|ازيك|إزيك|عامل ايه|عامل إيه|شكرا|شكراً|تمام|ماشي|اوك|صباح الخير|مساء الخير|انت مين|إنت مين)\b[\s!.?؟]*$/i;
const MAKE = /\b(write|draft|compose|translate|rewrite|paraphrase|summari[sz]e this|fix (my|this)|code|program|function|script|regex|sql|html|css|python|javascript|poem|story|joke|essay|email|letter|tweet|caption)\b|اكتب(لي)?|ترجم|قصيده|قصيدة|نكته|نكتة|كود|برنامج|ايميل|إيميل|جواب/i;
/** A question that asks for a fact or a lookup (not a greeting, not "write me…", not code). Pure and fast. */
export function wantsFacts(q) {
  const s = String(q || "").trim();
  if (s.length < 4 || s.length > 1500 || CHAT.test(s)) return false;
  if (/```|[{};]\s*\n|=>|\bdef |\bfunction\b/.test(s)) return false;
  if (MAKE.test(s) && !/\?|؟|^(what|who|when|where|which|how (much|many|long|tall|big|far|old))\b/i.test(s)) return false;
  return words(s).length >= 1;
}

/**
 * The passages for a question: [{ chunk, score, tag }] best first. Only passages that share enough of the question's meaningful words
 * (`cover`) and score well enough relative to the best one are kept, so an unrelated question gets nothing.
 */
export function findFacts(index, question, { k = 3, cover = 0.34, rel = 0.45, budget = 1600 } = {}) {
  if (!index || !index.N) return [];
  const qw = [...new Set(words(question))]; if (!qw.length) return [];
  const top = rank(index, question, { k: k * 3 });
  if (!top.length) return [];
  const best = top[0].score, out = []; let used = 0;
  for (const h of top) {
    if (h.score < best * rel) break;
    const hit = qw.filter((w) => h.chunk.tf.has(w)).length;
    // a one- or two-word question must match all its words; otherwise a third of the question's words
    const need = qw.length <= 2 ? qw.length : Math.max(2, Math.ceil(qw.length * cover));
    if (hit < need) continue;
    if (used + h.chunk.text.length > budget && out.length) break;
    used += h.chunk.text.length;
    out.push({ chunk: h.chunk, score: h.score });
    if (out.length >= k) break;
  }
  return out.map((h, i) => ({ ...h, tag: "K" + (i + 1) }));
}

/** The block added to the request: the passages with their tags and sources, and how to use them. */
export function factsBlock(hits, question = "") {
  if (!hits || !hits.length) return "";
  const ar = hasArabic(question);
  const lines = hits.map((h) => `[${h.tag}] (${h.chunk.title || "note"}${h.chunk.page ? ", p. " + h.chunk.page : ""}) ${h.chunk.text.replace(/\s+/g, " ").trim()}`);
  // a pack with a warning (the laws pack): the answer must repeat it when it uses those facts
  const notes = [...new Set(hits.filter((h) => h.chunk.note).map((h) => (ar && h.chunk.note_ar) || h.chunk.note))];
  return "Facts from your Knowledge (the person's own saved sources):\n" + lines.join("\n") +
    (notes.length ? "\n\nIf you use these facts, end the answer with this line: " + notes.join(" ") : "") +
    "\n\nHow to use them: if these facts answer the question, answer from them only — do not change their numbers, names or dates — and put the tag, like [K1], after each sentence that uses one. " +
    "If they do not answer the question, say in one short sentence that your Knowledge doesn't cover it" + (ar ? " (in Arabic: «لا تحتوي معرفتك على هذا»)" : "") + ", then answer from what you know." +
    "\n\nQuestion: ";
}

// ---- checking the answer ------------------------------------------------------------------------------------------------------------
const TAG = /\s?\[\s*K\s*(\d{1,2})(?:\s*[,،]\s*K?\s*\d{1,2})*\s*\]/gi;
const tagsIn = (m) => (m.match(/\d{1,2}/g) || []).map(Number);
const numsOf = (s) => new Set((toLatin(s).match(/\d+(?:[.,]\d+)*/g) || []).map((x) => x.replace(/,/g, "")).filter((x) => x.length >= 2 || +x > 0));
/** Does this sentence really use this passage? A shared number, or two shared meaningful words (one if the sentence is tiny). */
export function supports(sentence, chunk) {
  const ns = numsOf(sentence), cn = numsOf(chunk.text);
  for (const n of ns) if (cn.has(n)) return true;
  const sw = new Set(words(sentence)); if (!sw.size) return false;
  const cw = chunk.tf || new Map(words(chunk.text).map((w) => [w, 1]));
  let shared = 0; for (const w of sw) if (cw.has(w)) shared++;
  return shared >= Math.min(2, sw.size) && shared / sw.size >= 0.25;
}
/**
 * The model's answer + the passages it was shown → { text (tags removed), chips: [{ tag, title, src, page, text }], removed }.
 * A tag that was never shown is removed; a tag on a sentence that doesn't use its passage gets no chip; with no tags at all, a
 * passage gets a chip when one sentence clearly repeats it (a shared number, or most of its words).
 */
export function checkFacts(answer, hits) {
  const byTag = new Map((hits || []).map((h, i) => [i + 1, h]));
  const used = new Set(); let removed = 0, tagged = 0;
  const pieces = String(answer || "").split(/(?<=[.!?؟۔\]])[ \t]+(?=\S)|(?<=\n)/);
  const kept = pieces.map((piece) => {
    const plain = piece.replace(TAG, "");
    return piece.replace(TAG, (m) => {
      for (const n of tagsIn(m)) {
        tagged++;
        const h = byTag.get(n);
        if (!h) { removed++; continue; }
        if (supports(plain, h.chunk)) used.add(n);
      }
      return "";
    });
  });
  if (!tagged) for (const piece of pieces) for (const [n, h] of byTag) {
    if (used.has(n)) continue;
    const sw = words(piece); if (sw.length < 2) continue;
    const ns = numsOf(piece), cn = numsOf(h.chunk.text);
    const num = [...ns].some((x) => cn.has(x));
    const cw = h.chunk.tf || new Map(words(h.chunk.text).map((w) => [w, 1]));
    const shared = sw.filter((w) => cw.has(w)).length;
    if ((num && shared >= 1) || shared >= Math.max(3, Math.ceil(sw.length * 0.5))) used.add(n);
  }
  const text = kept.join(" ").replace(/ *\n */g, "\n").replace(/ +([.,!?؟،])/g, "$1").replace(/ {2,}/g, " ").trim();
  const chips = [...used].sort((a, b) => a - b).map((n) => { const c = byTag.get(n).chunk; return { tag: "K" + n, title: c.title || "", src: c.src, page: c.page || 0, kind: c.kind || "", text: c.text.slice(0, 400), ...(c.note ? { note: c.note, note_ar: c.note_ar || "" } : {}) }; });
  return { text, chips, removed };
}

// ---- stores: the same methods on memory (tests) and IndexedDB (the phone) -------------------------------------------------------------
export function memoryStore() {
  const sources = new Map(), chunks = new Map();
  return {
    kind: "memory",
    async putSource(s, list) { sources.set(s.id, s); for (const c of list) chunks.set(c.id, c); },
    async removeSource(id) { sources.delete(id); for (const [k, c] of chunks) if (c.src === id) chunks.delete(k); },
    async sources() { return [...sources.values()]; },
    async chunks() { return [...chunks.values()]; },
    async clear() { sources.clear(); chunks.clear(); },
  };
}
export function idbStore(name = "attune-knowledge") {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(name, 1);
    rq.onupgradeneeded = () => { const db = rq.result; db.createObjectStore("sources", { keyPath: "id" }); const c = db.createObjectStore("chunks", { keyPath: "id" }); c.createIndex("src", "src"); };
    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
  }));
  const tx = async (stores, mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(stores, mode); let out; Promise.resolve(fn(t)).then((v) => { out = v; }, rej); t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); };
  const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return {
    kind: "idb",
    putSource: (s, list) => tx(["sources", "chunks"], "readwrite", (t) => { t.objectStore("sources").put(s); const c = t.objectStore("chunks"); for (const x of list) c.put(x); }),
    removeSource: (id) => tx(["sources", "chunks"], "readwrite", async (t) => {
      t.objectStore("sources").delete(id);
      const keys = await req(t.objectStore("chunks").index("src").getAllKeys(id));
      const c = t.objectStore("chunks"); for (const k of keys) c.delete(k);
    }),
    sources: () => tx(["sources"], "readonly", (t) => req(t.objectStore("sources").getAll())),
    chunks: () => tx(["chunks"], "readonly", (t) => req(t.objectStore("chunks").getAll())),
    clear: () => tx(["sources", "chunks"], "readwrite", (t) => { t.objectStore("sources").clear(); t.objectStore("chunks").clear(); }),
  };
}

// ---- the Knowledge itself: stored sources + live adapters (Mind now, Shelf later) -----------------------------------------------------
/**
 * An adapter brings notes that live elsewhere in the app, read live (nothing copied): { id: "mind", label, version(): any,
 * items(): [{ id, title, text, updated? }] }. Shelf notes plug in the same way later.
 */
export function mindAdapter(getRecords, kindOf) {
  return {
    id: "mind", label: "Mind notes",
    version: () => { const r = getRecords() || []; return r.length + ":" + (r[0] ? r[0].ts || r[0].id : ""); },
    items: () => (getRecords() || []).filter((r) => !kindOf || kindOf(r) !== "answer").map((r) => ({ id: String(r.id || r.ts), title: r.title || "", text: [r.text, r.note].filter(Boolean).join("\n") })).filter((x) => (x.title + x.text).trim()),
  };
}

let seq = 0;
const newId = () => "k" + Date.now().toString(36) + (seq++).toString(36);
export const sizeOf = (s) => (typeof TextEncoder !== "undefined" ? new TextEncoder().encode(String(s || "")).length : String(s || "").length);

export function createKnowledge(store, { adapters = [], now = () => Date.now() } = {}) {
  let index = null, stamp = "", dirty = true, cache = null;
  const advStamp = () => adapters.map((a) => a.id + "=" + (a.enabled === false ? "off" : a.version())).join("|");
  const K = {
    store, adapters,
    /** Add a source: { kind: "text"|"file"|"doc"|"pack", title, text | pages, lang?, url?, license? } → the stored source. */
    async add(src) {
      const id = src.id || newId();
      const parts = chunkSource(src);
      if (!parts.length) throw new Error("There is no readable text in this source.");
      const chunks = parts.map((p, i) => ({ id: id + "#" + i, src: id, title: src.title || "", page: p.page, text: p.text, kind: src.kind || "text" }));
      const bytes = chunks.reduce((s, c) => s + sizeOf(c.text), 0);
      const rec = { id, kind: src.kind || "text", title: src.title || "", added: now(), bytes, chunks: chunks.length, pages: src.pages ? src.pages.length : 0, url: src.url || "", license: src.license || "", pack: src.pack || "" };
      await store.putSource(rec, chunks); dirty = true;
      return rec;
    },
    async remove(id) { await store.removeSource(id); dirty = true; },
    async sources() { return (await store.sources()).sort((a, b) => b.added - a.added); },
    /** Live adapter sources as list rows (not stored). */
    adapterRows() { return adapters.map((a) => { const it = a.enabled === false ? [] : a.items(); return { id: "@" + a.id, kind: a.id, title: a.label, live: true, chunks: it.length, bytes: it.reduce((s, x) => s + sizeOf(x.title + x.text), 0) }; }); },
    invalidate() { dirty = true; },
    /** (Re)builds the word index if anything changed. */
    async ensure() {
      const st = advStamp();
      if (!dirty && index && st === stamp) return index;
      if (dirty || !cache) cache = await store.chunks();
      const live = [];
      for (const a of adapters) {
        if (a.enabled === false) continue;
        for (const it of a.items()) for (const [i, p] of chunkSource({ text: it.text }).entries()) live.push({ id: "@" + a.id + ":" + it.id + "#" + i, src: "@" + a.id, title: it.title || a.label, page: 0, text: p.text, kind: a.id });
      }
      index = indexChunks(cache.concat(live)); stamp = st; dirty = false;
      return index;
    },
    /** The facts for a question (empty when it isn't a lookup or nothing fits). */
    async find(question, o) {
      if (!wantsFacts(question)) return [];
      return findFacts(await K.ensure(), question, o);
    },
    async stats() {
      const s = await store.sources(); const rows = K.adapterRows();
      return { sources: s.length + rows.filter((r) => r.chunks).length, chunks: s.reduce((a, x) => a + x.chunks, 0) + rows.reduce((a, x) => a + x.chunks, 0), bytes: s.reduce((a, x) => a + x.bytes, 0) + rows.reduce((a, x) => a + x.bytes, 0) };
    },
  };
  return K;
}

// ---- downloadable public packs ------------------------------------------------------------------------------------------------------
/*  A pack is a GitHub release (tag know-<id>-v1) built by tools/build_know_pack.py:
      manifest.json  { id, name, name_ar, version, built, license, attribution, sources:[{title,url,license}], count, bytes,
                       shards: [{ name, bytes, count }] }
      <id>-NNN.jsonl.gz   one passage per line: { t: title, x: text, u: url, l: "en"|"ar" }
    Each shard becomes one stored source (so a pack can be removed as a whole: every source carries pack = id). */
export const KNOW_BASE = "https://github.com/alydibiky/attune-/releases/download/";
export const CATALOG = [
  { id: "world", tag: "know-world-v1", name: "World facts", name_ar: "حقائق عن دول العالم", size: "≈ 3 MB", size_ar: "≈ ٣ ميجابايت", license: "Public domain (CIA World Factbook)", license_ar: "ملكية عامة (كتاب حقائق العالم)",
    about: "Every country's geography, people, government, economy, energy and transport — Egypt first and complete. CIA World Factbook, public domain.",
    about_ar: "جغرافيا كل دولة وسكانها وحكومتها واقتصادها وطاقتها ومواصلاتها — مصر أولًا وكاملة. من كتاب حقائق العالم، ملكية عامة." },
  { id: "egy-laws", tag: "know-egy-laws-v1", name: "Egyptian laws (Arabic)", name_ar: "القوانين المصرية", size: "≈ 3 MB", size_ar: "≈ ٣ ميجابايت", license: "MIT, as declared by the publisher (Dataflare)", license_ar: "ترخيص مفتوح حسب الناشر",
    about: "Articles of Egyptian laws and codes (civil, procedure, penal, labour, commercial, tax, rent, personal status…), each passage titled with its law and article. From the Egyptian Legal Corpus (Dataflare), MIT as declared.",
    about_ar: "مواد القوانين المصرية (المدني، المرافعات، العقوبات، العمل، التجاري، الضرائب، الإيجارات، الأحوال الشخصية…)، ومع كل فقرة اسم القانون ورقم المادة. من مجموعة نصوص قانونية منشورة بترخيص مفتوح.",
    notice: "Not legal advice; may be out of date; check the official gazette.", notice_ar: "ليست استشارة قانونية؛ قد تكون قديمة؛ راجع الجريدة الرسمية." },
];
export const parsePackShard = (text) => String(text || "").split("\n").map((l) => { try { return l.trim() ? JSON.parse(l) : null; } catch (e) { return null; } }).filter((r) => r && r.x);

/** Installs a pack shard by shard (resumable: shards already installed are skipped). */
export async function installKnowPack(K, { manifest, getText, onProgress = () => {}, isStopped = () => false }) {
  const have = new Set((await K.sources()).filter((s) => s.pack === manifest.id).map((s) => s.id));
  let done = 0;
  for (const sh of manifest.shards) {
    if (isStopped()) break;
    const id = "pack:" + manifest.id + ":" + sh.name;
    if (!have.has(id)) {
      const rows = parsePackShard(await getText(sh.name));
      // passages are already cut by the builder: one stored chunk per row, title = the article
      const cat = CATALOG.find((c) => c.id === manifest.id) || {};
      const note = manifest.notice || cat.notice || "";   // e.g. the laws pack: "Not legal advice…" travels with every passage
      const chunks = rows.map((r, i) => ({ id: id + "#" + i, src: id, title: r.t || "", page: 0, text: r.x, kind: "pack", url: r.u || "", ...(note ? { note, note_ar: manifest.notice_ar || cat.notice_ar || "" } : {}) }));
      const bytes = chunks.reduce((s, c) => s + sizeOf(c.text), 0);
      await K.store.putSource({ id, kind: "pack", pack: manifest.id, title: manifest.name + " · " + (done + 1) + "/" + manifest.shards.length, added: Date.now(), bytes, chunks: chunks.length, license: manifest.license || "", url: "" }, chunks);
      K.invalidate();
    }
    done++; onProgress({ shard: done, of: manifest.shards.length });
  }
  return done;
}
export async function removeKnowPack(K, packId) { for (const s of await K.sources()) if (s.pack === packId) await K.remove(s.id); }
