/* ---- v6.27 Homework Coach — everything except the maths engine (coach-math.js) and the screens (coach-ui.jsx) -------------------
   - a homework page (typed, or read from a photo) → its separate problems ("1.", "2)", "a)", "Q3", "١-"…);
   - each problem → a lesson: the maths engine's exact steps (with a "your turn" at the answer), or — for anything it can't
     prove — the phone's model writes the steps and, if it is maths, Python checks the final answer (verify.js);
   - practice "like this one", made BY CODE (new numbers in the same shape; every answer proven by the engine);
   - what the child finds hard: right / wrong per topic (store "attune:coach:v1").
   Pure. Tests: tests/unit/v727coach.test.mjs.                                                                                  */
import { solve, styleOf, normalize } from "./coach-math.js";

/** A page of homework → [{ n, text }] — numbered items split; lines that continue an item stay with it. */
export function splitProblems(text) {
  const lines = String(text || "").replace(/\r/g, "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const out = [];
  const NUM = /^(?:\(?([a-h])\)|\(?(\d{1,2})[).](?=\s)|q\s?(\d{1,2})\s*[.:)]?|([٠-٩]{1,2})\s*[-–)]|(?:exercise|question|ex\.?|سؤال|تمرين)\s*(\d{1,2})\s*[.:)]?)\s*/i;
  for (const l of lines) {
    const m = NUM.exec(l);
    if (m || !out.length) out.push({ n: m ? (m[1] || m[2] || m[3] || m[4] || m[5]) : String(out.length + 1), text: m ? l.slice(m[0].length) : l });
    else if (/^[=+\-−×÷*/(\d]/.test(l) && /[=+\-−×÷*/]$/.test(out[out.length - 1].text)) out[out.length - 1].text += " " + l;   // a sum broken over two lines
    else if (!/[=?]|\d/.test(l) && out[out.length - 1].text.length < 200) out[out.length - 1].text += " " + l;              // words that continue the question
    else out.push({ n: String(out.length + 1), text: l });
  }
  // a page with no numbering but several sums on one line separated by ";" or two spaces
  if (out.length === 1 && /;|\s{3,}/.test(out[0].text)) return out[0].text.split(/;|\s{3,}/).map((t, i) => ({ n: String(i + 1), text: t.trim() })).filter((x) => x.text);
  // page headers are not problems: "Homework — page 12", "Name: …", "Date …", "Class 5B", "واجب", "الاسم"
  const HEADER = /^(homework|home work|worksheet|page|p\.|name|date|class|grade|teacher|school|subject|unit|lesson|chapter|devoirs|tarea|hausaufgabe|compiti|ödev|pr\b|واجب|الواجب|صفحة|صفحه|الاسم|التاريخ|الفصل|الصف|المادة|درس)\b/i;
  return out.filter((x) => x.text.length > 0 && !(HEADER.test(x.text) && !/[=+×÷*?]/.test(x.text.replace(/^[^:]*:/, "")))).map((x, i) => ({ ...x, n: /^\d+$/.test(x.n) ? x.n : x.n })).slice(0, 30);
}

/** The topic of a solved problem (for "what is hard" and for practice). */
export function topicOf(problem, sol) {
  const t = normalize(problem);
  if (!sol) return "other";
  if (sol.kind === "equation") return "equations";
  if (sol.kind === "percent" || /%/.test(t)) return "percent";
  if (/\d\/\d|\d \d+\/\d+/.test(t)) return "fractions";
  if (/\d\.\d/.test(t)) return "decimals";
  if (/(^|[^\d)])-\s*\d|\(-/.test(t.replace(/^\s*-/, "(-"))) return "negatives";
  if (/[()^]/.test(t) || /[+\-].*[*/]|[*/].*[+\-]/.test(t)) return "order of operations";
  if (/\*/.test(t)) return "multiplication"; if (/\//.test(t) || /÷/.test(t)) return "division";
  return "addition and subtraction";
}
export const TOPIC_NAMES = { equations: "Equations", percent: "Percentages", fractions: "Fractions", decimals: "Decimals", negatives: "Negative numbers", "order of operations": "Order of operations", multiplication: "Multiplication", division: "Division", "addition and subtraction": "Adding and subtracting", other: "Other" };

/** A problem → the lesson the player shows: the engine's steps, the last one a "your turn" (when teaching first). */
export function lessonFor(problem, { teach = true, lang } = {}) {
  const sol = solve(problem);
  if (!sol) return null;
  if (sol.error) return { kind: "error", topic: "other", lesson: { title: problem, lang, steps: [{ text: "?", rule: sol.error }] }, sol };
  const steps = sol.steps.map((s) => ({ ...s }));
  // teaching first: before the answer step is shown, the child tries it (the check step of an equation stays as it is)
  if (teach && steps.length > 1) {
    const k = steps.findIndex((s, i) => i > 0 && (sol.kind === "equation" ? /^[a-z] = /.test(s.text) : i === steps.length - 1));
    if (k > 0) steps[k] = { ...steps[k], ask: { q: sol.kind === "equation" ? `${sol.variable} = ?` : steps[k - 1].text + " = ?", answer: sol.kind === "equation" ? sol.answer.toString() : sol.display, hint: steps[k].rule } };
  }
  return { kind: sol.kind, topic: topicOf(problem, sol), answer: sol.display, lesson: { title: problem, lang, steps }, sol, checked: true };
}

// ---- practice like this one: the same shape, new numbers — kept only when the engine proves a tidy answer ----------------------
const rnd = (lo, hi, r = Math.random) => lo + Math.floor(r() * (hi - lo + 1));
export function practiceLike(problem, count = 3, r = Math.random) {
  const src = normalize(problem), sol = solve(problem);
  if (!sol || sol.error) return [];
  const style = styleOf(problem), out = [], seen = new Set([src]);
  for (let tries = 0; out.length < count && tries < 400; tries++) {
    let p;
    if (sol.kind === "equation") {
      const x = rnd(-9, 12, r), a = rnd(2, 9, r), c = r() < 0.5 ? 0 : rnd(1, 9, r), b = rnd(-15, 15, r);
      if (a === c || b === 0) continue;
      const d = a * x + b - c * x, v = sol.variable;
      const L = `${a}${v} ${b < 0 ? "-" : "+"} ${Math.abs(b)}`, R = c ? `${c}${v} ${d < 0 ? "-" : "+"} ${Math.abs(d)}` : `${d}`;
      p = `${L} = ${R}`;
    } else {
      // every number replaced by one of the same kind and size
      p = src.replace(/(\d+)\/(\d+)|\d+\.\d+|\d+/g, (m, n, d) => {
        if (d) { const D = rnd(2, Math.max(4, Math.min(12, +d + 3)), r); return `${rnd(1, D - 1, r)}/${D}`; }
        if (/\./.test(m)) return (rnd(1, 99, r) / 10).toFixed(1);
        const v = +m; return String(v <= 10 ? rnd(2, 10, r) : v <= 100 ? rnd(11, 99, r) : rnd(100, 999, r));
      });
    }
    if (seen.has(p)) continue;
    const s = solve(p); if (!s || s.error || !s.answer) continue;
    // tidy answers only: whole numbers, or a small denominator for fraction work
    if (!s.answer.isInt() && !(style !== "auto" && s.answer.d <= 12)) continue;
    if (Math.abs(s.answer.toNumber()) > 10000) continue;
    seen.add(p); out.push({ text: p.replace(/\*/g, "×").replace(/-/g, "−"), answer: s.display, sol: s });
  }
  return out;
}

// ---- the phone's model, for what the engine can't prove (science, language, word problems, harder maths) -----------------------------
export function coachModelPrompt(problem, { lang = "English", level = "" } = {}) {
  return `You are a patient teacher${level ? " for a student in " + level : ""}. Teach how to solve this, step by step, in ${lang}. Explain each step simply; do not skip steps; no long paragraphs.
Problem: «${String(problem).slice(0, 800)}»
Reply with ONLY one JSON object: {"steps": [{"text": "the working of this step (short)", "rule": "what we did and why, one sentence"}], "answer": "the final answer, short"}`;
}
export function readCoachModel(out) {
  const m = /\{[\s\S]*\}/.exec(String(out || "")); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (e) { return null; }
  const steps = Array.isArray(j.steps) ? j.steps.filter((s) => s && (s.text || s.rule)).slice(0, 12).map((s) => ({ text: String(s.text || "").slice(0, 160), rule: String(s.rule || "").slice(0, 300) })) : [];
  if (!steps.length || !j.answer) return null;
  return { steps, answer: String(j.answer).slice(0, 120) };
}

// ---- the child's progress ----------------------------------------------------------------------------------------------------------
export const COACH_KEY = "attune:coach:v1";
export const loadCoach = (store = typeof localStorage !== "undefined" ? localStorage : null) => { try { const j = JSON.parse((store && store.getItem(COACH_KEY)) || "null"); return j && j.topics ? j : { topics: {}, history: [], settings: { teach: true, level: "" } }; } catch (e) { return { topics: {}, history: [], settings: { teach: true, level: "" } }; } };
export const saveCoach = (c, store = typeof localStorage !== "undefined" ? localStorage : null) => { try { store && store.setItem(COACH_KEY, JSON.stringify(c)); } catch (e) {} return c; };
export function record(c, topic, right, text, now = Date.now()) {
  const t = c.topics[topic] || { right: 0, wrong: 0 };
  return { ...c, topics: { ...c.topics, [topic]: { right: t.right + (right ? 1 : 0), wrong: t.wrong + (right ? 0 : 1) } }, history: [{ text: String(text).slice(0, 120), topic, right, at: now }, ...c.history].slice(0, 200) };
}
/** Topics to practise: the most mistakes first (at least 2 tries and under 70 % right). */
export const weakTopics = (c) => Object.entries(c.topics || {}).filter(([, v]) => v.right + v.wrong >= 2 && v.right / (v.right + v.wrong) < 0.7).sort((a, b) => b[1].wrong - a[1].wrong).map(([k]) => k);
