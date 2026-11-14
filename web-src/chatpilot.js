/* ---- v9.9.40 AP-5 (screens) the new Autopilot's running state — what the chat Autopilot has looked at, what it did (with the
   full message and how to undo it — rule 3 / K4), what it is asking you (K1), and what it kept quietly today (NS-2).
   step(notes, st, ctx) → { st, effects } looks at each chat message ONCE, oldest first, through autopilot2.decide(); the page carries
   out the effects (add to a list, tick, a to-do) and keeps st. Pure; tests: tests/unit/v9940chatpilot.test.mjs.
   messagesByChat(notes, exports) → the kept messages of every chat, from notifications and from WhatsApp exports (rule 6), for
   chatask.askChat (K5) and the full-message sheet. */
import { decide } from "./autopilot2.js";
import { chatOf, noiseOf } from "./chats.js";
import { readExport } from "./waexport.js";
import { guessRole } from "./chatroles.js";

export const CP_KEY = "attune:chatpilot:v1";
export const emptyCP = () => ({ seen: {}, done: [], ask: [], quiet: {}, since: 0, kept: [], review: null });
export function loadCP(s = typeof localStorage !== "undefined" ? localStorage : null) { try { const v = JSON.parse((s && s.getItem(CP_KEY)) || "null"); return v && typeof v === "object" ? { ...emptyCP(), ...v } : emptyCP(); } catch (e) { return emptyCP(); } }
export function saveCP(st, s = typeof localStorage !== "undefined" ? localStorage : null) { try { s && s.setItem(CP_KEY, JSON.stringify(st)); } catch (e) {} return st; }
const day = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const idOf = (n) => String(n.id || (n.pkg || n.app) + ":" + n.ts + ":" + String(n.title || "").slice(0, 40) + ":" + String(n.text || "").slice(0, 60));

/** ctx: { roles, me, listOf(chatKey) → open items of that chat's list, now }. Only messages newer than st.since (the first run starts
 *  from the last 2 days — older ones are kept for questions, never acted on). */
export function step(notes = [], st0 = emptyCP(), { roles = {}, me = [], listOf = () => [], now = Date.now(), minds = {} } = {}) {
  const st = { ...st0, seen: { ...st0.seen }, done: st0.done.slice(), ask: st0.ask.slice(), quiet: { ...st0.quiet } };
  if (!st.since) st.since = now - 2 * 864e5;
  const effects = [], known = {};
  for (const k of Object.keys(roles)) if (k.includes("|g:")) known[k] = { group: true };
  const fresh = notes.filter((n) => n && (n.ts || 0) >= st.since && !st.seen[idOf(n)] && chatOf(n, known)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  for (const n of fresh) {
    const id = idOf(n);
    const c = chatOf(n, known); if (c && c.group) known[c.key] = { group: true };
    const d = decide(n, { roles, known, me, list: c ? listOf(c.key) : [], minds }); if (!d) continue;
    // a message waiting for "what is this chat?" is NOT marked as looked at — once you say Right it is acted on (Talabat's first items)
    const waiting = d.kind === "ask" || (d.kind === "keep" && !d.quiet && /^waiting for you/.test((d.why && d.why.t) || ""));
    // a one-person message the phone's AI hasn't read yet (it reads a little later): looked at again for 30 minutes, then kept
    const pendingMind = d.kind === "keep" && !d.quiet && c && !c.group && !minds[String(n.id)] && now - (n.ts || 0) < 30 * 60000;
    if (pendingMind) continue;
    if (!waiting) st.seen[id] = 1;
    const rec = { id, kind: d.kind, at: n.ts || now, from: d.from, why: d.why };
    if (d.kind === "keep") { const k = day(n.ts || now); st.quiet[k] = st.quiet[k] || {}; st.quiet[k][d.from.chat] = (st.quiet[k][d.from.chat] || 0) + 1;
      // K6: the last 200 kept messages (text + why) travel with sync, so the computer's bigger AI can read them again
      st.kept = [{ id, at: n.ts || now, from: d.from, quiet: d.quiet || "", why: d.why }, ...(st.kept || [])].slice(0, 200); continue; }
    if (d.kind === "ask") { if (!st.ask.some((a) => a.key === d.from.chatKey) && !(roles[d.from.chatKey])) st.ask.push({ key: d.from.chatKey, chat: d.from.chat, group: c ? c.group : false, guess: d.guess, from: d.from, at: n.ts || now }); continue; }
    if (d.kind === "items") effects.push({ type: "addItems", chatKey: d.from.chatKey, list: d.list, items: d.items, rec: { ...rec, items: d.items } });
    else if (d.kind === "bought") effects.push({ type: "bought", chatKey: d.from.chatKey, bought: d.bought, rec });
    else if (d.kind === "todo") effects.push({ type: "todo", title: d.title, due: d.due || 0, rec: { ...rec, title: d.title } });
    else if (d.kind === "alert") effects.push({ type: "alert", rec: { ...rec, topic: d.topic || "" } });
  }
  // keep the record small: what was looked at in the last 14 days; the done list 200 long; quiet counts 14 days
  const cut = now - 14 * 864e5;
  if (Object.keys(st.seen).length > 4000) st.seen = Object.fromEntries(Object.entries(st.seen).slice(-3000));
  for (const k of Object.keys(st.quiet)) if (Date.parse(k + "T12:00:00") < cut) delete st.quiet[k];
  st.ask = st.ask.slice(-10);
  return { st, effects };
}
/** After the page carried out an effect: the line for "Done for you" / "For you", with what undoes it (ids it made). */
export const record = (st, rec, undo = {}) => ({ ...st, done: [{ ...rec, undo, undone: false }, ...st.done].slice(0, 200) });
export const markUndone = (st, id) => ({ ...st, done: st.done.map((d) => (d.id === id ? { ...d, undone: true } : d)) });
/** "Kept quietly today": { total, byChat: [[chat, n]] } */
export function quietToday(st, now = Date.now()) { const q = (st.quiet || {})[day(now)] || {}; const byChat = Object.entries(q).sort((a, b) => b[1] - a[1]); return { total: byChat.reduce((a, x) => a + x[1], 0), byChat }; }

/** Every chat's kept messages: from notifications (chatOf) and exports ([{ title, text }] — readExport). → { chats: [{ key, chat, app, group }], byKey } */
export function messagesByChat(notes = [], exports = [], roles = {}) {
  const byKey = {}, chats = new Map(), known = {};
  for (const k of Object.keys(roles)) if (k.includes("|g:")) known[k] = { group: true };
  const add = (key, chat, app, group, m) => { if (!chats.has(key)) chats.set(key, { key, chat, app, group, role: (roles[key] || {}).role || "" }); (byKey[key] = byKey[key] || []).push(m); };
  for (const n of notes) { const c = chatOf(n, known); if (!c) continue; add(c.key, c.chat, c.app, c.group, { id: idOf(n), ts: n.ts || 0, who: c.who, text: c.text, noise: noiseOf(c.text) || "" }); }
  for (const x of exports) {
    let r; try { r = readExport(x.text || "", { fileName: x.fileName || "" }); } catch (e) { continue; }
    // (Talabat is a group of TWO — Ali and Noudy: "more than 2 writers" alone filed it as one person) a chat already known as a group
    // (its notifications or its role) stays one
    const chat = x.title || r.chat || "WhatsApp chat", gk = "whatsapp|g:" + chat.toLowerCase(), group = chats.has(gk) || !!roles[gk] || (r.members || []).length > 2, key = "whatsapp|" + (group ? "g:" : "p:") + chat.toLowerCase();
    for (const m of r.messages) if (m.kind === "text") add(key, chat, "whatsapp", group, { id: "x:" + key + ":" + m.ts + ":" + (m.author || ""), ts: m.ts, who: m.author || "", text: m.text, noise: noiseOf(m.text) || "" });
  }
  // the same message from the export and the notification → once (same writer, same words, same minute)
  for (const k of Object.keys(byKey)) { const seen = new Set(); byKey[k] = byKey[k].sort((a, b) => a.ts - b.ts).filter((m) => { const s = (m.who || "") + "|" + String(m.text).slice(0, 80) + "|" + Math.floor(m.ts / 60000); if (seen.has(s)) return false; seen.add(s); return true; }); }
  return { chats: [...chats.values()], byKey };
}

/** v9.9.40 EX-1 (Ali OK'd: "Export → Attune reads it and suggests what the chat is"): a chat whose export was shared to Attune and
 *  that you haven't described yet → asked at once ("What I understood", from its whole history) — not only when it next notifies. */
// (an export doesn't say if it was a group — Talabat, a group of two, looks like one person in the file: the notifications decide,
// and an answer given on an export's question is kept for both forms of the chat's name)
export function askForExports(st, exports = [], roles = {}, now = Date.now(), notes = []) {
  const mb = messagesByChat(notes, exports, roles); let out = st, added = 0;
  const twin = (k) => k.replace(/\|[gp]:/, (m) => (m === "|g:" ? "|p:" : "|g:"));
  for (const c of mb.chats) {
    if (!exports.some((x) => String(x.title || "").toLowerCase() === c.chat.toLowerCase())) continue;
    if (roles[c.key] || roles[twin(c.key)] || out.ask.some((a) => a.key === c.key || a.key === twin(c.key))) continue;
    const msgs = (mb.byKey[c.key] || []).map((m) => ({ who: m.who, text: m.text }));
    out = { ...out, ask: [...out.ask, { key: c.key, chat: c.chat, group: c.group, guess: guessRole({ chat: c.chat, group: c.group }, msgs), from: null, at: now, n: msgs.length, fromExport: true }] }; added++;
  }
  return { st: out, added };
}
