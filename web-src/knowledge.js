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
const SOLVE = /\b(solve|calculate|compute|find the|derive|prove|simplify|integrate|differentiate|evaluate|how (much|many|long|far|fast)|write (a|an|the|me)?\s*(code|program|function|script|class|query)|fix (this|my)|debug|implement|explain how|step by step)\b|احسب|حل |أوجد|اوجد|اثبت|أثبت|بسّط|بسط|اشتق|كامل|اكتب (كود|برنامج|دالة)|صحح الكود|خطوة بخطوة|كيف أحسب|اشرح كيف/i;
export function factsBlock(hits, question = "") {
  if (!hits || !hits.length) return "";
  const ar = hasArabic(question);
  // code keeps its lines (the coding pack, or any passage with an indented or fenced block)
  const body = (t) => /```|\n {2,}\S|\n\t/.test(t) ? "\n" + String(t).trim() : String(t).replace(/\s+/g, " ").trim();
  const lines = hits.map((h) => `[${h.tag}] (${h.chunk.title || "note"}${h.chunk.page ? ", p. " + h.chunk.page : ""}) ${body(h.chunk.text)}`);
  // a pack with a warning (the laws pack): the answer must repeat it when it uses those facts
  const notes = [...new Set(hits.filter((h) => h.chunk.note).map((h) => (ar && h.chunk.note_ar) || h.chunk.note))];
  const solve = SOLVE.test(question);
  return "Facts from your Knowledge (the person's own saved sources and the reference packs on this phone):\n" + lines.join("\n") +
    (notes.length ? "\n\nIf you use these facts, end the answer with this line: " + notes.join(" ") : "") +
    "\n\nHow to use them: if these facts answer the question, answer from them only — do not change their numbers, names or dates — and put the tag, like [K1], after each sentence that uses one. " +
    (solve ? "This question asks you to solve, calculate, write code or explain: use the passages' definitions, formulas, rules, code and worked examples as your method, then work it out yourself step by step — show each step, do the arithmetic carefully, and adapt the code to the person's case; put the tag after the step whose method comes from a passage. " : "") +
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
      const chunks = parts.map((p, i) => ({ id: id + "#" + i, src: id, title: src.title || "", page: p.page, text: p.text, kind: src.kind || "text", ...(src.collection ? { coll: src.collection } : {}) }));
      const bytes = chunks.reduce((s, c) => s + sizeOf(c.text), 0);
      const rec = { id, kind: src.kind || "text", title: src.title || "", added: now(), bytes, chunks: chunks.length, pages: src.pages ? src.pages.length : 0, url: src.url || "", license: src.license || "", pack: src.pack || "", ...(src.collection ? { collection: src.collection } : {}) };
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
      const off = K.offPacks;   // v6.16: the person's own packs that are switched off
      index = indexChunks((off && off.size ? cache.filter((c) => !c.coll || !off.has(c.coll)) : cache).concat(live)); stamp = st; dirty = false;
      return index;
    },
    /** v6.16: names of the person's own packs (collections) left out of lookups — set it, then invalidate(). */
    offPacks: new Set(),
    /** v6.16: the public packs searched on the phone (set by the app): async question → passages. */
    packSearch: null,
    /** v6.16: live sources asked only when online (Dorar for hadith questions): async question → passages, or null. */
    liveSearch: null,
    /** The facts for a question (empty when it isn't a lookup or nothing fits): your own sources and the packs, ranked together. */
    async find(question, o) {
      // v6.16: a task to solve (code to write, a problem to work out) still looks things up — the subject packs are its reference
      if (!(o && o.solve) && !wantsFacts(question)) return [];
      const idx = await K.ensure();
      let pack = [];
      if (K.packSearch) { try { pack = (await K.packSearch(question)) || []; } catch (e) { pack = []; } }
      if (K.liveSearch) { try { pack = ((await K.liveSearch(question)) || []).concat(pack); } catch (e) { /* offline or Dorar unreachable: the packs still answer */ } }
      if (!pack.length) return findFacts(idx, question, o);
      const own = idx.N ? rank(idx, question, { k: 9 }).map((h) => h.chunk) : [];
      const cands = own.concat(pack.map((p) => ({ id: p.id, src: "pack:" + p.pack, title: p.title || "", page: 0, text: p.text || "", kind: "pack", url: p.url || "", pack: p.pack,
        ...(p.notice ? { note: p.notice, note_ar: p.notice_ar || "" } : {}) })));
      return findFacts(indexChunks(cands), question, o);
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
  { id: "world", legacy: true, name: "World facts", name_ar: "حقائق عن دول العالم", size: "≈ 8 MB", size_ar: "≈ ٨ ميجابايت", license: "Public domain (CIA World Factbook)", license_ar: "ملكية عامة (كتاب حقائق العالم)",
    about: "Every country's geography, people, government, economy, energy and transport. CIA World Factbook, public domain.",
    about_ar: "جغرافيا كل دولة وسكانها وحكومتها واقتصادها وطاقتها ومواصلاتها. من كتاب حقائق العالم، ملكية عامة." },
  { id: "numbers", name: "Country numbers", name_ar: "أرقام الدول", size: "≈ 1 MB", size_ar: "≈ ١ ميجابايت", license: "CC BY 4.0 (World Bank)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (البنك الدولي)",
    about: "Each country's latest population, GDP, growth, inflation, unemployment, life expectancy, trade and more — World Bank open data, rebuilt every month.",
    about_ar: "أحدث أرقام كل دولة: السكان والناتج المحلي والنمو والتضخم والبطالة ومتوسط العمر والتجارة وغيرها — بيانات البنك الدولي، تُحدَّث كل شهر." },
  { id: "cities", name: "Countries & cities", name_ar: "الدول والمدن", size: "≈ 6 MB", size_ar: "≈ ٦ ميجابايت", license: "CC BY 4.0 (GeoNames)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (جيونيمز)",
    about: "Every city over 15,000 people (with Arabic names), each country's capital, currency, calling code and languages — GeoNames.",
    about_ar: "كل مدينة يزيد سكانها على ١٥ ألفًا (بأسمائها العربية)، وعاصمة كل دولة وعملتها ورمز الاتصال ولغاتها — من جيونيمز." },
  { id: "math", name: "Mathematics", name_ar: "الرياضيات", size: "≈ 12 MB", size_ar: "≈ ١٢ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "University and school math textbooks — calculus 1–3, algebra and trigonometry, precalculus, statistics, algebra — with every formula and worked example, so Chat can solve step by step.",
    about_ar: "كتب الرياضيات الجامعية والمدرسية — التفاضل والتكامل ١–٣، والجبر وحساب المثلثات، وما قبل التفاضل، والإحصاء — بكل الصيغ والأمثلة المحلولة، ليحل المحادثة المسائل خطوة بخطوة." },
  { id: "physics", name: "Physics", name_ar: "الفيزياء", size: "≈ 10 MB", size_ar: "≈ ١٠ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "University Physics 1–3, College Physics, high-school Physics and Astronomy — laws, formulas and worked examples.",
    about_ar: "الفيزياء الجامعية ١–٣، وفيزياء الكلية، والفيزياء المدرسية، والفلك — القوانين والصيغ والأمثلة المحلولة." },
  { id: "chemistry", name: "Chemistry", name_ar: "الكيمياء", size: "≈ 6 MB", size_ar: "≈ ٦ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "Chemistry 2e, Chemistry: Atoms First and Organic Chemistry — reactions, equations and worked examples.",
    about_ar: "الكيمياء، والكيمياء: الذرات أولًا، والكيمياء العضوية — التفاعلات والمعادلات والأمثلة المحلولة." },
  { id: "biology", name: "Biology", name_ar: "الأحياء", size: "≈ 9 MB", size_ar: "≈ ٩ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "Biology 2e, Concepts of Biology, Anatomy & Physiology, Microbiology and AP Biology.",
    about_ar: "الأحياء، ومفاهيم الأحياء، والتشريح ووظائف الأعضاء، والأحياء الدقيقة، والأحياء المتقدمة." },
  { id: "history", name: "History", name_ar: "التاريخ", size: "≈ 5 MB", size_ar: "≈ ٥ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "World History volumes 1–2 (from the first civilisations to today) and US History.",
    about_ar: "تاريخ العالم بجزأيه (من الحضارات الأولى حتى اليوم) وتاريخ الولايات المتحدة." },
  { id: "geography", name: "Geography", name_ar: "الجغرافيا", size: "≈ 8 MB", size_ar: "≈ ٨ ميجابايت", license: "Public domain (CIA World Factbook) + CC BY 4.0 (GeoNames)", license_ar: "ملكية عامة (كتاب حقائق العالم) ورخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (جيونيمز)",
    about: "Each country's geography — location, area, borders, climate, terrain, highest and lowest points, resources, hazards — and the world's well-known mountains, rivers, lakes, deserts, islands and seas with their heights and places.",
    about_ar: "جغرافيا كل دولة — الموقع والمساحة والحدود والمناخ والتضاريس وأعلى وأدنى نقطة والموارد والمخاطر — وأشهر جبال العالم وأنهاره وبحيراته وصحاريه وجزره وبحاره بارتفاعاتها وأماكنها." },
  { id: "coding", name: "Coding", name_ar: "البرمجة", size: "≈ 12 MB", size_ar: "≈ ١٢ ميجابايت", license: "PSF (Python docs), CC BY-SA 2.5 (MDN), Apache 2.0 (Kotlin)", license_ar: "رخصة بايثون للتوثيق، ورخصة المشاع الإبداعي مع الإسناد والمشاركة بالمثل ٢٫٥ (إم دي إن)، ورخصة أباتشي ٢٫٠ (كوتلن)",
    about: "The official Python documentation, MDN's JavaScript, HTML and CSS reference and guides, and the Kotlin docs — with their code examples line by line.",
    about_ar: "التوثيق الرسمي للغة بايثون، ومراجع وأدلة جافاسكربت وإتش تي إم إل وسي إس إس من إم دي إن، وتوثيق كوتلن — بأمثلة الكود سطرًا سطرًا." },
  { id: "science", name: "Society, economics & business", name_ar: "المجتمع والاقتصاد والأعمال", size: "≈ 15 MB", size_ar: "≈ ١٥ ميجابايت", license: "CC BY 4.0 (OpenStax)", license_ar: "رخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (أوبن ستاكس)",
    about: "Peer-reviewed university textbooks: psychology, economics, sociology, philosophy, business, management, marketing, accounting, government — OpenStax (Rice University).",
    about_ar: "كتب جامعية محكَّمة: علم النفس والاقتصاد وعلم الاجتماع والفلسفة والأعمال والإدارة والتسويق والمحاسبة ونظم الحكم — أوبن ستاكس (جامعة رايس)." },
  { id: "health", name: "Health", name_ar: "الصحة", size: "≈ 3 MB", size_ar: "≈ ٣ ميجابايت", license: "Public domain (US National Library of Medicine)", license_ar: "ملكية عامة (المكتبة الوطنية الأمريكية للطب)",
    about: "About 1,000 health topics — conditions, symptoms, treatments, tests, healthy living — written and reviewed by MedlinePlus.",
    about_ar: "نحو ١٠٠٠ موضوع صحي — الأمراض والأعراض والعلاج والفحوص والحياة الصحية — من ميدلاين بلس.",
    notice: "General health information, not medical advice — see a doctor for your own case.", notice_ar: "معلومات صحية عامة وليست نصيحة طبية — راجع طبيبًا في حالتك." },
  { id: "cranes", name: "Cranes & lifting rules", name_ar: "قواعد الرافعات والرفع", size: "≈ 1 MB", size_ar: "≈ ١ ميجابايت", license: "Public domain (US government)", license_ar: "ملكية عامة (الحكومة الأمريكية)",
    about: "OSHA's rules for cranes and derricks, overhead and mobile cranes, rigging and slings — inspections, operator qualification, assembly, power lines, signals.",
    about_ar: "قواعد أوشا للرافعات والأوناش العلوية والمتحركة والرفع والحبال — الفحص وتأهيل المشغّل والتركيب وخطوط الكهرباء والإشارات.",
    notice: "US rules (OSHA) — for safety guidance; Egyptian law and the manufacturer's load chart come first.", notice_ar: "قواعد أمريكية (أوشا) للإرشاد في السلامة؛ القانون المصري وجدول أحمال الشركة المصنّعة لهما الأولوية." },
  { id: "egy-laws", legacy: true, name: "Egyptian laws (Arabic)", name_ar: "القوانين المصرية", size: "≈ 7 MB", size_ar: "≈ ٧ ميجابايت", license: "MIT, as declared by the publisher (Dataflare)", license_ar: "ترخيص إم آي تي كما أعلنه الناشر (داتافلير)",
    about: "Articles of Egyptian laws and codes (civil, procedure, penal, labour, commercial, tax, rent, personal status…), each passage titled with its law and article.",
    about_ar: "مواد القوانين المصرية (المدني، المرافعات، العقوبات، العمل، التجاري، الضرائب، الإيجارات، الأحوال الشخصية…)، ومع كل فقرة اسم القانون ورقم المادة.",
    notice: "Not legal advice; may be out of date; check the official gazette.", notice_ar: "ليست استشارة قانونية؛ قد تكون قديمة؛ راجع الجريدة الرسمية." },
  { id: "quran", name: "The Quran + Tafsir al-Muyassar", name_ar: "القرآن الكريم مع التفسير الميسر", size: "≈ 4 MB", size_ar: "≈ ٤ ميجابايت", license: "Tanzil Project (verbatim) + King Fahd Complex, with credit", license_ar: "مشروع تنزيل (النص كما هو) ومجمع الملك فهد، مع ذكر المصدر",
    about: "The full Arabic text, verse by verse, from the verified Tanzil text — and al-Tafsir al-Muyassar (King Fahd Complex) for every verse, with each surah's introduction.",
    about_ar: "النص العربي كاملًا، آيةً آية، من نص تنزيل الموثَّق — ومعه التفسير الميسر (مجمع الملك فهد) لكل آية، ومقدمة كل سورة." },
  { id: "cars", name: "Cars — specs", name_ar: "السيارات — المواصفات", size: "≈ 15 MB", size_ar: "≈ ١٥ ميجابايت", license: "Public domain (US EPA) + CC BY 4.0 (EEA)", license_ar: "ملكية عامة (وكالة حماية البيئة الأمريكية) ورخصة المشاع الإبداعي، نسب المصنَّف ٤٫٠ (وكالة البيئة الأوروبية)",
    about: "Every car sold in the US from 2000 to today (engine, gearbox, drive, fuel use, electric range, CO2) and every version registered in Europe since 2010 — Chinese brands included (BYD, MG, Chery, Geely, Zeekr, NIO, XPeng, Leapmotor, GWM…): power, weight, range and consumption. Official test figures; prices are not included.",
    about_ar: "كل سيارة بيعت في أمريكا من ٢٠٠٠ حتى اليوم (المحرك وناقل الحركة والدفع والاستهلاك ومدى الكهرباء والانبعاثات) وكل نسخة سُجّلت في أوروبا منذ ٢٠١٠ — ومنها الماركات الصينية (بي واي دي، إم جي، شيري، جيلي، زيكر، نيو، إكس بنغ، ليب موتور، جريت وول…): القوة والوزن والمدى والاستهلاك. أرقام الاختبارات الرسمية، ولا تشمل الأسعار.",
    notice: "Official test figures (EPA / WLTP); prices are not in these sources — ask online for today's price.", notice_ar: "أرقام الاختبارات الرسمية؛ الأسعار ليست في هذه المصادر — اسأل عبر الإنترنت عن السعر الحالي." },
  { id: "hadith", name: "Hadith (main books, with rulings)", name_ar: "الحديث النبوي مع الأحكام", size: "≈ 20 MB", size_ar: "≈ ٢٠ ميجابايت", license: "Public domain (hadith-api)", license_ar: "ملكية عامة",
    about: "About 36,000 hadiths: Sahih al-Bukhari, Sahih Muslim, the four Sunan, the Muwatta and the Forties — each with the rulings of al-Albani, Shu'ayb al-Arna'ut, Ahmad Shakir and others. Online, hadith questions also search Dorar (dorar.net).",
    about_ar: "نحو ٣٦ ألف حديث: صحيح البخاري وصحيح مسلم والسنن الأربع والموطأ والأربعينات — ومع كل حديث أحكام الألباني وشعيب الأرناؤوط وأحمد شاكر وغيرهم. ومع الاتصال بالإنترنت يُبحث في الدرر السنية أيضًا.",
    notice: "Rulings are quoted from the scholars named; for a doubtful hadith, check Dorar (dorar.net).", notice_ar: "الأحكام منقولة عن العلماء المذكورين؛ وللتحقق من حديث مشكوك فيه راجع الدرر السنية." },
  { id: "fiqh", name: "Islamic jurisprudence (al-Fiqh al-Muyassar)", name_ar: "الفقه الميسر", size: "≈ 10 MB", size_ar: "≈ ١٠ ميجابايت", license: "The publishers' texts via the Shamela library, with credit", license_ar: "نصوص الناشرين عبر المكتبة الشاملة، مع ذكر المصدر",
    about: "The full al-Fiqh al-Muyassar (al-Tayyar, al-Mutlaq, al-Musa — 13 volumes) and al-Fiqh al-Muyassar in the light of the Quran and Sunnah (King Fahd Complex): purification, prayer, zakat, fasting, hajj, transactions, family, inheritance and more — each passage with its book, chapter, volume and page.",
    about_ar: "الفقه الميسر كاملًا (الطيار والمطلق والموسى — ١٣ جزءًا) والفقه الميسر في ضوء الكتاب والسنة (مجمع الملك فهد): الطهارة والصلاة والزكاة والصيام والحج والمعاملات والأسرة والمواريث وغيرها — ومع كل فقرة اسم الكتاب والباب والجزء والصفحة.",
    notice: "For learning; for a ruling on your own case, ask a qualified scholar or Dar al-Ifta.", notice_ar: "للتعلّم؛ وفي مسألتك الخاصة اسأل عالمًا موثوقًا أو دار الإفتاء." },
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

/**
 * v6.16 (Ali: "integrate them so the model has this knowledge and Chat answers me"; "find reliable sources and make the app
 * better in general knowledge") — the public packs are ready search databases on the phone (KnowPacks.kt), installed by
 * themselves: missing ones are fetched, a newer published build replaces the old one, and the old in-page copies of the
 * first two packs (stored passages, heavy in memory) are removed once the phone has them.
 * native: { list() → [{id, built}], remote(id) → manifest, install(id) → manifest }. → the catalogue entries installed now.
 */
export async function autoInstallPacks(K, native, { ids = CATALOG.map((c) => c.id), isStopped = () => false, bigOk = true, big = 15e6 } = {}) {
  const done = [];
  const have = new Map(((await native.list()) || []).map((p) => [p.id, p]));
  for (const id of ids) {
    if (isStopped()) break;
    const cat = CATALOG.find((c) => c.id === id); if (!cat) continue;
    let man; try { man = await native.remote(id); } catch (e) { continue; }       // not published yet, or no signal
    const mine = have.get(id);
    const bytes = ((man.files || []).reduce((t, f) => t + (Number(f.bytes) || 0), 0));
    if (!bigOk && bytes > big) continue;                                          // a big pack waits for Wi-Fi
    if (!mine || String(man.built || "") > String(mine.built || "")) {
      try { await native.install(id); done.push(cat); } catch (e) { continue; }
    }
    if (cat.legacy && (await K.sources()).some((s) => s.pack === id)) await removeKnowPack(K, id);
  }
  return done;
}

// ---- الدرر السنية (Dorar): hadith with the scholars' rulings, asked live -----------------------------------------------------------
const HADITH_Q = /حديث|أحاديث|احاديث|الحديث|رواه|يروى|صحيح|ضعيف|موضوع|سند|إسناد|اسناد|قال رسول|قال النبي|النبي ﷺ|صلى الله عليه وسلم|الرسول|\bhadith|\bsunnah|\bnarrat/i;
/** Is this a question Dorar can help with (a hadith, its wording or its ruling)? */
export const isHadithQuestion = (q) => HADITH_Q.test(String(q || ""));
const DORAR_DROP = new Set("هل ما ماذا كيف من في على عن حديث أحاديث احاديث الحديث صحيح صحة ضعيف درجة حكم ما حكم هذا هذه رواه قال النبي الرسول رسول الله صلى عليه وسلم ﷺ يقول ورد أريد اريد ابحث عن نص".split(" "));
/** The words of the hadith itself: question words, "صحيح؟", "حديث" and the salawat removed. */
export function dorarQuery(q) {
  const w = String(q || "").replace(/[«»"“”'؟?!.,،:؛()\[\]﴿﴾]/g, " ").split(/\s+/).filter((x) => x && !DORAR_DROP.has(x));
  return w.join(" ").trim();
}
const stripTags = (h) => String(h || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").trim();
/** Dorar's API answer ({ahadith: {result: HTML}}) → passages: the hadith, then الراوي، المحدث، المصدر، الرقم and خلاصة حكم المحدث. */
export function parseDorar(body, q) {
  let html = "";
  try { const j = typeof body === "string" ? JSON.parse(body) : body; html = (j && j.ahadith && j.ahadith.result) || ""; } catch (e) { return []; }
  const out = []; const re = /<div class="hadith"[^>]*>([\s\S]*?)<\/div>\s*<div class="hadith-info">([\s\S]*?)<\/div>/g; let m;
  while ((m = re.exec(html))) {
    const text = stripTags(m[1]).replace(/^\d+\s*-\s*/, "").trim();
    const info = {}; const parts = m[2].split(/<span class="info-subtitle">/).slice(1);
    for (const p of parts) { const i = p.indexOf("</span>"); if (i < 0) continue; const label = stripTags(p.slice(0, i)).replace(/:$/, "").trim(); info[label] = stripTags(p.slice(i + 7)); }
    if (!text) continue;
    const lines = ["الراوي", "المحدث", "المصدر", "الصفحة أو الرقم", "خلاصة حكم المحدث"].filter((k) => info[k]).map((k) => k + ": " + info[k]);
    out.push({ id: "dorar:" + out.length, pack: "dorar", title: "الدرر السنية — " + [info["المصدر"], info["الصفحة أو الرقم"]].filter(Boolean).join(" ") + (info["المحدث"] ? " (" + info["المحدث"] + ")" : ""),
      text: text + "\n" + lines.join("\n"), url: "https://dorar.net/hadith/search?q=" + encodeURIComponent(q || ""),
      notice: "Ruling as given by the scholar named (Dorar, dorar.net).", notice_ar: "الحكم كما ذكره المحدّث المسمّى (الدرر السنية)." });
  }
  return out.slice(0, 15);
}
/** For createKnowledge.liveSearch: asks Dorar only for hadith questions, through the phone (native dorarSearch). */
export function dorarSearch(nativeCall, isOnline = () => true) {
  return async (question) => {
    if (!isHadithQuestion(question) || !isOnline()) return [];
    const q = dorarQuery(question); if (q.length < 3) return [];
    const r = await nativeCall("dorarSearch", q);
    return parseDorar(r && r.body, q);
  };
}

/** The phone's pack search for createKnowledge: question → [{ id, pack, title, text, url, notice, notice_ar }]. */
export function phonePackSearch(nativeCall) {
  return async (question) => {
    const r = await nativeCall("knowSearch", { q: question, k: 24 });
    return (r && r.passages) || [];
  };
}
