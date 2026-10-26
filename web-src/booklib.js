/* ---- v8.3 Library (Ali picked 3A, 26 Oct: "I want to upload 10 history books I trust, ask about something, and it reads the 10 books
   fast, tells me what happens, compares them and sees what's right, cites the book — and I can chat with follow-up questions").
   Pure: which passages of which books answer a question (BM25 per book, docqa.js), the prompt that makes the model compare the books
   and cite [Book, p. N], and reading those citations back. The books themselves live in Ask a PDF's on-phone library (IndexedDB).
   Tests: tests/unit/v830library.test.mjs.                                                                                          */
import * as Q from "./docqa.js";

export const LIB_KEY = "attune:booklib:v1";
export const loadLib = (s = typeof localStorage !== "undefined" ? localStorage : null) => { try { const v = JSON.parse((s && s.getItem(LIB_KEY)) || "null"); if (v && Array.isArray(v.ids)) return { chat: [], topics: [], topicOf: {}, ...v }; } catch (e) {} return { ids: [], chat: [], topics: [], topicOf: {} }; };
export const saveLib = (v, s = typeof localStorage !== "undefined" ? localStorage : null) => { try { s && s.setItem(LIB_KEY, JSON.stringify({ ...v, chat: (v.chat || []).slice(-40) })); } catch (e) {} return v; };

/** A book's short title for citations: "ibn-kathir_al-bidaya-vol13.pdf" → "ibn kathir al bidaya vol13" (40 characters at most). */
export const titleOf = (name) => String(name || "Book").replace(/\.(pdf|docx?|epub|pptx|odt|html?|rtf|txt)$/i, "").replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "Book";

/** A follow-up ("and why did they lose?") is searched together with the question before it. */
export function searchText(question, history = []) {
  const q = String(question || "").trim();
  const prev = [...(history || [])].reverse().find((m) => m && m.role === "user" && m.text && m.text.trim() !== q);
  return prev && Q.words(q).length < 6 ? prev.text + " " + q : q;
}

/** The passages to read for a question across the books: every book that has something gets its best passages (so they can be
    compared), the strongest books first, within a budget. books = [{ id, name, index }] → [{ book, title, page, text, score }]. */
export function passages(books, question, { history = [], budget = 7000, perBook = 3, maxBooks = 8 } = {}) {
  const q = searchText(question, history);
  const per = (books || []).map((b) => ({ b, hits: b && b.index ? Q.rank(b.index, q, { k: perBook }) : [] })).filter((x) => x.hits.length);
  if (!per.length) return [];
  per.sort((x, y) => y.hits[0].score - x.hits[0].score);
  const best = per[0].hits[0].score, out = []; let used = 0;
  const take = (x, h) => { const t = h.chunk.text; if (used + t.length > budget) return false; used += t.length; out.push({ book: x.b.id, title: titleOf(x.b.name), page: h.chunk.page, text: t, score: h.score }); return true; };
  const keep = per.filter((x) => x.hits[0].score >= best * 0.3).slice(0, maxBooks);
  for (const x of keep) take(x, x.hits[0]);                                  // round 1: each book's best passage (to compare)
  for (let r = 1; r < perBook; r++) for (const x of keep) if (x.hits[r] && x.hits[r].score >= best * 0.3) take(x, x.hits[r]);
  return out;
}

const SYS = (ar) => `You answer from the user's OWN library of books, using ONLY the passages given. Each passage starts with its book and page, like [Hourani, p. 84].
Rules: (1) Use only what the passages say; never add facts from memory. (2) After every fact write where it came from exactly like [Book, p. N]. (3) Compare the books: say what they agree on; when they differ (dates, numbers, names, causes, who did what), add a part titled "Where the books disagree" that gives each book's version with its citation and, if the passages show it, which version is better supported and why. (4) If the passages don't answer the question, say so plainly and name what is missing — do not guess. (5) Answer in ${ar ? "Egyptian Arabic (keep names, dates and numbers as written in the books)" : "the language of the question"}; clear and well organised, like a good teacher; the user can ask follow-up questions.`;

/** The model's messages: the rules, the last turns (for follow-ups), the passages and the question. */
export function libraryMessages(question, found, history = []) {
  const ar = Q.hasArabic(question);
  const body = (found || []).map((p) => `[${p.title}, p. ${p.page}]\n${p.text}`).join("\n\n---\n\n");
  const prior = (history || []).filter((m) => m && m.text).slice(-6).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.text).slice(0, 700) }));
  return [{ role: "system", content: SYS(ar) }, ...prior, { role: "user", content: `Passages from my books:\n\n${body || "(no passage matched the question)"}\n\nQuestion: ${String(question).trim()}\n\nAnswer from the passages only, citing like [Book, p. N]; compare the books.` }];
}

/** "[Hourani, p. 84]" / "[Lapidus p. 291]" in an answer → [{ title, page }] (each once, in order). */
export function citesIn(text) {
  const out = [], seen = new Set();
  for (const m of String(text || "").matchAll(/\[([^\[\]\n]{1,60}?),?\s*(?:p{1,2}\.|page|ص)\s*([\d٠-٩]+)(?:\s*[-–,]\s*[\d٠-٩]+)*\]/g)) {
    const k = m[1].trim().toLowerCase() + "|" + m[2]; if (seen.has(k)) continue; seen.add(k);
    out.push({ title: m[1].trim(), page: +String(m[2]).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)) });
  }
  return out;
}
/** A citation → the passage it points to (the same book by title, that page), so the person sees the book's own words. */
export function passageFor(cite, found) {
  const t = String(cite.title || "").toLowerCase();
  return (found || []).find((p) => p.page === cite.page && (p.title.toLowerCase() === t || p.title.toLowerCase().startsWith(t) || t.startsWith(p.title.toLowerCase().slice(0, 12)))) || null;
}
/** The answer split into the main part and "Where the books disagree" (shown in its own box). */
export function splitDisagree(text) {
  const t = String(text || ""); const m = /^\s*(?:#{1,4}\s*|\*\*)?(?:Where the books disagree|الكتب مختلفة في|فين الكتب بتختلف|اختلاف الكتب)[^\n]*\n?/im.exec(t);
  return m ? { main: t.slice(0, m.index).trim(), differ: t.slice(m.index + m[0].length).trim() } : { main: t.trim(), differ: "" };
}
/** The answer without its "[Book, p. N]" marks (they are shown as chips under it). */
export const noCites = (text) => String(text || "").replace(/\s*\[([^\[\]\n]{1,60}?),?\s*(?:p{1,2}\.|page|ص)\s*[\d٠-٩]+(?:\s*[-–,]\s*[\d٠-٩]+)*\]/g, "");

// ---- v8.3 (Ali: "make sure it's fast and smooth, writes, and can handle huge context"): Read deeper — many more pages per book,
// read in rounds that each fit the model (notes with citations), then one answer that compares the notes. -----------------------
/** All the useful passages (up to perBook per book), cut into rounds of about `budget` characters. → [[passage]] */
export function deepRounds(books, question, { history = [], perBook = 10, budget = 6000, maxRounds = 8 } = {}) {
  const q = searchText(question, history), all = [];
  for (const b of books || []) {
    if (!b || !b.index) continue;
    const hits = Q.rank(b.index, q, { k: perBook });
    for (const h of hits) all.push({ book: b.id, title: titleOf(b.name), page: h.chunk.page, text: h.chunk.text, score: h.score });
  }
  if (!all.length) return [];
  const best = Math.max(...all.map((x) => x.score));
  const keep = all.filter((x) => x.score >= best * 0.15).sort((a, b) => a.title.localeCompare(b.title) || a.page - b.page);
  const rounds = []; let cur = [], used = 0;
  for (const p of keep) { if (used + p.text.length > budget && cur.length) { rounds.push(cur); cur = []; used = 0; } cur.push(p); used += p.text.length; }
  if (cur.length) rounds.push(cur);
  return rounds.slice(0, maxRounds);
}
/** One round → notes: every fact that helps answer, each with its [Book, p. N]. */
export function notesMessages(question, round) {
  const body = round.map((p) => `[${p.title}, p. ${p.page}]\n${p.text}`).join("\n\n---\n\n");
  return [{ role: "system", content: "You take notes for a researcher. From the passages, write short bullet notes of every fact that helps answer the question — names, dates, numbers, causes, and where books say different things. After every note write its source exactly like [Book, p. N]. Only what the passages say. If nothing helps, write: nothing." },
    { role: "user", content: `Question: ${String(question).trim()}\n\nPassages:\n\n${body}` }];
}
/** The notes of all rounds → the final answer, compared and cited (same rules as a normal answer). */
export function fromNotesMessages(question, notes, history = []) {
  const found = (notes || []).filter((n) => n && !/^\s*nothing\.?\s*$/i.test(n)).map((n, i) => ({ title: "notes " + (i + 1), page: 0, text: n }));
  const m = libraryMessages(question, [], history);
  m[m.length - 1] = { role: "user", content: `Notes taken from my books (each with its [Book, p. N]):\n\n${found.map((f) => f.text).join("\n\n")}\n\nQuestion: ${String(question).trim()}\n\nAnswer from these notes only, keeping their citations [Book, p. N]; compare the books.` };
  return m;
}

// ---- v8.3 (Ali: "make the code strong so it does not overload the model or the phone") ------------------------------------------
/** How many characters of passages fit this model: its context minus the rules, the last turns and the answer (~3 characters a
    token for English and Arabic together), never under 2,500 or over 24,000. */
export function budgetFor(ctxTokens) {
  const ctx = +ctxTokens > 0 ? +ctxTokens : 8192;
  return Math.max(2500, Math.min(24000, Math.floor((ctx - 3400) * 2.8)));   // (3,400 tokens: the rules, the last turns and the answer)
}
/** Passages (already ranked) cut to a budget, best first, never a passage in pieces. */
export function fit(found, budget) {
  const out = []; let used = 0;
  for (const p of found || []) { const n = String(p.text || "").length; if (used + n > budget) continue; out.push(p); used += n; }
  return out;
}
/** Many passages (from the phone's index) → rounds that each fit the model, in book and page order; at most `maxRounds`. */
export function roundsOf(found, budget, maxRounds = 8) {
  const list = [...(found || [])].sort((a, b) => String(a.title).localeCompare(String(b.title)) || a.page - b.page);
  const rounds = []; let cur = [], used = 0;
  for (const p of list) { const n = String(p.text || "").length; if (used + n > budget && cur.length) { rounds.push(cur); cur = []; used = 0; } if (n <= budget) { cur.push(p); used += n; } }
  if (cur.length) rounds.push(cur);
  return rounds.slice(0, maxRounds);
}
/** The phone's search result → passages with short titles (the same shape as passages()). */
export const fromNative = (r) => ((r && r.passages) || []).map((p) => ({ book: String(p.book), title: titleOf(p.title), topic: p.topic || "", page: +p.page || 0, text: String(p.text || ""), score: +p.score || 0 }));
