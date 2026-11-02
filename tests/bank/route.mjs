// v9.0 the sentence bank's router: the SAME readers Chat uses (chat.jsx ask): Franco → Arabic, the Home reader (doit.js), the
// readers' flags, the referee (understand.js). → { kind } when code decides, or { ask: [candidates], fallback } when the phone's
// model decides. Shared by tests/unit/v908bank.test.mjs and tools/accuracy.mjs so both measure the same thing.
import { looksLikeAction } from "../../web-src/actions.js";
import { myMoneyIntent } from "../../web-src/myledger.js";
import { parsePayment } from "../../web-src/yusr/paytext.js";
import { looksLikeCalc } from "../../web-src/calc.js";
import { chatDeadlineIntent } from "../../web-src/deadlines.js";
import { chatLifeIntent } from "../../web-src/life.js";
import { parseAgent } from "../../web-src/agents.js";
import { understand as doU } from "../../web-src/doit.js";
import { signalsOf, decide, looksFranco, francoToArabic } from "../../web-src/understand.js";
export const NOW = Date.parse("2026-11-02T20:00:00");
const DO_HERE = ["money", "food", "water", "weight", "workout", "dose", "sugar", "bp", "sleep", "repay", "pot", "family"];
export function route(t0, now = NOW) {
  let t = t0;
  if (looksFranco(t0)) { const a = francoToArabic(t0); if (a !== t0 && (looksLikeAction(a) || doU(a, { now }).actions.length || myMoneyIntent(a) || chatLifeIntent(a))) t = a; }
  const p = parsePayment(t, { now }), u = doU(t, { now }), dk = u.ask ? [] : u.actions.map((a) => a.kind);
  let ag = null; try { ag = parseAgent(t, { country: "EG", now }); } catch (e) {}
  const f = { action: !!looksLikeAction(t), "money-log": !!((p && p.ok) || dk.some((k) => DO_HERE.includes(k))) && !/[?؟]\s*$/.test(t), "money-ask": !!myMoneyIntent(t), calc: !!looksLikeCalc(t),
    agent: !!(ag && ["watch", "buy", "track", "order"].includes(ag.kind)), deadline: !!chatDeadlineIntent(t, { now, home: "EGP", order: "dmy" }), life: !!chatLifeIntent(t) };
  if (ag && ag.kind === "research") f.research = true;
  const sig = signalsOf(t, f), fl = new Set(Object.entries(f).filter(([k, v]) => v && sig.has(k)).map(([k]) => k)), d = decide(sig, t, {}, fl);
  return d.unsure ? { ask: d.candidates, fallback: d.fallback } : { kind: d.pick || "chat" };
}
/** right = code got it; model = only the model can get it (the right kind is among the candidates); wrong = it can't be right. */
export function grade(r, want) {
  if (r.kind) return r.kind === want ? "right" : "wrong";
  if (!r.ask.includes(want)) return "wrong";
  return r.fallback === want || (want === "chat" && !r.fallback) ? "right" : "model";
}
