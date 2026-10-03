/* ---- Ask a PDF: read a document, chat with it, every answer pointing at its pages (v6.18) --------------------------------------------
   A phone model cannot hold a 300-page book, and re-reading all of it for every question is slow and wasteful. So the document is
   cut into passages that remember their page, and each question gets only the few passages that fit it (BM25 over normalised
   English / Arabic words, with a boost for exact phrases and numbers). The model is told to answer from those passages only and to
   cite pages like [p. 12]; code then checks every citation — a page the model was never shown is removed, and an answer with no
   valid citation is marked as unsupported instead of being passed off as the document's words.
   Questions that ask for the whole document ("summarise", "main points", "table of contents") use a plan instead: the pages are
   grouped into sections, each section is read into notes, and the notes become the answer — still with page ranges.
   Pure logic (no screen, no model): tests/unit/v619docqa.test.mjs. The screen is pdfchat-ui.jsx.                                  */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const toLatin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d))).replace(/٫/g, ".");
export const norm = (s) => toLatin(s).toLowerCase().replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}\s.%]/gu, " ").replace(/\s+/g, " ").trim();

const STOP = new Set(("the a an and or of to in on for with from by at is are was were be been it this that these those as about into what which who whom whose when where why how does do did can could would should will shall may might me my i you we they he she his her their our your there here than then also not no yes any all some more most such very per via vs please tell give show say said says mention mentioned document pdf file paper text page pages " +
  "في من على الى عن مع هل ما ماذا لماذا كيف اين متى هذا هذه ذلك تلك هو هي هم انا انت نحن كان كانت يكون تكون ثم او و ان انه انها قال يقول اذكر اشرح لي لنا الملف الوثيقه الصفحه صفحه المستند").split(/\s+/));
/** A light stem so "contracts" ~ "contract", "الشركات" ~ "شركه". */
const stem = (w) => {
  if (/^[a-z]+$/.test(w)) return w.length > 5 ? w.replace(/(ing|edly|edly|ed|es|s|ly)$/, "") : w.replace(/s$/, "");
  return w.length > 4 ? w.replace(/^(وال|بال|كال|فال|لل|ال)/, "").replace(/(ات|ون|ين|ان|ها|هم|ه|ي)$/, "") : w.replace(/^ال/, "");
};
export const words = (text) => norm(text).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem).filter((w) => w.length > 1);

// ---- the index -------------------------------------------------------------------------------------------------------------------
/** pages: [{ n, text }]. → { pages, chunks: [{ id, page, text, tf: Map, len }], df: Map, avg, N } */
export function buildIndex(pages, { size = 700, overlap = 120 } = {}) {
  const chunks = [];
  const clean = (pages || []).map((p) => ({ n: p.n, text: String(p.text || "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim() })).filter((p) => p.text);
  for (const p of clean) {
    const paras = p.text.split(/\n\s*\n|\n(?=[A-Z0-9•\-–—]|[؀-ۿ]{2,}[:.])/).map((t) => t.trim()).filter(Boolean);
    let cur = "";
    const push = (t) => { if (t.trim()) chunks.push({ id: chunks.length, page: p.n, text: t.trim() }); };
    for (const para of paras) {
      if (para.length > size * 1.5) {                              // a long paragraph: cut at sentence ends
        if (cur) { push(cur); cur = ""; }
        const sents = para.split(/(?<=[.!?؟۔])\s+/); let s = "";
        for (const x of sents) { if ((s + " " + x).length > size && s) { push(s); s = s.slice(Math.max(0, s.length - overlap)).replace(/^\S*\s/, "") + " " + x; } else s = s ? s + " " + x : x; }
        if (s) push(s);
      } else if ((cur + "\n" + para).length > size && cur) { push(cur); cur = para; }
      else cur = cur ? cur + "\n" + para : para;
    }
    if (cur) push(cur);
  }
  const df = new Map(); let total = 0;
  for (const c of chunks) {
    const ws = words(c.text); c.len = ws.length || 1; total += c.len;
    c.tf = new Map(); for (const w of ws) c.tf.set(w, (c.tf.get(w) || 0) + 1);
    for (const w of c.tf.keys()) df.set(w, (df.get(w) || 0) + 1);
    c.norm = norm(c.text);
  }
  return { pages: clean, chunks, df, avg: chunks.length ? total / chunks.length : 1, N: chunks.length };
}

/** Rank passages for a question (BM25, plus phrases and numbers). → [{ chunk, score }] best first. */
export function rank(index, question, { k = 8 } = {}) {
  const q = words(question); if (!q.length || !index.N) return [];
  const uniq = [...new Set(q)];
  const nums = (toLatin(question).match(/\d+(?:[.,]\d+)?%?/g) || []).map((x) => x.replace(/,/g, ""));
  const qn = norm(question);
  const phrases = []; for (let i = 0; i + 1 < q.length; i++) phrases.push(q[i] + " " + q[i + 1]);
  const k1 = 1.4, b = 0.7, out = [];
  for (const c of index.chunks) {
    let s = 0;
    for (const w of uniq) {
      const f = c.tf.get(w) || 0; if (!f) continue;
      const idf = Math.log(1 + (index.N - (index.df.get(w) || 0) + 0.5) / ((index.df.get(w) || 0) + 0.5));
      s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * c.len / index.avg));
    }
    if (!s) continue;
    for (const ph of phrases) if (c.norm.includes(ph.split(" ").map((x) => x).join(" "))) s *= 1.15;
    for (const n of nums) if (new RegExp("(^|[^\\d.])" + n.replace(".", "\\.") + "($|[^\\d])").test(toLatin(c.text))) s *= 1.35;
    if (qn.length > 6 && c.norm.includes(qn)) s *= 1.6;
    out.push({ chunk: c, score: s });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/** The passages to show the model: best first, within a character budget, merged per page in page order, neighbours of a strong hit added. */
export function retrieve(index, question, { budget = 4500, k = 8 } = {}) {
  const top = rank(index, question, { k });
  const picked = new Map(); let used = 0;
  const take = (c) => { if (picked.has(c.id) || used + c.text.length > budget) return false; picked.set(c.id, c); used += c.text.length; return true; };
  for (const { chunk } of top) take(chunk);
  // a strong first hit: the next passage on the SAME page often holds the rest of the sentence or the table
  if (top[0]) { const nx = index.chunks[top[0].chunk.id + 1]; if (nx && nx.page === top[0].chunk.page) take(nx); }
  const list = [...picked.values()].sort((a, b) => a.id - b.id);
  return { excerpts: list.map((c) => ({ page: c.page, text: c.text })), pages: [...new Set(list.map((c) => c.page))], score: top[0] ? top[0].score : 0 };
}

/** "what does page 12 say" / "اشرح صفحة ٥" → [12]; ranges "pages 3-5" too. */
export function pageRefs(q) {
  const t = toLatin(q).toLowerCase(); const out = [];
  for (const m of t.matchAll(/\b(?:pages?|pp?\.?)\s*(\d+)(?:\s*(?:-|–|to|and)\s*(\d+))?/g)) { const a = +m[1], b = m[2] ? +m[2] : a; for (let p = a; p <= Math.min(b, a + 9); p++) out.push(p); }
  for (const m of t.matchAll(/(?:صفحه|صفحة|ص)\s*(\d+)(?:\s*(?:-|–|الى|إلى|و)\s*(\d+))?/g)) { const a = +m[1], b = m[2] ? +m[2] : a; for (let p = a; p <= Math.min(b, a + 9); p++) out.push(p); }
  return [...new Set(out)];
}
/** The passages of exactly those pages (for "explain page 7"). */
export function pageExcerpts(index, pages, budget = 4500) {
  const out = []; let used = 0;
  for (const n of pages) for (const c of index.chunks) if (c.page === n && used + c.text.length <= budget) { out.push({ page: c.page, text: c.text }); used += c.text.length; }
  return { excerpts: out, pages: [...new Set(out.map((e) => e.page))], score: 1 };
}

// ---- what is being asked -----------------------------------------------------------------------------------------------------------
/** "summary" (the whole document), "outline", or "find" (a specific thing). */
export function intent(q) {
  const t = norm(q);
  if (/\b(summar\w*|overview|main points|key points|key takeaways|tl dr|tldr|gist|in short|brief me|what is (this|it) about|what is the (document|pdf|file|paper|book) about)\b/.test(t) || /(لخص|تلخيص|ملخص|خلاصه|ايه ده|عن ايه|الافكار الرئيسيه|النقاط الرئيسيه|النقاط المهمه)/.test(t)) return "summary";
  if (/\b(table of contents|outline|structure|chapters|sections|headings)\b/.test(t) || /(فهرس|المحتويات|الفصول|الاقسام|العناوين)/.test(t)) return "outline";
  return "find";
}

// ---- prompts ---------------------------------------------------------------------------------------------------------------------------
const SYS = (ar) => `You answer questions about ONE document, using ONLY the numbered excerpts you are given. Each excerpt starts with its page, like [p. 12].
Rules: (1) Use only what the excerpts say; never add facts from memory. (2) After every fact write the page it came from, like [p. 12] (several: [p. 3, 7]). (3) If the excerpts do not contain the answer, say so plainly in one sentence and name what is missing — do not guess. (4) Quote numbers, names and dates exactly as written. (5) Answer in ${ar ? "Egyptian Arabic (keep names and numbers as in the document)" : "the language of the question"}; be brief and well organised.`;
export const hasArabic = (s) => /[؀-ۿ]/.test(String(s || ""));
export function answerMessages(question, excerpts, history = []) {
  const ar = hasArabic(question);
  const body = excerpts.map((e) => `[p. ${e.page}]\n${e.text}`).join("\n\n---\n\n");
  const prior = history.filter((m) => m && m.text).slice(-4).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text).slice(0, 600) }));
  return [{ role: "system", content: SYS(ar) }, ...prior, { role: "user", content: `Excerpts from the document:\n\n${body || "(no passage matched the question)"}\n\nQuestion: ${String(question).trim()}\n\nAnswer from the excerpts only, citing pages like [p. N].` }];
}

/** Pages → sections of about `chars` characters: [{ from, to, text }]. */
export function sections(index, chars = 3200) {
  const out = []; let cur = null;
  for (const p of index.pages) {
    if (!cur) cur = { from: p.n, to: p.n, text: "" };
    if (cur.text.length + p.text.length > chars && cur.text) { out.push(cur); cur = { from: p.n, to: p.n, text: "" }; }
    cur.text += `\n[p. ${p.n}]\n${p.text.slice(0, chars)}`; cur.to = p.n;
  }
  if (cur && cur.text) out.push(cur);
  return out;
}
export function notesMessages(question, sec, i, n) {
  return [{ role: "system", content: "You read part of a document and write notes for a request. Write 3–6 short bullet notes with the facts that matter for the request; after each bullet put its page like [p. 4]. Use only this part. If nothing matters, reply: none." },
    { role: "user", content: `Request: ${question}\n\nPart ${i} of ${n} (pages ${sec.from}–${sec.to}):\n${sec.text}` }];
}
export function fromNotesMessages(question, notes, outline = false) {
  const ar = hasArabic(question);
  return [{ role: "system", content: `You write the answer to a request about a document from notes taken page by page. Use only the notes; keep every page citation like [p. 4]. ${outline ? "Give a numbered outline of the document in order, each line with its page." : "Start with a 2–3 sentence overview, then the key points as short bullets."} Answer in ${ar ? "Egyptian Arabic" : "the language of the request"}.` },
    { role: "user", content: `Request: ${question}\n\nNotes:\n${notes}` }];
}

// ---- checking the answer ----------------------------------------------------------------------------------------------------------------
const CITE = /\[\s*(?:p{1,2}\.?|pages?|ص|صفحه|صفحة)\s*([\d٠-٩][\d٠-٩,\s\-–و]*)\]/gi;
const pagesIn = (s) => { const out = []; for (const part of toLatin(s).split(/[,،و]/)) { const m = /(\d+)\s*[-–]\s*(\d+)/.exec(part); if (m) { for (let p = +m[1]; p <= Math.min(+m[2], +m[1] + 60); p++) out.push(p); } else { const n = parseInt(part, 10); if (n > 0) out.push(n); } } return out; };
/**
 * Every [p. N] the model wrote must be a page it was shown (`allowed`). Invented pages are removed. Returns
 * { text, cited: [pages], removed: n, supported: bool } — `supported` is false when no valid citation is left.
 */
export function checkCitations(answer, allowed) {
  const ok = new Set(allowed); const cited = new Set(); let removed = 0;
  // sentence by sentence (a bullet or a line is its own piece): a claim whose every page reference is invalid is dropped, not left standing without its source
  const cites = []; const guarded = String(answer || "").replace(CITE, (m, list) => { cites.push(list); return `\u0001${cites.length - 1}\u0001`; });   // "[p. 2]" has a full stop: keep it out of the sentence split
  const pieces = guarded.split(/(?<=[.!?؟۔])[ \t]+(?=\S)|(?<=\n)/);
  const kept = [];
  for (const piece of pieces) {
    let bad = 0, good = 0;
    const text = piece.replace(/\u0001(\d+)\u0001/g, (m, i) => {
      const ps = pagesIn(cites[+i]), g = ps.filter((p) => ok.has(p));
      bad += ps.length - g.length; good += g.length; g.forEach((p) => cited.add(p));
      return g.length ? `[p. ${g.join(", ")}]` : "";
    });
    removed += bad;
    if (bad && !good) continue;                      // every reference of this claim was invented
    kept.push(text);
  }
  const text = kept.join(" ").replace(/ *\n */g, "\n").replace(/[ \t]+\n/g, "\n").replace(/ {2,}/g, " ").trim();
  const nothing = /\b(do(es)? not (contain|mention|say|include|cover)|not (found|mentioned|stated|covered|specified)|no (information|mention))\b|لا يوجد|مش موجود|مفيش|لم يرد|غير مذكور/i.test(text);
  return { text, cited: [...cited].sort((a, b) => a - b), removed, supported: cited.size > 0, saysNotFound: nothing };
}
/** Page citations in a text → pieces for display: [{ t: "text" } | { p: 12 }]. */
export function splitCitations(text) {
  const out = []; let last = 0; const s = String(text || "");
  s.replace(CITE, (m, list, off) => { if (off > last) out.push({ t: s.slice(last, off) }); for (const p of pagesIn(list)) out.push({ p }); last = off + m.length; return m; });
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}

// ---- reading and searching ---------------------------------------------------------------------------------------------------------------
/** Word search inside the document (the reader's search box): pages with hits and a snippet for each. */
export function searchPages(index, query, { max = 40 } = {}) {
  const q = norm(query); if (q.length < 2) return [];
  const out = [];
  for (const p of index.pages) {
    const t = norm(p.text); let at = t.indexOf(q), count = 0, first = -1;
    while (at >= 0 && count < 99) { if (first < 0) first = at; count++; at = t.indexOf(q, at + q.length); }
    if (count) { const raw = p.text.replace(/\s+/g, " "); const rl = raw.toLowerCase().indexOf(String(query).toLowerCase().trim()); const pos = rl >= 0 ? rl : Math.max(0, first); out.push({ page: p.n, count, snippet: (pos > 40 ? "…" : "") + raw.slice(Math.max(0, pos - 40), pos + 120) + (raw.length > pos + 120 ? "…" : "") }); }
    if (out.length >= max) break;
  }
  return out;
}
/** Starter questions that fit what the document looks like. */
export function suggestions(index, ar = false) {
  const text = index.pages.slice(0, 3).map((p) => p.text).join(" ");
  const money = /\b(EGP|USD|SAR|AED|EUR|LE|جنيه|ريال|دولار)\b|[$€£]\s?\d/.test(text), dates = /\b(19|20)\d\d\b/.test(text);
  const base = ar ? ["لخّص الملف", "إيه النقاط الرئيسية؟", "اعمل فهرس بالمحتويات"] : ["Summarise this document", "What are the key points?", "Make an outline with page numbers"];
  if (money) base.push(ar ? "اذكر كل المبالغ والأرقام المهمة" : "List every amount and important figure");
  if (dates) base.push(ar ? "اذكر كل التواريخ والمواعيد" : "List all dates and deadlines");
  return base.slice(0, 5);
}
