/* ---- answer quality guards ------------------------------------------------------------
   Small models fail in a few recognisable ways. Each is caught here, in plain
   code, instead of hoping the model behaves:

   · loops      — "(Correction: … Let's redo step 6.)" five times, or
                  "60.66666666…" for a page. detectLoop() spots it while the
                  answer streams; the engine is stopped and the repeat cut off.
   · raw LaTeX  — "$\frac{1}{x} = \frac{1}{30}$" on a phone screen.
                  mathToText() turns it into 1/x = 1/30.
   · questions that need exact working (a word problem, a program) — sent to
                  the verified routes (verify.js), where the phone runs code.   */

/**
 * Is the text going round in circles? → { loop, cut } where cut is where the
 * repetition starts (keep text.slice(0, cut)).
 */
export function detectLoop(text) {
  const s = String(text || "");
  if (s.length < 120) return { loop: false };
  // 1. one character (or two) repeated on and on: 666666… / ------ / ……
  // (letters/digits only: long runs of - = _ are normal in tables and code)
  const run = /([A-Za-z0-9\u0600-\u06FF]{1,2})\1{39,}/.exec(s.slice(-1500));
  if (run) {
    const at = s.length - Math.min(s.length, 1500) + run.index;
    return { loop: true, cut: at + run[1].length * 6, why: "run" };
  }
  // 2. the same line again and again (a model "correcting" itself forever).
  //    Table rows and code are skipped: similar rows there are normal.
  const lines = s.split("\n");
  const seen = new Map();
  let pos = 0, inCode = false;
  for (const line of lines) {
    const tl = line.trim();
    if (/^```/.test(tl)) inCode = !inCode;
    const k = tl.replace(/\s+/g, " ");
    if (!inCode && k.length >= 24 && !k.startsWith("|")) {
      const at = seen.get(k) || [];
      at.push(pos);
      if (at.length === 3) return { loop: true, cut: at[1], why: "line" };   // keep the first, cut from the second
      seen.set(k, at);
    }
    pos += line.length + 1;
  }
  // 3. a stretch (20–300 chars) repeated 3 times back to back at the end
  const tail = s.slice(-1800);
  for (let L = 20; L <= 300 && L * 3 <= tail.length; L++) {
    const a = tail.slice(-L), b = tail.slice(-2 * L, -L), c = tail.slice(-3 * L, -2 * L);
    if (a === b && b === c && /\S/.test(a)) return { loop: true, cut: s.length - 2 * L, why: "tail" };
  }
  return { loop: false };
}
/** Cut a looping answer cleanly (at the last full sentence/line before the repeat). */
export function trimLoop(text, cut) {
  let t = String(text || "").slice(0, cut);
  const nl = t.lastIndexOf("\n");
  if (nl > t.length - 400 && nl > 0) t = t.slice(0, nl);
  return t.replace(/\s+$/, "");
}

// ---- LaTeX → readable text ------------------------------------------------------------
const SYM = {
  "\\times": "×", "\\cdot": "·", "\\div": "÷", "\\pm": "±", "\\neq": "≠", "\\ne": "≠", "\\leq": "≤", "\\le": "≤", "\\geq": "≥", "\\ge": "≥",
  "\\approx": "≈", "\\infty": "∞", "\\to": "→", "\\rightarrow": "→", "\\Rightarrow": "⇒", "\\implies": "⇒", "\\leftarrow": "←",
  "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ", "\\Delta": "Δ", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ", "\\pi": "π",
  "\\sigma": "σ", "\\Sigma": "Σ", "\\omega": "ω", "\\Omega": "Ω", "\\phi": "φ", "\\rho": "ρ", "\\tau": "τ", "\\epsilon": "ε",
  "\\sum": "Σ", "\\prod": "Π", "\\int": "∫", "\\partial": "∂", "\\circ": "°", "\\degree": "°", "\\%": "%", "\\,": " ", "\\;": " ", "\\quad": "  ", "\\qquad": "   ",
  "\\ldots": "…", "\\cdots": "…", "\\dots": "…", "\\in": "∈", "\\cup": "∪", "\\cap": "∩", "\\therefore": "∴", "\\angle": "∠", "\\sqrt": "√",
};
const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", "+": "⁺", "n": "ⁿ", "(": "⁽", ")": "⁾", "x": "ˣ" };
const SUB = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉" };

/** Read one {…} group starting at s[i] === "{" → [content, indexAfter]. */
function group(s, i) {
  if (s[i] !== "{") { const m = /^\\[a-zA-Z]+|^./.exec(s.slice(i)); return [m ? m[0] : "", i + (m ? m[0].length : 0)]; }
  let d = 0, j = i;
  for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}") { d--; if (d === 0) break; } }
  return [s.slice(i + 1, j), j + 1];
}
const wrap = (x) => (/^[\w.√]+$/.test(x) ? x : "(" + x + ")");

function tex(s) {
  let out = "", i = 0;
  while (i < s.length) {
    if (s.startsWith("\\frac", i) || s.startsWith("\\dfrac", i) || s.startsWith("\\tfrac", i)) {
      i += s.startsWith("\\frac", i) ? 5 : 6;
      const [a, i1] = group(s, i); const [b, i2] = group(s, i1);
      out += wrap(tex(a)) + "/" + wrap(tex(b)); i = i2; continue;
    }
    if (s.startsWith("\\sqrt", i)) { i += 5; const [a, i1] = group(s, i); const v = tex(a); out += "√" + (/^(\d+(\.\d+)?|[a-zA-Z])$/.test(v) ? v : "(" + v + ")"); i = i1; continue; }
    if (/^\\(text|mathrm|mathbf|textbf|operatorname|mbox|mathit)\b/.test(s.slice(i))) {
      i = s.indexOf("{", i); const [a, i1] = group(s, i); out += tex(a); i = i1; continue;
    }
    if (s.startsWith("\\left", i)) { i += 5; continue; }
    if (s.startsWith("\\right", i)) { i += 6; continue; }
    if (s[i] === "^" || s[i] === "_") {
      const map = s[i] === "^" ? SUP : SUB; const [a, i1] = group(s, i + 1); const v = tex(a);
      out += [...v].every((c) => map[c]) ? [...v].map((c) => map[c]).join("") : (s[i] === "^" ? "^" + wrap(v) : "_" + v);
      i = i1; continue;
    }
    const cmd = /^\\[a-zA-Z]+|^\\[,;%]/.exec(s.slice(i));
    if (cmd) { out += SYM[cmd[0]] != null ? SYM[cmd[0]] : cmd[0].slice(1); i += cmd[0].length; continue; }
    if (s[i] === "{" || s[i] === "}") { i++; continue; }
    out += s[i++];
  }
  return out.replace(/[ \t]{2,}/g, " ");
}

/** "$\frac{d}{30}$ hours" → "d/30 hours"; also \( \), \[ \] and $$ $$. Code spans are left alone. */
export function mathToText(text) {
  const s = String(text || "");
  if (!/[$\\]/.test(s)) return s;
  const parts = s.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  return parts.map((p, k) => {
    if (k % 2) return p;
    return p
      .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => "\n" + tex(m.trim()) + "\n")
      .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => "\n" + tex(m.trim()) + "\n")
      .replace(/\\\(([\s\S]+?)\\\)/g, (_, m) => tex(m))
      .replace(/(^|[^\\\w])\$(?!\s)([^$\n]{1,300}?)\$(?!\d)/g, (_, pre, m) => pre + tex(m))
      .replace(/\\(frac|dfrac|times|cdot|sqrt|approx|neq|leq|geq|text)\b(\{[^}]*\})*/g, (m) => tex(m));   // stray commands outside $…$
  }).join("");
}
