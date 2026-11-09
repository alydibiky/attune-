/* ---- v9.9.6 N1 Tables from one sentence (Ali OK'd; inside Lists): "track my cranes: name, tonnage, next inspection" makes the table;
   Table · Board · Calendar; a row added by a form or by talking ("add Grove GMK, 100 tons, inspection 4 Dec"); every future date gets
   a reminder the day before at 9:00. Logic: tables.js (tested). */
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, LayoutGrid as Table2, ArrowLeft } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as T from "./tables.js";
import * as U from "./ui-kit.jsx";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";

const inp = "min-h-[36px] w-full rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-2 text-[13px]";
const nice = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return d; } };
/** Keeps the phone's reminders in step with the table's dates (the day before, 9:00). */
export function syncTableReminders(t) {
  const want = T.dueReminders(t), keep = loadReminders().filter((r) => !String(r.id).startsWith("tbl-" + t.id + "-"));
  const list = saveReminders([...keep, ...want.map((r) => ({ ...r, created: Date.now() }))]);
  try { syncToPhone(typeof window !== "undefined" && window.AttuneNative, list); } catch (e) {}
  return want.length;
}

export function TablesPage({ flash }) {
  const [st, setSt] = useState(T.loadTables), [open, setOpen] = useState(() => { try { const v = localStorage.getItem("attune:tables:open"); localStorage.removeItem("attune:tables:open"); return v || ""; } catch (e) { return ""; } });
  const [say, setSay] = useState(""), [err, setErr] = useState("");
  useEffect(() => { const f = () => setSt(T.loadTables()); window.addEventListener("attune-tables", f); return () => window.removeEventListener("attune-tables", f); }, []);
  const put = (s, tid) => { T.saveTables(s); setSt(s); const t = s.tables.find((x) => x.id === tid); if (t) syncTableReminders(t); };
  const create = () => { const p = T.parseTrack(say); if (!p) { setErr(tr("Write it like: “track my cranes: name, tonnage, next inspection”")); return; }
    const t = T.makeTable(p); put({ ...st, tables: [t, ...st.tables] }, t.id); setSay(""); setErr(""); setOpen(t.id); };
  const t = st.tables.find((x) => x.id === open);
  if (t) return <TableView t={t} back={() => setOpen("")} put={(s) => put(s, t.id)} st={st} flash={flash} />;
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="tables-page">
    <U.Head title={tr("Tables")} sub={tr("Track anything in one sentence — your cranes, clients, courses. Dates remind you the day before.")} />
    <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) create(); }} className={U.card + " p-2 flex gap-2"}>
      <input value={say} onChange={(e) => setSay(e.target.value)} dir="auto" placeholder={tr("track my cranes: name, tonnage, next inspection")} className="flex-1 min-w-0 bg-transparent px-2.5 text-[15px] focus:outline-none" data-testid="tables-new" />
      <button type="submit" disabled={!say.trim()} className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] font-extrabold text-[13.5px] disabled:opacity-40" data-testid="tables-new-go">{tr("Make it")}</button>
    </form>
    {err ? <p className="m-0 text-[12.5px] text-[var(--c-warn)]" data-testid="tables-err">{err}</p> : null}
    {st.tables.map((x) => <button key={x.id} onClick={() => setOpen(x.id)} className={U.card + " w-full p-3.5 flex items-center gap-3 text-start"} data-testid="tables-item">
      <Table2 size={18} className="text-[var(--c-acc)] shrink-0" /><span className="flex-1 min-w-0"><b className="block text-[14.5px]" dir="auto">{x.name}</b>
        <span className="block text-[12px] c-sub truncate" dir="auto">{x.cols.map((c) => c.name).join(" · ")} — {tr("{n} rows", { n: x.rows.length })}</span></span>
      <ChevronRight size={16} className="c-sub rtl:-scale-x-100" /></button>)}
    {!st.tables.length ? <p className={"m-0 text-[13px] " + U.muted}>{tr("No tables yet. Say what to track and its columns, separated by commas.")}</p> : null}
  </div>;
}

function Cell({ c, v, set }) {
  if (c.type === "date") return <input type="date" value={v || ""} onChange={(e) => set(e.target.value)} className={inp} aria-label={c.name} />;
  if (c.type === "number") return <input inputMode="decimal" value={v == null ? "" : v} onChange={(e) => set(e.target.value === "" ? null : +e.target.value.replace(/[^\d.]/g, ""))} className={inp + " tabular-nums"} aria-label={c.name} />;
  return <input value={v || ""} onChange={(e) => set(e.target.value)} dir="auto" className={inp} aria-label={c.name} />;
}

function TableView({ t, back, put, st, flash }) {
  const [view, setView] = useState("table"), [say, setSay] = useState(""), [row, setRow] = useState({}), [month, setMonth] = useState(() => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); });
  const addCells = (cells) => { const s = T.addRow(st, t.id, cells); put(s); const n = T.dueReminders(s.tables.find((x) => x.id === t.id)).length; flash && flash(n ? tr("Row added — {n} date reminders kept", { n }) : tr("Row added")); };
  const addSaid = () => { const r = T.parseRow({ ...st, tables: [t] }, /^\s*(add|ضيف)\b/i.test(say) ? say : "add " + say); if (!r) { flash && flash(tr("I couldn't fit that into the columns — use the form below")); return; } addCells(r.cells); setSay(""); };
  const b = useMemo(() => T.board(t), [t]), cal = useMemo(() => T.calendar(t), [t]), hasDate = t.cols.some((c) => c.type === "date");
  const tab = (k, l) => <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={"min-h-[36px] px-3.5 rounded-full text-[13px] font-extrabold border " + (view === k ? "bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] border-transparent" : "border-[var(--c-ln)]")} data-testid={"table-view-" + k}>{tr(l)}</button>;
  const y = Math.floor(month / 12), mo = month % 12, first = new Date(y, mo, 1), days = new Date(y, mo + 1, 0).getDate();
  return <div className="calm pt-1 pb-10 space-y-3" data-testid="table-page">
    <button onClick={back} className="inline-flex items-center gap-1 min-h-[40px] text-[13px] font-bold c-sub"><ArrowLeft size={15} className="rtl:-scale-x-100" />{tr("Tables")}</button>
    <div className="flex items-center gap-2"><h2 className={U.h1 + " flex-1"} dir="auto">{t.name}</h2>
      <button onClick={() => { put(T.delTable(st, t.id)); back(); }} aria-label={tr("Delete")} className="w-10 h-10 grid place-items-center c-sub" data-testid="table-delete"><Trash2 size={16} /></button></div>
    <div className="flex gap-1.5">{tab("table", "Table")}{b ? tab("board", "Board") : null}{hasDate ? tab("calendar", "Calendar") : null}</div>
    <form onSubmit={(e) => { e.preventDefault(); if (say.trim()) addSaid(); }} className={U.card + " p-2 flex gap-2"}>
      <input value={say} onChange={(e) => setSay(e.target.value)} dir="auto" placeholder={tr("Say a row: “Grove GMK, 100 tons, inspection 4 Dec”")} className="flex-1 min-w-0 bg-transparent px-2 text-[14px] focus:outline-none" data-testid="table-say" />
      <button type="submit" disabled={!say.trim()} className="min-h-[40px] px-3.5 rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] font-extrabold text-[13px] disabled:opacity-40" data-testid="table-say-go">{tr("Add")}</button></form>
    {view === "table" ? <div className="overflow-x-auto rounded-[14px] border border-[var(--c-ln)]" data-testid="table-grid">
      <table className="w-full text-[13px] border-collapse min-w-[420px]">
        <thead><tr>{t.cols.map((c) => <th key={c.id} className="text-start px-2 py-2 bg-[var(--c-soft)] text-[var(--c-acc)] font-extrabold" dir="auto">{c.name}</th>)}<th className="bg-[var(--c-soft)] w-10"></th></tr></thead>
        <tbody>{t.rows.map((r) => <tr key={r.id} className="border-t border-[var(--c-ln)]" data-testid="table-row">{t.cols.map((c) => <td key={c.id} className="px-1.5 py-1"><Cell c={c} v={(r.cells || {})[c.id]} set={(v) => put(T.setCell(st, t.id, r.id, c.id, v))} /></td>)}
          <td className="px-1"><button onClick={() => put(T.delRow(st, t.id, r.id))} aria-label={tr("Delete")} className="w-9 h-9 grid place-items-center c-sub"><Trash2 size={14} /></button></td></tr>)}
          <tr className="border-t border-[var(--c-ln)] bg-[var(--c-bg)]" data-testid="table-new-row">{t.cols.map((c) => <td key={c.id} className="px-1.5 py-1"><Cell c={c} v={row[c.id]} set={(v) => setRow((x) => ({ ...x, [c.id]: v }))} /></td>)}
            <td className="px-1"><button onClick={() => { if (Object.values(row).some((v) => v != null && v !== "")) { addCells(row); setRow({}); } }} aria-label={tr("Add")} className="w-9 h-9 grid place-items-center text-[var(--c-acc)]" data-testid="table-add-row"><Plus size={16} /></button></td></tr></tbody>
      </table></div> : null}
    {view === "board" && b ? <div className="flex gap-2 overflow-x-auto pb-1" data-testid="table-board">{b.groups.map((g) => <div key={g.key} className="shrink-0 w-[200px] rounded-[16px] bg-[var(--c-soft)] p-2 space-y-1.5" data-testid="table-board-col">
      <p className="m-0 text-[12px] font-extrabold uppercase tracking-[0.05em] text-[var(--c-acc)]" dir="auto">{g.key} · {g.rows.length}</p>
      {g.rows.map((r) => <div key={r.id} className={U.card + " p-2 text-[13px]"} dir="auto"><b className="block">{T.rowName(t, r)}</b>
        <span className="block text-[11.5px] c-sub">{t.cols.filter((c) => c.id !== b.col.id && c !== t.cols.find((x) => x.type === "text") && (r.cells || {})[c.id] != null && (r.cells || {})[c.id] !== "").map((c) => c.type === "date" ? nice(r.cells[c.id]) : String(r.cells[c.id])).join(" · ")}</span></div>)}
    </div>)}</div> : null}
    {view === "calendar" ? <div className={U.card + " p-3 space-y-2"} data-testid="table-calendar">
      <div className="flex items-center gap-2"><button onClick={() => setMonth(month - 1)} aria-label={tr("Previous")} className="w-9 h-9 grid place-items-center"><ChevronLeft size={16} className="rtl:-scale-x-100" /></button>
        <b className="flex-1 text-center text-[14px]">{first.toLocaleDateString(dateLocale(), { month: "long", year: "numeric" })}</b>
        <button onClick={() => setMonth(month + 1)} aria-label={tr("Next")} className="w-9 h-9 grid place-items-center"><ChevronRight size={16} className="rtl:-scale-x-100" /></button></div>
      <div className="grid grid-cols-7 gap-1 text-center">{Array.from({ length: first.getDay() }, (_, i) => <span key={"e" + i} />)}
        {Array.from({ length: days }, (_, i) => { const d = y + "-" + String(mo + 1).padStart(2, "0") + "-" + String(i + 1).padStart(2, "0"), it = cal[d] || [];
          return <div key={d} className={"min-h-[44px] rounded-[10px] p-0.5 text-[11px] " + (it.length ? "bg-[var(--c-soft)]" : "")} data-testid={it.length ? "table-cal-day" : undefined}>
            <span className="block font-bold">{i + 1}</span>{it.slice(0, 2).map((x, k) => <span key={k} className="block truncate text-[9.5px] text-[var(--c-acc)] font-bold" dir="auto">{T.rowName(t, x.row)}</span>)}</div>; })}</div>
    </div> : null}
  </div>;
}
