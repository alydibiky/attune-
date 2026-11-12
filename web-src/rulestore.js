/* ---- v9.9.18 AU1 the rule store and runner (Ali OK'd the combined screen: say it → the When / If / Do card → or a question).
   A rule read by rules.js is saved here and handed to the engine that already runs that kind of trigger on the phone:
     time → a repeating reminder (Reminders.kt) · money arriving → an automation (AutoRules.kt, autom.js) · a message / call from
     someone → a message alert (watch.js). Arriving / leaving a place, Bluetooth, Wi-Fi and charging are saved and shown as
     "needs the phone part" until those listeners exist — never shown as working when they are not. Words: tr() in 20 languages.
   Tests: tests/unit/v9918rulestore.test.mjs + the browser test.                                                                 */
import { tr } from "./i18n.js";
import { loadDir } from "./entities.js";
import { loadAuto, saveAuto, addRule } from "./autom.js";
import { loadWatch, saveWatch, newRule } from "./watch.js";

export const RULES_KEY = "attune:rules:v1", DRAFT_KEY = "attune:rules:draft", PLACES_KEY = "attune:places:v1", DEVICES_KEY = "attune:btdevices:v1";
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const loadRules = () => get(RULES_KEY, []);
export const saveRules = (l) => (put(RULES_KEY, l), l);
export const loadDraft = () => get(DRAFT_KEY, null);
export const saveDraft = (d) => { if (d) put(DRAFT_KEY, d); else { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} } return d; };
/** The person's own names, for rules.js: people (People & plans directory, with roles), places, devices, funds, lists. */
export function ruleCtx() {
  const people = ((loadDir() || {}).items || []).filter((x) => x.kind === "person").map((p) => ({ id: p.id, name: p.name, aka: p.aka || [], role: p.role || null }));
  const pots = Object.keys((loadAuto() || {}).pots || {}).map((n) => ({ id: n, name: n }));
  return { people, places: get(PLACES_KEY, []), devices: get(DEVICES_KEY, []), pots };
}
const LIVE = new Set(["time", "money_in", "message", "call"]);
// the phone's money automations and message alerts can't check a condition yet ("on workdays", "before 11", "more than 1,000"),
// so a rule with one waits for the phone part instead of firing without it; a time rule's days are its own repeat (live)
export const isLive = (r) => !!(r && r.when && LIVE.has(r.when.type) && (r.when.type === "time" || !(r.if || []).length));
const nameOf = (list, id) => ((list || []).find((x) => x.id === id) || {}).name || id || "";
const hhmm = (at) => (at ? String(at.h).padStart(2, "0") + ":" + String(at.m).padStart(2, "0") : "");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The rule in the person's language: { when, ifs: [line], dos: [line] } */
export function ruleLines(r, ctx = ruleCtx()) {
  const w = r.when || {}, P = (id) => nameOf(ctx.people, id), when =
    w.type === "time" ? (w.monthly ? tr("On the {n} of each month at {t}", { n: w.dom || 1, t: hhmm(w.at) }) : w.days && w.days.length ? tr("Every {d} at {t}", { d: w.days.map((d) => tr(DAYS[d])).join(", "), t: hhmm(w.at) }) : tr("Every day at {t}", { t: hhmm(w.at) }))
    : w.type === "arrive" ? tr("You arrive at {p}", { p: nameOf(ctx.places, w.place) || "?" }) : w.type === "leave" ? tr("You leave {p}", { p: nameOf(ctx.places, w.place) || "?" })
    : w.type === "bluetooth" ? tr("You connect to {d}", { d: nameOf(ctx.devices, w.device) || tr("your car") }) : w.type === "wifi" ? tr("You join Wi-Fi") : w.type === "charging" ? tr("You start charging")
    : w.type === "money_in" ? (w.what === "salary" ? tr("Your salary arrives") : w.who ? tr("{n} sends you money", { n: P(w.who) }) : tr("Money arrives"))
    : w.type === "money_out" ? tr("You pay") : w.type === "message" ? tr("{n} messages you", { n: P(w.who) || "?" }) : w.type === "call" ? tr("{n} calls you", { n: P(w.who) || "?" }) : w.type === "notification" ? tr("An app notifies you") : "?";
  const ifs = (r.if || []).map((x) => (x.type === "weekdays" ? tr("On workdays") : x.type === "weekend" ? tr("On the weekend") : x.type === "before" ? tr("Before {t}", { t: hhmm(x.at) }) : x.type === "after" ? tr("After {t}", { t: hhmm(x.at) })
    : x.type === "more" ? tr("More than {n}", { n: (+x.amount).toLocaleString() }) : x.type === "less" ? tr("Less than {n}", { n: (+x.amount).toLocaleString() }) : x.type));
  const dos = (r.do || []).map((d) => (d.type === "remind" ? tr("Remind you: {x}", { x: d.text || "" }) : d.type === "tell" ? tr("Tell you") : d.type === "read" ? tr("Read today's to-dos aloud") : d.type === "show" ? tr("Show your list")
    : d.type === "list_add" ? tr("Add to your list: {x}", { x: (d.items || []).join(", ") }) : d.type === "todo_add" ? tr("Add a to-do: {x}", { x: d.text || "" }) : d.type === "log" ? tr("Log it in Money")
    : d.type === "pot" ? (d.pct === 100 ? tr("Put all of it in {f}", { f: d.pot || "?" }) : d.pct != null ? tr("Put {p}% in {f}", { p: d.pct, f: d.pot || "?" }) : tr("Put {n} in {f}", { n: (+d.amount).toLocaleString(), f: d.pot || "?" }))
    : d.type === "open" ? tr("Open {a}", { a: d.app }) : d.type === "call" ? tr("Call {n}", { n: P(d.who) }) : d.type === "message" ? tr("Message {n}", { n: P(d.who) }) + (d.text ? ": " + d.text : "")
    : d.type === "silent" ? tr("Silence the phone") : d.type === "timer" ? tr("Start a {m}-minute timer", { m: d.minutes || "?" }) : d.type));
  return { when, ifs, dos };
}
/** The questions in the person's language, with their choices as [value, label]. */
export function questions(r, ctx = ruleCtx()) {
  return (r.ask || []).map((a) => ({ field: a.field, q: tr(a.q, a.v), choices: (a.choices || []).map((c) => [c,
    a.field === "who" ? (c === "anyone" ? tr("Anyone") : nameOf(ctx.people, c)) : a.field === "place" ? (c === "new" ? tr("A new place") : nameOf(ctx.places, c)) : a.field === "pot" ? (c === "new" ? tr("A new fund") : c)
    : a.field === "device" ? nameOf(ctx.devices, c) : a.field === "when" ? tr({ time: "At a time", arrive: "Arriving at a place", leave: "Leaving a place", bluetooth: "A Bluetooth device", charging: "Charging", money_in: "Money arrives", message: "A message", call: "A call" }[c] || c)
    : a.field === "do" ? tr({ remind: "Remind me", tell: "Tell me", list_add: "Add to a list", pot: "Put money in a fund", read: "Read my to-dos", silent: "Silence the phone", open: "Open an app" }[c] || c) : a.field === "minutes" ? tr("{m} min", { m: c }) : String(c)]) }));
}
/** The person answered a question → the rule with that answer in it (and one question fewer). */
export function answer(r, field, value) {
  const n = JSON.parse(JSON.stringify(r)); n.ask = (n.ask || []).filter((a) => a.field !== field);
  if (field === "who" && n.when) n.when.who = value === "anyone" ? null : value;
  else if (field === "place" && n.when) n.when.place = value; else if (field === "device" && n.when) n.when.device = value;
  else if (field === "pot") (n.do || []).forEach((d) => { if (d.type === "pot") d.pot = value; });
  else if (field === "minutes") (n.do || []).forEach((d) => { if (d.type === "timer") d.minutes = +value; });
  else if (field === "when") n.when = { type: value, ...(value === "time" ? { at: { h: 9, m: 0 } } : {}) };
  else if (field === "do") n.do = [{ type: value }];
  else if (field === "at" && n.when) { const [h, m] = String(value).split(":").map(Number); n.when.at = { h, m }; }
  return n;
}
// v9.9.23: two rules saved in the same millisecond ("Switch on 2" on a recipe) got the same id, so the second reminder replaced the first
let lastMs = -1, seq = 0;
export function ruleId(now = Date.now()) { if (now === lastMs) seq++; else { lastMs = now; seq = 0; } return "r" + now.toString(36) + (seq ? "-" + seq : ""); }
/** Save + hand it to the engine that runs it. hooks: { schedule(reminder), native, lang } → the saved rule */
export function saveRule(r, { schedule, native, lang = "en", now = Date.now() } = {}) {
  const ctx = ruleCtx(), id = ruleId(now), lines = ruleLines(r, ctx), rule = { ...r, id, on: true, created: now, live: isLive(r), engine: null };
  const w = r.when || {}, firstDo = (r.do || [])[0] || {};
  try {
    if (!rule.live) {} else
    if (w.type === "time" && schedule) {
      const d = new Date(now); d.setHours(w.at ? w.at.h : 9, w.at ? w.at.m : 0, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1);
      if (w.days && w.days.length) while (!w.days.includes(d.getDay())) d.setDate(d.getDate() + 1);
      if (w.monthly) { d.setDate(w.dom || 1); if (d.getTime() <= now) d.setMonth(d.getMonth() + 1); }
      // v9.9.18 AU3: a rule may start later (from), end (until — Ramadan's month) or ring once (a trip's packing day)
      if (w.from && w.from > d.getTime()) { const f = new Date(w.from); f.setHours(d.getHours(), d.getMinutes(), 0, 0); d.setTime(f.getTime()); }
      const repeat = w.once ? "none" : w.monthly ? "monthly" : w.days && w.days.length ? (w.days.length === 1 ? "weekly" : "days:" + [...w.days].sort().join(",")) : "daily";
      schedule({ id: "rule-" + id, at: d.getTime(), title: r.title || lines.dos.join(" · ") || lines.when, body: lines.when, repeat, ...(w.until ? { until: w.until } : {}), created: now, source: "rule" }); rule.engine = "reminder:rule-" + id;
    } else if (w.type === "money_in") {
      const pot = (r.do || []).find((x) => x.type === "pot");
      const words = w.what === "salary" ? ["salary", "payroll", "مرتب", "راتب"] : w.who ? [nameOf(ctx.people, w.who)].filter(Boolean) : ["transfer", "تحويل"];
      const p = { words, pct: pot ? (pot.pct != null ? pot.pct : 0) : 0, fixed: pot && pot.amount ? pot.amount : 0, pot: pot ? pot.pot || tr("Savings") : tr("Savings"), tell: true, dir: "in", text: r.text, trigger: lines.when };
      if (pot) { const st = addRule(loadAuto(), p, now); saveAuto(st, native, lang); rule.engine = "auto:" + st.rules[st.rules.length - 1].id; }
      else { const wr = newRule({ who: words, app: "any", words: [], once: false, label: r.text }, now); saveWatch([wr, ...loadWatch()], lang); rule.engine = "watch:" + wr.id; }
    } else if ((w.type === "message" || w.type === "call") && w.who) {
      const wr = newRule({ who: [nameOf(ctx.people, w.who)], app: w.app && w.app !== "any" ? w.app : "any", words: [], once: false, label: r.text }, now); saveWatch([wr, ...loadWatch()], lang); rule.engine = "watch:" + wr.id;
    }
  } catch (e) {}
  saveRules([rule, ...loadRules()]);
  return rule;
}
/** Off / delete: the engine's own entry goes too. */
export function removeRule(id, { unschedule, native, lang = "en" } = {}) {
  const r = loadRules().find((x) => x.id === id); saveRules(loadRules().filter((x) => x.id !== id)); if (!r || !r.engine) return;
  const [k, eid] = [r.engine.split(":")[0], r.engine.slice(r.engine.indexOf(":") + 1)];
  try { if (k === "reminder" && unschedule) unschedule(eid); else if (k === "auto") { const s = loadAuto(); saveAuto({ ...s, rules: s.rules.filter((x) => x.id !== eid) }, native, lang); } else if (k === "watch") saveWatch(loadWatch().filter((x) => x.id !== eid), lang); } catch (e) {}
}
import { parseRule } from "./rules.js";
/** A sentence that should open the rule card: a rule whose trigger isn't just a time with a reminder (those stay reminders). */
export function ruleFor(text, ctx = ruleCtx()) {
  let r = null; try { r = parseRule(text, ctx); } catch (e) { return null; }
  if (!r || (!r.when && !(r.ask || []).length)) return null;
  if (!r.cond || /[?؟]\s*$/.test(String(text || ""))) return null;   // only a sentence that starts like a condition ("when …", «لما …», "every …", 「…たら」), never a question
  if (r.when && r.when.type === "time" && (r.do || []).every((d) => d.type === "remind" || d.type === "tell")) return null;
  return r;
}
