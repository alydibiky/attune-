/* ---- v6.38 (upgrade C4) — Project brain: each project keeps a living summary, re-read from its chats every time — what was
   decided, what is still open, the dates coming up, and its files. Code only (no model, nothing made up: every line is a
   sentence from the chats, with the chat it came from). The summary is also given to the assistant in that project's chats,
   so it remembers what was agreed. Pure; tests/unit/v740projectbrain.test.mjs.                                              */
import { datesIn } from "./deadlines.js";

const DECIDE = /\b(we(?:'ll| will)? (?:go|went) with|decided|decision|let'?s (?:go with|use|do|keep)|we(?:'ll| will) use|final(?:ly)?:?|agreed|approved|confirmed|chosen|we picked|go ahead with)\b|اتفقنا|قررنا|قررت|هنمشي ب|هنستخدم|خلاص هن|نهائي|اتوافق|وافق|اخترنا|اعتمدنا|تم الاعتماد/i;
const OPEN = /\b(still need|need to (?:check|find|ask|confirm|know)|to check|todo|to-do|not sure|unclear|open question|waiting (?:for|on)|tbd|pending)\b|لسه|محتاج اعرف|محتاج أعرف|لازم نشوف|لازم نسأل|مش متأكد|مستني|مستنيين|هنشوف|مش واضح/i;
const iso = (t) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const clean = (s) => String(s || "").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
const sentences = (text) => clean(text).split(/(?<=[.!?؟])\s+|\n+/).map((x) => x.trim()).filter((x) => x.length >= 8 && x.length <= 220);
const key = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** → { decisions: [{ text, chat, at }], open: [...], dates: [{ date, text, chat }], files: [names], chats: n, updated } */
export function brainOf(project, chats, now = Date.now()) {
  const mine = (chats || []).filter((c) => c && project && c.projectId === project.id).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  const decisions = [], open = [], dates = [], seen = new Set();
  const today = iso(now);
  mine.forEach((c, ci) => {
    for (const m of [...(c.messages || [])].reverse()) {
      const text = typeof m.text === "string" ? m.text : typeof m.content === "string" ? m.content : "";
      for (const s of sentences(text)) {
        const k = key(s); if (seen.has(k)) continue;
        if (DECIDE.test(s) && !/\?|؟/.test(s)) { seen.add(k); decisions.push({ text: s, chat: c.id, title: c.title, at: c.updated || 0 }); }
        else if (m.role === "user" && ci < 3 && (OPEN.test(s) || /[?؟]\s*$/.test(s))) { seen.add(k); open.push({ text: s, chat: c.id, title: c.title, at: c.updated || 0 }); }
        for (const d of datesIn(s, { now })) { const day = iso(d.t); if (day >= today && !dates.some((x) => x.date === day && x.text === s)) dates.push({ date: day, text: s, chat: c.id, title: c.title }); }
      }
    }
  });
  dates.sort((a, b) => a.date.localeCompare(b.date));
  return { decisions: decisions.slice(0, 6), open: open.slice(0, 5), dates: dates.slice(0, 5), files: (project && project.knowledge || []).map((k) => k.name), chats: mine.length, updated: mine.length ? mine[0].updated || 0 : 0 };
}

/** The brain as a short block for the assistant's instructions in that project's chats ("" when there is nothing yet). */
export function brainBlock(b) {
  if (!b || !(b.decisions.length || b.open.length || b.dates.length)) return "";
  const L = [];
  if (b.decisions.length) L.push("Decided so far:\n" + b.decisions.map((x) => "- " + x.text).join("\n"));
  if (b.open.length) L.push("Still open:\n" + b.open.map((x) => "- " + x.text).join("\n"));
  if (b.dates.length) L.push("Dates coming up:\n" + b.dates.map((x) => `- ${x.date}: ${x.text}`).join("\n"));
  return "PROJECT BRAIN (from this project's earlier chats — keep to what was decided unless the user changes it; mention an open point when it matters):\n" + L.join("\n");
}
