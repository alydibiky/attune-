/* ---- v9.3 (D2): keeps the two home-screen widgets up to date and applies the ticks made on them (widgets.js does the work). */
import { useEffect } from "react";
import { tr, dateLocale } from "./i18n.js";
import * as W from "./widgets.js";
import * as L from "./lists.js";
import * as Y from "./yourday.js";
import { loadDayset } from "./dayset.js";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";
import { safeToSpend } from "./safespend.js";
import { PRAYER_NAMES } from "./yourday-ui.jsx";

const MIND_TICKS = "attune:widget:mindticks";   // to-dos ticked on the widget, for Mind to mark done when Home opens
const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };

/** Mind's open to-dos as the last Home saw them (Home writes them; the widget never reads Mind's database itself). */
export const TODOS_SNAPSHOT = "attune:widget:todos";

let busy = false;   // saving the lists below fires "attune-lists", which would call this again: never twice at once
export function pushWidgets(N, now = Date.now()) {
  if (!N || !N.setTodoWidget || busy) return false;
  busy = true;
  try {
    // 1. the ticks made on the home screen since last time (taken first, so they are applied once)
    const ticks = JSON.parse((N.widgetTicks && N.widgetTicks()) || "[]");
    if (ticks.length) {
      N.clearWidgetTicks && N.clearWidgetTicks();
      const r = W.applyTicks(ticks, { reminders: loadReminders(), lists: L.loadLists(), now });
      saveReminders(r.reminders); try { syncToPhone(N, r.reminders); } catch (e) {}
      L.saveLists(r.lists);
      if (r.mind.length) try { localStorage.setItem(MIND_TICKS, JSON.stringify([...new Set([...j(MIND_TICKS, []), ...r.mind])])); window.dispatchEvent(new CustomEvent("attune-widget-mind")); } catch (e) {}
    }
    // 2. what they show now
    const ds = loadDayset();
    const prayers = ds.prayers ? Y.prayersToday(j("attune:prayer:v1", {}).city || "cairo", now) : null;
    let safe = null;
    if (ds.widgetMoney) { const ledger = j("ledger.v3", null); if (ledger && (ledger.accounts || []).length) { const s = safeToSpend({ ledger, life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }), now }); if (s) safe = { today: s.today != null ? s.today : s.perDay, cur: s.cur }; } }
    const names = Object.fromEntries(Object.entries(PRAYER_NAMES).map(([k, v]) => [k, tr(v)]));
    const todos = j(TODOS_SNAPSHOT, []).filter((x) => !j(MIND_TICKS, []).includes(x.id));
    N.setTodoWidget(JSON.stringify(W.todoWidgetData({ reminders: loadReminders(), todos, prayers, safe, now, t: tr, loc: dateLocale(), names })));
    N.setListWidget && N.setListWidget(JSON.stringify(W.listWidgetData(L.loadLists(), localStorage.getItem(W.PIN_KEY) || "", { now, t: tr })));
    return true;
  } catch (e) { return false; }
  finally { busy = false; }
}

/** Mounted once (App): on start, when the app comes back to the front, when lists / reminders / Your day change, and every 5 minutes. */
export function useWidgets() {
  useEffect(() => {
    const N = typeof window !== "undefined" ? window.AttuneNative : null; if (!N || !N.setTodoWidget) return;
    const go = () => pushWidgets(N);
    const vis = () => { if (document.visibilityState === "visible") go(); };
    const t0 = setTimeout(go, 1500), t = setInterval(go, 300000);
    window.addEventListener("attune-lists", go); window.addEventListener("attune-dayset", go); document.addEventListener("visibilitychange", vis);
    return () => { clearTimeout(t0); clearInterval(t); window.removeEventListener("attune-lists", go); window.removeEventListener("attune-dayset", go); document.removeEventListener("visibilitychange", vis); };
  }, []);
}
/** Home: the open to-dos for the widget, and the widget's ticks applied to Mind (Home has Mind's update). */
export function widgetTodos(records, update) {
  try {
    const open = (records || []).filter((r) => r && r.meta && r.meta.todo && !r.meta.done).slice(0, 8).map((r) => ({ id: r.id, title: String(r.title || r.text || "").slice(0, 80), meta: { todo: true } }));
    localStorage.setItem(TODOS_SNAPSHOT, JSON.stringify(open));
    const ticks = j(MIND_TICKS, []);
    if (ticks.length && update) { for (const id of ticks) update(id, (r) => ({ ...r, meta: { ...(r.meta || {}), done: true, doneAt: Date.now() } })); localStorage.removeItem(MIND_TICKS); }
  } catch (e) {}
}
