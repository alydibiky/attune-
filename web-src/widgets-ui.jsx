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
import * as W2 from "./widgets2.js";
import { loadCare, saveCare, dosesOn } from "./care.js";
import { loadAgents, saveAgents } from "./agents.js";
import { loadTrip } from "./travel.js";
import { loadDir } from "./entities.js";
import { datesOf } from "./b5-ui.jsx";
import { loadTheme } from "./spaces.js";
import { bankNow } from "./setup-ui.jsx";
import { addPaidNow, dismissPaid } from "./paylog-ui.jsx";
import { readNotification } from "./paylog.js";
import { payOpts } from "./locale.js";

const MIND_TICKS = "attune:widget:mindticks";   // to-dos ticked on the widget, for Mind to mark done when Home opens
const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };

/** Mind's open to-dos as the last Home saw them (Home writes them; the widget never reads Mind's database itself). */
export const TODOS_SNAPSHOT = "attune:widget:todos";

let busy = false;   // saving the lists below fires "attune-lists", which would call this again: never twice at once
export function pushWidgets(N, now = Date.now()) {
  if (!N || !(N.setTodoWidget || N.setWidgets) || busy) return false;
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
    // 1b. v10.5 the taps on the interactive widgets
    try { applyWidgetActs(N, now); } catch (e) {}
    // 2. what they show now
    const ds = loadDayset();
    const prayers = ds.prayers ? Y.prayersToday(j("attune:prayer:v1", {}).city || "cairo", now) : null;
    let safe = null;
    if (ds.widgetMoney) { const ledger = j("ledger.v3", null); if (ledger && (ledger.accounts || []).length) { const s = safeToSpend({ ledger, life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }), now }); if (s) safe = { today: s.today != null ? s.today : s.perDay, cur: s.cur }; } }
    const names = Object.fromEntries(Object.entries(PRAYER_NAMES).map(([k, v]) => [k, tr(v)]));
    const todos = j(TODOS_SNAPSHOT, []).filter((x) => !j(MIND_TICKS, []).includes(x.id));
    N.setTodoWidget && N.setTodoWidget(JSON.stringify(W.todoWidgetData({ reminders: loadReminders(), todos, prayers, safe, now, t: tr, loc: dateLocale(), names })));
    N.setListWidget && N.setListWidget(JSON.stringify(W.listWidgetData(L.loadLists(), localStorage.getItem(W.PIN_KEY) || "", { now, t: tr })));
    if (N.setWidgets) pushWidgets2(N, now, { todos, safe: (() => { const ledger = j("ledger.v3", null); if (!ledger || !(ledger.accounts || []).length) return null; try { return safeToSpend({ ledger, life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }), now }); } catch (e) { return null; } })() });
    return true;
  } catch (e) { return false; }
  finally { busy = false; }
}

/* ---- v10.5 the interactive widgets (Ali OK'd OK-A1 OK-W1 OK-W2 OK-W3 OK-W5 OK-W6 OK-W7 OK-S): the taps made on the home screen are
   applied once each (widgets2.js applyActs), then every widget gets what it shows now (AttuneWidgets.kt draws it). */
const ACTS_SEEN = "attune:widget:acts-seen";
export function applyWidgetActs(N, now = Date.now()) {
  let acts = []; try { acts = JSON.parse((N && N.widgetActs && N.widgetActs()) || "[]"); } catch (e) { acts = []; }
  if (!acts.length) return 0;
  const r = W2.applyActs(acts, { reminders: loadReminders(), lists: L.loadLists(), life: j("attune:life:v1", { items: [] }), care: loadCare(), agents: loadAgents() }, { now, seen: j(ACTS_SEEN, []), t: tr });
  const st = r.stores;
  if (st.reminders || r.schedule.length) {
    let list = st.reminders || loadReminders();
    for (const x of r.schedule) list = [...list.filter((y) => y.id !== x.id), x];
    saveReminders(list); try { syncToPhone(N, list); } catch (e) {}
  }
  if (st.lists) L.saveLists(st.lists);
  if (st.life) try { localStorage.setItem("attune:life:v1", JSON.stringify(st.life)); } catch (e) {}
  if (st.care) saveCare(st.care);
  if (st.agents) saveAgents(st.agents);
  if (r.mind.length) try { localStorage.setItem(MIND_TICKS, JSON.stringify([...new Set([...j(MIND_TICKS, []), ...r.mind])])); window.dispatchEvent(new CustomEvent("attune-widget-mind")); } catch (e) {}
  // the bank SMS: Add ✓ / ✕ on the Money widget — the same as the bank step's "Add them to Money"
  if (r.bankAdd.length || r.bankDismiss.length) {
    let q = []; try { q = JSON.parse((N.payQueue && N.payQueue()) || "[]"); } catch (e) {}
    for (const id of r.bankAdd) { const n = q.find((x) => String(x.id) === id); const e = n ? readNotification(n, payOpts()) : null; if (e) addPaidNow(e, N); }
    for (const id of r.bankDismiss) dismissPaid({ id }, N);
  }
  try { localStorage.setItem(ACTS_SEEN, JSON.stringify([...j(ACTS_SEEN, []), ...r.done].slice(-400))); } catch (e) {}
  try { N.clearWidgetActs && N.clearWidgetActs(JSON.stringify(acts.map(W2.actKey))); } catch (e) {}
  try { window.dispatchEvent(new Event("attune:data-changed")); } catch (e) {}
  return r.done.length;
}
const WORDS = () => ({ left: tr("{n} left"), alldone: tr("All done ✓"), add: tr("+ Add"), clear: tr("Clear {n} ticked"), lists: tr("Lists"), nolists: tr("Make a list in Attune — it shows here"),
  emptylist: tr("Nothing on this list — + Add"), open: tr("Open Attune once — then this fills itself"), tell: tr("Tell Attune anything…"), looktitle: tr("The widget's look"),
  look_auto: tr("Follow Attune's Look"), look_s1: tr("Attune's colours"), look_s2: tr("Dark glass") });
/** Everything every widget shows now → N.setWidgets. */
export function widgetsData({ now = Date.now(), todos = [], safe = null, bank = null, salaryDay = 0, placeList = "" } = {}) {
  const t = tr, loc = dateLocale();
  const lists = W2.listsData(L.loadLists(), { now, t });
  const day = W2.dayCard({ reminders: loadReminders(), todos, life: j("attune:life:v1", { items: [] }), now, t, loc });
  const money = W2.moneyCard({ safe, pending: (bank && bank.state === "waiting" && bank.add) || [], salaryDay, t });
  const agSt = loadAgents(), agents = W2.agentsCard(agSt, { now, t });
  const care = loadCare(), med = W2.medCard(care, { now, t }), papers = W2.papersCard(j("attune:radar:v1", { items: [] }), { now, t });
  const trip = W2.tripCard(loadTrip(), { now, t }); let dates = []; try { dates = datesOf(loadDir()); } catch (e) {}
  const next = W2.nextCard(dates, { now, t });
  let medDueIn = null; try { const hhmm = (d) => { const x = new Date(d); return x.getHours() * 60 + x.getMinutes(); }; const n = dosesOn(care, now).find((x) => !x.taken); if (n) { const [h, m] = n.time.split(":").map(Number); medDueIn = h * 60 + m - hhmm(now); } } catch (e) {}
  const agentBetter = (agSt.agents || []).some((a) => { try { const c = (a.checks || []).filter((x) => x.price > 0); const last = c[c.length - 1]; return last && now - last.at < 12 * 36e5 && c.length > 1 && last.price < Math.min(...c.slice(0, -1).map((x) => x.price)); } catch (e) { return false; } });
  const stack = W2.stackData({ day, money, agents, med, papers, trip, next, lists }, { bankWaiting: !!(bank && bank.state === "waiting" && bank.add.length), medDueIn, agentBetter, placeList }, { now, t, spentToday: safe ? safe.spentToday || 0 : 0, left: day.rows.length });
  let look = "plain"; try { look = loadTheme().look === "glass" ? "glass" : "plain"; } catch (e) {}
  return { list: { lists }, day, money, agents, med, papers, trip, next, stack, words: WORDS(), look };
}
function pushWidgets2(N, now, { todos, safe }) {
  try {
    let bank = null; try { bank = bankNow(); } catch (e) {}
    const L3 = j("ledger.v3", {}), sal = ((L3.recurring || []).find((r) => r && r.type === "income" && r.cat === "salary") || {});
    const salaryDay = +(sal.day || (/^\d{4}-\d{2}-(\d{2})$/.exec(sal.nextDate || sal.next || sal.start || "") || [])[1] || 0) || 0;
    N.setWidgets(JSON.stringify(widgetsData({ now, todos, safe, bank, salaryDay })));
  } catch (e) {}
}

/** Mounted once (App): on start, when the app comes back to the front, when lists / reminders / Your day change, and every 5 minutes. */
export function useWidgets() {
  useEffect(() => {
    const N = typeof window !== "undefined" ? window.AttuneNative : null; if (!N || !(N.setTodoWidget || N.setWidgets)) return;
    const go = () => pushWidgets(N);
    let lt = 0; const later = () => { clearTimeout(lt); lt = setTimeout(go, 1200); };
    const vis = () => { if (document.visibilityState === "visible") go(); };
    const t0 = setTimeout(go, 1500), t = setInterval(go, 300000);
    window.addEventListener("attune-lists", go); window.addEventListener("attune-dayset", go); document.addEventListener("visibilitychange", vis);
    window.addEventListener("attune-widget-acts", go); window.addEventListener("attune:data-changed", later);   // v10.5: a tap on a widget, and anything saved, reaches the widgets
    return () => { clearTimeout(t0); clearInterval(t); clearTimeout(lt); window.removeEventListener("attune-lists", go); window.removeEventListener("attune-dayset", go); document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("attune-widget-acts", go); window.removeEventListener("attune:data-changed", later); };
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
