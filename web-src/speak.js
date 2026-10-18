/* ---- v6.32: speaking practice and spoken dialogues for language lessons (roadmap "Learning": "speaking practice with
   offline speech recognition and a pronunciation score", "spoken dialogues with offline voices") ---------------------------------
   Hear a phrase in the phone's own voice, say it, and the phone's speech recognition writes what it heard; code compares that
   with the phrase word by word: each word is right, close (a sound or two off) or missed, and a score out of 100. A dialogue is
   a short conversation from the lesson: the phone says one part, you say the other, each line scored the same way.
   Pure code (no model for scoring). Tests: tests/unit/v736speak.test.mjs.                                                        */

// the language of a course → the voice / recognition tag
const TAGS = [[/turkish|türkçe|تركي/i, "tr-TR"], [/english|انجليزي|إنجليزي/i, "en-US"], [/french|français|فرنس/i, "fr-FR"], [/german|deutsch|الماني|ألماني/i, "de-DE"],
  [/spanish|español|اسبان|إسبان/i, "es-ES"], [/italian|italiano|ايطال|إيطال/i, "it-IT"], [/japanese|日本|يابان/i, "ja-JP"], [/chinese|mandarin|中文|صين/i, "zh-CN"],
  [/korean|한국|كوري/i, "ko-KR"], [/russian|русск|روس/i, "ru-RU"], [/portuguese|برتغال/i, "pt-PT"], [/arabic|عرب/i, "ar-EG"], [/hindi|هند/i, "hi-IN"], [/greek|يونان/i, "el-GR"]];
export function langTagOf(topic) { const t = String(topic || ""); const m = TAGS.find(([re]) => re.test(t)); return m ? m[1] : ""; }

/** Text → the words to compare: lower case, no punctuation or marks; Arabic letter forms folded; Turkish İ/ı kept apart. */
export function sayWords(text, tag = "") {
  let t = String(text || "");
  t = /^tr/i.test(tag) ? t.replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase() : t.toLowerCase();
  t = t.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");
  t = t.replace(/\([^)]*\)/g, " ").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/'/g, "");
  return t.split(/\s+/).filter(Boolean);
}
function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
/** How alike two words sound in writing, 0–1 (accents count half: "cok" for "çok" is close, not wrong). */
export function wordLike(a, b) {
  if (a === b) return 1;
  const base = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
  if (base(a) === base(b)) return 0.85;
  const d = lev(base(a), base(b)), L = Math.max(a.length, b.length);
  return Math.max(0, 1 - d / L);
}

/** The phrase and what was heard → { score 0–100, words: [{ w, got, mark: "good" | "close" | "missed" }], extra }
    Words are lined up in order (an extra or missing word doesn't shift the rest). */
export function pronScore(target, heard, tag = "") {
  const T = sayWords(target, tag), H = sayWords(heard, tag);
  if (!T.length) return { score: 0, words: [], extra: 0 };
  // alignment: maximise similarity, a skipped word costs nothing extra (it just scores 0)
  const m = T.length, n = H.length, S = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0)), B = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const like = wordLike(T[i - 1], H[j - 1]), diag = S[i - 1][j - 1] + (like >= 0.5 ? like : 0);
    if (diag >= S[i - 1][j] && diag >= S[i][j - 1]) { S[i][j] = diag; B[i][j] = 0; } else if (S[i - 1][j] >= S[i][j - 1]) { S[i][j] = S[i - 1][j]; B[i][j] = 1; } else { S[i][j] = S[i][j - 1]; B[i][j] = 2; }
  }
  const got = new Array(m).fill("");
  let used = 0;
  for (let i = m, j = n; i > 0 && j > 0;) {
    if (B[i][j] === 0) { if (wordLike(T[i - 1], H[j - 1]) >= 0.5) { got[i - 1] = H[j - 1]; used++; } i--; j--; } else if (B[i][j] === 1) i--; else j--;
  }
  const words = T.map((w, i) => { const l = got[i] ? wordLike(w, got[i]) : 0; return { w, got: got[i], mark: l >= 0.85 ? "good" : l >= 0.5 ? "close" : "missed", like: l }; });
  const extra = Math.max(0, n - used);
  const raw = words.reduce((s, x) => s + x.like, 0) / m;
  const score = Math.max(0, Math.round(100 * raw - Math.min(20, extra * 5)));
  return { score, words: words.map(({ w, got, mark }) => ({ w, got, mark })), extra };
}
/** A word to say about a score. */
export const scoreWord = (s) => (s >= 90 ? "Excellent" : s >= 75 ? "Good" : s >= 50 ? "Nearly — try again" : "Listen once more, then try again");

/** The phrases to practise in a lesson: its word cards (front), then the bold phrases in the text, then short example lines. */
export function phrasesFrom(l, max = 6) {
  const out = [], add = (p) => { p = String(p || "").replace(/\*\*/g, "").replace(/\s*\([^)]*\)\s*$/, "").trim(); const n = p.split(/\s+/).length; if (p && n >= 1 && n <= 9 && p.length <= 70 && !out.some((x) => x.toLowerCase() === p.toLowerCase())) out.push(p); };
  const v = l && l.visual;
  if (v && v.kind === "cards") for (const x of v.items) add(x.front);
  if (v && v.kind === "table" && v.rows) for (const r of v.rows) add(r[0]);
  for (const m of String((l && l.body) || "").matchAll(/\*\*([^*\n]{2,70})\*\*/g)) if (!/[:：]$/.test(m[1]) && !/^(example|note|tip|remember|try it)/i.test(m[1])) add(m[1]);
  return out.slice(0, max);
}

/** A dialogue for the lesson, written by the model as JSON: {lines: [{who: "A"|"B", text (the language), say (translation)}]} */
export function dialogueMessages(c, l, plain = false) {
  const ar = c.lang === "ar";
  // the second try asks for plain lines — a small model gets those right more often than JSON (parseDialogue reads both)
  if (plain) return [
    { role: "system", content: `Write a short, natural spoken dialogue of 6 lines between A and B in ${c.topic} for a ${c.level} learner, using what this lesson teaches. One line each, exactly like this:
A: <the line in ${c.topic}> (<its meaning in ${ar ? "Arabic" : "English"}>)
B: <the line in ${c.topic}> (<its meaning in ${ar ? "Arabic" : "English"}>)
Nothing else.` },
    { role: "user", content: `Lesson: ${l.title}\nKey points: ${(l.keyPoints || []).join("; ")}` },
  ];
  return [
    { role: "system", content: `Write a short, natural spoken dialogue (6 to 8 lines, two people A and B) in ${c.topic} for a ${c.level} learner that uses what this lesson teaches. Simple, everyday, correct. Reply with JSON only:
{"title": "<where it happens, in ${ar ? "Arabic" : "English"}>", "lines": [{"who": "A", "text": "<the line in ${c.topic}>", "say": "<its meaning in ${ar ? "Arabic" : "English"}>"}]}` },
    { role: "user", content: `Lesson: ${l.title}\nKey points: ${(l.keyPoints || []).join("; ")}` },
  ];
}
// v6.35 (Ali, Blaze: "couldn't write a small conversation"): the reply is read by code however it comes — JSON in a code fence,
// JSON cut off by the token limit, a trailing comma, names instead of A/B, or plain "A: … (meaning)" lines.
const lineOf = (x) => ({ who: String((x && (x.who || x.speaker || x.name)) || ""), text: String((x && (x.text || x.line)) || "").trim().slice(0, 160),
  say: String((x && (x.say || x.meaning || x.translation || x.en || x.ar)) || "").trim().slice(0, 200) });
function speakers(lines) {
  const order = [];
  for (const l of lines) { const k = l.who.trim().toLowerCase(); if (k && !order.includes(k)) order.push(k); }
  return lines.map((l, i) => {
    const k = l.who.trim().toLowerCase();
    const who = k === "a" || k === "b" ? k.toUpperCase() : order.indexOf(k) >= 0 ? (order.indexOf(k) % 2 ? "B" : "A") : (i % 2 ? "B" : "A");
    return { ...l, who };
  });
}
function jsonDialogue(t) {
  const s = t.indexOf("{");
  if (s < 0) return null;
  let body = t.slice(s).replace(/```/g, "");
  const tries = [body.slice(0, body.lastIndexOf("}") + 1)];
  // cut off mid-way: keep the lines that are complete, then close the array and the object
  const lastLine = body.lastIndexOf("}");
  if (lastLine > 0) tries.push(body.slice(0, lastLine + 1).replace(/,\s*$/, "") + "]}");
  for (let x of tries) {
    x = x.replace(/,\s*([\]}])/g, "$1");
    try { const j = JSON.parse(x); if (j && Array.isArray(j.lines)) return j; } catch (e) {}
  }
  return null;
}
function textDialogue(t) {
  const out = [];
  for (const raw of t.split(/\n+/)) {
    const m = raw.replace(/^[\s>*\-•\d.)]+/, "").replace(/\*\*/g, "").match(/^([A-Za-z\u00C0-\u024F\u0600-\u06FF]{1,20})\s*[:：]\s*(.+)$/);
    if (!m) { const pm = raw.trim().match(/^[(（\[]\s*(.+?)\s*[)）\]]$/); if (pm && out.length && !out[out.length - 1].say) out[out.length - 1].say = pm[1].slice(0, 200); continue; }
    if (/^(title|lesson|key|note)$/i.test(m[1])) continue;
    let text = m[2].trim(), say = "";
    const pm = text.match(/^(.*?)\s*[(（\[]\s*(.+?)\s*[)）\]]\s*$/) || text.match(/^(.*?)\s+[—–-]\s+(.+)$/);
    if (pm && pm[1]) { text = pm[1].trim(); say = pm[2].trim(); }
    out.push({ who: m[1], text: text.replace(/^["“]|["”]$/g, "").slice(0, 160), say: say.slice(0, 200) });
  }
  return out;
}
export function parseDialogue(text) {
  const t = String(text || "");
  const j = jsonDialogue(t);
  let lines = j ? j.lines.map(lineOf) : textDialogue(t);
  lines = speakers(lines.filter((x) => x.text)).slice(0, 10);
  return lines.length >= 4 ? { title: String((j && j.title) || "").slice(0, 80), lines } : null;
}
