/* ---- v9.9.40 K6 (Ali asked: "when the user opens his account on the computer with the bigger engine, it re-sees the work done on the
   phone?" → OK'd K6): the computer's bigger AI re-reads what the phone's Autopilot decided this week — what it kept quietly, what it
   added, the to-dos it made, what it showed you — and says for each: right, or wrong and what it should have been. Nothing changes by
   itself: each fix is listed with its message and why ("Computer checked: 312 · 2 fixed"), with Undo, and travels back to the phone
   with sync. The phone's state carries the decisions (chatpilot.js: done + the last 200 kept). Pure; tests: tests/unit/v9940secondlook.test.mjs.
     toReview(st, since)          → the decisions to look at again: [{ id, kind, chat, role, who, text, why }]
     reviewPrompt(batch, roles)   → the messages for the computer's model (one batch of up to 20)
     readReview(out, batch)       → [{ id, ok: true } | { id, ok: false, should: "keep"|"items"|"todo"|"alert", reason }] (checked)
     fixesOf(results, batch)      → the fixes to show: [{ id, from, was, should, reason }] */
import { noiseOf } from "./chats.js";

const KINDS = ["keep", "items", "todo", "alert", "bought"];
export function toReview(st = {}, since = 0) {
  const out = [];
  for (const d of st.done || []) if (!d.undone && (d.at || 0) >= since) out.push({ id: d.id, kind: d.kind, from: d.from, why: d.why });
  for (const k of st.kept || []) if ((k.at || 0) >= since && !(k.quiet && noiseOf(k.from && k.from.text))) out.push({ id: k.id, kind: "keep", from: k.from, why: k.why });   // pure noise is never re-asked
  return out;
}
const ROLE_WORD = { orders: "a record of the orders the person buys", shopping: "a shared shopping list", building: "the building's residents group", work: "a work group", family: "family", friends: "friends", person: "one person", courier: "deliveries", news: "news/offers", quiet: "never important" };
export function reviewPrompt(batch = [], roles = {}) {
  const lines = batch.map((x, i) => { const r = roles[x.from && x.from.chatKey] || {}; return (i + 1) + ". [" + x.kind + "] chat \"" + x.from.chat + "\" (" + (ROLE_WORD[r.role] || "unknown") + (r.care && r.care.length ? "; the person cares about: " + r.care.join(", ") : "") + ") — " + (x.from.who || "?") + ": " + String(x.from.text || "").slice(0, 300); });
  return [{ role: "system", content: "You check a phone assistant's decisions about chat messages. For each line, the decision is in brackets: keep = kept quietly, nothing shown; items = added to the shopping list; todo = made a to-do for the person; alert = shown to the person; bought = ticked off the shopping list. Judge ONLY from the message, its chat and the chat's role. Reply with ONE line of JSON: {\"r\": [{\"n\": line number, \"ok\": true}, or {\"n\": line number, \"ok\": false, \"should\": keep|items|todo|alert, \"why\": a short reason}]}. Say ok:false only when you are sure — a meme, a greeting or chatter must stay keep; a group message is never a todo." },
    { role: "user", content: lines.join("\n") }];
}
export function readReview(out, batch = []) {
  let j; try { j = JSON.parse(String(out || "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (e) { return null; }
  if (!j || !Array.isArray(j.r)) return null;
  const res = [];
  for (const x of j.r) {
    const it = batch[(+x.n || 0) - 1]; if (!it) continue;
    if (x.ok === true || x.ok === "true") { res.push({ id: it.id, ok: true }); continue; }
    const should = String(x.should || "");
    if (!KINDS.includes(should) || should === it.kind) { res.push({ id: it.id, ok: true }); continue; }   // nothing to change → right
    // the same hard rules as the phone: noise stays kept; a group message is never a to-do
    if (should !== "keep" && noiseOf(it.from && it.from.text)) { res.push({ id: it.id, ok: true }); continue; }
    if (should === "todo" && it.from && /\|g:/.test(it.from.chatKey || "")) { res.push({ id: it.id, ok: true }); continue; }
    res.push({ id: it.id, ok: false, should, reason: String(x.why || "").slice(0, 160) });
  }
  return res;
}
export function fixesOf(results = [], batch = []) {
  return results.filter((r) => !r.ok).map((r) => { const it = batch.find((b) => b.id === r.id); return { id: r.id, from: it.from, was: it.kind, should: r.should, reason: r.reason }; });
}
/** The review record kept in the state (what the card shows): { at, total, right, fixes: [...] } */
export const reviewRecord = (batches, results, now = Date.now()) => { const all = results.flat(); return { at: now, total: all.length, right: all.filter((r) => r.ok).length, fixes: fixesOf(all, batches.flat()) }; };
