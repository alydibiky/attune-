// v10.8 (Ali, 22 Nov 2026: "25000 egp expense under masroof nada for shopping winter clothes" — he has a category "masroof nada"; it was
// saved under Others with the whole sentence as the note — "fix this generally"). After any money reading, ONE step:
//   1. the category the sentence names — one of HIS categories (customCats: en / ar / name, written in English letters, Franco or
//      Arabic: "masroof nada" = «مصروف ندى» = "Masroof Nada"), with or without "under / in / category / for / تحت / في / بند / على";
//      a built-in category said by name ("under transport", «بند مواصلات») counts too
//   2. the note = what it was: the amount, the currency, "expense / spent / paid", the category phrase and joining words go
//      ("shopping winter clothes")
// Used by doit.understand (Home, Chat, voice) for every money item.
import { CAT_NAMES } from "./money-report.js";

const AR_LAT = { "ا": "a", "أ": "a", "إ": "e", "آ": "a", "ب": "b", "ت": "t", "ث": "s", "ج": "g", "ح": "h", "خ": "kh", "د": "d", "ذ": "z", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
  "ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "3", "غ": "gh", "ف": "f", "ق": "2", "ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y", "ى": "a", "ء": "2", "ؤ": "2", "ئ": "2" };
// the "skeleton" of a word: Arabic in Latin letters, vowels and the letters people drop in Franco gone — "masroof" / «مصروف» → "msrf"
export function skeleton(s) {
  let t = String(s || "").toLowerCase().replace(/[ً-ٰٟـ]/g, "").replace(/ه(?=\s|$)/g, "ة");   // «العربيه» = «العربية»
  t = t.replace(/[؀-ۿ]/g, (c) => AR_LAT[c] || "");
  t = t.replace(/^(?:el|al)(?=\S{3})/g, "").replace(/\s(?:el|al)(?=\S{3})/g, " ")   // «المصروف» / "el masroof"
    .replace(/kh/g, "k").replace(/gh/g, "g").replace(/sh/g, "s").replace(/ch/g, "s").replace(/th/g, "t").replace(/[2378]/g, "").replace(/q/g, "")
    .replace(/(.)\1+/g, "$1").replace(/[aeiouwy]/g, "")   // doubles merged BEFORE the vowels go: "mama" = «ماما» = "mm" (v10.8: it was "m", too short to match).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return t;
}
const LEAD = "(?:under|in|into|to|for|on|as|from|category|cat|the|my|el|al|ta7t|fe|f|3ala|bnd|band|تحت|في|ف|على|ع|بند|من|قسم|ضمن|ل|لـ)";
// one normalisation for the finder and the note, so their word positions line up: direction marks gone, "L.E." one word, "expense of"
export function normText(s) { return String(s || "").replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, "").replace(/\bL\.\s?E\.?(?=\s|$|[,،.:;!])/gi, " LE ")
  .replace(/\bE\.?G\.?P\.?\b/gi, " EGP ").replace(/\bexpenses? of\b/gi, " expense ").replace(/ج\.\s?م\.?/g, " جم "); }
const words = (s) => normText(s).split(/[\s,،.;:!?؟()"'«»“”—–-]+/).filter(Boolean);

/** The category the text names (his own first, then a built-in one said by name) → { id, span: [start, end] of its words } or null. */
const CURRENCY_WORD = /^(?:egp|le|pounds?|gneh|geneh|جنيه|جنية|ج|جم|ج\.م|usd|sar|aed|ريال|درهم|دولار)$/i;
export function catNamed(text, ledger) {
  // a currency word is never a category: «جم» (pounds) and "Gym" are the same letters
  const W = words(text), sk = W.map((w) => (CURRENCY_WORD.test(w) ? "\u0000" : skeleton(w)));
  const names = [];
  for (const c of (ledger && ledger.customCats) || []) for (const n of [c.en, c.ar, c.name, c.id]) if (n && String(n).trim().length >= 2) names.push({ id: c.id, n: String(n), own: true });
  for (const [id, pair] of Object.entries(CAT_NAMES || {})) for (const n of pair || []) if (n && String(n).length >= 3) names.push({ id, n: String(n), own: false });
  let best = null;
  for (const { id, n, own } of names) {
    const target = skeleton(n).split(" ").filter(Boolean); if (!target.length || target.join("").length < 2) continue;
    for (let i = 0; i + target.length <= W.length; i++) {
      let ok = true; for (let k = 0; k < target.length; k++) if (sk[i + k] !== target[k]) { ok = false; break; }
      // a built-in name alone must be said as a category ("under transport"), so "taxi to the shopping mall" is not "shopping"
      if (ok && !own && !(i > 0 && new RegExp("^" + LEAD + "$", "i").test(W[i - 1]) && /under|category|cat|تحت|بند|قسم|ضمن/i.test(W.slice(Math.max(0, i - 2), i).join(" ")))) ok = false;
      if (ok) { const score = (own ? 100 : 0) + target.length * 10 + n.length; if (!best || score > best.score) best = { id, own, score, span: [i, i + target.length], len: target.length }; }
    }
  }
  return best ? { id: best.id, own: best.own, span: best.span } : null;
}

const NOTE_DROP = /^(?:expenses?|spent|spend|paid|pay|payment|bought|buy|income|got|received|egp|le|l\.e|pounds?|gneh|geneh|جنيه|جنية|ج|ج\.م|جم|usd|\$|sar|aed|ريال|درهم|دولار|مصروف(?=$)|صرفت|دفعت|اشتريت|today|yesterday|النهارده|امبارح)$/i;
// fillers and the emoji people add around a money line (persona-style "btw", "ok", "📌", «شكرا») are not what it was
const FILLER = /^(?:ok|okay|btw|thanks|thank|thx|pls|please|plz|so|yo|hey|ali|شكرا|شكراً|بقى|يعني|طيب|بص|تمام|ماشي)$/i;
const EDGE = /^(?:for|on|in|into|to|under|of|with|at|as|from|category|cat|and|the|a|an|my|el|al|ta7t|fe|f|3ala|3shan|3ashan|عشان|علشان|لـ|ل|في|ف|على|ع|تحت|بند|من|و|ضمن|قسم)$/i;
/** The note: the words of the sentence minus the amount, money words, the category phrase and joining words at the edges. */
export function cleanNote(text, amountRaw, span) {
  let W = words(text);
  if (span) W = W.filter((_, i) => i < span[0] || i >= span[1]).map((w, i, a) => w);
  const amt = String(amountRaw || "").replace(/[\s,]/g, "");
  W = W.filter((w) => !(amt && w.replace(/[,]/g, "") === amt) && !/^[\d٠-٩][\d٠-٩.,]*(?:k|ك|ألف|الف)?$/i.test(w) && !NOTE_DROP.test(w) && !FILLER.test(w) && /[\p{L}\p{N}]/u.test(w));
  // "under" / «تحت» left where the category was, and joining words at both ends
  while (W.length && EDGE.test(W[0])) W.shift();
  while (W.length && EDGE.test(W[W.length - 1])) W.pop();
  return W.join(" ").slice(0, 80);
}

/** The amounts of a sentence, Franco letters left out ("el 3arabeya" has no amount 3; "25k" is 25,000). */
export function francoSafe(text) { return String(text || "").replace(/(?<![\d.,])[2378](?=[a-z]{2,})/gi, " ").replace(/(?<=[a-z])[2378](?=[a-z])/gi, " "); }
/** Was the category said AS a category ("under X", «تحت X», "category X", "in X")? */
const CAT_LEAD = /^(?:under|in|into|on|from|category|cat|ta7t|fe|f|3ala|men|mn|تحت|في|ف|على|علي|ع|بند|قسم|ضمن|من|ل|لـ)$/i;
const SKIP = /^(?:the|my|el|al|category|cat)$/i;
/** The lead word before the category ("under", «تحت», "from", «من»), over "the / my / el / the category" → [its index, true] or [start, false]. */
function leadBefore(W, start) { let j = start; while (j > 0 && (SKIP.test(W[j - 1]) || CAT_LEAD.test(W[j - 1]))) j--;   // "under the category", «علي ال»
  const lead = W.slice(j, start).some((w) => CAT_LEAD.test(w)); return lead ? [j, true] : [start, false]; }
export function saidAsCategory(text, hit) { return !!hit && leadBefore(words(text), hit.span[0])[1]; }
export const SPENT = /\b(?:expenses?|spent|spend|paid|pay|bought|purchased)\b|صرفت|دفعت|مصروف|اشتريت|دافع/i;
/** One money item, fitted to his categories: the named category and a clean note. src = the sentence it came from. */
export function fitItem(item, src, ledger) {
  if (!item || !src) return item;
  const hit = catNamed(src, ledger);
  const amountRaw = (String(src).match(/[\d٠-٩][\d٠-٩.,]*\s*(?:k|ك)?/i) || [""])[0].trim();
  // the category's words leave the note only when they were said AS the category ("under masroof nada", «تحت مصروف ندى», "on Masroof
  // Nada"); "500 for the car service" (his category Car) keeps «car service»
  const W = words(src), lb = hit ? leadBefore(W, hit.span[0]) : [0, false], asCat = hit && lb[1];
  // said as the category → the lead word ("under the category") goes with the name
  const note = cleanNote(src, amountRaw, asCat ? [lb[0], hit.span[1]] : null);
  const out = { ...item };
  if (hit && (hit.own || !item.cat || item.cat === "other")) out.cat = hit.id;
  if (hit || /\b(?:expenses?|under|category)\b|مصروف|تحت|بند/i.test(String(item.note || ""))) {
    const c = hit && ((ledger && ledger.customCats) || []).find((x) => x.id === hit.id);
    out.note = note || (c && (/[\u0600-\u06ff]/.test(src) ? c.ar || c.en : c.en || c.ar)) || item.note; }   // only the category said → its name
  return out;
}
