/* ---- v8.7 (Ali, 29 Oct: "tell me about my barber" took 15 s through a knowledge pack, and the voice said "I don't have
   access to your personal information like your barber" — although it was in the app): a question about YOUR people and
   things is answered at once, by code, from what you told Attune (Mind notes, Recall's kept messages, People & plans), never
   by the model guessing.
     personalAsk(q)               a question about someone / something of yours ("my barber", «الحلاق بتاعي», "who is Osama
                                  the carpenter", "do you know my plumber") — not a general question ("what is a barber")
     mindAnswer(q, stores)        → { en, ar, recs: [the records it came from], open } | null — the closest note, said back
   Pure (stores in); tests: tests/unit/v870personal.test.mjs.                                                                */
import { recallSearch, recallDocs, fold } from "./lookback.js";

const ASKS = /\b(tell me about|what do you know about|do you know|who(?:'s| is| was)|where(?:'s| is| do i)|remind me (?:who|where|what)|what(?:'s| is) (?:the (?:name|number|address) of )?my|which)\b|^(?:my )|(?:^|\s)(?:مين|فين|تعرف|تعرفي|عارف|عارفة|قولي عن|احكيلي عن|ايه اسم|إيه اسم|رقم|عنوان)(?:\s|$)/i;
const MINE = /\b(my|mine|i go to|i use|our)\b|بتاعي|بتاعتي|بتوعي|اللي بروحله|اللي بروحلها|بتاعنا|عندنا/i;
const NAMED = /\b(?:who(?:'s| is| was))\s+[A-Z؀-ۿ][\w؀-ۿ]+|(?:^|\s)مين\s+[؀-ۿ]{3,}/;   // "who is Osama the carpenter", «مين أسامة النجار»
const GENERAL = /\b(what is an? |what are |how (?:do|does|to) |why )/i;
/** A question about someone or something of the person's own. */
export function personalAsk(q) {
  const t = String(q || "").trim();
  if (!t || t.length > 160) return false;
  if (GENERAL.test(t) && !MINE.test(t)) return false;
  return ASKS.test(t) && (MINE.test(t) || NAMED.test(t));
}

const QWORDS = /\b(tell|me|about|what|do|you|know|who|is|was|where|my|mine|the|a|an|of|remind|which|name|number|address|i|go|to|use|our|please)\b|(?:^|\s)(مين|فين|تعرف|تعرفي|عارف|قولي|عن|احكيلي|ايه|إيه|اسم|بتاعي|بتاعتي|بتوعي|اللي|ده|دي|هو|هي)(?=\s|$)/gi;
/** The closest thing you told Attune about it — or null when nothing really matches (then the model / web may answer). */
export function mindAnswer(q, { memory = [], notes = [], life = null } = {}, { now = Date.now() } = {}) {
  if (!personalAsk(q)) return null;
  const core = String(q).replace(/[?؟!.]/g, " ").replace(QWORDS, " ").replace(/\s+/g, " ").trim();
  if (!core) return null;
  const people = ((life && life.items) || []).filter((c) => c && c.person).map((c) => ({ id: "life:" + c.id, title: c.person, text: [c.title, c.kind, c.note].filter(Boolean).join(" · "), ts: Date.parse(c.start || "") || 0 }));
  const docs = recallDocs({ memory: memory.filter((r) => r && r.kind !== "chat"), notes })
    .concat(people.map((p) => ({ ...p, kind: "mind", open: { mode: "life" } })));
  const r = recallSearch(docs, core, { now, limit: 5 });
  const hits = (r.hits || []).filter((h) => h.score > 0);
  if (!hits.length) return null;
  // every word that matters must be in the best one ("my barber" → a note that says barber / حلاق)
  const words = r.ask.terms; if (!words.length) return null;
  const top = hits[0], f = " " + fold(top.doc.title + " " + top.doc.text) + " ";
  const has = words.filter((w) => f.includes(w.replace(/_/g, " ")) || top.snip && fold(top.snip).includes(w)).length;
  if (r.loose && has < words.length) return null;
  const said = String(top.doc.text || top.doc.title).replace(/\s+/g, " ").trim().slice(0, 320);
  const when = top.doc.ts ? new Date(top.doc.ts).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "";
  const whenAr = top.doc.ts ? new Date(top.doc.ts).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric" }) : "";
  const src = top.doc.kind === "note" ? ["a message you got", "رسالة جاتلك"] : top.doc.open && top.doc.open.mode === "life" ? ["People & plans", "الناس والالتزامات"] : ["your Mind", "عقلي"];
  return { en: `From ${src[0]}${when ? " (" + when + ")" : ""}: “${said}”`, ar: `من ${src[1]}${whenAr ? " (" + whenAr + ")" : ""}: «${said}»`,
    recs: hits.slice(0, 3).map((h) => h.doc), open: top.doc.kind === "note" ? "recall" : top.doc.open && top.doc.open.mode === "life" ? "life" : "memory" };
}
