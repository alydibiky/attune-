/* ---- v9.9.40 AP-5 the new Autopilot's decision (Ali, 14 Nov 2026: "the whole autopilot idea is very stupid" → the six rules, his
   OK on K1–K6). One chat message → ONE decision, always with its source message and the reason (rule 3):
     keep      — kept for search and questions, nothing shown (rule 1: the normal answer). quiet: the noise kind, or the reason
     ask       — a chat Attune doesn't know yet: shown once as "What I understood — Right?" (K1); nothing is done before that
     items     — a shopping-list chat: these items go on the list (K2)
     bought    — someone in the list chat says they bought it («جبته», "got everything") → those items come off (K3)
     alert     — a topic the person said matters in this chat, or someone asks / mentions them (rule 5)
     todo      — a real request from ONE person to you (never from a group)
   Only a role the person confirmed is acted on (rule 2); everything else is "keep". Messages that are not chats (a bank SMS, a
   delivery, a bill) keep going through autopilot.js as before. Pure; tests: tests/autopilot2/gen.mjs (10,000 conversations). */
import { chatOf, noiseOf } from "./chats.js";
import { itemsOf, boughtOf } from "./shoplist.js";
import { confirmedRole, guessRole } from "./chatroles.js";
import { asksYou } from "./autopilot.js";

const fold = (s) => String(s || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$|[،,.!?؟])/g, "ه").replace(/^ال/, "");
const topicIn = (text, topics = []) => { const t = " " + fold(text).replace(/[^\p{L}\p{N}]+/gu, " ") + " ";
  return (topics || []).find((x) => { const w = fold(x).replace(/^(?:the|my|our)\s+/, "").replace(/^ال/, "").trim(); return w.length >= 2 && (t.includes(" " + w + " ") || t.includes(" ال" + w + " ") || t.includes(" el " + w + " ") || t.includes(" " + w + "s ")); }) || ""; };
/** Is the message to ME? my name (or @name) in it, or a question put to "you" in a chat with one person. */
const mentionsMe = (text, me = []) => { const t = fold(text); return (me || []).some((n) => n && n.length >= 2 && new RegExp("(?:^|[^\\p{L}])@?" + fold(n).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\p{L}])", "u").test(t)); };
const src = (c, n) => ({ chatKey: c.key, chat: c.chat, who: c.who, text: c.text, ts: n.ts || 0, id: String(n.id || ""), app: c.app });

/** n: a notification. ctx: { roles (chatroles store), known (chats seen), me: [your names], list: [open shopping items] } */
export function decide(n, { roles = {}, known = {}, me = [], list = [], minds = {} } = {}) {
  const c = chatOf(n, known); if (!c) return null;
  const from = src(c, n), nz = noiseOf(c.text);
  if (nz) return { kind: "keep", quiet: nz, from, why: { t: "kept quietly ({k})", v: { k: nz } } };
  // a one-to-one chat is certainly one person (code knows it — no need to ask about every contact); "What is this chat?" is for groups
  const role = confirmedRole(roles, c.key) || (!c.group && !roles[c.key] ? { role: "person", ok: true } : null);
  if (!role) {
    const seen = roles[c.key];
    return seen ? { kind: "keep", from, why: { t: "waiting for you to say what {c} is", v: { c: c.chat } } }
      : { kind: "ask", from, guess: guessRole(c, [c]), why: { t: "a new chat — what is {c}?", v: { c: c.chat } } };
  }
  const care = role.care || [], hit = topicIn(c.text, care);
  switch (role.role) {
    case "shopping": {
      const b = boughtOf(c.text, list); if (b) return { kind: "bought", bought: b, from, why: { t: "{w} said it was bought, in {c}", v: { w: c.who || "someone", c: c.chat } } };
      const items = itemsOf(c.text); if (items.length) return { kind: "items", items, list: c.chat, from, why: { t: "{c} is your shopping list (you said so)", v: { c: c.chat } } };
      return { kind: "keep", from, why: { t: "not items for the list", v: {} } };
    }
    case "quiet": return { kind: "keep", quiet: "chat", from, why: { t: "you said {c} is never important", v: { c: c.chat } } };
    case "person": {
      if (!c.group && asksYou(c.text)) return { kind: "todo", from, title: (c.who || c.chat) + ": " + c.text.slice(0, 80), why: { t: "{w} asked you something", v: { w: c.who || c.chat } } };
      // v9.9.31 kept: what code can't read (Dima in Russian: "send me the contract tomorrow") — the phone's AI reading of THIS message,
      // checked and kept by notifmind (code + model, sure, a request to do something), with its due date
      { const md = minds[String(n.id)];
        if (!c.group && md && md.by === "code+model" && md.sure && md.intent === "request" && /^(?:do|pay|submit|call_back|pickup)$/.test(md.action || ""))
          return { kind: "todo", from, title: (c.who || c.chat) + ": " + String(md.summary || c.text).slice(0, 80), due: md.due && md.due.date ? Date.parse(md.due.date + "T" + (md.due.time || "09:00") + ":00") : 0, why: { t: "{w} asked you something", v: { w: c.who || c.chat } } }; }
      if (hit) return { kind: "alert", from, topic: hit, why: { t: "it's about {x} — you asked to know", v: { x: hit } } };
      return { kind: "keep", from, why: { t: "nothing asked of you", v: {} } };
    }
    default: {   // building · work · family · friends · courier · news
      if (hit) return { kind: "alert", from, topic: hit, why: { t: "it's about {x} — you asked to know", v: { x: hit } } };
      if (role.whenMe && mentionsMe(c.text, me)) return { kind: "alert", from, topic: "", why: { t: "{w} mentioned you in {c}", v: { w: c.who || "someone", c: c.chat } } };
      if (!c.group && role.role === "family" && asksYou(c.text)) return { kind: "todo", from, title: (c.who || c.chat) + ": " + c.text.slice(0, 80), why: { t: "{w} asked you something", v: { w: c.who || c.chat } } };
      return { kind: "keep", from, why: { t: "kept with {c} — nothing for you", v: { c: c.chat } } };
    }
  }
}

/** The day's "Kept quietly" line (NS-2): how many, by chat — { total, byChat: [[chat, n], …] }. */
export function quietCounts(decisions = []) {
  const by = new Map(); let total = 0;
  for (const d of decisions) if (d && d.kind === "keep") { total++; by.set(d.from.chat, (by.get(d.from.chat) || 0) + 1); }
  return { total, byChat: [...by.entries()].sort((a, b) => b[1] - a[1]) };
}
