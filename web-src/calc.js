/* ---- instant calculations ------------------------------------------------------
   "3 cranes × 4 days × 12,500 EGP a day + 14% VAT — total?" is arithmetic, not a
   language problem. A phone model takes seconds to minutes and can still get it
   wrong; code gets it right in under a millisecond. So Chat answers these here,
   shows the working, and offers the model only if the person wants it.

   Understood: numbers with commas or Arabic digits, × x * · ÷ / + - −, brackets,
   and percentages: "+ 14% VAT" / "+14%" (add 14 % of what came before),
   "- 10%" (take 10 % off), "14% of 150,000". Words and units between the
   numbers are ignored; the unit/currency of the answer is taken from the text. */

const AR = "٠١٢٣٤٥٦٧٨٩";
const digits = (s) => String(s || "").replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/٫/g, ".").replace(/٬/g, ",");

const CUR = [[/\bEGP\b|جنيه|ج\.م/i, "EGP"], [/\bUSD\b|\$|دولار/i, "USD"], [/\bSAR\b|ريال/i, "SAR"], [/\bAED\b|درهم/i, "AED"], [/\bEUR\b|€|يورو/i, "EUR"]];
const OPS = { "×": "*", "x": "*", "X": "*", "*": "*", "·": "*", "÷": "/", "/": "/", "+": "+", "-": "-", "−": "-", "–": "-" };

/** Lexer: numbers, operators, brackets, % — everything else is skipped, but a
 *  word BETWEEN two numbers with no operator means this isn't a sum. */
function lex(text) {
  const s = digits(text);
  const out = [];
  const re = /(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)|([×xX*·÷/+\-−–])|([()])|(%)|([^\s\d×xX*·÷/+\-−–()%]+)|\s+/g;
  let m;
  while ((m = re.exec(s))) {
    if (m[1]) out.push({ t: "n", v: parseFloat(m[1].replace(/,/g, "")), raw: m[1] });
    else if (m[2]) {
      // "x" is only "times" between numbers ("3 x 4"), not inside a word.
      if (/[xX]/.test(m[2])) { const before = s[m.index - 1] || " ", after = s[m.index + 1] || " "; if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) { out.push({ t: "w", v: m[2] }); continue; } }
      out.push({ t: "op", v: OPS[m[2]] });
    }
    else if (m[3]) out.push({ t: m[3] });
    else if (m[4]) out.push({ t: "%" });
    else if (m[5]) out.push({ t: "w", v: m[5] });
  }
  return out;
}

/** Is this message a calculation we can do exactly? */
export function looksLikeCalc(text) {
  const t = String(text || "");
  if (t.length > 220 || /\n.*\n/.test(t)) return false;
  const toks = lex(t).filter((x) => x.t !== "w");
  const nums = toks.filter((x) => x.t === "n").length;
  const ops = toks.filter((x) => x.t === "op").length;
  if (nums < 2 || ops < 1) return false;
  // Only when it is clearly a sum: a times/plus/percent sign, or words that ask
  // for a result. "25/9" (a date) or "10-12 days" alone never trigger it.
  const strong = /[×*÷+%]|\d\s*[xX]\s*\d/.test(digits(t));
  const asks = /\b(total|sum|calculate|how much|equals?)\b|=|كام|احسب|حسبة|اجمالي|إجمالي|مجموع|يساوي/i.test(t);
  if (!strong && !asks) return false;
  if (/\+\s*\d[\d\s-]{7,}/.test(digits(t))) return false;      // a phone number
  if (/\b\d{1,2}[/.-]\d{1,2}([/.-]\d{2,4})?\b/.test(digits(t)) && !/[×*÷+%]/.test(t)) return false; // a date
  // Every operator must sit between numbers/brackets/percent; no dangling ones.
  return calculate(t) != null;
}

// Shunting-yard evaluation over number/op/bracket tokens.
function evalTokens(toks) {
  const out = [], st = [], prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  let expectNum = true;
  for (const k of toks) {
    if (k.t === "n") { if (!expectNum) return null; out.push(k.v); expectNum = false; }
    else if (k.t === "op") {
      if (expectNum) { if (k.v === "-") { out.push(0); } else return null; }
      while (st.length && st[st.length - 1] !== "(" && prec[st[st.length - 1]] >= prec[k.v]) out.push(st.pop());
      st.push(k.v); expectNum = true;
    } else if (k.t === "(") { if (!expectNum) return null; st.push("("); }
    else if (k.t === ")") {
      if (expectNum) return null;
      while (st.length && st[st.length - 1] !== "(") out.push(st.pop());
      if (!st.length) return null; st.pop();
    }
  }
  if (expectNum) return null;
  while (st.length) { const o = st.pop(); if (o === "(") return null; out.push(o); }
  const v = [];
  for (const x of out) {
    if (typeof x === "number") v.push(x);
    else { const b = v.pop(), a = v.pop(); if (a == null || b == null) return null;
      v.push(x === "+" ? a + b : x === "-" ? a - b : x === "*" ? a * b : b === 0 ? NaN : a / b); }
  }
  return v.length === 1 && isFinite(v[0]) ? v[0] : null;
}

const fmt = (n) => { const r = Math.round(n * 100) / 100; return r.toLocaleString("en-US", { maximumFractionDigits: 2 }); };
const show = (toks) => toks.map((k) => (k.t === "n" ? k.raw || fmt(k.v) : k.t === "op" ? { "*": "×", "/": "÷", "+": "+", "-": "−" }[k.v] : k.t)).join(" ").replace(/\( /g, "(").replace(/ \)/g, ")");

/**
 * The exact result and its working, or null if this isn't plain arithmetic.
 * { value, unit, steps: [text…], markdown }
 */
export function calculate(text) {
  const all = lex(text);
  // Words between two numbers with no operator ("3 cranes 4 days") → not a sum.
  const core = [];
  let pendingWordsBetweenNumbers = false;
  for (const k of all) {
    if (k.t === "w") { continue; }
    const prev = core[core.length - 1];
    // "15% of 2,400" is fine (the % becomes ×); "3 cranes 4 days" is not a sum.
    if (k.t === "n" && prev && (prev.t === "n" || prev.t === ")")) { pendingWordsBetweenNumbers = true; break; }
    core.push(k);
  }
  if (pendingWordsBetweenNumbers) return null;
  // A dash or operator used as punctuation at either end ("… VAT – total?").
  while (core.length && core[core.length - 1].t === "op") core.pop();
  while (core.length && core[0].t === "op" && core[0].v !== "-") core.shift();
  if (core.length < 3) return null;

  // Split at top-level "+ p%" / "- p%": each applies to everything before it.
  const segments = [];   // [{ toks, pct?, sign? }]
  let cur = [], depth = 0;
  for (let i = 0; i < core.length; i++) {
    const k = core[i];
    if (k.t === "(") depth++; else if (k.t === ")") depth--;
    if (depth === 0 && k.t === "op" && (k.v === "+" || k.v === "-") && core[i + 1] && core[i + 1].t === "n" && core[i + 2] && core[i + 2].t === "%"
        && (!core[i + 3] || (core[i + 3].t === "op"))) {
      segments.push({ toks: cur }); cur = [];
      segments.push({ pct: core[i + 1].v, sign: k.v });
      i += 2; continue;
    }
    cur.push(k);
  }
  segments.push({ toks: cur });
  // Plain "p% of X" / "p% × X" inside a segment → p/100.
  const clean = (toks) => {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      if (k.t === "%") { const n = out.pop(); if (!n || n.t !== "n") return null; out.push({ t: "n", v: n.v / 100, raw: n.raw + "%" });
        if (toks[i + 1] && toks[i + 1].t === "n") out.push({ t: "op", v: "*" }); continue; }
      out.push(k);
    }
    return out;
  };
  const steps = [];
  let value = null;
  for (const sg of segments) {
    if (sg.pct != null) {
      if (value == null) return null;
      const part = value * sg.pct / 100;
      const next = sg.sign === "+" ? value + part : value - part;
      steps.push(`${sg.pct}% ${sg.sign === "+" ? "of" : "off"} ${fmt(value)} = ${fmt(part)}`);
      steps.push(`${fmt(value)} ${sg.sign === "+" ? "+" : "−"} ${fmt(part)} = **${fmt(next)}**`);
      value = next;
    } else {
      if (!sg.toks.length) continue;
      const toks = clean(sg.toks); if (!toks) return null;
      let v;
      if (value == null) { v = evalTokens(toks); if (v == null) return null; steps.push(`${show(toks)} = **${fmt(v)}**`); }
      else {
        // continues the running total: "… + 14% + 500"
        const first = toks[0]; if (!first || first.t !== "op") return null;
        v = evalTokens([{ t: "n", v: value }, ...toks]); if (v == null) return null;
        steps.push(`${fmt(value)} ${show(toks)} = **${fmt(v)}**`);
      }
      value = v;
    }
  }
  if (value == null || !isFinite(value)) return null;
  const s = String(text);
  const unit = (CUR.find(([re]) => re.test(s)) || [])[1] || "";
  const isAr = /[؀-ۿ]/.test(s);
  const label = isAr ? "الإجمالي" : "Total";
  const shownUnit = isAr ? ({ EGP: "جنيه", USD: "دولار", SAR: "ريال", AED: "درهم", EUR: "يورو" }[unit] || unit) : unit;
  const markdown = `**${label}: ${fmt(value)}${shownUnit ? " " + shownUnit : ""}**\n\n` + steps.map((x, i) => `${i + 1}. ${x}`).join("\n");
  return { value, unit, steps, markdown };
}
