/* ---- v6.38 (Ali: "I am not sure if the answers are correct") — every calculation in an answer is re-done by code.
   An answer line like "t_d = ln(2)/0.34657 h⁻¹ = 0.69315/0.34657 ≈ 1.980 h" is split at = / ≈; each part that is only numbers
   (units after a number are dropped) is evaluated, and two neighbours that disagree are reported:
   "0.69315/0.34657 = 2.000, not 1.980". Variables (X₂, μ…) are never guessed — those parts are skipped. Also: the same
   paragraph / "Final Answer" block written twice by a small model is removed (dedupeAnswer). Pure; tests/unit/v740mathcheck. */
import { mathToText } from "./quality.js";

const SUPN = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-", "⁺": "+" };
const SUBN = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };

/** A safe little calculator: numbers, + − × · ÷ / ^ ( ), ln log exp sqrt √, e, π. → number | null (anything else). */
export function evalExpr(src) {
  let s = String(src || "").replace(/[−–]/g, "-").replace(/[×·∙*]/g, "*").replace(/÷/g, "/").replace(/,(?=\d{3}\b)/g, "").replace(/π/g, "(pi)")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+/g, (m) => "^(" + [...m].map((c) => SUPN[c]).join("") + ")").replace(/√\s*\(/g, "sqrt(").replace(/√\s*([\d.]+)/g, "sqrt($1)").trim();
  if (!s || /[^\d.+\-*/^()\sa-z]/i.test(s)) return null;
  let i = 0;
  const ws = () => { while (s[i] === " ") i++; };
  const num = () => { ws(); const m = /^(\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?/i.exec(s.slice(i)); if (!m) return null; i += m[0].length; return parseFloat(m[0]); };
  const FN = { ln: Math.log, log: Math.log10, exp: Math.exp, sqrt: Math.sqrt };
  function atom() {
    ws();
    if (s[i] === "(") { i++; const v = expr(); ws(); if (s[i] !== ")") throw 0; i++; return v; }
    if (s[i] === "-") { i++; return -factor(); }
    const w = /^(ln|log|exp|sqrt|pi|e)(?![a-z])/i.exec(s.slice(i));
    if (w) { i += w[1].length; const k = w[1].toLowerCase(); if (k === "pi") return Math.PI; if (k === "e") return Math.E; ws(); const a = s[i] === "(" ? atom() : factor(); return FN[k](a); }
    const n = num(); if (n == null) throw 0; return n;
  }
  function factor() { let b = atom(); ws(); if (s[i] === "^") { i++; return Math.pow(b, factor()); } return b; }
  function term() { let v = factor(); for (;;) { ws(); if (s[i] === "*") { i++; v *= factor(); } else if (s[i] === "/") { i++; v /= factor(); } else if (s[i] === "(" ) { v *= factor(); } else return v; } }
  function expr() { let v = term(); for (;;) { ws(); if (s[i] === "+") { i++; v += term(); } else if (s[i] === "-") { i++; v -= term(); } else return v; } }
  try { const v = expr(); ws(); return i === s.length && Number.isFinite(v) ? v : null; } catch (e) { return null; }
}

/** One side of an equation → its number, or null when it has variables. Units right after a number are dropped. */
export function sideValue(side) {
  let t = String(side || "").replace(/[*_`]/g, " ").replace(/[₀-₉]/g, (c) => SUBN[c]).trim();
  // a unit after a number: "10.5 g/L", "4 h", "0.34657 h⁻¹", "25 %", "30 °C", "5 g L⁻¹", "4.0 h^-1"
  t = t.replace(/(\d)\s*(?:%|°\s*[CF]?|[a-zA-Zµμ]{1,5}(?:\s*\/\s*[a-zA-Zµμ]{1,5})?(?:\s*[a-zA-Zµμ]{1,3})?(?:\s*(?:⁻¹|⁻²|\^\s*\(?-?\d\)?))?)(?![a-z(])/g, (m, d) => (/^(\d)\s*(ln|log|exp|sqrt|e)\b/.test(m) ? m : d));
  t = t.replace(/\s+/g, " ").trim();
  if (!t || !/\d/.test(t)) return null;
  if (/[a-z]/i.test(t.replace(/\b(ln|log|exp|sqrt|pi|e)\b/gi, ""))) return null;
  return evalExpr(t);
}
const decimals = (s) => { const m = /(\d+)\.(\d+)\s*\D*$/.exec(String(s).trim()); return m ? m[2].length : 0; };

/** → { checked: n, wrong: [{ line, expr, value, written }] } over the whole answer (LaTeX is turned into text first). */
export function checkMath(answer) {
  const text = mathToText(String(answer || "")).replace(/\*\*/g, "");
  let checked = 0; const wrong = []; const last = new Map();   // a variable's latest value: "t_d = …" on one line, "t_d ≈ 1.98" later
  for (const raw of text.split("\n")) {
    const line = raw.replace(/^[\s>*\-•\d.)]*\s/, (m) => (/^\s*\d+\.\d/.test(raw) ? "" : m)).trim();
    if (!/[=≈]/.test(line) || line.length > 300) continue;
    const parts = line.split(/\s*(?:=|≈|≅)\s*/);
    const vals = parts.map((p) => ({ p, v: sideValue(p) }));
    const name = vals.length >= 2 && vals[0].v == null && /^[\p{L}][\p{L}\p{N}_/()\s]{0,14}$/u.test(vals[0].p.trim()) ? vals[0].p.replace(/\s+/g, "").toLowerCase() : null;
    if (name) {
      const firstNum = vals.find((x) => x.v != null), lastNum = [...vals].reverse().find((x) => x.v != null);
      const prev = last.get(name);
      if (firstNum && prev) vals.splice(vals.indexOf(firstNum), 0, prev);
      if (lastNum) last.set(name, lastNum);
    }
    for (let k = 0; k + 1 < vals.length; k++) {
      const a = vals[k], b = vals[k + 1];
      if (a.v == null || b.v == null) continue;
      checked++;
      // v8.6 (persona 6: "150000 + 21000 = 171500" passed — 0.5 % of 171,000 is 855): sums of whole numbers (+ − ×) must be exact;
      // the 0.5 % room is only for rounded results (division, powers, roots, π, decimals)
      const exact = /^[\d\s,+\-−×*()]+$/.test(a.p.trim()) && Number.isInteger(a.v) && !/[.]/.test(b.p);
      const d = decimals(b.p), tol = exact ? 0.5 : Math.max(Math.abs(a.v) * 0.005, d ? 0.6 * Math.pow(10, -d) : 0.5);
      if (Math.abs(a.v - b.v) > tol && !(Math.abs(b.v) > 0 && Math.abs(a.v / b.v - 100) < 0.5)) {   // (a fraction written as a % is fine)
        const show = (v) => { const r = Math.abs(v) >= 100 ? v.toFixed(1) : Math.abs(v) >= 1 ? v.toFixed(Math.max(2, d)) : v.toPrecision(4); return String(parseFloat(r)); };
        wrong.push({ line: raw.trim(), expr: a.p.trim(), value: show(a.v), written: b.p.trim() });
      }
    }
  }
  return { checked, wrong };
}

/** The same paragraph twice (a small model "summarising" what it just wrote) → once; several "Final Answer" blocks → the first. */
export function dedupeAnswer(text) {
  const paras = String(text || "").split(/\n\s*\n/);
  const key = (p) => p.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const words = (p) => new Set(key(p).split(" ").filter((w) => w.length > 2));
  const kept = []; let finals = 0;
  for (const p of paras) {
    const k = key(p); if (!k) continue;
    const isFinal = /^\W*(final answers?|answers?|الإجابة النهائية|الاجابة النهائية|الإجابة)\b/i.test(p.trim());
    if (isFinal && ++finals > 1) continue;
    const w = words(p);
    const dup = kept.some((q) => { if (key(q) === k) return true; const v = words(q); if (w.size < 6 || v.size < 6) return false; let n = 0; for (const x of w) if (v.has(x)) n++; return n / Math.min(w.size, v.size) > 0.85; });
    if (!dup) kept.push(p);
  }
  return kept.join("\n\n");
}
