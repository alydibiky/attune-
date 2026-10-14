/* ---- v6.27 Homework Coach — the maths engine: school maths solved BY CODE, step by step, exactly ------------------------------
   Ali: "the code should be smart and strong enough so the app doesn't make mistakes". So the answer and every step come from
   exact arithmetic (fractions, never floating point), and every result is CHECKED a second way before it is shown:
     - an expression: each step's value equals the original's (re-evaluated independently);
     - an equation: the answer is substituted back into BOTH sides (that check is also shown to the child as the last step).
   Topics: arithmetic with the order of operations, negative numbers, decimals, fractions and mixed numbers (common
   denominator, simplify), powers, percentages ("15% of 80", "20 is what % of 80", "increase 50 by 10%"), linear equations
   in one unknown (brackets, fractions, the unknown on both sides). Anything else → null (then the phone's model explains it and
   Python/sympy checks the final answer — verify.js), never a guess.
   Each step: { text (the maths after the step), rule (what was done, in plain words), visual?: {kind, …} } for the lesson player.
   Pure. Tests: tests/unit/v727coach.test.mjs.                                                                                  */

// ---- exact numbers: fractions of integers ----------------------------------------------------------------------------------------
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
export class Q {
  constructor(n, d = 1) { if (d === 0) throw new Error("division by zero"); if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); this.n = n / g; this.d = d / g; if (!Number.isSafeInteger(this.n) || !Number.isSafeInteger(this.d)) throw new Error("too big"); }
  static of(x) { if (x instanceof Q) return x; const s = String(x); if (/^-?\d+$/.test(s)) return new Q(+s); const m = /^(-?)(\d*)\.(\d+)$/.exec(s); if (m) { const d = 10 ** m[3].length; return new Q((m[1] ? -1 : 1) * (+(m[2] || 0) * d + +m[3]), d); } throw new Error("not a number: " + s); }
  add(b) { b = Q.of(b); return new Q(this.n * b.d + b.n * this.d, this.d * b.d); }
  sub(b) { b = Q.of(b); return new Q(this.n * b.d - b.n * this.d, this.d * b.d); }
  mul(b) { b = Q.of(b); return new Q(this.n * b.n, this.d * b.d); }
  div(b) { b = Q.of(b); if (b.n === 0) throw new Error("division by zero"); return new Q(this.n * b.d, this.d * b.n); }
  pow(k) { if (!(k instanceof Q) || k.d !== 1 || Math.abs(k.n) > 12) throw new Error("power"); let r = new Q(1); for (let i = 0; i < Math.abs(k.n); i++) r = r.mul(this); return k.n < 0 ? new Q(1).div(r) : r; }
  neg() { return new Q(-this.n, this.d); }
  eq(b) { b = Q.of(b); return this.n === b.n && this.d === b.d; }
  isInt() { return this.d === 1; }
  toNumber() { return this.n / this.d; }
  /** 3/4 · −5 · 1 1/2 (mixed) · 0.75 (decimal) */
  toString(style = "auto") {
    if (this.d === 1) return fmtInt(this.n);
    if (style === "decimal" || (style === "auto" && isDecimalDen(this.d) && this.d <= 1000)) return dec(this);
    if (style === "mixed" && Math.abs(this.n) > this.d) { const w = Math.trunc(this.n / this.d), r = Math.abs(this.n % this.d); return `${fmtInt(w)} ${r}/${this.d}`; }
    return `${fmtInt(this.n)}/${this.d}`;
  }
}
const fmtInt = (n) => (n < 0 ? "−" : "") + Math.abs(n).toString();
const isDecimalDen = (d) => { while (d % 2 === 0) d /= 2; while (d % 5 === 0) d /= 5; return d === 1; };
const dec = (q) => { let d = q.d, k = 0; while (10 ** k % d !== 0) k++; const v = (q.n * (10 ** k / d)); const s = Math.abs(v).toString().padStart(k + 1, "0"); return (v < 0 ? "−" : "") + s.slice(0, s.length - k) + (k ? "." + s.slice(s.length - k) : ""); };

// ---- reading what is written: 3 × (4 + 2)² − 1 1/2 ÷ ¾, ٣+٤, 2x+3=11, 15% of 80 ---------------------------------------------------
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const VULGAR = { "½": "1/2", "⅓": "1/3", "⅔": "2/3", "¼": "1/4", "¾": "3/4", "⅕": "1/5", "⅖": "2/5", "⅗": "3/5", "⅘": "4/5", "⅙": "1/6", "⅚": "5/6", "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8" };
export function normalize(s) {
  return String(s || "")
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/٫/g, ".").replace(/٬/g, "")
    .replace(/(\d)\s*([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, (m, a, f) => `${a} ${VULGAR[f]}`).replace(/[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (f) => VULGAR[f])
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUP[c]).join(""))
    .replace(/[×✕·∙]/g, "*").replace(/:/g, "÷").replace(/[−–—]/g, "-").replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/\bX\b/g, "x").replace(/س/g, "x").replace(/\s+/g, " ").trim();
}

// tokens → a tree. Mixed numbers ("1 1/2") and implicit multiplication ("2x", "3(x+1)", "(x+1)(x-1)") are understood.
function tokens(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    // "3/4" written together is ONE number (a fraction), so 3/4 ÷ 1/2 is (3/4) ÷ (1/2) as every child reads it
    const f = /^(\d+)\/(\d+)(?![\d.])/.exec(s.slice(i));
    if (f && +f[2] !== 0) { out.push({ t: "frac", n: +f[1], d: +f[2] }); i += f[0].length; continue; }
    const m = /^(\d+(?:\.\d+)?)/.exec(s.slice(i));
    if (m) { out.push({ t: "num", v: m[1] }); i += m[1].length; continue; }
    if (c === "÷") { out.push({ t: "/" }); i++; continue; }
    if (/[a-z]/.test(c)) { out.push({ t: "var", v: c }); i++; continue; }
    if ("+-*/^()%=".includes(c)) { out.push({ t: c }); i++; continue; }
    throw new Error("unexpected " + c);
  }
  // mixed numbers: a whole number then a fraction ("1 1/2") → one number
  const merged = [];
  for (let k = 0; k < out.length; k++) {
    const a = out[k], b = out[k + 1];
    if (a.t === "num" && /^\d+$/.test(a.v) && b && b.t === "frac" && b.n < b.d) { merged.push({ t: "mixed", w: +a.v, n: b.n, d: b.d }); k++; continue; }
    merged.push(a);
  }
  // implicit ×: 2x, 2(…), )(…), x(…), )x
  const res = [];
  for (let k = 0; k < merged.length; k++) {
    const a = merged[k], b = merged[k + 1]; res.push(a);
    if (b && (a.t === "num" || a.t === "var" || a.t === ")" || a.t === "mixed" || a.t === "frac") && (b.t === "var" || b.t === "(" || ((b.t === "num" || b.t === "frac") && a.t !== "num" && a.t !== "frac"))) res.push({ t: "*", implicit: true });
  }
  return res;
}
// recursive descent: sum := prod (± prod)* ; prod := unary ((*|/) unary)* ; unary := -unary | pow ; pow := atom (^ unary)? ; atom := num | var | (sum) | atom %
export function parse(str) {
  const tk = tokens(normalize(str)); let p = 0;
  const peek = () => tk[p], eat = (t) => { if (!tk[p] || tk[p].t !== t) throw new Error("expected " + t); return tk[p++]; };
  function sum() { let l = prod(); while (peek() && (peek().t === "+" || peek().t === "-")) { const op = tk[p++].t; l = { op, a: l, b: prod() }; } return l; }
  function prod() { let l = unary(); while (peek() && (peek().t === "*" || peek().t === "/")) { const op = tk[p++].t; l = { op, a: l, b: unary() }; } return l; }
  function unary() { if (peek() && peek().t === "-") { p++; return { op: "neg", a: unary() }; } if (peek() && peek().t === "+") { p++; return unary(); } return pow(); }
  function pow() { const b = atom(); if (peek() && peek().t === "^") { p++; return { op: "^", a: b, b: unary() }; } return b; }
  function atom() {
    const x = tk[p++]; if (!x) throw new Error("end");
    let node;
    if (x.t === "num") node = { num: Q.of(x.v), src: x.v };
    else if (x.t === "mixed") node = { num: new Q(x.w * x.d + x.n, x.d), mixed: true };
    else if (x.t === "frac") node = { num: new Q(x.n, x.d), frac: true };
    else if (x.t === "var") node = { v: x.v };
    else if (x.t === "(") { node = { op: "()", a: sum() }; eat(")"); }
    else throw new Error("unexpected " + x.t);
    while (peek() && peek().t === "%") { p++; node = { op: "%", a: node }; }
    return node;
  }
  const lhs = sum();
  if (peek() && peek().t === "=") { p++; const rhs = sum(); if (p !== tk.length) throw new Error("trailing"); return { eq: true, lhs, rhs }; }
  if (p !== tk.length) throw new Error("trailing");
  return lhs;
}
export function value(n, env = {}) {
  if (n.num) return n.num;
  if (n.v) { if (!(n.v in env)) throw new Error("unknown " + n.v); return env[n.v]; }
  switch (n.op) {
    case "()": return value(n.a, env);
    case "neg": return value(n.a, env).neg();
    case "%": return value(n.a, env).div(100);
    case "+": return value(n.a, env).add(value(n.b, env));
    case "-": return value(n.a, env).sub(value(n.b, env));
    case "*": return value(n.a, env).mul(value(n.b, env));
    case "/": return value(n.a, env).div(value(n.b, env));
    case "^": return value(n.a, env).pow(value(n.b, env));
  }
  throw new Error("bad node");
}
const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, neg: 3, "^": 4 };
/** A tree back to how a child writes it: 3 × (4 + 2) − 1/2. */
export function show(n, style) {
  if (n.num) return n.src && /\./.test(n.src) ? n.src : n.num.toString(n.mixed ? "mixed" : style);
  if (n.v) return n.v;
  if (n.op === "()") return "(" + show(n.a, style) + ")";
  if (n.op === "neg") return "−" + wrap(n.a, 3, style);
  if (n.op === "%") return show(n.a, style) + "%";
  const sym = { "+": " + ", "-": " − ", "*": " × ", "/": " ÷ ", "^": "^" }[n.op];
  return wrap(n.a, PREC[n.op], style) + sym + wrap(n.b, PREC[n.op] + (n.op === "-" || n.op === "/" || n.op === "^" ? 0.5 : 0), style, true);
}
// a negative number gets brackets after any sign ("3 + (−12)", "4 × (−3)") and before ^ — as it is written at school
const wrap = (n, prec, style, right) => { const s = show(n, style); return (n.op && n.op !== "()" && n.op !== "%" && PREC[n.op] < prec) || (n.num && n.num.n < 0 && (right || prec > 1)) ? "(" + s + ")" : s; };

// ---- arithmetic, one operation at a time, in the order of operations ------------------------------------------------------------
const RULE = { "()": "Brackets first", "^": "Powers next", "*": "Multiply (left to right)", "/": "Divide (left to right)", "+": "Add (left to right)", "-": "Subtract (left to right)", neg: "Negative", "%": "Percent means ÷ 100" };
// find the next node to reduce: innermost brackets first, then ^, then × ÷ left to right, then + − left to right
function nextRedex(n) {
  const all = []; let order = 0;
  (function walk(x, depth) {
    if (!x || x.num || x.v) return;
    if (x.a) walk(x.a, depth + (x.op === "()" ? 1 : 0)); if (x.b) walk(x.b, depth);
    const ready = (x.a && (x.a.num || (x.a.op === "()" && x.a.a.num))) && (!x.b || x.b.num || (x.b.op === "()" && x.b.a.num));
    if (x.op === "()" && x.a.num) all.push({ x, rank: 0, depth, order: order++ });
    else if (ready && x.op !== "()") all.push({ x, rank: x.op === "^" ? 1 : x.op === "%" || x.op === "neg" ? 1 : x.op === "*" || x.op === "/" ? 2 : 3, depth, order: order++ });
  })(n, 0);
  if (!all.length) return null;
  // the deepest brackets' content first, then by rank, then left to right
  all.sort((a, b) => b.depth - a.depth || a.rank - b.rank || a.order - b.order);
  return all[0].x;
}
const unwrap = (x) => (x && x.op === "()" ? x.a : x);
function reduceOnce(n, target) {
  if (n === target) {
    if (n.op === "()") return { node: n.a, rule: "Brackets: " + show(n.a) };
    const a = unwrap(n.a), b = unwrap(n.b);
    const v = value(n);
    let rule = RULE[n.op], visual;
    if ((n.op === "+" || n.op === "-") && (a.num && !a.num.isInt() || b && b.num && !b.num.isInt())) {
      const L = lcm(a.num.d, b.num.d);
      rule = `Same denominator ${L}: ${a.num.mul(L).toString()}/${L} ${n.op === "+" ? "+" : "−"} ${b.num.mul(L).toString()}/${L}`;
      visual = { kind: "fractions", parts: [a.num, b.num], op: n.op, result: v };
    } else if (n.op === "/" && b && b.num && !b.num.isInt()) rule = `Dividing by ${b.num.toString()} is multiplying by ${new Q(b.num.d, b.num.n).toString()}`;
    else if (n.op === "*" && a.num && b.num && a.num.isInt() && b.num.isInt() && Math.abs(a.num.n) <= 12 && Math.abs(b.num.n) <= 12 && a.num.n > 0 && b.num.n > 0) visual = { kind: "array", rows: a.num.n, cols: b.num.n };
    else if ((n.op === "+" || n.op === "-") && a.num && b.num && a.num.isInt() && b.num.isInt() && (a.num.n < 0 || v.n < 0 || b.num.n < 0) && Math.abs(a.num.n) <= 20 && Math.abs(v.n) <= 20) visual = { kind: "numberline", from: a.num.n, to: v.n };
    return { node: { num: v }, rule: `${rule}: ${show(n)} = ${v.toString()}`, visual };
  }
  for (const k of ["a", "b"]) if (n[k]) { const r = reduceOnce(n[k], target); if (r) { const child = r.node; return { node: n.op === "()" && child.num ? child : { ...n, [k]: child }, rule: r.rule, visual: r.visual }; } }
  return null;
}
const lcm = (a, b) => (a / gcd(a, b)) * b;
/** "3 + 4 × (2 − 5)" → { answer: Q, steps: [{ text, rule, visual? }] }, every step checked to keep the same value. */
export function arithmeticSteps(input, style = styleOf(input)) {
  let tree; try { tree = parse(input); } catch (e) { return null; }
  if (tree.eq || hasVar(tree)) return null;
  let truth; try { truth = value(tree); } catch (e) { return { error: e.message === "division by zero" ? "You can't divide by zero — the question has no answer." : "I can't read this as a sum." }; }
  const steps = [{ text: show(tree, style), rule: "The question" }];
  let cur = tree, guard = 0;
  while (!cur.num && guard++ < 60) {
    const red = nextRedex(cur); if (!red) break;
    const r = reduceOnce(cur, red); if (!r) break;
    cur = r.node;
    // the check: the expression after each step is still worth the same
    if (!value(cur).eq(truth)) throw new Error("internal check failed at: " + r.rule);
    const txt = show(cur, style);
    if (steps[steps.length - 1].text !== txt) steps.push({ text: txt, rule: r.rule, visual: r.visual });
  }
  if (!cur.num || !cur.num.eq(truth)) return null;
  return { kind: "arithmetic", answer: truth, display: truth.toString(style === "mixed" ? "mixed" : style), steps };
}
/** How the child wrote it decides how the answer is written: fractions stay fractions, mixed stay mixed, decimals decimals. */
export function styleOf(input) {
  const t = normalize(input);
  if (/\d \d+\/\d+/.test(t)) return "mixed";
  if (/\d\/\d/.test(t)) return "plain";
  if (/\d\.\d/.test(t)) return "decimal";
  return "auto";
}
function _unusedTail(truth, steps) {
  const last = steps[steps.length - 1];
  if (!truth.isInt()) { const simple = truth.toString("plain"); last.note = truth.d <= 1000 && isDecimalDen(truth.d) ? `= ${simple === truth.toString("decimal") ? simple : truth.toString("decimal")}` : Math.abs(truth.n) > truth.d ? `= ${truth.toString("mixed")}` : ""; }
}
const hasVar = (n) => !!(n && (n.v || hasVar(n.a) || hasVar(n.b) || (n.eq && (hasVar(n.lhs) || hasVar(n.rhs)))));

// ---- linear equations: a·x + b = c·x + d, solved like on the board ---------------------------------------------------------------
// a side → { a: coefficient of x, b: constant } — exact; null if it isn't linear (x², x in a denominator…)
function linear(n, x) {
  if (n.num) return { a: new Q(0), b: n.num };
  if (n.v) return n.v === x ? { a: new Q(1), b: new Q(0) } : null;
  const A = n.a && linear(n.a, x), B = n.b && linear(n.b, x);
  switch (n.op) {
    case "()": return A;
    case "neg": return A && { a: A.a.neg(), b: A.b.neg() };
    case "%": return A && { a: A.a.div(100), b: A.b.div(100) };
    case "+": return A && B && { a: A.a.add(B.a), b: A.b.add(B.b) };
    case "-": return A && B && { a: A.a.sub(B.a), b: A.b.sub(B.b) };
    case "*": if (!A || !B) return null; if (A.a.n && B.a.n) return null; return A.a.n ? { a: A.a.mul(B.b), b: A.b.mul(B.b) } : { a: B.a.mul(A.b), b: B.b.mul(A.b) };
    case "/": if (!A || !B || B.a.n || B.b.n === 0) return null; return { a: A.a.div(B.b), b: A.b.div(B.b) };
    case "^": return null;
  }
  return null;
}
const term = (a, b, x) => { const ax = a.n === 0 ? "" : a.eq(1) ? x : a.eq(-1) ? "−" + x : a.toString() + x; const bs = b.n === 0 ? "" : b.n < 0 ? (ax ? " − " : "−") + b.neg().toString() : (ax ? " + " : "") + b.toString(); return (ax + bs) || "0"; };
/** "3(x − 2) = x + 4" → { answer, steps } with a balance picture, the check substituted into both sides as the last step. */
export function equationSteps(input) {
  let t; try { t = parse(input); } catch (e) { return null; }
  if (!t.eq) return null;
  const vars = new Set(); (function w(n) { if (!n) return; if (n.v) vars.add(n.v); w(n.a); w(n.b); w(n.lhs); w(n.rhs); })(t);
  if (vars.size !== 1) return null;
  const x = [...vars][0];
  const L = linear(t.lhs, x), R = linear(t.rhs, x);
  if (!L || !R) return null;
  const steps = [{ text: `${show(t.lhs)} = ${show(t.rhs)}`, rule: "The equation" }];
  const simplified = `${term(L.a, L.b, x)} = ${term(R.a, R.b, x)}`;
  if (simplified.replace(/\s/g, "") !== steps[0].text.replace(/\s/g, "").replace(/×/g, "")) steps.push({ text: simplified, rule: "Open the brackets and tidy each side" });
  let a = L.a.sub(R.a), b = L.b, c = R.b;
  if (R.a.n) steps.push({ text: `${term(a, b, x)} = ${term(new Q(0), c, x)}`, rule: `Take ${term(R.a, new Q(0), x)} from both sides`, visual: { kind: "balance", left: term(a, b, x), right: c.toString() } });
  if (a.n === 0) return { kind: "equation", answer: null, steps: [...steps, { text: b.eq(c) ? "true for every " + x : "no solution", rule: b.eq(c) ? `The ${x} cancels and both sides are equal — any ${x} works` : `The ${x} cancels and ${b.toString()} ≠ ${c.toString()} — there is no ${x}` }] };
  if (b.n) { c = c.sub(b); steps.push({ text: `${term(a, new Q(0), x)} = ${c.toString()}`, rule: `${b.n > 0 ? "Take " + b.toString() + " from" : "Add " + b.neg().toString() + " to"} both sides`, visual: { kind: "balance", left: term(a, new Q(0), x), right: c.toString() } }); }
  const ans = c.div(a);
  if (!a.eq(1)) steps.push({ text: `${x} = ${ans.toString()}`, rule: `Divide both sides by ${a.toString()}`, visual: { kind: "balance", left: x, right: ans.toString() } });
  // the check — exact, both sides
  const env = { [x]: ans }, lv = value(t.lhs, env), rv = value(t.rhs, env);
  if (!lv.eq(rv)) throw new Error("internal check failed");
  // the value goes in brackets only where it must: a negative number or a fraction, or right after a number (2x → 2 × 5)
  const put = (side) => show(side).replace(new RegExp("(\\d)?(?<![a-z])" + x + "(?![a-z])", "g"), (m, d) => {
    const v = ans.toString(), br = ans.n < 0 || !ans.isInt() ? "(" + v + ")" : v; return d ? d + " × " + br : br; });
  steps.push({ text: `${put(t.lhs)} = ${lv.toString()}  ·  ${put(t.rhs)} = ${rv.toString()} ✓`, rule: `Check: put ${x} = ${ans.toString()} back — both sides are ${lv.toString()}`, check: true });
  return { kind: "equation", answer: ans, variable: x, display: `${x} = ${ans.toString(styleOf(input) === "auto" ? "auto" : styleOf(input))}`, steps };
}

// ---- percentages in words (English, Arabic, French, Spanish…) ----------------------------------------------------------------------
export function percentSteps(input) {
  const s = normalize(input).toLowerCase();
  const N = "(-?\\d+(?:\\.\\d+)?)";
  let m = new RegExp(N + "\\s*%\\s*(?:of|من|de|du|des|von|di|dari)\\s*" + N).exec(s);
  if (m) { const p = Q.of(m[1]), w = Q.of(m[2]), r = p.div(100).mul(w); return { kind: "percent", answer: r, display: r.toString(), steps: [{ text: `${m[1]}% × ${m[2]}`, rule: "“% of” means multiply" }, { text: `${m[1]}/100 × ${m[2]}`, rule: "Percent means out of 100", visual: { kind: "bar", part: p.toNumber(), whole: 100 } }, { text: r.toString(), rule: `${m[1]} hundredths of ${m[2]} = ${r.toString()}` }] }; }
  m = new RegExp(N + "\\s*(?:is what (?:percent|%)\\s*of|كام في المية من|ما نسبة)\\s*" + N).exec(s);
  if (m) { const a = Q.of(m[1]), w = Q.of(m[2]); if (w.n === 0) return null; const r = a.div(w).mul(100); return { kind: "percent", answer: r, display: r.toString() + "%", unit: "%", steps: [{ text: `${m[1]} ÷ ${m[2]}`, rule: "Part ÷ whole" }, { text: `${a.div(w).toString()} × 100`, rule: "× 100 to make it a percent" }, { text: r.toString() + "%", rule: "The percent", visual: { kind: "bar", part: r.toNumber(), whole: 100 } }] }; }
  m = new RegExp("(increase|decrease|زود|زيد|نقص|اخصم)\\s*" + N + "\\s*(?:by|ب)\\s*" + N + "\\s*%").exec(s);
  if (m) { const up = /increase|زود|زيد/.test(m[1]), w = Q.of(m[2]), p = Q.of(m[3]), ch = w.mul(p).div(100), r = up ? w.add(ch) : w.sub(ch); return { kind: "percent", answer: r, display: r.toString(), steps: [{ text: `${m[3]}% of ${m[2]} = ${ch.toString()}`, rule: "First find the change" }, { text: `${m[2]} ${up ? "+" : "−"} ${ch.toString()} = ${r.toString()}`, rule: up ? "Then add it" : "Then take it away" }] }; }
  return null;
}

/** One problem as written → its exact solution with steps, or null if it isn't a kind this engine can prove. */
export function solve(problem) {
  const raw = String(problem || "").replace(/^\s*(?:\(?[a-h]\)|\(?\d{1,2}[).](?=\s)|q\d+\s*[.:)]?|[٠-٩]{1,2}\s*[-–)])\s*/i, "").trim();
  const ask = raw.replace(/^(?:solve|find x|simplify|calculate|compute|work out|evaluate|احسب|حل|اوجد|أوجد|بسط|résous|calcule|resuelve|calcula|berechne|löse|risolvi|calcola|çöz|hesapla|hitung|selesaikan)\s*[:،,]?\s*/i, "").replace(/[=?]\s*$/, "").replace(/\s*[=?]\s*\?\s*$/, "").trim();
  try { return percentSteps(ask) || equationSteps(ask) || arithmeticSteps(ask); } catch (e) { return null; }
}
