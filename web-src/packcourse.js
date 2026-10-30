/* ---- v6.32: Knowledge packs become courses (roadmap "Learning": packs → lessons → quizzes → cards with FSRS) ------------------
   A pack (OpenStax Mathematics, Physics, Biology, Economics, Coding docs…) is a set of books, each a list of sections in order.
   Pick a book and its sections become the course plan: one section a day. The lesson is the section itself — the book's own
   words, shortened and with its source — so it works with NO model and is never made up; with a model the lesson is rewritten
   simply from that text only. Definitions in the text ("Inflation is …") become review cards (FSRS, fsrs.js).
   Pure code. The phone reads the pack (KnowPacks.toc / section). Tests: tests/unit/v736packcourse.test.mjs.                       */
import { tr } from "./i18n.js";
import { newCourse } from "./daily.js";

const clean = (s, n = 200) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);
export const MAX_LESSONS = 120;

/** "Book — Section" → { book, section } (a title without the dash is its own book). */
export function splitTitle(t) {
  const i = String(t || "").indexOf(" — ");
  return i > 0 ? { book: t.slice(0, i).trim(), section: t.slice(i + 3).trim() } : { book: String(t || "").trim(), section: String(t || "").trim() };
}
// sections that are not lessons: the book's front and back matter
const SKIP = /^(preface|index|references?|bibliography|answer key|appendix|glossary|key terms|chapter review|review questions|key equations|summary|introduction to the book|about the authors?|contributors?|table of contents|credits?)\b/i;

/** The pack's table of contents → its books: [{ book, sections: [{ title (full), section, n }] }] in order. */
export function booksOf(toc) {
  const out = [];
  for (const s of toc || []) {
    const { book, section } = splitTitle(s.title);
    if (!book || SKIP.test(section)) continue;
    let b = out.find((x) => x.book === book);
    if (!b) out.push((b = { book, sections: [] }));
    if (!b.sections.some((x) => x.title === s.title)) b.sections.push({ title: s.title, section, n: s.n || 1 });
  }
  return out.filter((b) => b.sections.length >= 2);
}

/** A book → a course: one section a day (from `from`, at most MAX_LESSONS). */
export function courseFromBook(pack, b, { lang = "en", time = "08:00", from = 0 } = {}) {
  const secs = b.sections.slice(from, from + MAX_LESSONS);
  const c = newCourse({ topic: b.book, level: "beginner", lang, time, quizEvery: 5 });
  return { ...c, title: b.book, plan: secs.map((s) => s.section), pack: { id: pack.id, name: pack.name || pack.id, book: b.book, titles: secs.map((s) => s.title) } };
}

/** A pack text cleaned for reading: no figure / table captions, no "Access for free at…", no leftover markup. */
export function tidy(t) {
  return String(t || "").replace(/\bAccess for free at \S+/gi, "").replace(/\b(Figure|Table) \d+(\.\d+)*[^.]*\.\s*/g, "")
    .replace(/<[^>]+>/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
const sentences = (t) => String(t || "").match(/[^.!?؟]+[.!?؟]+/g) || [];
/** Definitions in the text → "Term: meaning" (they become the lesson's key points and review cards). */
export function definitionsIn(text, max = 5) {
  const out = [];
  for (const s0 of sentences(text)) {
    const s = s0.trim();
    const m = /^(?:An?|The)?\s*([A-Za-z][A-Za-z0-9' -]{1,40}?)\s+(?:is|are|refers to|means|is defined as|describes)\s+(.{12,170}?)[.]$/.exec(s);
    if (!m || /^(this|that|it|there|these|those|they|he|she|we|you|here|what|which|one|each|example)\b/i.test(m[1]) || m[1].split(" ").length > 5) continue;
    const term = m[1].trim(), mean = m[2].trim();
    if (!out.some((x) => x.toLowerCase().startsWith(term.toLowerCase() + ":"))) out.push(term.charAt(0).toUpperCase() + term.slice(1) + ": " + mean);
    if (out.length >= max) break;
  }
  return out;
}

/** The section's passages → a lesson with no model: the book's words (≈ 5 minutes of reading), key points, the source. */
export function lessonFromPassages(c, n, passages, { words = 900 } = {}) {
  const title = (c.pack && c.pack.titles[n]) || c.plan[n] || "";
  const paras = [], examples = [];
  let count = 0;
  for (const p of passages || []) {
    const t = tidy(p.text); if (!t) continue;
    if (/^Example\b/.test(t)) { if (examples.length < 2) examples.push(t); continue; }
    if (count > words) break;
    paras.push(t); count += t.split(/\s+/).length;
  }
  const all = [...paras, ...examples].join("\n\n");
  let keyPoints = definitionsIn(all, 4);
  if (keyPoints.length < 3) for (const p of paras) { const s = clean(sentences(p)[0] || "", 160); const told = keyPoints.some((k) => s.toLowerCase().replace(/^(an?|the) /, "").startsWith(k.split(":")[0].toLowerCase())); if (s && !told && keyPoints.length < 3) keyPoints.push(s); }
  const body = [...paras, ...examples.map((e) => "**" + e.replace(/^Example:?\s*/, "Example: ").split("\n")[0] + "**" + e.slice(e.split("\n")[0].length))].join("\n\n");
  const url = ((passages || []).find((p) => p.url) || {}).url || "";
  return { body, visual: null, keyPoints, source: { pack: c.pack && c.pack.id, name: c.pack && c.pack.name, title, url } };
}

/** With a model: the same section explained simply, from that text ONLY (the source stays with the lesson). */
export function packLessonMessages(c, n, passages) {
  const text = (passages || []).map((p) => tidy(p.text)).filter(Boolean).join("\n\n").slice(0, 7000);
  const ar = c.lang === "ar";
  return [
    { role: "system", content: `You are a warm, expert teacher. Rewrite the textbook section below as today's 5-minute lesson for a learner, using ONLY facts in the text — add nothing from memory. ${ar ? "Write in simple Modern Standard Arabic and keep technical terms in English in brackets." : "Write in clear, simple English."}
Markdown: a one-line hook, 2–4 short sections with ## headings, one worked example from the text if it has one, and a tiny practice task under "## Try it". No LaTeX.
Then at the very end a JSON block:
\`\`\`json
{"keyPoints": ["<3 short things to remember, each 'Term: meaning' when it is a definition>"]}
\`\`\`` },
    { role: "user", content: `Section: ${(c.pack && c.pack.titles[n]) || c.plan[n]}\n\nThe text:\n${text}` },
  ];
}

/** A quiz with no model, from the definitions in the lessons: "Which term means …?" with the other terms as choices.
    → the same questions shape as D.parseQuiz ({ q, options, answer, why }); [] when there are fewer than 4 terms. */
export function codeQuiz(lessons, { max = 5, ar = false } = {}) {
  const defs = [];
  for (const l of lessons || []) for (const k of l.keyPoints || []) {
    const m = /^([^:]{2,45}):\s*(.{12,})$/.exec(k);
    if (m && !defs.some((d) => d.term.toLowerCase() === m[1].trim().toLowerCase())) defs.push({ term: m[1].trim(), mean: m[2].trim() });
  }
  if (defs.length < 4) return [];
  const out = [];
  for (let i = 0; i < defs.length && out.length < max; i++) {
    const d = defs[i], others = defs.filter((x) => x !== d);
    const pick = [0, 1, 2].map((k) => others[(i + k * 2 + 1) % others.length]).filter((x, j, a) => a.indexOf(x) === j);
    if (pick.length < 2) continue;
    const opts = [d.term, ...pick.map((x) => x.term)];
    const at = i % opts.length, options = [...opts.slice(1, at + 1), d.term, ...opts.slice(at + 1)];
    out.push({ q: (ar ? "أي مصطلح معناه: " : tr("Which term means: ")) + d.mean, options, answer: options.indexOf(d.term), why: d.term + ": " + d.mean });
  }
  return out;
}
