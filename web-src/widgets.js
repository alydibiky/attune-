/* ---- v9.3 (Ali picked D2 — "do all and make people choose"): what the two home-screen widgets show, and the ticks made on them.
   · Attune · To-dos: today's reminders (late first) and open to-dos, the next prayer (only when prayer times are on), safe to spend
     today (only when Settings → Your day → "Safe to spend on the Today widget" is on);
   · Attune · A list: the list pinned from To-dos & lists ("Pin to the widget").
   Pure (the strings come in through `t`); the phone draws it (TodoWidget.kt). Tests: tests/unit/v930widgets.test.mjs. */
import * as L from "./lists.js";

export const PIN_KEY = "attune:lists:widget";   // the id of the list on the "A list" widget
const timeOf = (t, loc) => { try { return new Date(t).toLocaleTimeString(loc || undefined, { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

/** The To-dos widget. reminders: the app's reminders; todos: Mind to-dos ({ id, title|text, meta }); prayers: Y.prayersToday() or null;
 *  safe: { today, cur } or null. → { title, side, rows: [{ id, kind: "rem"|"todo", text, sub }], foot, empty } */
export function todoWidgetData({ reminders = [], todos = [], prayers = null, safe = null, now = Date.now(), t = (s) => s, loc = "", names = {} } = {}) {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const rem = reminders.filter((r) => r && !r.done && r.at && r.at <= end.getTime() && (r.at >= now || ((!r.repeat || r.repeat === "none") && r.at >= now - 3 * 864e5)))
    .sort((a, b) => a.at - b.at)
    .map((r) => ({ id: String(r.id), kind: "rem", text: String(r.title || "").slice(0, 80), sub: r.at < now ? t("late") : timeOf(r.at, loc) }));
  const td = todos.filter((r) => r && r.meta && r.meta.todo && !r.meta.done).map((r) => ({ id: String(r.id), kind: "todo", text: String(r.title || r.text || "").slice(0, 80), sub: "" }));
  const nx = prayers && prayers.next ? prayers.list.find((x) => x.k === prayers.next) : null;
  return {
    title: t("To-dos") + (rem.length + td.length ? " · " + t("{n} left").replace("{n}", rem.length + td.length) : ""),
    side: nx ? (names[nx.k] || nx.k) + " " + nx.at : "",
    rows: [...rem, ...td].slice(0, 4),
    foot: safe && safe.today >= 0 ? t("Safe to spend today: {a}").replace("{a}", Math.round(safe.today).toLocaleString("en-US") + (safe.cur ? " " + safe.cur : "")) : "",
    empty: t("Nothing due today — open Attune to add a to-do"),
  };
}

/** The "A list" widget: the pinned list's round now (ticked items stay, ticked). */
export function listWidgetData(st, pinId, { now = Date.now(), t = (s) => s } = {}) {
  const l0 = (st && st.lists || []).find((x) => x.id === pinId);
  if (!l0) return { title: t("A list"), side: "", rows: [], empty: t("In Attune: To-dos & lists → open a list → Pin to the widget") };
  const l = L.current(l0, now), p = L.progress(l);
  const items = [...l.items.filter((x) => !x.done), ...l.items.filter((x) => x.done)].slice(0, 5);
  return { title: (l.emoji ? l.emoji + " " : "") + l.name, side: t("{a} of {b}").replace("{a}", p.done).replace("{b}", p.of),
    rows: items.map((x) => ({ id: l.id + "|" + x.id, kind: "list", text: String(x.text).slice(0, 80), done: !!x.done })), empty: t("Every box is ticked") };
}

/** The ticks made on the widgets → applied: reminders done, list items ticked; Mind to-dos are returned (Mind marks them itself). */
export function applyTicks(ticks = [], { reminders = [], lists = { lists: [] }, now = Date.now() } = {}) {
  let rem = reminders, st = lists; const mind = [];
  for (const k of ticks || []) {
    if (!k || !k.id) continue;
    if (k.kind === "rem") rem = rem.map((r) => (String(r.id) === k.id && !r.done ? { ...r, done: true, doneAt: k.at || now } : r));
    else if (k.kind === "list") { const [lid, iid] = String(k.id).split("|"); const l = st.lists.find((x) => x.id === lid); if (l && l.items.some((x) => x.id === iid && !x.done)) st = L.tick(st, lid, iid, k.at || now); }
    else if (k.kind === "todo") mind.push(k.id);
  }
  return { reminders: rem, lists: st, mind };
}
