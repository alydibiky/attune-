// v9.9.15 (Ali, 10 Nov 2026: "test 10000 scenarios of everything you can write in chat and evaluate what needs improvement").
// A mirror of the ORDER Chat and the Home box decide in (chat.jsx ask → attune.jsx doFromHome), built from the app's own readers —
// no model, no browser. classify(text) → the first thing the app would do with the sentence:
//   money · life (a debt / instalment / subscription…) · reminder · deadline · agent · calc · money-ask · todo · list · note · open ·
//   teach · automation · alert · mission · table · email · confirm (asks "Save this?" / "Which did you mean?") · ask:<kind> (answers
//   from the person's own data) · chat (goes to the AI)
// It is a mirror, so a result here is a strong hint, not proof — every miss found is checked in the real app before it is "fixed".
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
import { understand, doSure, strictCheck } from "../../web-src/doit.js";
import * as UND from "../../web-src/understand.js";
import { route as cmdRoute } from "../../web-src/cmdrun.js";
import { looksLikeAction, quickAction } from "../../web-src/actions.js";
import { parsePayment } from "../../web-src/yusr/paytext.js";
import { payOpts, homeCurrency } from "../../web-src/locale.js";
import { myMoneyIntent } from "../../web-src/myledger.js";
import { looksLikeCalc, calculate } from "../../web-src/calc.js";
import { planTask } from "../../web-src/agent.js";
import { chatDeadlineIntent } from "../../web-src/deadlines.js";
import { chatLifeIntent } from "../../web-src/life.js";
import { parseAgent } from "../../web-src/agents.js";
import { parseAutomation } from "../../web-src/autom.js";
import { parseWatch } from "../../web-src/watch.js";
import { parseMission } from "../../web-src/missions.js";
import { looksLikeGoal } from "../../web-src/scout.js";
import { metroAsk } from "../../web-src/metro.js";
import * as NT from "../../web-src/noteteach.js";
import * as AL from "../../web-src/applinks.js";
import * as WT from "../../web-src/webtask.js";
import * as TBL from "../../web-src/tables.js";
import * as HG from "../../web-src/haggle.js";
import { missingAmounts } from "../../web-src/numguard.js";
import { directionsOf } from "../../web-src/gomaps.js";
import { typedPayment, numWords } from "../../web-src/sense.js";
export { understand, quickAction, calculate, parseAgent, UND, missingAmounts };
const DO_HERE = ["teach", "lifeEdit", "money", "food", "water", "weight", "workout", "dose", "sugar", "bp", "sleep", "repay", "pot", "family"];
const T = (f, d = null) => { try { return f(); } catch (e) { return d; } };
export function setCountry(c) { localStorage.setItem("attune:country", c); }

function doFromHome(text0, now) {
  let text = text0;
  if (UND.looksFranco(text0)) { const a = UND.francoToArabic(text0); const u = T(() => understand(a, { now, stores: {} })); if (u && a !== text0 && (u.ask || u.actions.length)) text = a; }
  const teachFirst = T(() => { const tx = NT.readTeach(text, { items: [] }); return !!(tx && (tx.kind === "rule" || (tx.kind === "ask" && tx.needRole != null))); }, false);
  if (T(() => TBL.parseTrack(text))) return { k: "table" };
  if (!teachFirst && T(() => AL.readOpen(text))) return { k: "open" };
  if (T(() => metroAsk(text))) return { k: "metro" };
  if (T(() => parseAutomation(text))) return { k: "automation" };
  if (!teachFirst && T(() => parseWatch(text))) return { k: "alert" };
  { const pm = T(() => parseMission(text, now)); if (pm && pm.deadline) return { k: "mission" }; }
  if (T(() => HG.parseHaggle(text))) return { k: "agent", sub: "haggle" };
  { const ag = teachFirst ? null : T(() => parseAgent(text, { now, country: "EG", usual: {}, prefs: {} })); if (ag && ["watch", "track", "order", "buy"].includes(ag.kind)) return { k: "agent", sub: ag.kind, ag }; }
  if (!teachFirst && T(() => WT.readWebTask(text, now))) return { k: "agent", sub: "web" };
  if (!teachFirst && T(() => looksLikeGoal(text))) return { k: "agent", sub: "scout" };
  const u = T(() => understand(text, { now, stores: {} }), { actions: [] });
  if (u.ask) return { k: "ask:" + (u.ask.kind || ""), u };
  if (!u.actions.length) return null;
  const miss = T(() => missingAmounts(text, u.actions), []);
  if (miss.length) return { k: "guard", u, miss };
  if (T(() => strictCheck(text, u, { now, stores: {} }))) return { k: "confirm", u };
  const kinds = u.actions.map((a) => a.kind);
  return { k: kinds.includes("money") ? "money" : kinds[0] === "life" ? "life" : kinds[0], u, kinds };
}

export function classify(typed0, { now = Date.parse("2026-11-10T12:00:00"), both = false } = {}) {
  let typed = String(typed0 || "").trim();
  // Chat first: what Mind does by code (to-dos, lists, where things are, a note, an email)
  { const det = (text) => { const u = T(() => understand(text, { now, stores: {} }), { actions: [] }); const doActions = (u.actions || []).filter((a) => a.kind !== "note").length;
      const pm = T(() => parseMission(text, now)); const ag = T(() => parseAgent(text, { now, country: "EG", usual: {}, prefs: {} }));
      const agent = ag && ["buy", "order", "watch", "track"].includes(ag.kind) ? ag.kind : "";
      let teach = T(() => { const tx = NT.readTeach(text, { items: [] }); return !!(tx && (tx.kind === "rule" || (tx.kind === "who" && text.split(/\s+/).length <= 7))); }, false);
      if (!teach && T(() => AL.readOpen(text))) teach = true; if (!teach && !agent && T(() => WT.readWebTask(text))) teach = true; if (!teach && T(() => TBL.parseTrack(text))) teach = true;
      if (teach) return { doActions: Math.max(1, doActions), teach: true };
      return { doActions, goal: T(() => looksLikeGoal(text), false), metro: !!T(() => metroAsk(text)), automation: !!T(() => parseAutomation(text)), watch: !!T(() => parseWatch(text)), mission: !!(pm && pm.deadline), agent }; };
    const o = T(() => cmdRoute(typed, { api: { detect: det, records: () => [] }, prefs: {} }));
    if (o) { const m = { list: "list", todoAdd: "todo", todos: "todo", whereSave: "where", confirm: "where", rememberNote: "note", found: "find", email: "email", projectTask: "todo" }[o.type];
      if (m && !(o.type === "email")) return { k: m }; if (o.type === "email") return { k: "email" };
      if (o.type === "lines" && o.lines[0] && (o.lines[0].open === "memory" || /where|فين/i.test(typed))) return { k: "where" }; } }
  if (UND.looksFranco(typed)) { const arT = UND.francoToArabic(typed);
    if (arT !== typed && (T(() => looksLikeAction(arT)) || T(() => understand(arT, { now, stores: {} }).actions.length) || T(() => myMoneyIntent(arT)) || T(() => chatLifeIntent(arT)) || T(() => chatDeadlineIntent(arT, { now, home: homeCurrency(), order: "dmy" })))) typed = arT; }
  // chat.jsx (v9.9.17): number words → digits when the sentence is then something the app does; two orders → both done by Home's reader
  { const nw = numWords(typed); if (nw !== typed && (T(() => typedPayment(nw, { now, ...payOpts() }), null) || {}).ok || (nw !== typed && (T(() => understand(nw, { now, stores: {} }).actions.length) || T(() => chatLifeIntent(nw))))) typed = nw; }
  { const u2 = T(() => understand(typed, { now, stores: {} })); if (u2 && u2.two) { const rem = u2.actions.find((a) => a.kind === "reminder"), mon = u2.actions.filter((a) => a.kind === "money").flatMap((a) => (a.items || []).map((i) => i.amount));
      return { k: both ? "both" : "money", u: u2, parts: { money: mon, at: rem.action.at, title: rem.action.title } }; } }
  const q = /[?؟]\s*$/.test(typed);
  const pay0 = T(() => typedPayment(typed, { now, ...payOpts() }));
  const dkOf = (t) => T(() => { const u = understand(t, { now, stores: {} }); return u.ask ? [] : u.actions.map((a) => a.kind); }, []);
  const dk = dkOf(typed);
  const flags = { action: !!T(() => looksLikeAction(typed)), "money-log": !!((pay0 && pay0.ok) || dk.some((k) => DO_HERE.includes(k))) && !q, "money-ask": !!T(() => myMoneyIntent(typed)),
    calc: !!T(() => looksLikeCalc(typed)), agent: !!T(() => planTask(typed, { now, order: "dmy", country: "EG", homeAirport: "CAI" })),
    deadline: !!T(() => chatDeadlineIntent(typed, { now, home: homeCurrency(), order: "dmy" })), life: !!T(() => chatLifeIntent(typed)) };
  const sig = UND.signalsOf(typed, flags), fl = new Set(Object.entries(flags).filter(([k, v]) => v && sig.has(k)).map(([k]) => k));
  const d = UND.decide(sig, typed, {}, fl);
  const only = d.unsure ? d.fallback : d.pick, unsure = d.unsure;
  const ok = (k) => !only || only === k;
  const R = (k, x = {}) => ({ k, only, unsure, cands: d.candidates, ...x });
  if (T(() => directionsOf(typed))) return R("map");
  { const ag = q ? null : T(() => parseAgent(typed, { now, country: "EG", usual: {}, prefs: {} }));   // chat.jsx agentK (v9.9.15)
    if (ag && ["watch", "track", "order", "buy"].includes(ag.kind) && (!only || only === "agent" || only === "money-log")) return R("agent", { sub: ag.kind, ag }); }
  if (pay0 && pay0.ok && typed.length < 600 && !q && ok("money-log")) return R("money", { via: "pay", pay: pay0 });
  if (T(() => AL.pageOf(typed))) return R("open");
  if (!only || only === "action") { if (T(() => AL.readOpen(typed))) return R("open"); }
  if (!only || only === "money-log") {
    if (dk.length && dk.every((k) => DO_HERE.includes(k)) && !T(() => doSure(typed, { now, stores: {} }), true)) return R("confirm", { via: "which" });
    if (dk.length && dk.every((k) => DO_HERE.includes(k))) { const r = doFromHome(typed, now); if (r) return R(r.k, r); }
  }
  if (looksLikeCalc(typed) && ok("calc")) return R("calc");
  if ((T(() => myMoneyIntent(typed)) || only === "money-ask") && ok("money-ask")) return R("money-ask");
  if (ok("agent") && flags.agent) return R("agent", { sub: "card" });
  if (ok("deadline") && flags.deadline) return R("deadline");
  if (ok("life") && flags.life) return R("life");
  if (only === "action" || (ok("action") && flags.action)) return R("reminder");
  // what is left of the Home reader (agents, alerts, missions…) — Chat reaches it through its own "do" card
  if (!only || only === "agent") { const r = doFromHome(typed, now); if (r && !["money", "confirm", "guard"].includes(r.k) && !/^ask:/.test(r.k) && !(q && r.k === "agent")) return R(r.k, r); if (r && /^ask:/.test(r.k)) return R(r.k, r); }
  return R("chat");
}
