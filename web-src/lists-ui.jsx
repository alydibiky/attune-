/* ---- v9.2 To-dos & lists (Ali, 4 Nov 2026, picked 1A + "there also should be a part where I add my list and choose whether it is
   recurring or not, and it should be clear and visible"):
   · HomeTodo — Home's "To do" card: late reminders (red) and today's, the open to-dos, and every list that is needed today (its own
     card, ticks in place). "+ Add" and "Lists" are on the card itself.
   · ListsPage — the page: the to-dos, then the lists, each with WHEN it comes back written on it; "+ New list" opens a clear editor:
     name, the items, and "Does it repeat?" — No · Every day · Every week (which days) · Every month (which day) · Before a date (a trip).
   The rules (when a list is needed, new rounds start empty): lists.js. Tests: tests/unit/v922lists.test.mjs, tests/e2e_v922lists.py. */
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Check, Trash2, ChevronRight, Repeat, X, ListChecks, CalendarDays } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as L from "./lists.js";
import { loadReminders, saveReminders } from "./actions.js";
import * as U from "./ui-kit.jsx";
import { YourDay } from "./yourday-ui.jsx";
import { PIN_KEY } from "./widgets.js";
import { widgetTodos } from "./widgets-ui.jsx";

const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WD_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const fmtDay = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };
/** A line from lists.js ({ en, v }) in the person's language: dates and weekdays shown their way. */
export const lineText = (x) => { if (!x) return ""; const v = { ...(x.v || {}) };
  if (v.date) v.d = fmtDay(v.date); if (Array.isArray(v.d)) v.d = v.d.map((d) => tr(d)).join(getLang() === "ar" ? " و" : ", ");
  return tr(x.en, v); };

export function useLists() {
  const [st, setSt] = useState(() => L.refresh(L.loadLists()));
  useEffect(() => { const on = () => setSt(L.refresh(L.loadLists())); window.addEventListener("attune-lists", on); window.addEventListener("storage", on);
    return () => { window.removeEventListener("attune-lists", on); window.removeEventListener("storage", on); }; }, []);
  const put = (next) => { setSt(next); L.saveLists(next); return next; };
  return [st, put];
}
/** Reminders that are late (not done, time passed in the last 3 days) or still to come today. */
export function todayReminders(now = Date.now()) {
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  return loadReminders().filter((r) => r && !r.done && r.at && r.at <= end.getTime() && (r.at >= now || ((!r.repeat || r.repeat === "none") && r.at >= now - 3 * 86400000)))
    .sort((a, b) => a.at - b.at).map((r) => ({ ...r, late: r.at < now }));
}
const markReminderDone = (id) => { saveReminders(loadReminders().map((r) => (r.id === id ? { ...r, done: true, doneAt: Date.now() } : r))); window.dispatchEvent(new CustomEvent("attune-lists")); };
const timeOf = (t) => { try { return new Date(t).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

const Box = ({ on, onClick, label, testid, tone }) => <button onClick={onClick} aria-pressed={!!on} className="w-full min-h-[44px] flex items-center gap-2.5 text-start" data-testid={testid}>
  <span className="w-5 h-5 rounded-md shrink-0 grid place-items-center" style={{ border: "2px solid " + (tone === "bad" ? "var(--c-neg)" : "var(--c-acc)"), background: on ? "var(--c-acc)" : "transparent" }}>{on ? <Check size={13} color="#fff" strokeWidth={3} /> : null}</span>
  <span className={"flex-1 min-w-0 text-[14px] " + (on ? "line-through c-sub" : "")} dir="auto">{label}</span></button>;

/** One list with its ticks — on Home, in Chat's answer and on the page. */
export function ListCard({ list, onTick, onOpen, compact = false, testid = "list-card" }) {
  const p = L.progress(list), w = L.whenLine(list);
  return <div className="c-card space-y-1.5" style={{ borderColor: "var(--c-acc)" }} data-testid={testid}>
    <div className="flex items-center gap-2">
      <span className="text-[12px] font-extrabold tracking-wide c-acc flex-1 min-w-0 truncate"><span className="uppercase">{tr("List")}</span> · <span dir="auto">{list.emoji} {list.name}</span></span>
      <span className="text-[12px] c-sub shrink-0">{lineText(w)}</span></div>
    <b className="block text-[15px]">{tr("{a} of {b} done", { a: p.done, b: p.of })}</b>
    <div className="c-bar" aria-hidden="true"><i style={{ width: (p.of ? Math.round(p.done / p.of * 100) : 0) + "%" }} /></div>
    {(compact ? list.items.filter((x) => !x.done).slice(0, 4) : list.items).map((x) => <Box key={x.id} on={x.done} onClick={() => onTick(list, x)} label={x.text} testid="list-item" />)}
    {compact && list.items.filter((x) => !x.done).length > 4 ? <p className="m-0 text-[12.5px] c-sub">{tr("+{n} more", { n: list.items.filter((x) => !x.done).length - 4 })}</p> : null}
    {onOpen ? <button onClick={onOpen} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="list-open">{tr("Open the list")}</button> : null}
  </div>;
}

/** Home's "To do" card + the lists needed today (1A). Nothing to show → only a small "+ Add a to-do or a list" line. */
export function HomeTodo({ records = [], onTickTodo, navTo, flash, now = Date.now() }) {
  const [st, put] = useLists();
  const [, setTick] = useState(0);
  const todos = (records || []).filter((r) => r && r.meta && r.meta.todo && !r.meta.done).sort((a, b) => a.ts - b.ts);
  // v9.3 (D2): the widget shows these to-dos; a to-do ticked on the widget is marked done here (Home has Mind)
  useEffect(() => { widgetTodos(records, onTickTodo ? (id) => onTickTodo({ id }) : null); try { window.dispatchEvent(new CustomEvent("attune-lists")); } catch (e) {} }, [todos.map((r) => r.id).join()]);
  useEffect(() => { const f = () => widgetTodos(records, onTickTodo ? (id) => onTickTodo({ id }) : null); window.addEventListener("attune-widget-mind", f); return () => window.removeEventListener("attune-widget-mind", f); }, [records]);
  const rem = todayReminders(now);
  const lists = L.homeLists(st, now);
  const late = rem.filter((r) => r.late).length;
  const rows = [...rem.map((r) => ({ k: "r" + r.id, label: r.title, sub: (r.late ? tr("late") + " · " : "") + timeOf(r.at), bad: r.late, tick: () => { markReminderDone(r.id); setTick((n) => n + 1); } })),
    ...todos.map((r) => ({ k: "t" + r.id, label: r.title || r.text, sub: "", tick: () => onTickTodo && onTickTodo(r) }))];
  return <div className="space-y-2" data-testid="home-todo">
    <YourDay records={records} navTo={navTo} flash={flash} />
    {rows.length ? <div className="c-card space-y-0.5" data-testid="home-todo-card">
      <div className="flex items-center gap-2 mb-0.5"><span className="text-[12px] font-extrabold tracking-wide flex-1 uppercase" style={{ color: "var(--c-area-fu, var(--c-acc))" }}>{tr("To do")} · {tr("{n} left", { n: rows.length })}</span>
        {late ? <span className={U.tag("red")} data-testid="home-todo-late">{tr("{n} late", { n: late })}</span> : null}
        <button onClick={() => navTo("lists")} className="text-[12.5px] font-extrabold c-acc min-h-[36px] px-1" data-testid="home-todo-all">{tr("Lists")} ›</button></div>
      {rows.slice(0, 5).map((x) => <div key={x.k}><Box on={false} onClick={x.tick} tone={x.bad ? "bad" : ""} label={<span><span className={x.bad ? "font-extrabold text-[var(--c-neg)]" : ""}>{x.label}</span>{x.sub ? <span className="block text-[12px] c-sub">{x.sub}</span> : null}</span>} testid="home-todo-row" /></div>)}
      {rows.length > 5 ? <button onClick={() => navTo("lists")} className="text-[12.5px] c-sub min-h-[36px]">{tr("+{n} more", { n: rows.length - 5 })}</button> : null}
    </div> : null}
    {lists.map((l) => <ListCard key={l.id} list={l} compact testid="home-list" onTick={(li, x) => put(L.tick(st, li.id, x.id, now))} onOpen={() => { try { localStorage.setItem("attune:lists:open", l.id); } catch (e) {} navTo("lists"); }} />)}
    {!rows.length && !lists.length ? <button onClick={() => navTo("lists")} className="w-full c-card text-start flex items-center gap-2.5 min-h-[52px]" data-testid="home-todo-add">
      <ListChecks size={18} className="c-acc shrink-0" /><span className="flex-1 text-[14px] font-bold">{tr("Add a to-do or a list")}</span><Plus size={17} className="c-acc" /></button> : null}
  </div>;
}

// ---- the page ---------------------------------------------------------------------------------------------------------------------
const REPEATS = [["once", "No — just once"], ["day", "Every day"], ["week", "Every week"], ["month", "Every month"], ["date", "Before a date (a trip)"]];

/** The editor: name, items, and "Does it repeat?" — big, clear choices. */
function ListEditor({ list, onSave, onDelete, onClose }) {
  const [name, setName] = useState(list ? list.name : "");
  const [items, setItems] = useState(list ? list.items.map((x) => x.text).join("\n") : "");
  const [rep, setRep] = useState(list ? list.repeat : { every: "once" });
  const set = (p) => setRep(L.cleanRepeat({ ...rep, ...p }));
  const today = L.isoDay(Date.now());
  const save = () => {
    const texts = items.split(/\n|,|،/).map((x) => x.trim()).filter(Boolean);
    if (!name.trim() || !texts.length) return;
    onSave({ name: name.trim(), texts, repeat: rep });
  };
  return <div className={U.cardPad + " space-y-4"} data-testid="list-editor">
    <div className="flex items-center gap-2"><h3 className={U.h2 + " flex-1"}>{list ? tr("Change the list") : tr("New list")}</h3>
      <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 grid place-items-center c-sub"><X size={18} /></button></div>
    <label className="block space-y-1"><span className={U.label}>{tr("Name")}</span>
      <input value={name} onChange={(e) => setName(e.target.value)} dir="auto" className={U.inp} placeholder={tr("Travel, Saturday cleaning, Shopping…")} data-testid="list-name" /></label>
    <label className="block space-y-1"><span className={U.label}>{tr("The items — one per line")}</span>
      <textarea value={items} onChange={(e) => setItems(e.target.value)} dir="auto" rows={5} className={U.area} placeholder={tr("Passport\nCharger\nMedicines")} data-testid="list-items" /></label>
    <div className="space-y-2" data-testid="list-repeat">
      <span className={U.label}>{tr("Does it repeat?")}</span>
      <div className="grid gap-2">{REPEATS.map(([k, l]) => <button key={k} onClick={() => set({ every: k })} aria-pressed={rep.every === k} data-testid={"list-repeat-" + k}
        className={"min-h-[48px] rounded-[14px] border px-3.5 text-start text-[14.5px] font-bold flex items-center gap-2.5 " + (rep.every === k ? "border-[var(--c-acc)] bg-[var(--c-soft)] text-[var(--c-acc)]" : "border-[var(--c-ln)] bg-[var(--c-surf)]")}>
        <span className="w-4 h-4 rounded-full shrink-0 grid place-items-center" style={{ border: "2px solid currentColor" }}>{rep.every === k ? <span className="w-2 h-2 rounded-full" style={{ background: "currentColor" }} /> : null}</span>{tr(l)}</button>)}</div>
      {rep.every === "week" ? <div className="flex flex-wrap gap-1.5" data-testid="list-days">{WD_SHORT.map((d, i) => <button key={d} onClick={() => set({ days: rep.days.includes(i) ? rep.days.filter((x) => x !== i) : [...rep.days, i] })} aria-pressed={rep.days.includes(i)} className={U.chip(rep.days.includes(i))} data-testid={"list-day-" + i}>{tr(d)}</button>)}</div> : null}
      {rep.every === "month" ? <label className="flex items-center gap-2 text-[14px] font-bold">{tr("On day")}<input type="number" min={1} max={31} value={rep.dom} onChange={(e) => set({ dom: e.target.value })} className={U.inp + " w-24!"} data-testid="list-dom" /></label> : null}
      {rep.every === "date" || rep.every === "once" ? <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <label className="block space-y-1"><span className="text-[12.5px] font-bold c-sub">{rep.every === "date" ? tr("The date (you can also just say “I'm travelling Thursday”)") : tr("From a date (optional)")}</span>
          <input type="date" min={today} value={rep.date || ""} onChange={(e) => set({ date: e.target.value })} className={U.inp} dir="ltr" data-testid="list-date" /></label>
        {rep.every === "date" ? <label className="block space-y-1"><span className="text-[12.5px] font-bold c-sub">{tr("Days before")}</span>
          <input type="number" min={0} max={14} value={rep.before} onChange={(e) => set({ before: e.target.value })} className={U.inp + " w-20!"} data-testid="list-before" /></label> : null}
      </div> : null}
      <p className="m-0 text-[12.5px] c-sub" data-testid="list-when">{rep.every === "once" ? tr("On Home until every box is ticked.") : tr("Comes back to Home: {w} — every box empty again.", { w: lineText(L.whenLine({ repeat: rep })) })}</p>
    </div>
    <div className="flex gap-2"><button onClick={save} disabled={!name.trim() || !items.trim() || (rep.every === "week" && !rep.days.length)} className={U.btnP + " flex-1"} data-testid="list-save">{tr("Save the list")}</button>
      {onDelete ? <button onClick={onDelete} className={U.btnDanger} aria-label={tr("Delete")} data-testid="list-delete"><Trash2 size={16} /></button> : null}</div>
  </div>;
}

export function ListsPage({ records = [], onTickTodo, onAddTodo, flash }) {
  const [st, put] = useLists();
  const [edit, setEdit] = useState(null);   // null | "new" | list id
  const [open, setOpen] = useState(() => { try { const v = localStorage.getItem("attune:lists:open"); localStorage.removeItem("attune:lists:open"); return v || null; } catch (e) { return null; } });
  const [todo, setTodo] = useState("");
  const [addTo, setAddTo] = useState({});
  const now = Date.now();
  const todos = (records || []).filter((r) => r && r.meta && r.meta.todo && !r.meta.done).sort((a, b) => a.ts - b.ts);
  const rem = todayReminders(now);
  const [, setTick] = useState(0);
  const lists = useMemo(() => st.lists.map((l) => L.current(l, now)).sort((a, b) => (L.onHome(b, now) ? 1 : 0) - (L.onHome(a, now) ? 1 : 0)), [st]);
  const saveEdit = ({ name, texts, repeat }) => {
    if (edit === "new") { const l = L.makeList({ name, items: texts, repeat }); put(L.addList(st, l)); setOpen(l.id); flash && flash(tr("Saved")); }
    else { const old = st.lists.find((l) => l.id === edit); const keep = old.items.filter((x) => texts.includes(x.text));
      const fresh = texts.filter((t) => !old.items.some((x) => x.text === t)).map((t) => ({ id: "i" + Math.random().toString(36).slice(2, 9), text: t, done: false }));
      put(L.editList(st, edit, { name, repeat, items: texts.map((t) => keep.find((x) => x.text === t) || fresh.find((x) => x.text === t)) })); flash && flash(tr("Saved")); }
    setEdit(null);
  };
  if (edit) return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="lists-page">
    <ListEditor list={edit === "new" ? null : st.lists.find((l) => l.id === edit)} onSave={saveEdit} onClose={() => setEdit(null)}
      onDelete={edit === "new" ? null : () => { if (window.confirm(tr("Delete this list?"))) { put(L.removeList(st, edit)); setEdit(null); } }} /></div>;
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="lists-page">
    <U.Head title={tr("To-dos & lists")} sub={tr("What is due or not finished is on Home until you tick it.")} />
    {/* v9.9.6 N1: tables from one sentence live here too */}
    <button onClick={() => window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "tables" } }))} className={U.card + " w-full p-3 text-start flex items-center gap-2"} data-testid="lists-tables">
      <b className="flex-1 text-[14px]">{tr("Tables")}</b><span className="text-[12.5px] c-sub">{"“" + tr("track my books: title, author, due date") + "”"}</span></button>
    <button onClick={() => setEdit("new")} className={U.btnP + " w-full"} data-testid="lists-new"><Plus size={18} />{tr("New list")}</button>
    {/* to-dos and today's reminders */}
    <div className={U.cardPad + " space-y-1"} data-testid="lists-todos">
      <p className={U.label + " m-0"}>{tr("To-dos")}</p>
      {rem.map((r) => <Box key={r.id} on={false} tone={r.late ? "bad" : ""} onClick={() => { markReminderDone(r.id); setTick((n) => n + 1); }} label={<span><span className={r.late ? "font-extrabold text-[var(--c-neg)]" : ""}>{r.title}</span><span className="block text-[12px] c-sub">{(r.late ? tr("late") + " · " : "") + timeOf(r.at)}</span></span>} testid="lists-reminder" />)}
      {todos.map((r) => <Box key={r.id} on={false} onClick={() => onTickTodo && onTickTodo(r)} label={r.title || r.text} testid="lists-todo" />)}
      {!rem.length && !todos.length ? <p className="m-0 text-[13px] c-sub py-1">{tr("Nothing to do — add one below.")}</p> : null}
      <form onSubmit={(e) => { e.preventDefault(); const t = todo.trim(); if (!t) return; onAddTodo && onAddTodo(t); setTodo(""); }} className="flex gap-2 pt-1">
        <input value={todo} onChange={(e) => setTodo(e.target.value)} dir="auto" className={U.inp + " flex-1"} placeholder={tr("Add a to-do…")} data-testid="lists-todo-input" />
        <button className={U.btnS} aria-label={tr("Add")} data-testid="lists-todo-add"><Plus size={16} /></button></form>
    </div>
    {/* the lists */}
    <p className={U.label + " m-0 pt-1"}>{tr("Your lists")} · {lists.length}</p>
    {!lists.length ? <div className={U.cardPad + " space-y-2"} data-testid="lists-empty">
      <p className="m-0 text-[14px] font-bold">{tr("No lists yet.")}</p>
      <p className="m-0 text-[13px] c-sub">{tr("Tap “New list”, or just say it in the box on Home:")}</p>
      {["make my travel checklist: passport, charger, medicines", "every Saturday: clean the flat, pay the maid", "I'm travelling Thursday"].map((x) => <p key={x} className="m-0 text-[13px] font-bold c-acc" dir="auto">«{tr(x)}»</p>)}
    </div> : null}
    {lists.map((l) => { const p = L.progress(l), here = L.onHome(l, now), isOpen = open === l.id;
      return <div key={l.id} className={U.cardPad + " space-y-2"} data-testid="lists-row">
        <button onClick={() => setOpen(isOpen ? null : l.id)} className="w-full flex items-center gap-3 text-start" aria-expanded={isOpen} data-testid="lists-row-head">
          <span className="text-[22px]">{l.emoji}</span>
          <span className="flex-1 min-w-0"><b className="block text-[15.5px] truncate" dir="auto">{l.name}</b>
            <span className="flex items-center gap-1.5 text-[12.5px] c-sub" data-testid="lists-row-when">{l.repeat.every === "once" ? <CalendarDays size={13} /> : <Repeat size={13} />}{lineText(L.whenLine(l, now))}</span></span>
          <span className="text-end shrink-0"><b className="block text-[14px] tabular-nums">{p.done}/{p.of}</b>{here ? <span className={U.tag("green")}>{tr("On Home")}</span> : null}</span>
          <ChevronRight size={17} className={"c-sub transition-transform " + (isOpen ? "rotate-90" : "rtl:rotate-180")} /></button>
        {isOpen ? <div className="space-y-1 pt-1 border-t border-[var(--c-ln)]">
          {l.items.map((x) => <Box key={x.id} on={x.done} onClick={() => put(L.tick(st, l.id, x.id, now))} label={x.text} testid="lists-item" />)}
          <form onSubmit={(e) => { e.preventDefault(); const t = (addTo[l.id] || "").trim(); if (!t) return; put(L.addItem(st, l.id, t)); setAddTo({ ...addTo, [l.id]: "" }); }} className="flex gap-2 pt-1">
            <input value={addTo[l.id] || ""} onChange={(e) => setAddTo({ ...addTo, [l.id]: e.target.value })} dir="auto" className={U.inp + " flex-1"} placeholder={tr("Add an item…")} data-testid="lists-item-input" />
            <button className={U.btnS} aria-label={tr("Add")}><Plus size={16} /></button></form>
          <button onClick={() => setEdit(l.id)} className={U.btnS + " w-full"} data-testid="lists-edit"><Repeat size={15} />{tr("Change the name, the items or when it repeats")}</button>
          {/* v9.3 (D2 C): this list on the home-screen widget "Attune · A list" */}
          {(() => { let pinned = ""; try { pinned = localStorage.getItem(PIN_KEY) || ""; } catch (e) {} const on = pinned === l.id;
            return <button onClick={() => { try { on ? localStorage.removeItem(PIN_KEY) : localStorage.setItem(PIN_KEY, l.id); } catch (e) {} window.dispatchEvent(new CustomEvent("attune-lists")); setTick((n) => n + 1); flash && flash(on ? tr("Taken off the widget") : tr("Pinned — add the “Attune · A list” widget to your home screen")); }}
              className={U.btnS + " w-full"} aria-pressed={on} data-testid="lists-pin">{on ? tr("Take it off the widget") : tr("Pin to the widget")}</button>; })()}
        </div> : null}
      </div>; })}
  </div>;
}
