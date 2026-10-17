/* ---- v6.32: split a bill with friends (roadmap "Split bills", linked to People and debts) --------------------------------
   «Dinner 1,200 split with Ahmed and Sara» → 3 ways, 400 each → Ahmed owes you 400, Sara owes you 400 (two debts in
   People & plans, each with its own checkbox and reminder). «Ahmed paid 900 for the taxi, split between me, him and Ali»
   → you owe Ahmed 300. «قسمنا العشا ١٢٠٠ على ٤» → 300 each, 3 unnamed shares. Uneven shares: «Ahmed 500, Sara 300, me 400».
   Code reads it (English, Arabic incl. Egyptian, and the common words in Spanish/French/Portuguese/German/Turkish/Indonesian);
   no model. Pure; tests: tests/unit/v736split.test.mjs.                                                                         */
import { amountsIn } from "./life.js";
import { payCurrency } from "./yusr/paytext.js";
import { homeCurrency } from "./locale.js";

const AR_D = "٠١٢٣٤٥٦٧٨٩";
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR_D.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");
const fold = (s) => latin(s).replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟])/g, "ه");

export const SPLIT_RE = /\b(split|splitting|share[ds]?|divide[ds]?|go(?:ing)? halves|half each|each pays?|between us|dividir|dividimos|partager|partagé|rachat|teilen|geteilt|bölüş|paylaş|patungan|bagi)\b|قسم|نقسم|اتقسم|هنقسم|بالنص|مناصفه|كل واحد|علينا|بيننا/i;
const ME = /^(me|i|myself|us|انا|وانا|أنا|وأنا|yo|moi|eu|ich|ben|saya|aku)$/i;
const STOP = /^(the|a|an|and|with|between|among|for|dinner|lunch|taxi|uber|bill|split|paid|each|of|on|to|in|at|by|him|her|them|friends?|everyone|all|people|ways?|egp|usd|sar|aed|eur)$/i;
const AR_STOP = /^(العشا|العشاء|الغدا|الغداء|الفطار|التاكسي|الاوبر|الحساب|الفاتوره|على|علي|مع|بين|كل|واحد|دفع|دفعت|و|اللي|الي|جنيه|ج|ريال|درهم|دولار|نفر|افراد|اشخاص|قسمنا|نقسم|هنقسم|اتقسم|قسم|بالنص|بيننا|علينا|هو|هي|هم|احنا)$/;

/** Names in a list: "Ahmed, Sara and Ali" / «أحمد وسارة ومنى» → ["Ahmed", "Sara", "Ali"]; "me" is reported apart. */
function namesIn(chunk) {
  const out = []; let me = false;
  const parts = String(chunk).split(/\s*(?:,|،|\band\b|\by\b|\bet\b|\be\b|\bund\b|\bve\b|\bdan\b|&|\+)\s*|\s+و(?=[ء-ي])|\s+/u).map((x) => x.trim()).filter(Boolean);
  for (let p of parts) {
    p = p.replace(/^و(?=[ء-ي]{2,})/, "");
    if (ME.test(p)) { me = true; continue; }
    if (/^\p{Lu}[\p{Ll}'’-]+$/u.test(p) && !STOP.test(p)) out.push(p);
    else if (/^[ء-ي]{2,}$/.test(p) && !AR_STOP.test(fold(p))) out.push(p);
  }
  return { names: [...new Set(out)], me };
}

/**
 * One sentence → a split, or null. → { title, total, currency, payer ("me" or a name), people (others), count (shares incl. you
 * when you are in it), each, shares: [{ person, amount }], debts: [{ person, dir: "in"|"out", amount }] }
 */
export function parseSplit(text, { currency = homeCurrency() } = {}) {
  const raw = String(text || "").trim(); if (!raw || !SPLIT_RE.test(raw) && !SPLIT_RE.test(fold(raw))) return null;
  const cur = payCurrency(raw, currency) || currency;
  const t = fold(raw);
  const amts = amountsIn(raw, cur).filter((a) => a.value > 0);
  if (!amts.length) return null;
  // who paid: "Ahmed paid", «أحمد دفع», «دفع أحمد»; else you
  let payer = "me";
  const pm = /(\p{Lu}[\p{Ll}'’-]+)\s+(?:paid|pagó|a payé|pagou|hat bezahlt|ödedi|bayar)/u.exec(raw) || /(?:^|\s)([ء-ي]{2,})\s+(?:دفع|اللي دفع|هو اللي دفع)/.exec(t) || /(?:دفع|دفعها)\s+([ء-ي]{2,})/.exec(t);
  if (pm && !ME.test(pm[1]) && !AR_STOP.test(fold(pm[1]))) payer = raw.slice(pm.index + pm[0].indexOf(pm[1]), pm.index + pm[0].indexOf(pm[1]) + pm[1].length);
  // the people: after with / between / among / مع / بين / على
  const lm = /\b(?:with|between|among|entre|avec|com|mit|ile|dengan|sama)\s+(.+?)(?:[.!?]|\s+(?:for|on|at|and paid|who paid|el|pour|para|für)\b|$)/iu.exec(raw)
    || /(?:مع|بين|علي|على)\s+((?:[ء-ي]+(?:\s*[،,]\s*|\s+و|\s+)?){1,8})/.exec(t);
  let names = [], meIn = true;
  // (fold keeps every letter in place, so the names are taken from what was typed: «أحمد», not «احمد»)
  const back = (mt, g) => { const at = mt.index + mt[0].indexOf(mt[g]); return raw.slice(at, at + mt[g].length); };
  if (lm) { const r = namesIn(back(lm, 1)); names = r.names; meIn = r.me || !/\bbetween\b|بين|entre/i.test(lm[0]) || payer === "me"; }
  // unnamed: "on 4", "4 ways", «على ٤», «٤ أفراد»
  const nm = /(?:\bon|\binto|\bin|علي|على)\s*(\d{1,2})(?!\d)(?!\s*(?:%|k\b))|(\d{1,2})\s*(?:ways|people|persons|friends|of us|parts|افراد|اشخاص|نفر|انفار)/i.exec(latin(t));
  const nUnnamed = nm ? +(nm[1] || nm[2]) : 0;
  if (payer !== "me" && !names.includes(payer)) names = [payer, ...names];
  names = names.filter((n) => !ME.test(n));
  // uneven shares: «Ahmed 500, Sara 300, me 400»
  const shares = [];
  const pairRe = /(\p{Lu}[\p{Ll}'’-]+|me|[ء-ي]{2,})\s*(?::|=|had|ate|ب|عليه|عليها)?\s*(\d[\d,.]*)/giu;
  let m; while ((m = pairRe.exec(latin(raw)))) { const who = ME.test(m[1]) ? "me" : m[1]; if (!STOP.test(who) && !AR_STOP.test(fold(who))) shares.push({ person: who, amount: +m[2].replace(/,/g, "") }); }
  const tipM = /(\d{1,2})\s*%\s*(?:service|tip|خدمه|خدمة|بقشيش|propina|pourboire|gorjeta|trinkgeld|bahşiş)|(?:service|tip|خدمه|خدمة|بقشيش)\s*(\d{1,2})\s*%/i.exec(latin(t));
  const tip = tipM ? +(tipM[1] || tipM[2]) / 100 : 0;
  let total, list;
  if (shares.length >= 2 && shares.every((s) => s.amount > 0) && new Set(shares.map((s) => s.person)).size === shares.length) {
    list = shares.map((s) => ({ ...s, amount: r2(s.amount * (1 + tip)) }));
    total = r2(list.reduce((a, s) => a + s.amount, 0));
  } else {
    total = r2(Math.max(...amts.map((a) => a.value)) * (1 + tip));
    const n = names.length + (meIn ? 1 : 0) + 0;
    const count = Math.max(n, nUnnamed, names.length ? 0 : 2);
    if (count < 2) return null;
    const each = Math.floor((total / count) * 100) / 100;
    const people = [...(meIn ? ["me"] : []), ...names];
    while (people.length < count) people.push("");                         // unnamed shares
    list = people.map((p) => ({ person: p, amount: each }));
    const rest = r2(total - each * count);                                  // a cent left over goes to whoever paid
    const pi = list.findIndex((s) => s.person === payer); if (rest && pi >= 0) list[pi].amount = r2(list[pi].amount + rest);
  }
  const debts = [];
  for (const s of list) {
    if (!s.person || s.person === payer) continue;
    if (payer === "me") debts.push({ person: s.person, dir: "in", amount: s.amount });
    else if (s.person === "me") debts.push({ person: payer, dir: "out", amount: s.amount });
  }
  const title = titleOf(raw, t);
  return { kind: "split", title, total, currency: cur, payer, people: list.filter((s) => s.person && s.person !== "me").map((s) => s.person), count: list.length,
    each: list.every((s) => s.amount === list[0].amount) ? list[0].amount : null, shares: list, debts, tip };
}
const r2 = (x) => Math.round(x * 100) / 100;
function titleOf(raw, t) {
  const w = /\b(dinner|lunch|breakfast|taxi|uber|careem|trip|groceries|rent|gift|hotel|party|pizza|coffee|drinks|tickets?|cena|comida|dîner|déjeuner|jantar|almoço|abendessen|yemek|makan)\b/i.exec(raw)
    || /(عشا|عشاء|غدا|غداء|فطار|تاكسي|اوبر|كريم|رحله|رحلة|هديه|هدية|فندق|بيتزا|قهوه|قهوة|تذاكر|سوبر ?ماركت|شقه|شقة)/.exec(t);
  return w ? w[0][0].toUpperCase() + w[0].slice(1).toLowerCase() : "";
}

/** The split → the debts to save in People & plans (one commitment each, the same shape as parseLife's). */
export function splitToCommitments(s, { now = Date.now() } = {}) {
  const day = new Date(now); const start = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return (s.debts || []).map((d) => ({ kind: "debt", person: d.person, dir: d.dir, amount: d.amount, count: 1, total: d.amount, every: null, currency: s.currency,
    start, paid: [], title: s.title ? s.title + " (split)" : "Split bill", split: { total: s.total, count: s.count } }));
}
