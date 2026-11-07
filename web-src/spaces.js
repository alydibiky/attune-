/* ---- Spaces: Assistants, Projects, Artifacts and Themes (v5.14) --------------------------
   Pure logic and storage, no React — unit-tested in tests/unit/spaces.test.mjs.

   - Assistants: a saved "who you are talking to" — a name, an emoji and standing
     instructions (like Gemini's Gems). A chat started with one carries its id, and
     its instructions go into every answer's system prompt.
   - Projects: a folder for related chats with shared instructions and knowledge
     (pasted notes, attached text files). Only the passages that match the question
     go to the model — a phone model's window is small, so the whole folder can't.
   - Artifacts: a web page, document or program pulled out of an answer into its
     own full-screen view, saved with versions, shared or saved as a file.
   - Themes: the app's colours come from Tailwind's CSS variables (--color-teal-300 …),
     so a theme swaps the variables on <html> — every screen follows, nothing is rewritten.
   Everything lives in localStorage under attune:* keys, so backups include it.         */
import { neutral } from "./industry.js";
import { brainOf, brainBlock } from "./projectbrain.js";

export const ASSISTANTS_KEY = "attune:assistants:v1";
export const PROJECTS_KEY = "attune:projects:v1";
export const ARTIFACTS_KEY = "attune:artifacts:v1";
export const THEME_KEY = "attune:theme:v1";

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
// v8.7 (Ali: "Assistants has 5 next to it although they are 4"): every save tells the sidebar, so its counts are never stale
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); try { window.dispatchEvent(new CustomEvent("attune-spaces")); } catch (e) {} return true; } catch (e) { return false; } };
export const newSpaceId = (p) => (p || "s") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---- Chat helpers ------------------------------------------------------------------ */
// A message that leans on the conversation: short, or pointing back at "it /
// this / that / the model / the price". Searched on its own it finds nothing
// useful, so it is rewritten first (v5.14).
export function looksLikeFollowUp(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).length;
  if (words <= 4) return true;
  return words <= 14 && /\b(it|its|it's|this|that|these|those|they|them|he|she|the (model|price|same|one|brand|company|version)|which one|and (the|what|how)|what about|how about)\b|(^|\s)(ده|دي|دا|دول|هو|هي|بتاعه|بتاعها|الموديل ده|طيب|وكمان|وايه|و إيه)(\s|[?؟]|$)/i.test(t);
}

/* ---- Assistants ----------------------------------------------------------------------- */
export const BUILTIN_ASSISTANTS = [
  { id: "a-crane", emoji: "🏗️", name: "Crane expert", desc: "Mobile & tower cranes: lifts, load charts, hydraulics, safety",
    instructions: "You are a senior mobile-crane engineer and lift planner (Liebherr, Demag, Grove, Terex, Tadano, XCMG, Sany, Zoomlion). Explain mechanical, hydraulic and electrical systems step by step, very clearly, and give every technical term in English and Egyptian Arabic, e.g. outrigger (رجل التثبيت). For lifts: state assumptions (radius, boom length, counterweight, outrigger base), use the load chart logic, and always add the safety margin and what to check on site. Never invent a capacity figure — say when a chart is needed. Answer in the language of the question (an English question gets English, with the Arabic term in brackets). Lead with the direct answer, then the steps; keep it tight enough to finish.",
    starters: ["Explain how a crane's hydraulic telescoping works", "What should I check before a 40 t lift at 12 m radius?", "Why does a crane need counterweight? Explain simply"] },
  { id: "a-turkish", emoji: "🇹🇷", name: "Turkish tutor", desc: "From beginner to native-like, with corrections",
    instructions: "You are a patient Turkish teacher for an Egyptian Arabic speaker who understands Turkish but struggles to build complex sentences. Speak mostly Turkish at the learner's level, explain grammar in simple English with Egyptian Arabic notes. When the learner writes Turkish, first correct every mistake — especially verb tenses — showing wrong → right and a one-line reason, then continue the conversation. End each reply with one short practice question.",
    starters: ["Let's practise: ask me about my day in Turkish", "Explain -miş past tense simply", "Correct this: Dün markete gidiyorum"] },
  { id: "a-web", emoji: "🌐", name: "Website builder", desc: "Complete, good-looking sites and tools from one prompt",
    instructions: "You build complete, professional single-file websites and web apps (HTML + CSS + JS in one file, no internet resources). Always produce the whole file in one ```html block, finished and polished: real content, mobile-first layout, a consistent colour palette, dark mode, working interactions. Never leave placeholders or TODOs.",
    starters: ["A landing page for my bakery with the menu, prices and a contact form", "A to-do app with categories and due dates", "A loan calculator with a monthly payment table"] },
  { id: "a-accountant", emoji: "📊", name: "Accountant (Egypt)", desc: "Invoices, VAT, zakat, statements — worked out exactly",
    instructions: "You are a careful accountant who knows Egyptian practice (14% VAT, withholding tax, e-invoicing). Work every number step by step, one line per step, and put the total in bold at the end. State the rule or rate you apply. If a figure is missing, ask for it or state your assumption. Use every quantity given (units × days × rate). Never add a tax or fee that was not asked for and does not exist — in Egypt: VAT 14%, table tax on some goods, withholding tax (1% / 3% / 5%) deducted by some company payers; mention one only when it applies.",
    starters: ["Invoice: 3 laptops × 18,500 EGP + 14% VAT", "Explain withholding tax on a service contract", "Make a simple monthly cash-flow table"] },
  { id: "a-writer", emoji: "✍️", name: "Writer", desc: "Emails, reports and posts in English or Arabic",
    instructions: "You write clear, professional text: emails, reports, proposals, posts. Match the language asked (English, Modern Standard Arabic or Egyptian Arabic). Give the finished text first, ready to copy, then at most one line of notes.",
    starters: ["A polite email asking a client to pay an overdue invoice", "A LinkedIn post about our new branch in Alexandria", "Turn these notes into a short report: "] },
];

export function loadAssistants() {
  const mine = read(ASSISTANTS_KEY, []);
  return [...(Array.isArray(mine) ? mine : []), ...neutral(BUILTIN_ASSISTANTS, "assistants")];   // v6.50: the Crane expert only for Fleet users
}
export function saveCustomAssistants(list) {
  return write(ASSISTANTS_KEY, (list || []).filter((a) => a && !a.builtin && !BUILTIN_ASSISTANTS.some((b) => b.id === a.id)).slice(0, 50));
}
export function upsertAssistant(a) {
  const mine = read(ASSISTANTS_KEY, []).filter((x) => x.id !== a.id);
  const clean = { id: a.id || newSpaceId("a"), emoji: (a.emoji || "✨").slice(0, 4), name: String(a.name || "").trim().slice(0, 40) || "My assistant",
    desc: String(a.desc || "").trim().slice(0, 90), instructions: String(a.instructions || "").trim().slice(0, 4000),
    starters: (a.starters || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 4) };
  saveCustomAssistants([clean, ...mine]);
  return clean;
}
export function deleteAssistant(id) { saveCustomAssistants(read(ASSISTANTS_KEY, []).filter((x) => x.id !== id)); }
export const isBuiltinAssistant = (id) => BUILTIN_ASSISTANTS.some((b) => b.id === id);

/* ---- Projects ------------------------------------------------------------------------- */
export function loadProjects() { const v = read(PROJECTS_KEY, []); return Array.isArray(v) ? v : []; }
export function saveProjectList(list) { return write(PROJECTS_KEY, (list || []).slice(0, 40)); }
export function upsertProject(p) {
  const list = loadProjects().filter((x) => x.id !== p.id);
  const clean = { id: p.id || newSpaceId("p"), emoji: (p.emoji || "📁").slice(0, 4), name: String(p.name || "").trim().slice(0, 50) || "Project",
    instructions: String(p.instructions || "").trim().slice(0, 4000),
    knowledge: (p.knowledge || []).map((k) => ({ id: k.id || newSpaceId("k"), name: String(k.name || "Note").slice(0, 80), text: String(k.text || "").slice(0, 200000) })).filter((k) => k.text.trim()),
    // v9.1 design D (Ali, 4 Nov): a due date, who answers (an assistant) and its repeats — questions it asks again and again
    due: /^\d{4}-\d{2}-\d{2}$/.test(String(p.due || "")) ? p.due : "",
    assistantId: p.assistantId || "",
    repeats: (p.repeats || []).map((r) => ({ id: r.id || newSpaceId("r"), text: String(r.text || "").trim().slice(0, 600), every: EVERY.includes(r.every) ? r.every : "", last: +r.last || 0 })).filter((r) => r.text).slice(0, 20),
    // v9.2 (Ali picked 6 = A + B "in a smart and organised way"): the work's tasks, on a board To do · Doing · Done
    tasks: (p.tasks || []).map((t) => ({ id: t.id || newSpaceId("t"), text: String(t.text || "").trim().slice(0, 200), col: TASK_COLS.includes(t.col) ? t.col : "todo", ts: +t.ts || Date.now() })).filter((t) => t.text).slice(0, 200),
    created: p.created || Date.now(), updated: Date.now() };
  if (!saveProjectList([clean, ...list])) return null;       // storage full
  return clean;
}
export function deleteProject(id) { saveProjectList(loadProjects().filter((x) => x.id !== id)); }

/* ---- v9.2 a project's tasks (Ali, 4 Nov: "make the app like Trello in the tasks I give it" — the board where things move through
   stages) and the starters that make a project in one tap. Pure; tests: tests/unit/v922projects.test.mjs. ------------------------ */
export const TASK_COLS = ["todo", "doing", "done"];
export const taskProgress = (p) => { const t = (p && p.tasks) || []; return { done: t.filter((x) => x.col === "done").length, of: t.length, left: t.filter((x) => x.col !== "done").length }; };
export const addTasks = (p, text) => ({ ...p, tasks: [...(p.tasks || []), ...String(text || "").split(/\s*(?:\n|,|،|;)\s*/).map((x) => x.trim()).filter(Boolean).map((x) => ({ id: newSpaceId("t"), text: x.slice(0, 200), col: "todo", ts: Date.now() }))] });
export const moveTask = (p, id, dir) => ({ ...p, tasks: (p.tasks || []).map((t) => { if (t.id !== id) return t; const i = TASK_COLS.indexOf(t.col) + dir; return i >= 0 && i < TASK_COLS.length ? { ...t, col: TASK_COLS[i] } : t; }) });
export const setTaskCol = (p, id, col) => ({ ...p, tasks: (p.tasks || []).map((t) => (t.id === id && TASK_COLS.includes(col) ? { ...t, col } : t)) });
export const removeTask = (p, id) => ({ ...p, tasks: (p.tasks || []).filter((t) => t.id !== id) });
/** "add buy tiles to the renovation" / «ضيف شراء السيراميك لمشروع الشقة» → { project, text } when a project with that name exists. */
export function parseProjectTask(text, projects = loadProjects()) {
  const t = String(text || "").trim();
  const m = /^\s*(?:please\s+)?(?:add|put)\s+(.+?)\s+(?:to|on|in|into)\s+(?:my\s+|the\s+)?(.+?)(?:\s+(?:project|tasks?|board|list))?\s*[.!]?$/i.exec(t)
    || /^\s*(?:ضيف|حط)\s+(.+?)\s+(?:ل|في|على)\s*(?:مشروع\s+)?(.+?)\s*$/.exec(t);
  if (!m) return null;
  const want = m[2].toLowerCase().replace(/^(ال|the\s+)/, "").trim();
  if (/^(my\s+)?(to-?do|todo|tasks?)(\s+list)?$|^(المهام|التودو)$/i.test(want)) return null;   // the plain to-do list is Home's
  const f = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/^(ال)/, "");
  const pr = (projects || []).find((p) => { const n = f(p.name); return n === f(want) || n.includes(f(want)) || (f(want).length >= 4 && f(want).split(/\s+/).every((w) => n.includes(w))); });
  return pr ? { project: pr, text: m[1].trim() } : null;
}
export const STARTERS = [
  { id: "study", emoji: "📚", name: "Study plan", sub: "Exam dates, chapters, a weekly plan", instructions: "Help me study for this: plan up to the exam date, explain simply, and quiz me.", tasks: ["List the chapters", "Set the exam date", "Make a weekly plan", "First practice test"] },
  { id: "trip", emoji: "✈️", name: "A trip", sub: "Bookings, documents, the budget", instructions: "Help me plan this trip: bookings, documents, a packing list and the budget.", tasks: ["Book the flight", "Book the hotel", "Visa and documents", "Packing list"] },
  { id: "job", emoji: "💼", name: "Job hunt", sub: "CV, applications, interviews", instructions: "Help me find a job: tailor my CV, write cover letters and prepare me for interviews.", tasks: ["Update my CV", "List 10 companies", "Apply to 3 jobs", "Practise an interview"] },
  { id: "home", emoji: "🏠", name: "Flat renovation", sub: "Quotes, materials, workers", instructions: "Help me run this renovation: compare quotes, keep the budget and the order of the work.", tasks: ["Get 3 quotes", "Choose the tiles", "Electrician", "Painting"] },
];

/* v9.1 design D: a repeat is due when it has a rhythm and its time since the last run has passed (a day / 7 days / a calendar month).
   Never run → due now. "" (only when I tap) → never due. */
export const EVERY = ["", "day", "week", "month"];
export function repeatDue(r, now = Date.now()) {
  if (!r || !r.every) return false;
  if (!r.last) return true;
  const d = new Date(r.last), day = 864e5;
  const dayStart = (t) => { const x = new Date(t); x.setHours(0, 0, 0, 0); return x.getTime(); };
  if (r.every === "day") return dayStart(now) - dayStart(r.last) >= day;
  if (r.every === "week") return dayStart(now) - dayStart(r.last) >= 7 * day;
  if (r.every === "month") { const n = new Date(now); return (n.getFullYear() - d.getFullYear()) * 12 + n.getMonth() - d.getMonth() >= 1 && n.getDate() >= Math.min(d.getDate(), 28); }
  return false;
}
export const dueRepeats = (p, now = Date.now()) => ((p && p.repeats) || []).filter((r) => repeatDue(r, now));
/** Mark a repeat as run now → the saved project (or null). */
export function markRepeatRun(projectId, repeatId, now = Date.now()) {
  const p = loadProjects().find((x) => x.id === projectId); if (!p) return null;
  return upsertProject({ ...p, repeats: (p.repeats || []).map((r) => (r.id === repeatId ? { ...r, last: now } : r)) });
}
/** Days from today to the due date (negative = late), or null. */
export function daysToDue(due, now = Date.now()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(due || "")); if (!m) return null;
  const a = new Date(+m[1], +m[2] - 1, +m[3]), b = new Date(now); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}
/** What Attune saved for this project (artifacts made in its chats). */
export const artifactsFor = (projectId, list = loadArtifacts()) => (projectId ? list.filter((a) => a.projectId === projectId) : []);

// Words that carry meaning (English and Arabic), for matching a question to passages.
const STOP = new Set("the a an and or of to in on for with is are was were be it this that what how why when which who me my i you your we our do does did can could should would will from at by as about into than then there here".split(" "));
export function words(t) {
  return String(t || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي")
    .split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1 && !STOP.has(w));
}
/** Split a document into ~chunk-sized passages on paragraph/line breaks. */
export function chunks(text, size = 900) {
  const parts = String(text || "").replace(/\r/g, "").split(/\n{2,}|(?<=\.)\s+(?=[A-Z؀-ۿ])/);
  const out = []; let cur = "";
  for (const p of parts) {
    if ((cur + "\n" + p).length > size && cur) { out.push(cur.trim()); cur = ""; }
    if (p.length > size) { for (let i = 0; i < p.length; i += size) out.push(p.slice(i, i + size).trim()); continue; }
    cur += (cur ? "\n\n" : "") + p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}
/** The passages of a project's knowledge that best match the question, within a budget. */
export function knowledgeFor(project, question, budget = 3500) {
  const docs = (project && project.knowledge) || [];
  if (!docs.length) return [];
  const all = [];
  for (const d of docs) chunks(d.text).forEach((c, i) => all.push({ doc: d.name, i, text: c }));
  const total = all.reduce((n, c) => n + c.text.length, 0);
  if (total <= budget) return all;                            // small: everything fits
  const q = new Set(words(question));
  const scored = all.map((c) => {
    const w = words(c.text); let hit = 0;
    for (const x of w) if (q.has(x)) hit++;
    return { ...c, score: hit / Math.sqrt(w.length + 5) };
  }).sort((a, b) => b.score - a.score);
  const out = []; let used = 0;
  for (const c of scored) {
    if (c.score <= 0 && out.length) break;
    if (used + c.text.length > budget) continue;
    out.push(c); used += c.text.length;
  }
  return out.sort((a, b) => (a.doc === b.doc ? a.i - b.i : 0));
}

/* ---- v6.40 (upgrade C1): assistants that learn from your corrections. A 👎 + the right answer (or a note "always …") in a chat
   with an assistant becomes a rule that assistant keeps and follows from then on (any assistant, built-in ones too). An
   assistant can be saved as one file with its rules and opened on another phone. */
export const RULES_KEY = "attune:assistants:rules:v1";
export function rulesFor(id) { const all = read(RULES_KEY, {}); return (all && Array.isArray(all[id]) ? all[id] : []); }
export function setRules(id, list) { const all = read(RULES_KEY, {}) || {}; all[id] = (list || []).slice(-40); write(RULES_KEY, all); return all[id]; }
/** A correction → the rule text: the note when there is one ("always answer in Egyptian Arabic"), else the corrected answer. */
export function ruleFromCorrection({ input = "", corrected = "", note = "" } = {}) {
  const n = String(note || "").trim(), c = String(corrected || "").replace(/\s+/g, " ").trim(), q = String(input || "").replace(/\s+/g, " ").trim();
  if (n) return n.slice(0, 240);
  if (!c) return "";
  return `When asked something like “${q.slice(0, 90)}”, the right answer is: ${c.slice(0, 220)}`;
}
export function learnRule(id, entry) {
  const r = ruleFromCorrection(entry); if (!id || !r) return null;
  const list = rulesFor(id).filter((x) => x.text !== r);
  return setRules(id, [...list, { text: r, at: Date.now() }]);
}
/** One file with the assistant and what it learned → JSON text; and back. */
export function exportAssistant(a) {
  const { id, builtin, ...rest } = a || {};
  return JSON.stringify({ kind: "attune-assistant", v: 1, assistant: rest, rules: rulesFor(id).map((x) => x.text) }, null, 2);
}
export function importAssistant(text) {
  let j; try { j = JSON.parse(String(text || "")); } catch (e) { throw new Error("That is not an assistant file"); }
  if (!j || j.kind !== "attune-assistant" || !j.assistant || !j.assistant.name) throw new Error("That is not an assistant file");
  const a = upsertAssistant({ ...j.assistant, id: undefined });
  if (a && Array.isArray(j.rules)) setRules(a.id, j.rules.filter((x) => typeof x === "string" && x.trim()).map((t) => ({ text: t.slice(0, 300), at: Date.now() })));
  return a;
}

/** The extra system-prompt block for a chat that belongs to an assistant and/or project. */
export function spaceBlock({ assistant, project, question, chats = null }) {
  const parts = [];
  if (assistant && assistant.instructions) parts.push(`YOUR ROLE — you are "${assistant.name}":\n${assistant.instructions}`);
  if (assistant) { const rl = rulesFor(assistant.id); if (rl.length) parts.push("WHAT THIS USER TAUGHT YOU (from their corrections — always follow these):\n" + rl.map((r) => "- " + r.text).join("\n")); }
  if (project) {
    if (project.instructions) parts.push(`PROJECT "${project.name}" — standing instructions:\n${project.instructions}`);
    // v6.38 (C4): what earlier chats in this project decided, left open and dated
    if (chats) { const bb = brainBlock(brainOf(project, chats)); if (bb) parts.push(bb); }
    const k = knowledgeFor(project, question);
    if (k.length) parts.push(`PROJECT KNOWLEDGE (the user's own files and notes — use them when relevant and say which file you used, e.g. "from ${k[0].doc}"; if they don't cover the question, say so and answer normally):\n` +
      k.map((c) => `[${c.doc}]\n${c.text}`).join("\n\n"));
  }
  return parts.join("\n\n");
}

/* ---- Artifacts ------------------------------------------------------------------------ */
const FENCE_RE = /```([\w+-]*)[^\n]*\n([\s\S]*?)\n```/g;
function titleOf(content, kind) {
  if (kind === "html") {
    const t = content.match(/<title>([^<]{1,80})<\/title>/i) || content.match(/<h1[^>]*>([^<]{1,80})<\/h1>/i);
    return t ? t[1].trim() : "Web page";
  }
  const h = content.match(/^#{1,3}\s+(.{1,80})$/m) || content.match(/^\*\*(.{3,80})\*\*/m);
  return h ? h[1].replace(/[*#]/g, "").trim() : (kind === "code" ? "Program" : "Document");
}
/**
 * What in an answer is worth opening as an artifact:
 *   a complete web page (```html with <html>/<body>/<script>/<style>) → html
 *   a program of 15+ lines → code
 *   a long structured document (≥ 900 chars with headings, a table or many list items) → doc
 */
export function detectArtifact(text) {
  const s = String(text || "");
  let m; FENCE_RE.lastIndex = 0;
  let best = null;
  while ((m = FENCE_RE.exec(s))) {
    const lang = (m[1] || "").toLowerCase(), body = m[2];
    if ((lang === "html" || /^\s*<!doctype html|<html[\s>]/i.test(body)) && /<(body|script|style|div|main|section)[\s>]/i.test(body))
      return { kind: "html", lang: "html", title: titleOf(body, "html"), content: body };
    if (body.split("\n").length >= 15 && (!best || body.length > best.content.length)) best = { kind: "code", lang: lang || "text", title: titleOf(s, "code"), content: body };
  }
  if (best) return best;
  // v5.41: a page whose closing ``` never came (the answer was cut) still gets its Preview
  const open = s.match(/```html[^\n]*\n([\s\S]+)$/i);
  if (open && /<\/(body|html)>|<\/script>|<\/style>/i.test(open[1]) && /<(body|div|main|section)[\s>]/i.test(open[1]))
    return { kind: "html", lang: "html", title: titleOf(open[1], "html"), content: open[1].replace(/\n```\s*$/, "") };
  const plain = s.replace(FENCE_RE, "");
  const structure = (plain.match(/^#{1,3}\s/mg) || []).length * 2 + (/\n\|.+\|\n\|[\s:|-]+\|/.test(plain) ? 3 : 0) + Math.min(4, (plain.match(/^\s*(?:[-*]|\d+\.)\s/mg) || []).length / 3);
  if (plain.length >= 900 && structure >= 3) return { kind: "doc", lang: "markdown", title: titleOf(plain, "doc"), content: s.trim() };
  return null;
}
export function loadArtifacts() { const v = read(ARTIFACTS_KEY, []); return Array.isArray(v) ? v : []; }
/** Save an artifact; the same id (or the same title and kind) adds a new version. → saved item or null */
export function saveArtifact(a) {
  const list = loadArtifacts();
  const same = list.find((x) => (a.id && x.id === a.id) || (!a.id && x.title === a.title && x.kind === a.kind));
  let item;
  if (same) {
    const versions = same.versions || [];
    if (versions.length && versions[versions.length - 1].content === a.content) return same;   // unchanged
    item = { ...same, updated: Date.now(), versions: [...versions, { content: a.content, ts: Date.now() }].slice(-10) };
  } else {
    item = { id: newSpaceId("art"), kind: a.kind, lang: a.lang, title: String(a.title || "Untitled").slice(0, 80), created: Date.now(), updated: Date.now(),
      ...(a.projectId ? { projectId: a.projectId } : {}),
      versions: [{ content: a.content, ts: Date.now() }] };
  }
  const next = [item, ...list.filter((x) => x.id !== item.id)].slice(0, 60);
  // Full storage: drop old versions, then the oldest artifacts, rather than fail.
  if (write(ARTIFACTS_KEY, next)) return item;
  const slim = next.map((x) => ({ ...x, versions: x.versions.slice(-1) }));
  for (let n = slim.length; n > 0; n = Math.floor(n * 0.7)) if (write(ARTIFACTS_KEY, slim.slice(0, n))) return item;
  return null;
}
export function deleteArtifact(id) { write(ARTIFACTS_KEY, loadArtifacts().filter((x) => x.id !== id)); }
export const latest = (a) => (a && a.versions && a.versions.length ? a.versions[a.versions.length - 1].content : "");
export function fileNameFor(a) {
  const base = String(a.title || "artifact").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40) || "artifact";
  const ext = a.kind === "html" ? "html" : a.kind === "doc" ? "md" : ({ python: "py", javascript: "js", js: "js", py: "py", css: "css", json: "json", sql: "sql", kotlin: "kt", java: "java" }[a.lang] || "txt");
  return base + "." + ext;
}

/* ---- Themes --------------------------------------------------------------------------- */
// Tailwind 4's default palette (oklch), only the families a theme needs.
export const PALETTES = {"burgundy":{"50":"oklch(97% 0.012 5)","100":"oklch(94% 0.025 5)","200":"oklch(88.5% 0.05 5)","300":"oklch(80% 0.09 5)","400":"oklch(69% 0.13 5)","500":"oklch(58% 0.15 5)","600":"oklch(49% 0.14 5)","700":"oklch(41.5% 0.125 5)","800":"oklch(35% 0.105 5)","900":"oklch(30% 0.085 5)","950":"oklch(21% 0.06 5)"},"teal":{"50":"oklch(98.4% 0.014 180.72)","100":"oklch(95.3% 0.051 180.801)","200":"oklch(91% 0.096 180.426)","300":"oklch(85.5% 0.138 181.071)","400":"oklch(77.7% 0.152 181.912)","500":"oklch(70.4% 0.14 182.503)","600":"oklch(60% 0.118 184.704)","700":"oklch(51.1% 0.096 186.391)","800":"oklch(43.7% 0.078 188.216)","900":"oklch(38.6% 0.063 188.416)","950":"oklch(27.7% 0.046 192.524)"},"violet":{"50":"oklch(96.9% 0.016 293.756)","100":"oklch(94.3% 0.029 294.588)","200":"oklch(89.4% 0.057 293.283)","300":"oklch(81.1% 0.111 293.571)","400":"oklch(70.2% 0.183 293.541)","500":"oklch(60.6% 0.25 292.717)","600":"oklch(54.1% 0.281 293.009)","700":"oklch(49.1% 0.27 292.581)","800":"oklch(43.2% 0.232 292.759)","900":"oklch(38% 0.189 293.745)","950":"oklch(28.3% 0.141 291.089)"},"blue":{"50":"oklch(97% 0.014 254.604)","100":"oklch(93.2% 0.032 255.585)","200":"oklch(88.2% 0.059 254.128)","300":"oklch(80.9% 0.105 251.813)","400":"oklch(70.7% 0.165 254.624)","500":"oklch(62.3% 0.214 259.815)","600":"oklch(54.6% 0.245 262.881)","700":"oklch(48.8% 0.243 264.376)","800":"oklch(42.4% 0.199 265.638)","900":"oklch(37.9% 0.146 265.522)","950":"oklch(28.2% 0.091 267.935)"},"amber":{"50":"oklch(98.7% 0.022 95.277)","100":"oklch(96.2% 0.059 95.617)","200":"oklch(92.4% 0.12 95.746)","300":"oklch(87.9% 0.169 91.605)","400":"oklch(82.8% 0.189 84.429)","500":"oklch(76.9% 0.188 70.08)","600":"oklch(66.6% 0.179 58.318)","700":"oklch(55.5% 0.163 48.998)","800":"oklch(47.3% 0.137 46.201)","900":"oklch(41.4% 0.112 45.904)","950":"oklch(27.9% 0.077 45.635)"},"rose":{"50":"oklch(96.9% 0.015 12.422)","100":"oklch(94.1% 0.03 12.58)","200":"oklch(89.2% 0.058 10.001)","300":"oklch(81% 0.117 11.638)","400":"oklch(71.2% 0.194 13.428)","500":"oklch(64.5% 0.246 16.439)","600":"oklch(58.6% 0.253 17.585)","700":"oklch(51.4% 0.222 16.935)","800":"oklch(45.5% 0.188 13.697)","900":"oklch(41% 0.159 10.272)","950":"oklch(27.1% 0.105 12.094)"},"emerald":{"50":"oklch(97.9% 0.021 166.113)","100":"oklch(95% 0.052 163.051)","200":"oklch(90.5% 0.093 164.15)","300":"oklch(84.5% 0.143 164.978)","400":"oklch(76.5% 0.177 163.223)","500":"oklch(69.6% 0.17 162.48)","600":"oklch(59.6% 0.145 163.225)","700":"oklch(50.8% 0.118 165.612)","800":"oklch(43.2% 0.095 166.913)","900":"oklch(37.8% 0.077 168.94)","950":"oklch(26.2% 0.051 172.552)"},"indigo":{"50":"oklch(96.2% 0.018 272.314)","100":"oklch(93% 0.034 272.788)","200":"oklch(87% 0.065 274.039)","300":"oklch(78.5% 0.115 274.713)","400":"oklch(67.3% 0.182 276.935)","500":"oklch(58.5% 0.233 277.117)","600":"oklch(51.1% 0.262 276.966)","700":"oklch(45.7% 0.24 277.023)","800":"oklch(39.8% 0.195 277.366)","900":"oklch(35.9% 0.144 278.697)","950":"oklch(25.7% 0.09 281.288)"},"orange":{"50":"oklch(98% 0.016 73.684)","100":"oklch(95.4% 0.038 75.164)","200":"oklch(90.1% 0.076 70.697)","300":"oklch(83.7% 0.128 66.29)","400":"oklch(75% 0.183 55.934)","500":"oklch(70.5% 0.213 47.604)","600":"oklch(64.6% 0.222 41.116)","700":"oklch(55.3% 0.195 38.402)","800":"oklch(47% 0.157 37.304)","900":"oklch(40.8% 0.123 38.172)","950":"oklch(26.6% 0.079 36.259)"},"sky":{"50":"oklch(97.7% 0.013 236.62)","100":"oklch(95.1% 0.026 236.824)","200":"oklch(90.1% 0.058 230.902)","300":"oklch(82.8% 0.111 230.318)","400":"oklch(74.6% 0.16 232.661)","500":"oklch(68.5% 0.169 237.323)","600":"oklch(58.8% 0.158 241.966)","700":"oklch(50% 0.134 242.749)","800":"oklch(44.3% 0.11 240.79)","900":"oklch(39.1% 0.09 240.876)","950":"oklch(29.3% 0.066 243.157)"},"slate":{"50":"oklch(98.4% 0.003 247.858)","100":"oklch(96.8% 0.007 247.896)","200":"oklch(92.9% 0.013 255.508)","300":"oklch(86.9% 0.022 252.894)","400":"oklch(70.4% 0.04 256.788)","500":"oklch(55.4% 0.046 257.417)","600":"oklch(44.6% 0.043 257.281)","700":"oklch(37.2% 0.044 257.287)","800":"oklch(27.9% 0.041 260.031)","900":"oklch(20.8% 0.042 265.755)","950":"oklch(12.9% 0.042 264.695)"},"zinc":{"50":"oklch(98.5% 0 none)","100":"oklch(96.7% 0.001 286.375)","200":"oklch(92% 0.004 286.32)","300":"oklch(87.1% 0.006 286.286)","400":"oklch(70.5% 0.015 286.067)","500":"oklch(55.2% 0.016 285.938)","600":"oklch(44.2% 0.017 285.786)","700":"oklch(37% 0.013 285.805)","800":"oklch(27.4% 0.006 286.033)","900":"oklch(21% 0.006 285.885)","950":"oklch(14.1% 0.005 285.823)"},"stone":{"50":"oklch(98.5% 0.001 106.423)","100":"oklch(97% 0.001 106.424)","200":"oklch(92.3% 0.003 48.717)","300":"oklch(86.9% 0.005 56.366)","400":"oklch(70.9% 0.01 56.259)","500":"oklch(55.3% 0.013 58.071)","600":"oklch(44.4% 0.011 73.639)","700":"oklch(37.4% 0.01 67.558)","800":"oklch(26.8% 0.007 34.298)","900":"oklch(21.6% 0.006 56.043)","950":"oklch(14.7% 0.004 49.25)"},"red":{"50":"oklch(97.1% 0.013 17.38)","100":"oklch(93.6% 0.032 17.717)","200":"oklch(88.5% 0.062 18.334)","300":"oklch(80.8% 0.114 19.571)","400":"oklch(70.4% 0.191 22.216)","500":"oklch(63.7% 0.237 25.331)","600":"oklch(57.7% 0.245 27.325)","700":"oklch(50.5% 0.213 27.518)","800":"oklch(44.4% 0.177 26.899)","900":"oklch(39.6% 0.141 25.723)","950":"oklch(25.8% 0.092 26.042)"}};
const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
// v6.27: design A "Calm" (Ali picked it, 13 Oct 2026) — the default look of the whole app: a soft green-grey instead of
// blue-grey, and a deeper, quieter teal. Light mode: grey ground #F4F5F3, white cards, lines #E4E8E5 (themeVars below).
PALETTES.calm = { "50": "#F4F7F5", "100": "#EAEFEC", "200": "#DDE3E0", "300": "#C2CBC7", "400": "#9BA8A3", "500": "#6B7772",
  "600": "#4A5852", "700": "#343E3A", "800": "#26302D", "900": "#171D1B", "950": "#101413" };   // v7.0 Gemini's Quiet Atelier stone
PALETTES.calmteal = { "50": "#E2F1ED", "100": "#C5E8E0", "200": "#9ADACB", "300": "#6FCDB9", "400": "#4FC2AF", "500": "#26A592",
  "600": "#0F7B6C", "700": "#0B6358", "800": "#0A4F47", "900": "#08403A", "950": "#052926" };
export const ACCENTS = [
  ["burgundy", "Burgundy"], ["teal", "Teal"], ["violet", "Violet"], ["blue", "Blue"], ["indigo", "Indigo"], ["emerald", "Green"], ["amber", "Amber"], ["orange", "Orange"], ["rose", "Rose"],
];
export const BACKGROUNDS = [
  ["auto", "Follow my phone"],   // v8.7 (Ali picked V-B): light by day, dark when the phone is dark — the default
  ["slate", "Midnight"], ["black", "Black (OLED)"], ["zinc", "Graphite"], ["stone", "Warm"], ["light", "Light"],
];
// v6.43 (Ali picked design A on the design canvas): light, green — the new default. A theme still at the old default (teal on
// dark slate) moves to A once; a look chosen in Settings → Theme afterwards is kept.
export function loadTheme() {
  let t = read(THEME_KEY, null);
  if (!t || ((t.accent || "teal") === "teal" && (t.bg || "slate") === "slate" && !t.a43)) { t = { accent: "emerald", bg: "auto", a43: 1, v87: 1 }; write(THEME_KEY, t); }
  // v8.7 (Ali picked V-B): the old default (green on light) now follows the phone, once; a look chosen after this is kept
  if (t.a43 && !t.v87 && t.accent === "emerald" && t.bg === "light") { t = { ...t, bg: "auto", v87: 1 }; write(THEME_KEY, t); }
  // v9.5 (Ali, 5 Nov: "I don't like the green in the interface of the whole app — make it burgundy"): the green default becomes
  // burgundy, once; a colour chosen in Settings → Theme after this is kept
  if (!t.v95 && (t.accent || "emerald") === "emerald") { t = { ...t, accent: "burgundy", v95: 1 }; write(THEME_KEY, t); }
  return { accent: t.accent || "burgundy", bg: t.bg || "auto" };
}
export function saveTheme(t) { write(THEME_KEY, { accent: t.accent || "burgundy", bg: t.bg || "auto", a43: 1, v87: 1, v95: 1 }); }

/* v9.5 (Ali, 5 Nov: "not all background colours work"): the redesigned screens (.calm) had their own fixed colours, so Settings →
   Theme reached only the older screens. Now every choice sets the .calm tokens too: the accent (light / dark tone, its soft tint,
   the text on it) and the ground (Midnight, Black, Graphite, Warm, Light). Green for money in / red for money out stay as they are. */
export const CALM_ACCENT = {
  burgundy: { l: ["#7A1F3D", "#F7E8ED"], d: ["#E58AA2", "#3A1E27"] },
  emerald: { l: ["#157A52", "#E3F4EC"], d: ["#4FC2AF", "#173530"] },
  teal: { l: ["#0F766E", "#DDF3F0"], d: ["#5EC9BD", "#163633"] },
  violet: { l: ["#6D28D9", "#EFE7FD"], d: ["#B79BF5", "#2A2140"] },
  blue: { l: ["#1D4ED8", "#E3ECFD"], d: ["#8DB4F7", "#1B2740"] },
  indigo: { l: ["#4338CA", "#E7E6FB"], d: ["#A5A1F5", "#22213F"] },
  amber: { l: ["#9A5B05", "#FBF0DC"], d: ["#E8B04B", "#3A2C12"] },
  orange: { l: ["#A8380A", "#FCE8DD"], d: ["#F59E6B", "#3B2216"] },
  rose: { l: ["#BE123C", "#FCE4EA"], d: ["#F38BA3", "#3D1C25"] },
};
const CALM_GROUND = {
  slate: { bg: "#101413", surf: "#171D1B", surf2: "#1E2623", ink: "#EAEFEC", mut: "#9BA8A3", ln: "#26302D" },
  black: { bg: "#000000", surf: "#0E1110", surf2: "#161A19", ink: "#ECEFEE", mut: "#9AA3A0", ln: "#222826" },
  zinc: { bg: "#131416", surf: "#1B1C1F", surf2: "#232428", ink: "#ECECEE", mut: "#A1A1AA", ln: "#2E3035" },
  stone: { bg: "#171412", surf: "#201C19", surf2: "#29241F", ink: "#EEE9E4", mut: "#A8A29E", ln: "#352F29" },
  light: { bg: "#F4F7F5", surf: "#FFFFFF", surf2: "#EEF3F0", ink: "#16201C", mut: "#4A5852", ln: "#E2EAE5" },
  lightWarm: { bg: "#F6F3F3", surf: "#FFFFFF", surf2: "#F1ECED", ink: "#1E1618", mut: "#5A4E51", ln: "#EAE2E4" },
  // v9.6 C1 (Ali picked "quiet burgundy" — "calm and clear"): neutral greys, no pink tint, dark text
  lightQuiet: { bg: "#F5F4F2", surf: "#FFFFFF", surf2: "#EFEDEA", ink: "#1E1C1B", mut: "#5E5A57", ln: "#E6E3E0" },
  darkQuiet: { bg: "#141313", surf: "#1C1B1B", surf2: "#242222", ink: "#EDEBEA", mut: "#A9A4A2", ln: "#2F2C2C" },
};
/* v9.6 C1 (Ali, 6 Nov: "C1 is the best if done right and all colours are calm and clear as promised" — MOCKUPS.md,
   https://claude.ai/artifact/E8FbW1hcBmvmFHqWCAwk1P): burgundy only for the small things (the selected tab, links, the + button);
   big buttons soft (light burgundy tint, burgundy text); charts in calm mixed colours (teal, amber, blue, grey) — never all red;
   green = money in, red = money out. */
const QUIET = {
  l: { btn: "#F5E6EB", onBtn: "#7A1F3D", charts: ["#2A9D8F", "#E0A13B", "#4C7DD9", "#9AA0A6"] },
  d: { btn: "#3A1E27", onBtn: "#F0A9BB", charts: ["#4FC2B4", "#E8B04B", "#7FA6EE", "#8E949B"] },
};
/* v9.8 C6 (Ali, 7 Nov: "too much burgundy and too few colours" → picked C6 "each area its own colour", MOCKUPS.md,
   https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC): Money green (in) / red (out), Agents blue, Follow-ups amber, Documents violet.
   On a page of that area its colour is the accent (tabs, links, soft buttons); Home's cards wear their area's colour; the theme's own
   colour stays for the logo, the selected tab of the bottom bar and the rest of the app. */
export const AREA = {
  money: { l: ["#1E7A43", "#E4F3EA"], d: ["#5BC48A", "#16301F"] },
  agents: { l: ["#2F5FA8", "#E5EDF9"], d: ["#86AEEA", "#1A2638"] },
  fu: { l: ["#9A5B05", "#FBF0DC"], d: ["#E8B04B", "#3A2C12"] },
  docs: { l: ["#6D3FB5", "#EFE7FD"], d: ["#B79BF5", "#2A2140"] },
};
export const AREA_OF = { money: "money", guardian: "money", planner: "money", agents: "agents", scout: "agents", radar: "agents", timeline: "fu", life: "fu", reminders: "fu", errands: "fu", people: "fu", lists: "fu",
  pdfchat: "docs", booklib: "docs", convert: "docs", translate: "docs", shelf: "docs", slides: "docs" };
/** The CSS that gives each area its colour (on its pages + the --c-area-* tokens Home uses). */
export function areaCss(theme) {
  const bg = resolveBg((theme && theme.bg) || "auto"), light = bg === "light";
  const toks = Object.entries(AREA).map(([k, v]) => `--c-area-${k}:${v[light ? "l" : "d"][0]};--c-area-${k}-soft:${v[light ? "l" : "d"][1]}`).join(";");
  const pages = Object.entries(AREA).map(([k, v]) => { const [a, soft] = v[light ? "l" : "d"];
    return `html.att-themed.att-themed[data-area="${k}"] .calm{--c-acc:${a};--c-soft:${soft};--c-btn:${soft};--c-on-btn:${a}}`; }).join("");
  return `html{${toks}}` + pages;
}
/** The .calm colour tokens for a theme → { "--c-bg": "#…", … } (pure; tests: tests/unit/v950theme.test.mjs). */
export function calmVars(theme) {
  const t = theme || {}, acc = CALM_ACCENT[t.accent] ? t.accent : "burgundy", bg = resolveBg(t.bg || "auto"), light = bg === "light";
  // v9.7.2 (Ali, 6 Nov: "that wasn't the colours we agreed on" — his phone had Rose picked, and C1 was only built for Burgundy):
  // C1 is the look for EVERY colour — the colour only on small things, soft big buttons, calm charts, a neutral ground
  // (Green and Teal keep their own green-grey ground)
  const greenish = acc === "emerald" || acc === "teal";
  const g = light ? (greenish ? CALM_GROUND.light : CALM_GROUND.lightQuiet) : !greenish && bg === "slate" ? CALM_GROUND.darkQuiet : CALM_GROUND[bg] || CALM_GROUND.slate;
  const [a, soft] = CALM_ACCENT[acc][light ? "l" : "d"];
  const q = QUIET[light ? "l" : "d"];
  return { "--c-bg": g.bg, "--c-surf": g.surf, "--c-surf-2": g.surf2, "--c-ink": g.ink, "--c-mut": g.mut, "--c-ln": g.ln,
    "--c-acc": a, "--c-soft": soft, "--c-on-acc": light ? "#FFFFFF" : g.bg,
    "--c-btn": acc === "burgundy" ? q.btn : soft, "--c-on-btn": acc === "burgundy" ? q.onBtn : a,
    "--c-chart-1": q.charts[0], "--c-chart-2": q.charts[1], "--c-chart-3": q.charts[2], "--c-chart-4": q.charts[3] };
}
export function calmCss(theme) {
  const v = calmVars(theme);
  return "html.att-themed.att-themed .calm{" + Object.entries(v).map(([k, x]) => k + ":" + x).join(";") + "}" + areaCss(theme);
}
/** "auto" → "light" or "slate" (dark), from the phone's own setting right now. */
export const phoneDark = () => { try { return !!(typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches); } catch (e) { return false; } };
export const resolveBg = (bg) => (bg === "auto" ? (phoneDark() ? "slate" : "light") : bg);

/**
 * The CSS variables for a theme, as { "--color-teal-300": "oklch(…)", … }.
 * The app is written with teal as its accent and slate as its surfaces, so a theme
 * points those names at other colours. Light mode flips every scale (50 ↔ 950), so
 * "slate-950 background, slate-100 text" becomes a light page with dark text, and
 * "teal-300 text" becomes a deep accent that reads on white.
 */
export function themeVars(theme) {
  const t = theme || {};
  const accent = PALETTES[t.accent] ? t.accent : "teal";
  const bg = resolveBg(t.bg || "slate");
  const vars = {};
  const light = bg === "light";
  const flip = (i) => (light ? SHADES.length - 1 - i : i);
  const setScale = (name, from) => SHADES.forEach((s, i) => { vars[`--color-${name}-${s}`] = PALETTES[from][SHADES[flip(i)]]; });
  setScale("teal", accent === "teal" ? "calmteal" : accent);      // v6.27: Calm's teal is the default accent
  const surface = bg === "zinc" || bg === "stone" ? bg : "calm";   // v6.27: Calm's green-grey is the default ground
  setScale("slate", surface);
  if (bg === "black") {
    vars["--color-slate-950"] = "#000000";
    vars["--color-slate-900"] = "oklch(17% 0.01 265)";
    vars["--color-slate-800"] = "oklch(23% 0.015 265)";
  }
  if (light) {
    for (const fam of ["amber", "rose", "emerald", "sky", "violet", "red"]) setScale(fam, fam);
    vars["--color-white"] = PALETTES.slate["950"];
    vars["--color-black"] = "#ffffff";
    vars["--att-bg"] = "#F4F5F3";
    if (surface === "calm") { vars["--color-slate-950"] = "#F4F5F3"; vars["--color-slate-900"] = "#FFFFFF"; vars["--color-slate-800"] = "#E4E8E5"; }   // Calm light: grey ground, white cards
  }
  return vars;
}
const APPLIED = new Set();
/** Put a theme on the page (and the Android status bar colour via <meta name=theme-color>). */
export function applyTheme(theme, doc) {
  const d = doc || (typeof document !== "undefined" ? document : null);
  if (!d) return {};
  const root = d.documentElement, vars = themeVars(theme);
  for (const k of APPLIED) if (!(k in vars)) root.style.removeProperty(k);
  APPLIED.clear();
  for (const [k, v] of Object.entries(vars)) { root.style.setProperty(k, v); APPLIED.add(k); }
  const bgNow = resolveBg((theme || {}).bg), light = bgNow === "light";
  root.classList.toggle("att-light", light);
  // v9.5: the chosen colour and background on every screen (the .calm tokens)
  try { let st = d.getElementById("att-calm-theme"); if (!st) { st = d.createElement("style"); st.id = "att-calm-theme"; (d.head || root).appendChild(st); } st.textContent = calmCss(theme); root.classList.add("att-themed"); } catch (e) {}
  root.style.colorScheme = light ? "light" : "dark";
  try {
    const bgc = light ? "#F4F5F3" : bgNow === "black" ? "#000000" : getComputedStyle(root).getPropertyValue("--color-slate-950") || "#020618";
    let m = d.querySelector('meta[name="theme-color"]');
    if (!m) { m = d.createElement("meta"); m.name = "theme-color"; d.head.appendChild(m); }
    m.content = bgc.trim();
  } catch (e) {}
  return vars;
}
