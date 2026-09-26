/* ---- Web: the passages that answer the question (v5.19) -----------------------------------
   Until v5.18 the model saw the first 2,200 characters of each page — menus and an
   intro — and never the spec tables further down, so "all trims with hp, torque,
   price" came back thin or invented. Now each page arrives in full (tables as
   "cell | cell" rows, WebTools.kt) and this picks, within a budget the phone model can
   read, the passages that match the question:

     - split into passages (lines and table rows grouped to ~450 characters, with the
       nearest heading kept as context);
     - score = question words found (names count double) + numbers and table rows when
       the question asks for figures (specs, price, trims, range, hp …) − boilerplate
       (cookies, sign in, subscribe, ©);
     - every source keeps its best passages, in page order, so citations stay honest.
   Pure logic, unit-tested in tests/unit/v519.test.mjs.                                     */

const STOP = new Set("the a an and or of to in on for with is are was were be it this that what how why when which who me my i you your we our do does did can could should would will from at by as about into than then there here all every full list give show tell please vs versus".split(" "));
const norm = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
export function qWords(q) {
  return [...new Set(norm(q).split(/[^\p{L}\p{N}.]+/u).map((w) => w.replace(/^\.+|\.+$/g, "")).filter((w) => w.length > 1 && !STOP.has(w)))];
}
const FIGURES = /\b(specs?|specifications?|price|prices|cost|trims?|versions?|variants?|models?|hp|horsepower|torque|nm|kw|range|battery|kwh|wltp|cltc|epa|dimensions?|length|width|height|wheelbase|clearance|weight|speed|acceleration|0-100|capacity|tons?|year|how much|how many|when|release|launch)\b|سعر|أسعار|اسعار|مواصفات|فئات|فئة|قوة|عزم|مدى|بطارية|أبعاد|ابعاد|وزن|سرعة|كام|امتى|إمتى/i;
const JUNK = /(cookie|cookies|sign in|log in|subscribe|newsletter|privacy policy|terms of (use|service)|all rights reserved|©|advertis|accept all|javascript|enable js|share this|follow us|related articles|read more)/i;

/** Split a page into passages of about `size` characters, each with its heading. */
export function passages(text, size = 450) {
  const out = [];
  let head = "", cur = "", table = false;
  const push = () => { if (cur.trim()) out.push({ head, text: cur.trim(), table }); cur = ""; table = false; };
  for (const raw of String(text || "").split("\n")) {
    const l = raw.trim(); if (!l) continue;
    if (/^##\s/.test(l)) { push(); head = l.replace(/^##\s*/, "").slice(0, 80); continue; }
    const isRow = l.includes(" | ");
    if (cur && (cur.length + l.length > size || isRow !== table && cur.length > 120)) push();
    cur += (cur ? "\n" : "") + l; table = table || isRow;
    if (l.length > size * 1.6) push();
  }
  push();
  return out;
}

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function scorePassage(p, words, named, wantFigures) {
  const t = norm(p.head + " " + p.text);
  let s = 0, hits = 0;
  for (const w of words) {
    // short words ("co", "hp", "900") must be whole words, not parts of others
    const found = w.length <= 3 ? new RegExp("(^|[^\\p{L}\\p{N}])" + esc(w) + "($|[^\\p{L}\\p{N}])", "u").test(t) : t.includes(w);
    if (found) { s += named.has(w) ? 2 : 1; hits++; }
  }
  // numbers only help a passage that is on the subject (or a table)
  if (wantFigures && (hits > 0 || p.table)) {
    const nums = (p.text.match(/\d[\d.,]*/g) || []).length;
    s += Math.min(3, nums / 4);
    if (p.table) s += 1.5;
  }
  if (JUNK.test(p.text) && p.text.length < 300) s -= 3;
  return s;
}

/**
 * hits [{title, url, text}] → the same hits, each text replaced by its best passages,
 * all within `budget` characters. Sources with nothing relevant are dropped (keeping at least 2).
 */
export function rankPassages(question, hits, { budget = 7000, perSource = 2600 } = {}) {
  const words = qWords(question);
  // names (capitalised or with digits: "Lynk", "900", "LTM") matter most
  const named = new Set(qWords(String(question || "").split(/\s+/).filter((w) => /[A-Z]|\d/.test(w)).join(" ")));
  const wantFigures = FIGURES.test(String(question || ""));
  const scored = (hits || []).map((h, hi) => {
    const ps = passages(h.text).map((p, i) => { const b = scorePassage(p, words, named, wantFigures); return { ...p, i, s: b + (i < 2 && b > 0 ? 0.3 : 0) }; });
    const titleHit = words.filter((w) => norm(h.title).includes(w)).length;
    // Wikipedia is not treated as a reliable source (Ali): it gets the leftover budget, after the others
    const wiki = /(^|\.)wikipedia\.org\//i.test(String(h.url || "").replace(/^https?:\/\//, ""));
    return { h, hi, ps, wiki, best: Math.max(0, ...ps.map((p) => p.s)) + titleHit * 0.5 - (wiki ? 100 : 0) };
  });
  // share the budget: better sources first, each gets at least a little
  const order = [...scored].sort((a, b) => b.best - a.best);
  let left = budget;
  const pick = new Map();
  for (const src of order) {
    if (left < 300) break;
    const cap = Math.min(perSource, Math.max(600, left / Math.max(1, order.length - pick.size)) * 1.4, left);
    const chosen = []; let used = 0;
    for (const p of [...src.ps].sort((a, b) => b.s - a.s)) {
      if (p.s <= 0 && chosen.length) break;
      if (used + p.text.length > cap) continue;
      chosen.push(p); used += p.text.length + (p.head ? p.head.length + 4 : 0);
    }
    if (chosen.length) { pick.set(src.hi, chosen.sort((a, b) => a.i - b.i)); left -= used; }
  }
  const out = [];
  for (const src of [...scored.filter((x) => !x.wiki), ...scored.filter((x) => x.wiki)]) {
    const ch = pick.get(src.hi);
    if (!ch) continue;
    if (src.best <= 0 && out.length >= 2 && !/wikipedia\.org/i.test(String(src.h.url))) continue;
    let lastHead = null;
    const text = ch.map((p) => { const h = p.head && p.head !== lastHead ? "[" + p.head + "] " : ""; lastHead = p.head; return h + p.text; }).join("\n");
    out.push({ ...src.h, text });
  }
  return out.length ? out : (hits || []).slice(0, 3);
}
