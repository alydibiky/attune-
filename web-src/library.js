/* ---- v6.46 "Remember this" — your own library (Ali, 21 Oct 2026: "remove Knowledge from users — I add the knowledge packs; users
   can just upload something for the system to remember, so when they ask about it, it answers — a news article, or a book:
   'what happens in this chapter'"). A book, an article, a saved page or pasted text is kept on the phone in the same store
   Chat already looks facts up in (knowledge.js, collection "mine"); its chapters are found by code, so "what happens in chapter
   3" (or «إيه اللي بيحصل في الفصل التالت») gives Chat that chapter's own text. Pure; tests: tests/unit/v746library.test.mjs. */

export const MINE = "mine";

const EN_NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty",
  "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty"];
const EN_ORD = ["zeroth", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth", "twentieth"];
// Arabic ordinals as written and as said in Egypt («التالت», «التاني»), and the plain numbers
const AR_ORD = [null, ["الأول", "الاول", "أول", "اول", "واحد"], ["الثاني", "التاني", "تاني", "ثاني", "اتنين", "اثنين"], ["الثالث", "التالت", "تالت", "ثالث", "تلاتة", "ثلاثة"], ["الرابع", "رابع", "اربعة", "أربعة"],
  ["الخامس", "خامس", "خمسة"], ["السادس", "سادس", "ستة"], ["السابع", "سابع", "سبعة"], ["الثامن", "التامن", "تامن", "ثامن", "تمانية", "ثمانية"], ["التاسع", "تاسع", "تسعة"], ["العاشر", "عاشر", "عشرة"],
  ["الحادي عشر", "حداشر"], ["الثاني عشر", "التاني عشر", "اتناشر"], ["الثالث عشر", "التالت عشر", "تلاتاشر"], ["الرابع عشر", "اربعتاشر"], ["الخامس عشر", "خمستاشر"]];
const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d));
const ROMAN = { i: 1, v: 5, x: 10, l: 50, c: 100 };
function roman(s) { s = s.toLowerCase(); if (!/^[ivxlc]+$/.test(s)) return null; let n = 0; for (let i = 0; i < s.length; i++) { const v = ROMAN[s[i]], w = ROMAN[s[i + 1]] || 0; n += v < w ? -v : v; } return n || null; }
/** A chapter number written any way: 3, III, three, third, «التالت», «٣». */
export function numberOf(word) {
  const w = latin(String(word || "")).trim().toLowerCase().replace(/[.:،,)-]+$/, "");
  if (/^\d{1,3}$/.test(w)) return +w;
  const r = roman(w); if (r) return r;
  let i = EN_NUM.indexOf(w); if (i > 0) return i;
  i = EN_ORD.indexOf(w); if (i > 0) return i;
  for (let n = 1; n < AR_ORD.length; n++) if (AR_ORD[n].includes(w)) return n;
  return null;
}

// a line that starts a chapter: "Chapter 3", "CHAPTER III: The Storm", "Part Two", «الفصل الثالث», «الباب ٢»
const HEAD_EN = /^\s*(chapter|chap\.?|part|book|section)\s+([0-9]{1,3}|[ivxlc]{1,7}|[a-z-]+)\b[\s.:\-–—]*(.{0,80})$/i;
const HEAD_AR = /^\s*(الفصل|فصل|الباب|باب|الجزء|جزء)\s+([^\s:،.\-–—]+(?:\s+عشر)?)[\s.:،\-–—]*(.{0,80})$/;
/** The chapters of a text, in order: [{ n, kind, head, title, at }] (at = where the heading starts). A table of contents at the
    top lists every heading once more — so for each chapter number the LAST heading is the chapter itself. Parts are used only
    when the text has no chapters. */
export function chaptersOf(text) {
  const t = String(text || ""), all = [];
  let pos = 0;
  for (const line of t.split("\n")) {
    const L = line.trim();
    if (L && L.length <= 100) {
      const m = HEAD_EN.exec(L) || HEAD_AR.exec(L), n = m ? numberOf(m[2]) : null;
      if (n) all.push({ n, kind: /part|book|الجزء|جزء/i.test(m[1]) ? "part" : "chapter", head: L, title: (m[3] || "").trim(), at: pos + line.indexOf(L) });
    }
    pos += line.length + 1;
  }
  const kind = all.some((c) => c.kind === "chapter") ? "chapter" : "part";
  const last = new Map();
  for (const c of all) if (c.kind === kind) last.set(c.n, c);
  return [...last.values()].sort((a, b) => a.at - b.at);
}
/** Which chapter a question asks about (or null): "what happens in chapter 3", "summarise the third chapter", «الفصل التالت». */
export function askedChapter(q) {
  const s = latin(String(q || "")).toLowerCase();
  let m = /\b(?:chapter|chap\.?|ch\.)\s+([0-9]{1,3}|[ivxlc]{1,7}|[a-z-]+)\b/.exec(s) || /\bthe\s+([a-z-]+)\s+chapter\b/.exec(s);
  if (m) { const n = numberOf(m[1]); if (n) return n; }
  m = /(?:الفصل|فصل|الباب|باب)\s+(?:رقم\s+)?([^\s؟?.,،]+(?:\s+عشر)?)/.exec(String(q || ""));
  if (m) { const n = numberOf(m[1]) || numberOf(m[1].split(/\s+/)[0]); if (n) return n; }
  return null;
}
/** The text of chapter n (to the next chapter's heading), or null. */
export function chapterText(text, n) {
  const list = chaptersOf(text);
  const i = list.findIndex((c) => c.n === n); if (i < 0) return null;
  const end = i + 1 < list.length ? list[i + 1].at : String(text).length;
  return { n, head: list[i].head, title: list[i].title, text: String(text).slice(list[i].at, end).trim() };
}

/** Which of your items a question is about: one whose title words are in the question, else the newest with chapters. */
export function pickItem(items, q) {
  const f = (s) => String(s || "").toLowerCase().replace(/\.[a-z0-9]{2,4}$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const qq = " " + f(q) + " ";
  const scored = (items || []).map((x) => ({ x, n: f(x.title).split(" ").filter((w) => w.length >= 3 && qq.includes(" " + w + " ")).length })).sort((a, b) => b.n - a.n || (b.x.added || 0) - (a.x.added || 0));
  if (scored.length && scored[0].n) return scored[0].x;
  return (items || []).filter((x) => (x.chapters || 0) > 0).sort((a, b) => (b.added || 0) - (a.added || 0))[0] || null;
}

/** Long text → parts of about `size` characters, cut at paragraph or sentence ends. */
export function partsOf(text, size = 3500) {
  const t = String(text || ""), out = []; let a = 0;
  while (a < t.length) {
    let b = Math.min(t.length, a + size);
    if (b < t.length) { const p = t.lastIndexOf("\n\n", b); const s = t.lastIndexOf(". ", b); b = p > a + size * 0.5 ? p : s > a + size * 0.5 ? s + 1 : b; }
    out.push(t.slice(a, b).trim()); a = b;
  }
  return out.filter(Boolean);
}
/**
 * What Chat sends for a chapter question: the chapter itself when it fits, else notes on each part first (made by the model,
 * `parts` > 1) — so a long chapter is read whole, never guessed. → { direct: bool, parts: [text], note: (partNotes) → prompt }
 */
export function chapterPlan(book, ch, question, { fit = 6000, maxParts = 8 } = {}) {
  const intro = `The person saved "${book}" in Attune and asks about ${ch.head}${ch.title && !ch.head.includes(ch.title) ? " (" + ch.title + ")" : ""}. Answer from this chapter only — what happens, who, where, in order — and say if the chapter doesn't say something. Answer in the language of the question.`;
  if (ch.text.length <= fit) return { direct: true, parts: [ch.text], prompt: `${intro}\n\n--- ${ch.head} ---\n${ch.text}\n--- end ---\n\nQuestion: ${question}` };
  let parts = partsOf(ch.text, 3500);
  if (parts.length > maxParts) { const step = parts.length / maxParts; parts = Array.from({ length: maxParts }, (_, i) => parts[Math.floor(i * step)]); }
  return { direct: false, parts, partPrompt: (p, i) => `Part ${i + 1} of ${parts.length} of ${ch.head} of "${book}". Write short notes of what happens in this part, in order (names, places, events). Notes only.\n\n${p}`,
    prompt: (notes) => `${intro}\n\nNotes on the chapter, part by part:\n${notes.map((x, i) => `Part ${i + 1}: ${x}`).join("\n")}\n\nQuestion: ${question}` };
}
