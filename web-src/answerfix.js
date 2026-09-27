/* ---- v5.32: web answers checked and repaired by CODE, like Gemini's grounding ------------
   Ali's phone test: "0-inch" (10-inch), "range of 4 km" (40), "0kg", "The 0 features",
   "sixseater", "rotate180degrees", "**Winner Sky (V10)****", the same bullet twice, a table
   whose rows don't match its header, and "The passages do not provide …" lines.
   A small phone model copying figures from long pages slips on single digits and on the
   little tokens between words — so the finished answer is compared, line by line, with the
   sources each line cites, and fixed by code:
     - repairFigures: a number the cited source doesn't contain is replaced by the source's
       figure with the same unit / the same words around it (when there is exactly one);
       words the model glued together ("sixseater") get their source spelling back;
     - tidyAnswer: broken bold, citation lists, duplicate bullets, table columns, and the
       "the passages do not provide" lines are removed (nobody wants to read them);
     - gapsOf: what the question asked for that the answer still lacks (a price, the trims,
       the specs) — searched for once more before the answer is shown.
   Pure functions; tests in tests/unit/v532.test.mjs.                                        */

const lc = (s) => String(s || "").toLowerCase();
const digitsOf = (s) => String(s).replace(/\D/g, "");
const isSub = (small, big) => { let i = 0; for (const ch of big) if (ch === small[i]) i++; return i === small.length; };
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The source texts a line cites ([3], [2][5]); every source when it cites none. */
function citedText(line, sources) {
  const ids = [...String(line).matchAll(/\[(\d{1,2})\]/g)].map((m) => +m[1] - 1).filter((i) => sources[i]);
  const list = ids.length ? [...new Set(ids)].map((i) => sources[i]) : sources;
  return list.map((h) => (h.title || "") + "\n" + (h.text || "")).join("\n");
}

const UNIT = /^\s?(-?[A-Za-z%°″"]+(?:\/[A-Za-z]+)?)/;
function numbersWithUnit(hay) {
  const out = [];
  for (const m of hay.matchAll(/(\d+(?:[.,]\d+)*)(\s?-?[A-Za-z%°″"]+(?:\/[A-Za-z]+)?)?/g)) {
    out.push({ n: m[1], unit: normUnit((m[2] || "").trim()), at: m.index });
  }
  return out;
}
function normUnit(u) {
  const x = lc(u).replace(/^-/, "");
  if (!x) return "";
  if (/^(kph|kmh|km\/h)$/.test(x)) return "km/h";
  if (/^(metres?|meters?|m)$/.test(x)) return "m";
  if (/^(inch|inches|in|″|")$/.test(x)) return "in";
  if (/^(percent|per|%)$/.test(x)) return "%";
  if (/^(degrees?|°)$/.test(x)) return "deg";
  return x;
}
const wordsNear = (text, at) => lc(String(text).slice(Math.max(0, at - 50), at + 50)).match(/[a-z]{3,}/g) || [];
const hasWhole = (hay, n) => new RegExp("(^|[^\\d.,])" + escRe(n) + "(?![\\d])").test(hay) ||
  (/,/.test(n) && new RegExp("(^|[^\\d.,])" + escRe(n.replace(/,/g, "")) + "(?![\\d])").test(hay));

/** The one source figure a garbled answer figure should be, or null when it isn't clear. */
function pickFigure(hay, n, unit, d, before, after, mine) {
  // candidates: the source's figures with the same unit, or (no unit) between the same words
  let cands = [];
  if (unit) cands = numbersWithUnit(hay).filter((x) => x.unit === unit && digitsOf(x.n) !== d);
  if (!cands.length) {
    // no unit: the words right around it ("The 0 features" → "The 90 features")
    const pw = (before.match(/([A-Za-z]{2,})\W*$/) || [])[1], nw = (after.match(/^\W*([A-Za-z]{2,})/) || [])[1];
    if (pw && nw) {
      const re = new RegExp(escRe(pw) + "\\W{1,3}(\\d+(?:[.,]\\d+)*)\\W{0,3}" + escRe(nw), "gi");
      cands = [...hay.matchAll(re)].map((x) => ({ n: x[1], at: x.index + x[0].indexOf(x[1]), near: true }));
    }
  }
  // the best: digits that fit (a dropped / doubled digit) and the same words nearby
  const scored = cands.map((c) => {
    const cd = digitsOf(c.n);
    const fit = cd !== d && (isSub(d, cd) || isSub(cd, d));
    const overlap = wordsNear(hay, c.at).filter((w) => mine.has(w)).length;
    return { to: c.n, fit, overlap, s: (fit ? 2 : 0) + overlap + (c.near ? 2 : 0) };
  }).filter((c) => c.fit || c.overlap >= 2);
  const byVal = new Map();
  for (const c of scored) if (!byVal.has(c.to) || byVal.get(c.to).s < c.s) byVal.set(c.to, c);
  const ranked = [...byVal.values()].sort((a, b) => b.s - a.s);
  return ranked.length && (ranked.length === 1 || ranked[0].s > ranked[1].s) ? ranked[0].to : null;
}

/** Fix the figures (and glued words) of one answer against its sources. → { text, fixed } */
export function repairFigures(answer, sources) {
  const src = (sources || []).filter(Boolean);
  if (!answer || !src.length) return { text: answer || "", fixed: [] };
  const fixed = [];
  const hayAll = src.map((h) => (h.title || "") + "\n" + (h.text || "")).join("\n");
  const lines = String(answer).split("\n").map((line) => {
    if (!/\d|[A-Za-z]{5,}/.test(line) || /^\s*\|?\s*:?-{2,}/.test(line)) return line;
    const hay = citedText(line, src);
    const hayL = lc(hay);
    const reps = [];
    for (const m of line.matchAll(/(\d+(?:[.,]\d+)*)/g)) {
      const n = m[1], at = m.index;
      // citation numbers and years in the question are not figures
      if (line[at - 1] === "[" || /^\d{1,2}\]/.test(line.slice(at))) continue;
      const after = line.slice(at + n.length), before = line.slice(0, at);
      const um = after.match(UNIT);
      const unit = um ? normUnit(um[1]) : "";
      // in the source as written — with the same unit ("4 km" is not the "4" of "4D radar")
      const inSrc = (h) => unit ? numbersWithUnit(h).some((x) => x.unit === unit && (x.n === n || x.n.replace(/,/g, "") === n.replace(/,/g, ""))) : hasWhole(h, n);
      if (inSrc(hay) || inSrc(hayAll)) continue;   // right figure (maybe cited wrong) — leave it
      const d = digitsOf(n);
      const mine = new Set(wordsNear(line, at));
      // v5.32: the cited source first; small models often cite the wrong number, so then all of them
      const to = pickFigure(hay, n, unit, d, before, after, mine) || (hay !== hayAll ? pickFigure(hayAll, n, unit, d, before, after, mine) : null);
      if (to) reps.push({ at, len: n.length, to });
    }
    let out = line;
    for (const r of reps.sort((a, b) => b.at - a.at)) {
      fixed.push(out.slice(r.at, r.at + r.len) + "→" + r.to);
      out = out.slice(0, r.at) + r.to + out.slice(r.at + r.len);
    }
    // glued words: "sixseater" / "rotate180degrees" → the source's "six-seater" / "rotate 180 degrees"
    out = out.replace(/[A-Za-z0-9]{5,}/g, (w) => {
      if (hayL.includes(lc(w)) || w.length > 40) return w;
      const re = new RegExp(w.split("").map(escRe).join("[\\s\\-‐‑–]?"), "i");
      const m = hay.match(re);
      if (!m || m[0] === w || m[0].replace(/[\s\-‐‑–]/g, "") !== w.replace(/[\s\-‐‑–]/g, "")) return w;
      fixed.push(w + "→" + m[0]);
      return m[0].replace(/[‐‑]/g, "-");
    });
    return out;
  });
  return { text: lines.join("\n"), fixed };
}

const NOT_GIVEN = /\b(the )?(passages?|sources?|articles?|search results?|pages?)\b[^.\n]{0,40}\b(do(es)? not|don't|doesn't|did not|didn't|not)\b[^.\n]{0,20}\b(provide|give|mention|include|specify|list|contain|say|state|offer|cover)|\bnot (provided|mentioned|specified|listed|given|available) in the (passages?|sources?)|\b(I )?(can(no|')t|could not|couldn't) find\b[^.\n]{0,60}\b(passages?|sources?)|لم (تذكر|يذكر|توضح|يوضح) (المصادر|الفقرات|النصوص)|المصادر (لا|ما) (تذكر|بتذكرش)/i;

/** Tidy a finished answer: bold, citations, duplicate bullets, tables, "not provided" lines. */
export function tidyAnswer(answer) {
  let t = String(answer || "");
  // citation lists "[2, 3, 5]" → [2][3][5]; empty "[]" gone; "[5][5]" → [5]
  t = t.replace(/\[(\d{1,2}(?:\s*,\s*\d{1,2})+)\]/g, (_, l) => l.split(/\s*,\s*/).map((x) => "[" + x + "]").join(""));
  t = t.replace(/\[\s*\]/g, "").replace(/(\[\d{1,2}\])(\s*\1)+/g, "$1");
  // bold: "****" runs → "**"; a line with an odd number of ** loses its last one
  t = t.replace(/\*{3,}/g, "**");
  const seen = new Set();
  const out = [];
  const lines = t.split("\n");
  for (let i = 0; i < lines.length; i++) {
    let l = lines[i];
    const n = (l.match(/\*\*/g) || []).length;
    if (n % 2) { const k = l.lastIndexOf("**"); l = l.slice(0, k) + l.slice(k + 2); }
    l = l.replace(/\*\*\s*\*\*/g, "").replace(/\(\s*\*\*/g, "**(");
    // "the passages don't provide …": dropped (the gaps are searched for instead)
    if (NOT_GIVEN.test(l) && !/\|/.test(l)) continue;
    l = l.replace(/\bthe passages\b/gi, "the sources").replace(/\bpassages\b/gi, "sources");
    // the same bullet again (ignoring citations and bold) → dropped
    const key = lc(l).replace(/\[\d+\]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l) && key.length > 5) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(l);
  }
  // tables: every row as many cells as the header
  for (let i = 0; i + 1 < out.length; i++) {
    if (!/^\s*\|.*\|\s*$/.test(out[i]) || !/^\s*\|?\s*:?-{2,}/.test(out[i + 1])) continue;
    const cells = (s) => s.trim().replace(/^\||\|$/g, "").split("|");
    const w = cells(out[i]).length;
    out[i + 1] = "|" + Array(w).fill(" --- ").join("|") + "|";
    for (let j = i + 2; j < out.length && /^\s*\|/.test(out[j]); j++) {
      const c = cells(out[j]).map((x) => x.trim() || "—");
      while (c.length < w) c.push("—");
      out[j] = "| " + c.slice(0, w).join(" | ") + " |";
    }
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

const CUR = /(\$|US\$|USD|EGP|E£|LE\b|€|EUR|£|GBP|¥|CNY|RMB|yuan|AED|SAR|dirham|riyal|جنيه|دولار|يورو|ريال|درهم)\s?\d|\d[\d,.]*\s?(\$|USD|EGP|EUR|GBP|CNY|RMB|yuan|AED|SAR|جنيه|دولار)/i;

/**
 * What the question asked for that the answer doesn't have yet → facet words to search for
 * ("price", "trims versions", "specifications"). Empty when nothing is missing.
 */
export function gapsOf(question, answer) {
  const q = String(question || ""), a = String(answer || "");
  const gaps = [];
  if (/\b(price|prices|cost|how much)\b|سعر|أسعار|اسعار|بكام|تمن/i.test(q) && !CUR.test(a)) gaps.push(/[؀-ۿ]/.test(q) ? "سعر" : "price");
  const rows = (a.match(/^\s*\|.*\|\s*$/gm) || []).length;
  if (/\b(trims?|versions?|variants?|all models)\b|فئات|فئة|نسخ/i.test(q) && rows < 4) gaps.push(/[؀-ۿ]/.test(q) ? "الفئات" : "trims versions");
  if (/\b(specs?|specifications?|detailed)\b|مواصفات/i.test(q) && ((a.match(/\d[\d,.]*\s?(hp|kw|nm|km|kg|mm|kwh|mph|km\/h|v|ah|w|l)\b/gi) || []).length < 4)) gaps.push(/[؀-ۿ]/.test(q) ? "المواصفات" : "specifications");
  return gaps;
}
