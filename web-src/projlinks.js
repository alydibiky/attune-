/* ---- v10.1 Projects connected to the rest of the app (Ali picked P1 P2 P3 P4 W2 on 16 Nov 2026 — combined page OK'd).
   · P1 projectDates(project, chats, now) — the days coming up in a project: what YOU wrote in its chats, its notes (files / shared
     messages), its tasks, its due date. → [{ date, text, src }] (today or later, once each). Follow-ups shows them with the project's
     name; a tap opens the project. The assistant's own replies are never read for dates (it may suggest one nobody agreed).
   · P2 projectMoney(project, txns) — its budget and what was spent: payments tagged to it (txn.project === id) and payments whose
     note names it (one of its money words — the distinctive words of its name, or the ones you set), from 30 days before it started.
     → { budget, spent, left, items: [txn…] newest first }. Never an income, a transfer, or a word inside another word.
   · P3 projectPeople(project, chats, dir) / projectsOf(personId, projects, chats, dir) — the People cards a project names (in your
     messages, notes, tasks). A name two cards share is "maybe", never sure.
   · P4 addShared(project, text, now) — a shared message / note into the project's notes (dates in it reach Follow-ups through P1).
   Pure. Tests: tests/projlinks/gen.mjs (10,000 projects × dates · money · people) + tests/unit/v1010projects.test.mjs. */
import { datesIn } from "./deadlines.js";
import { mentions } from "./entities.js";

const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const clean = (s) => String(s || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
const sentences = (text) => clean(text).split(/(?<=[.!?؟])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length >= 4 && x.length <= 300);
const textOf = (m) => (typeof m.text === "string" ? m.text : typeof m.content === "string" ? m.content : "");
const mineChats = (p, chats) => (chats || []).filter((c) => c && p && c.projectId === p.id);

/** P1: the days coming up in a project. */
export function projectDates(p, chats = [], now = Date.now()) {
  if (!p) return [];
  const today = iso(now), out = [], seen = new Set();
  const add = (s, src) => { for (const d of datesIn(s, { now })) { const day = iso(d.t); if (day < today) continue; const k = day + "|" + s.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ date: day, text: s, src }); } };
  for (const c of mineChats(p, chats)) for (const m of c.messages || []) if (m && m.role === "user") for (const s of sentences(textOf(m))) add(s, "chat");
  for (const k of p.knowledge || []) for (const s of sentences(String(k.text || "").slice(0, 20000))) add(s, "note");
  for (const t of p.tasks || []) if (t && t.col !== "done") add(String(t.text || ""), "task");
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(p.due || "")) && p.due >= today) out.push({ date: p.due, text: "", src: "due" });
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 30);
}

// ---- P2 money -----------------------------------------------------------------------------------------------------------------
const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "")
  .replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
// words too common to tell one project from another ("Flat Maadi" → maadi; "Umrah · December" → umrah)
const COMMON = new Set(("project work job plan new my our the a an and of for to in at on with trip travel holiday vacation flat house home apartment " +
  "office shop car wedding party birthday renovation repair fix build move moving buy buying sale study course school uni exam " +
  "kitchen bathroom room garden villa roof floor sign gift gifts visit " +
  "january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec " +
  "2024 2025 2026 2027 2028 2029 2030 مشروع شغل رحله سفر شقه بيت مكتب محل عربيه فرح تشطيب نقل دراسه").split(" "));
const strip = (w) => w.replace(/^(?:ال|لل|بال|وال)(?=\S{3,})/, "");
/** The words a payment's note must have to count for this project (the ones you set, else its distinctive name words). */
export function moneyWords(p) {
  if (p && Array.isArray(p.moneyWords) && p.moneyWords.length) return p.moneyWords.map((w) => strip(fold(w))).filter((w) => w.length >= 2);
  const ws = fold(p && p.name).split(" ").map(strip).filter((w) => w.length >= 3 && !COMMON.has(w) && !/^\d+$/.test(w));
  return [...new Set(ws)];
}
const has = (note, w) => { const toks = fold(note).split(" ").map(strip); return w.includes(" ") ? (" " + toks.join(" ") + " ").includes(" " + w + " ") : toks.includes(w); };
/** P2: the project's money. */
export function projectMoney(p, txns = []) {
  if (!p) return { budget: 0, spent: 0, left: 0, items: [] };
  const words = moneyWords(p), from = (p.created || 0) - 30 * 864e5;
  const items = (txns || []).filter((t) => t && t.type === "expense" && (+t.amount || 0) > 0 && (t.project === p.id ||
    (!t.project && words.length && Date.parse(String(t.date || "") + "T12:00:00") >= from && words.some((w) => has([t.note, t.payee, t.merchant].join(" "), w)))));
  items.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const spent = Math.round(items.reduce((a, t) => a + (+t.amount || 0), 0) * 100) / 100, budget = +p.budget || 0;
  return { budget, spent, left: budget ? Math.round((budget - spent) * 100) / 100 : 0, items };
}

// ---- P3 people ----------------------------------------------------------------------------------------------------------------
const peopleTexts = (p, chats) => [...mineChats(p, chats).flatMap((c) => (c.messages || []).filter((m) => m && m.role === "user").map(textOf)),
  ...(p.knowledge || []).map((k) => String(k.text || "").slice(0, 20000)), ...(p.tasks || []).map((t) => t.text || ""), p.name || "", p.instructions || ""];
/** P3: the People cards a project names → [{ id, n, maybe }] (most mentioned first). */
export function projectPeople(p, chats = [], dir = { items: [] }) {
  if (!p) return [];
  const count = new Map();
  for (const tx of peopleTexts(p, chats)) for (const m of mentions(tx, dir)) {
    if (m.ids.length === 1) { const c = count.get(m.ids[0]) || { id: m.ids[0], n: 0, maybe: false }; c.n++; c.maybe = false; count.set(m.ids[0], c); }
    else for (const id of m.ids) { if (!count.has(id)) count.set(id, { id, n: 0, maybe: true }); count.get(id).n += 0; }
  }
  return [...count.values()].filter((x) => x.n > 0 || x.maybe).sort((a, b) => (a.maybe - b.maybe) || b.n - a.n);
}
/** P3, the other way: the projects that name this person (sure only). */
export const projectsOf = (personId, projects = [], chats = [], dir = { items: [] }) =>
  (projects || []).filter((p) => projectPeople(p, chats, dir).some((x) => x.id === personId && !x.maybe));

// ---- P4 add from anywhere -----------------------------------------------------------------------------------------------------
/** A shared message / note → the project's notes (its dates then reach Follow-ups). */
export function addShared(p, text, now = Date.now()) {
  const t = String(text || "").trim(); if (!p || !t) return p;
  const name = t.split("\n")[0].replace(/\s+/g, " ").slice(0, 60);
  return { ...p, knowledge: [...(p.knowledge || []), { id: "k" + now.toString(36), name, text: t.slice(0, 200000), shared: now }] };
}
