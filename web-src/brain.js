/* ---- v9.8 (Ali, 7 Nov: "the chat is still stupid — I don't care if it takes 3, 4 or even 10 seconds, but the answer must be right,
   using AI · all chats in the app should be smarter"). One brain for every chat that is not the main Chat (Ya Attune voice, the
   small chats on pages): the model is told what Attune itself can do (so it never says "I can't access files" — it says where in
   the app, or the app does it), and it gets what Attune already knows that fits the question: the notifications as understood by
   notifmeaning.js, the people / payments / promises (connected memory), the agents' finds. A request the app does better than a
   model (translate a whole document, read a long PDF) is routed to that tool first (routeTask).
   Pure; tests/unit/v980fixes.test.mjs.                                                                                            */
import { comprehend } from "./notifmind.js";
import { noteLine } from "./notifmeaning.js";
import { recallDocs, recallSearch } from "./lookback.js";

const DOC = /\b(document|doc|docx|file|pdf|word file|slides?|pptx|presentation|contract|paper|report|cv|resume|book|chapter)\b|ملف|الملف|مستند|المستند|ورق|الورق|الورقه|ورقه|عقد|العقد|بي دي اف|pdf|تقرير|التقرير|كتاب|الكتاب|السي في/i;
const TRANSLATE = /\b(translate|translation|translating)\b|ترجم|ترجمه|ترجمة|ترجملي|ترجمهولي|traduis|traducir|traduz|übersetz|tradurre|çevir|terjemah/i;
const READ = /\b(summari[sz]e|summary|read|explain|what does .{0,30} say|key points|ask (?:about|a question)|questions? about)\b|لخص|لخصلي|ملخص|اقرا|اقرأ|اشرح|فهمني|ايه اللي في|بيقول ايه/i;

/** A job the app does better than a chat answer → { tool, lang? } (else null).
 *  "translate this document to English" → translate-doc · "summarise this PDF" → read-doc. */
export function routeTask(q, { hasFile = false } = {}) {
  const t = String(q || "");
  if (TRANSLATE.test(t) && (DOC.test(t) || hasFile)) return { tool: "translate-doc", lang: langIn(t) };
  if (READ.test(t) && DOC.test(t) && hasFile) return { tool: "read-doc" };
  return null;
}
const LANGS = [["en", /\b(?:to|into|in)\s+english\b|انجليزي|إنجليزي|بالانجليزي|للانجليزي|الانجليزيه/i], ["ar", /\b(?:to|into|in)\s+arabic\b|عربي|بالعربي|للعربي|العربيه/i],
  ["fr", /\bfrench\b|فرنساوي|فرنسي|الفرنسيه/i], ["de", /\bgerman\b|الماني|ألماني/i], ["tr", /\bturkish\b|تركي|التركي/i], ["es", /\bspanish\b|اسباني|إسباني/i],
  ["it", /\bitalian\b|ايطالي|إيطالي/i], ["ru", /\brussian\b|روسي/i], ["zh", /\bchinese\b|صيني/i]];
export function langIn(t) { for (const [id, rx] of LANGS) if (rx.test(t)) return id; return ""; }

/** What Attune can do — the model answers knowing it (never "I can't access files / your data"). */
export const CAPABILITIES = `About the app you are part of (Attune, on the user's phone): it can translate whole documents keeping their layout (Translate → Document, or attach the file in Chat and say "translate"), read and answer questions about long PDFs and Word files (Documents / Ask a PDF), keep money and expenses (Money), people and payments due (Follow-ups → People & plans), reminders and scheduled messages, agents that watch hotel / flight / product prices, notes (Mind), and it keeps the phone's notifications so it can recall them. Below you may get "What Attune already knows" — facts from the user's own phone. Use them when they answer the question and say where they came from in a few words. Never say you cannot access files, notifications or the user's data: if the facts are not below, say Attune has nothing about it yet and which page would have it.`;

/** The facts that fit a question: notifications (understood), people / payments (connected memory), as short lines. */
// v9.9.31 the meaning of a notification for Chat: "Mona asks you to send the ID photo — by 2026-11-14"
function meaningLine(n) { try { const m = (JSON.parse(localStorage.getItem("attune:notifmind:v1") || "{}") || {})[String(n.id)] || comprehend(n); if (!m) return "";
  return " — means: " + [m.cat, m.intent, m.action && m.action !== "none" ? "you should " + m.action.replace("_", " ") : "", m.due ? "by " + m.due.date + (m.due.time ? " " + m.due.time : "") : "", m.amount && m.amount.dir !== "price" ? m.amount.value + " " + m.amount.cur + " (" + m.amount.dir + ")" : "", m.by === "code+model" && m.summary ? "«" + m.summary + "»" : ""].filter(Boolean).join(", "); } catch (e) { return ""; } }
export function knownFor(q, { notes = [], now = Date.now(), connect = null, max = 6 } = {}) {
  const lines = [];
  try {
    if (notes.length) {
      const r = recallSearch(recallDocs({ notes }), q, { now, limit: 4 });
      const byId = new Map(notes.map((n) => [n.id, n]));
      // only real matches (most of the question's words or their meanings) — never "some word in common" noise
      if (!r.loose && r.ask.terms.length) for (const h of r.hits.slice(0, 4)) { const n = byId.get(h.doc.raw); if (n) lines.push("Notification " + noteLine(n, now) + meaningLine(n)); }
    }
  } catch (e) {}
  try { const cx = connect ? connect(q) : null; if (cx && cx.answer && cx.answer.en) lines.push("From the user's records: " + cx.answer.en); } catch (e) {}
  return lines.slice(0, max);
}

/** The system prompt for a voice / page chat: Attune's rules + what it can do + (for voice) how to sound when read aloud. */
export function brainSystem({ voice = false, ui = "en", known = [] } = {}) {
  const lang = ui === "ar" ? "Answer in natural Egyptian Arabic (عامية مصرية)." : "Answer in the language the user speaks; Egyptian Arabic if they speak Arabic.";
  const shape = voice
    ? "You are being spoken to. Answer correctly and completely, in 2 to 5 natural spoken sentences — no lists, tables, markdown or links. Give the actual answer (the number, the name, the step), not a promise to help."
    : "Answer directly: the answer first, then only the details that help.";
  return [
    "You are Attune, the user's personal assistant on their phone. Think the question through before answering; check names, numbers and dates; if unsure, say what you are unsure about in one short line instead of guessing.",
    shape, lang, CAPABILITIES, "Today is " + new Date().toDateString() + ".",
    known.length ? "What Attune already knows (from this phone):\n- " + known.join("\n- ") : "",
  ].filter(Boolean).join("\n\n");
}
