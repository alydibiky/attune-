/* ---- v10.3 K1 week calendar on the computer's Home (Ali picked K1 + OK-G1 G2 G3, 17 Nov 2026 — MOCKUPS.md). Logic: weekcal.js.
   Day · Week · Month, ‹ Today ›, the hours with a line for now, an "all day" lane, a trip as one bar; a tap opens the thing on the
   right (its details + Open), never a pop-up. Under it: safe to spend, agents, latest payments. Colours: tw.css (.wk-*).        */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { tr, dateLocale } from "./i18n.js";
import { weekOf, weekStartOf, addDays, iso, nowLine } from "./weekcal.js";
import { timeline } from "./timeline.js";
import { loadReminders } from "./actions.js";
import { loadProjects, openProject } from "./spaces.js";
import { projectDates } from "./projlinks.js";
import { weekStart } from "./country.js";
import { safeToSpend } from "./safespend.js";
import { loadAgents } from "./agents.js";
import { fmt } from "./money-calm.js";

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const DAY = 864e5;
const KIND_LABEL = { money: "Money", people: "People", home: "Home & orders", work: "Projects", trip: "Trips" };
const loc = () => dateLocale() || "en-GB";
const dname = (s, o) => { try { return new Date(s + "T12:00:00").toLocaleDateString(loc(), o); } catch (e) { return s; } };
const hhmm = (h) => String(Math.floor(h)).padStart(2, "0").replace(/^0(\d)$/, "$1") + ":" + String(Math.round((h % 1) * 60)).padStart(2, "0");

/** Everything Attune keeps, as the calendar's inputs, for the days from `from` to `to`. */
export function calendarInputs(from, to, now = Date.now()) {
  const today = iso(now), back = Math.max(0, Math.round((Date.parse(today + "T12:00:00") - Date.parse(from + "T12:00:00")) / DAY)),
    ahead = Math.max(0, Math.round((Date.parse(to + "T12:00:00") - Date.parse(today + "T12:00:00")) / DAY));
  const ledger = j("ledger.v3", null), life = j("attune:life:v1", null);
  let list = []; try { list = timeline({ reminders: loadReminders(), radar: j("attune:radar:v1", null), life, ledger, xray: j("attune:xray:v1", []), errands: j("attune:errands:v1", []), now, days: ahead, back }); } catch (e) {}
  const projects = []; try { const chats = j("attune:chats:v1", []); for (const p of loadProjects()) projectDates(p, chats, now).forEach((d, i) => projects.push({ id: p.id + ":" + i, pid: p.id, name: p.name, date: d.date, text: d.src === "due" ? tr("due") : d.text })); } catch (e) {}
  return { timeline: list, txns: (ledger && ledger.txns) || [], projects, trip: j("attune:trip:v1", null), cur: (ledger && ledger.currency) || "" };
}

function Detail({ x, onClose, navTo }) {
  const s = x.src || {};
  const when = x.kind === "trip" ? dname(x.from, { weekday: "short", day: "numeric", month: "short" }) + " → " + dname(x.until, { weekday: "short", day: "numeric", month: "short" })
    : (x.date ? dname(x.date, { weekday: "long", day: "numeric", month: "long" }) : "") + (x.h != null ? " · " + hhmm(x.h) : " · " + tr("All day"));
  const slip = Array.isArray(s.slip) ? tr(s.slip[0], { amount: x.amount ? fmt(x.amount) + (x.cur ? " " + x.cur : "") : "", who: s.who || "" }) : "";
  const open = () => { if (x.page === "projects" && s.pid) openProject(s.pid); navTo && navTo(x.page === "errands" || s.kind === "errand" ? "errands" : x.page || "timeline"); };
  return (
    <aside className="wk-detail" data-testid="wk-detail" aria-label={tr("Details")}>
      <div className="flex items-start justify-between gap-2">
        <span className={"wk-chip wk-" + x.kind}>{tr(KIND_LABEL[x.kind] || "")}</span>
        <button onClick={onClose} className="w-9 h-9 -mt-1 -me-1 grid place-items-center rounded-[10px] text-[var(--c-mut)] hover:text-[var(--c-ink)]" aria-label={tr("Close")} data-testid="wk-detail-close"><X size={16} /></button>
      </div>
      <b className="block text-[16px] font-black leading-snug mt-2" dir="auto">{x.what}</b>
      <span className="block text-[12.5px] text-[var(--c-mut)] mt-1">{when}</span>
      {x.amount ? <span className="block text-[22px] font-black tabular-nums mt-2">{x.sign}{fmt(x.amount)}{x.cur ? <small className="text-[12px] font-bold text-[var(--c-mut)] ms-1">{x.cur}</small> : null}</span> : null}
      {slip ? <p className="text-[13px] text-[var(--c-mut)] mt-2 mb-0" dir="auto">{slip}</p> : null}
      {s.evidence && s.evidence.text ? <p className="text-[12px] text-[var(--c-mut)] mt-2 mb-0 rounded-[10px] bg-[var(--c-surf-2)] p-2" dir="auto">{s.evidence.text}</p> : null}
      {x.page ? <button onClick={open} className="mt-3 h-10 px-5 rounded-full text-[13.5px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" data-testid="wk-open">{tr("Open")}</button> : null}
    </aside>);
}

function Chip({ x, onPick, sel, style, testid }) {
  return (
    <button onClick={() => onPick(x)} style={style} title={x.what} data-testid={testid} data-kind={x.kind}
      className={"wk-pill wk-" + x.kind + (sel ? " wk-sel" : "")}>
      <span className="wk-pn" dir="auto">{x.kind === "trip" ? "✈ " : ""}{x.what}{x.kind === "trip" && x.until ? " — " + tr("until {d}", { d: dname(x.until, { weekday: "short", day: "numeric" }) }) : ""}</span>
      {x.amount ? <em>{x.sign}{fmt(x.amount)}</em> : null}
    </button>);
}

function WeekGrid({ wk, sel, onPick, now, oneDay = -1 }) {
  const step = wk.h1 - wk.h0 > 16 ? 3 : 2, hours = []; for (let h = wk.h0; h < wk.h1; h += step) hours.push(h);
  const H = (wk.h1 - wk.h0) * wk.pxh, at = (h) => (h - wk.h0) * wk.pxh;   // (one height whatever hours show — weekcal.js gridPx)
  const cols = oneDay >= 0 ? [oneDay] : [0, 1, 2, 3, 4, 5, 6], n = cols.length;
  const nl = nowLine(wk, now), tmpl = { gridTemplateColumns: `54px repeat(${n}, minmax(0, 1fr))` };
  const allday = wk.allday.filter((x) => oneDay < 0 || (x.d0 <= oneDay && x.d1 >= oneDay));
  const rows = oneDay < 0 ? wk.rows : Math.min(wk.rows, allday.length);
  return (<>
    <div className="wk-dayhead" style={tmpl}>
      <span />
      {cols.map((d) => <div key={d} className={"wk-dh" + (d === wk.today ? " wk-today" : "")} data-testid="wk-day"><small>{dname(wk.days[d], { weekday: "short" })}</small><b>{new Date(wk.days[d] + "T12:00:00").getDate()}</b></div>)}
    </div>
    {rows || wk.more.some(Boolean) ? <div className="wk-allday" style={tmpl} data-testid="wk-allday">
      <span className="wk-lab" style={{ gridRow: `1 / ${Math.max(1, rows) + 2}` }}>{tr("All day")}</span>
      {allday.map((x) => { const a = oneDay < 0 ? x.d0 : 0, b = oneDay < 0 ? x.d1 : 0;
        return <Chip key={x.id} x={{ ...x, date: wk.days[x.d0] }} sel={sel && sel.id === x.id} onPick={onPick} testid="wk-allday-item" style={{ gridColumn: `${a + 2} / ${b + 3}`, gridRow: x.row + 1 }} />; })}
      {cols.map((d, i) => wk.more[d] ? <span key={"m" + d} className="wk-more" style={{ gridColumn: i + 2, gridRow: Math.max(1, rows) + 1 }} data-testid="wk-more">{tr("+{n} more", { n: wk.more[d] })}</span> : null)}
    </div> : null}
    <div className="wk-grid" style={tmpl}>
      <div className="wk-hours" style={{ height: H }}>{hours.map((h) => <span key={h} style={{ top: at(h) }}>{hhmm(h)}</span>)}</div>
      {cols.map((d) => (
        <div key={d} className={"wk-col" + (d === wk.today ? " wk-today" : "")} style={{ height: H }}>
          {hours.slice(1).map((h) => <i key={h} className="wk-ln" style={{ top: at(h) }} />)}
          {wk.timed.filter((x) => x.day === d).map((x) => (
            <button key={x.id} onClick={() => onPick({ ...x, date: wk.days[d] })} data-testid="wk-ev" data-kind={x.kind} title={x.what}
              className={"wk-ev wk-" + x.kind + (sel && sel.id === x.id ? " wk-sel" : "")}
              style={{ top: at(x.y0), height: (x.y1 - x.y0) * wk.pxh - 3, insetInlineStart: `calc(${(100 / x.cols) * x.col}% + 3px)`, width: `calc(${100 / x.cols}% - 6px)` }}>
              <span className="wk-t">{hhmm(x.h)}{x.amount ? <b>{x.sign}{fmt(x.amount)}</b> : null}</span>
              <span className="wk-n" dir="auto">{x.what}</span>
            </button>))}
          {d === wk.today && nl != null ? <i className="wk-now" style={{ top: at(nl) }} data-testid="wk-now" /> : null}
        </div>))}
    </div>
  </>);
}

function MonthGrid({ month, startDay, onPick, sel, now, setDay }) {
  const first = month + "-01", s = weekStartOf(Date.parse(first + "T12:00:00"), startDay);
  const weeks = useMemo(() => { const out = []; for (let k = 0; k < 6; k++) { const ws = addDays(s, k * 7); if (k && ws.slice(0, 7) > month) break; const inp = calendarInputs(ws, addDays(ws, 6), now); out.push(weekOf({ ...inp, start: ws, now, maxRows: 9 })); } return out; }, [month, startDay]);
  return (
    <div className="wk-month" data-testid="wk-month">
      <div className="wk-mhead">{weeks[0].days.map((d) => <small key={d}>{dname(d, { weekday: "short" })}</small>)}</div>
      {weeks.map((w) => <div key={w.start} className="wk-mrow">{w.days.map((d, i) => { const items = [...w.allday.filter((x) => x.d0 <= i && x.d1 >= i), ...w.timed.filter((x) => x.day === i)];
        return (<div key={d} className={"wk-mday" + (d.slice(0, 7) !== month ? " wk-out" : "") + (d === iso(now) ? " wk-today" : "")}>
          <button className="wk-mnum" onClick={() => setDay(d)} data-testid="wk-mday">{new Date(d + "T12:00:00").getDate()}</button>
          {items.slice(0, 3).map((x) => <Chip key={x.id} x={{ ...x, date: d }} sel={sel && sel.id === x.id} onPick={onPick} testid="wk-mitem" />)}
          {items.length > 3 ? <span className="wk-more">{tr("+{n} more", { n: items.length - 3 })}</span> : null}
        </div>); })}</div>)}
    </div>);
}

/** The calendar card. navTo opens a thing's own page from its details. */
export function WeekCalendar({ navTo, now0 = null }) {
  const [now, setNow] = useState(() => now0 || Date.now());
  useEffect(() => { if (now0) return; const t = setInterval(() => setNow(Date.now()), 60000); const on = () => setV((x) => x + 1); window.addEventListener("storage", on); document.addEventListener("visibilitychange", on); return () => { clearInterval(t); window.removeEventListener("storage", on); document.removeEventListener("visibilitychange", on); }; }, []);
  const [v, setV] = useState(0);
  const startDay = useMemo(() => { try { return weekStart(); } catch (e) { return 6; } }, []);
  const [view, setView] = useState(() => { try { return localStorage.getItem("attune:wk:view") || "week"; } catch (e) { return "week"; } });
  useEffect(() => { try { localStorage.setItem("attune:wk:view", view); } catch (e) {} }, [view]);
  const [day, setDay] = useState(() => iso(now));   // the day the view is on (week = its week, month = its month)
  const [sel, setSel] = useState(null);
  const ws = weekStartOf(Date.parse(day + "T12:00:00"), startDay);
  const wk = useMemo(() => { const inp = calendarInputs(ws, addDays(ws, 6), now); return weekOf({ ...inp, start: ws, now }); }, [ws, v, Math.floor(now / 6e5)]);
  const step = (k) => { setSel(null); setDay(view === "month" ? (() => { const d = new Date(day + "T12:00:00"); d.setDate(1); d.setMonth(d.getMonth() + k); return iso(d.getTime()); })() : addDays(day, k * (view === "day" ? 1 : 7))); };
  const title = view === "month" ? dname(day, { month: "long", year: "numeric" })
    : view === "day" ? dname(day, { weekday: "long", day: "numeric", month: "long" })
    : (ws === weekStartOf(now, startDay) ? tr("This week") : tr("Week")) ;
  const sub = view === "week" ? dname(ws, { day: "numeric", month: "short" }) + " – " + dname(addDays(ws, 6), { day: "numeric", month: "short" }) : "";
  const legend = ["money", "people", "home", "work"];
  return (
    <section className="wk c-card" data-testid="wk" aria-label={tr("Calendar")}>
      <div className="wk-head">
        <div className="wk-title"><b>{title}</b>{sub ? <span>{sub}</span> : null}</div>
        <div className="wk-seg" role="tablist">{[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([id, l]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? "on" : ""} onClick={() => { setView(id); setSel(null); }} data-testid={"wk-view-" + id}>{tr(l)}</button>)}</div>
        <div className="wk-nav"><button onClick={() => step(-1)} aria-label={tr("Back")} data-testid="wk-prev"><ChevronLeft size={16} className="rtl:-scale-x-100" /></button>
          <button className="wk-todaybtn" onClick={() => { setDay(iso(now)); setSel(null); }} data-testid="wk-today">{tr("Today")}</button>
          <button onClick={() => step(1)} aria-label={tr("Next")} data-testid="wk-next"><ChevronRight size={16} className="rtl:-scale-x-100" /></button></div>
      </div>
      <div className={"wk-body" + (sel ? " wk-open" : "")}>
        <div className="wk-main">
          {view === "month" ? <MonthGrid month={day.slice(0, 7)} startDay={startDay} onPick={setSel} sel={sel} now={now} setDay={(d) => { setDay(d); setView("day"); }} />
            : <WeekGrid wk={wk} sel={sel} onPick={setSel} now={now} oneDay={view === "day" ? wk.days.indexOf(day) : -1} />}
          {!wk.count && view !== "month" ? <p className="wk-empty" data-testid="wk-empty">{tr("Nothing on this week yet — bills, payments, reminders, projects and trips you add anywhere in Attune show here.")}</p> : null}
          <div className="wk-legend">{legend.map((k) => <span key={k}><i className={"wk-" + k} />{tr(KIND_LABEL[k])}</span>)}</div>
        </div>
        {sel ? <Detail x={sel} onClose={() => setSel(null)} navTo={navTo} /> : null}
      </div>
    </section>);
}

/** The three cards under the calendar: safe to spend, agents, latest payments. */
export function UnderWeek({ navTo }) {
  const d = useMemo(() => {
    const ledger = j("ledger.v3", null); let safe = null;
    try { safe = ledger ? safeToSpend({ ledger, life: j("attune:life:v1", null), radar: j("attune:radar:v1", null) }) : null; } catch (e) {}
    const month = iso(Date.now()).slice(0, 7), txns = (ledger && ledger.txns) || [];
    const spent = txns.filter((t) => t.type === "expense" && String(t.date).startsWith(month)).reduce((a, t) => a + (+t.amount || 0), 0);
    const latest = [...txns].filter((t) => t.type === "expense" || t.type === "income").sort((a, b) => String(b.date).localeCompare(String(a.date)) || (+(b.ts || b.created) || 0) - (+(a.ts || a.created) || 0)).slice(0, 3);
    let ags = []; try { ags = loadAgents().agents.filter((a) => a.on !== false).slice(0, 3); } catch (e) {}
    return { safe, spent, latest, ags, cur: (ledger && ledger.currency) || (safe && safe.cur) || "", has: !!ledger };
  }, []);
  const price = (a) => { const o = a.found || a.best || (a.best3 && a.best3[0]) || null; return o && o.price > 0 ? fmt(o.price) + (a.found ? " ✓" : "") : ""; };
  const card = "c-card wk-under text-start";
  return (
    <div className="grid grid-cols-3 gap-4" data-testid="wk-under">
      <button className={card} onClick={() => navTo("money")} data-testid="wk-safe">
        {d.safe && d.has ? <><span className="c-sub">{tr("Safe to spend until {d}", { d: dname(d.safe.until, { day: "numeric", month: "short" }) })}</span>
          <b className="block text-[26px] font-black tabular-nums tracking-tight">{d.cur} {fmt(d.safe.today)}</b>
          <span className="c-sub">{tr("{a} spent this month", { a: fmt(d.spent) })}</span></>
          : <><span className="c-sub">{tr("Money")}</span><b className="block text-[15px] font-extrabold mt-1">{tr("Write what you spend — Attune keeps the count")}</b></>}
      </button>
      <button className={card} onClick={() => navTo("agents")} data-testid="wk-agents">
        <b className="block text-[14px] font-extrabold mb-1">{tr("Agents")}</b>
        {d.ags.length ? d.ags.map((a) => <span key={a.id} className="flex justify-between gap-2 py-0.5 text-[13px]"><span className="truncate" dir="auto">{a.what || a.title}</span><span className="font-extrabold tabular-nums shrink-0">{price(a)}</span></span>)
          : <span className="c-sub">{tr("No agents yet — ask one to watch a price or a hotel for you.")}</span>}
      </button>
      <button className={card} onClick={() => navTo("money")} data-testid="wk-latest">
        <b className="block text-[14px] font-extrabold mb-1">{tr("Latest")}</b>
        {d.latest.length ? d.latest.map((t, i) => <span key={t.id || i} className="flex justify-between gap-2 py-0.5 text-[13px]"><span className="truncate" dir="auto">{String(t.note || "").replace(" ↻", "") || tr("Payment")}</span><span className={"font-extrabold tabular-nums shrink-0 " + (t.type === "income" ? "c-pos" : "")}>{t.type === "income" ? "+" : "−"}{fmt(t.amount)}</span></span>)
          : <span className="c-sub">{tr("No payments yet")}</span>}
      </button>
    </div>);
}
