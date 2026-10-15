/* ---- v6.27: the phone's Home in design A "Calm" (Ali picked it, 13 Oct 2026; mock-up: claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4)
   Greeting + date, an "Ask or add anything" box (→ Chat), a short TODAY card (what is due: People & plans, Money's bills —
   computed by code from their own data), two numbers (spent this month of the budget, food today of the goal), then the
   areas (v6.29: replaced by "Recent" — the last 4 tools with what waits there; TODAY became "What's waiting": also new Scout
   finds, cards to review and a medicine running out). The bottom bar is Home · Chat · Money · Scout · Mind · All (v6.29).
   Tests: tests/unit/v727home.test.mjs (todayList), tests/e2e_v727home.py.                                                       */
import React, { useMemo, useState } from "react";
import { MessageCircle, ArrowUp, Camera, Zap, Menu, ChevronRight, Binoculars, GraduationCap, Pill, AlertTriangle } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { loadLife } from "./life.js";
import { loadRadar } from "./deadlines.js";
import { loadCare } from "./care.js";
import { waitingList, toolLine } from "./home.js";
import { loadScout } from "./scout.js";
import { recentTools } from "./side-ui.jsx";
import { loadLedger } from "./myledger.js";
import { moneyOverview, fmt } from "./money-calm.js";
import { todayFacts } from "./desk-ui.jsx";
import { targetsOf } from "./fithome.js";
import { openRead } from "./readaloud-ui.jsx";
import { DoResult, DO_HINTS } from "./doit-ui.jsx";
import { FitToday } from "./health-ui.jsx";

function greeting(now = new Date()) { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

// v6.29 (Ali picked A): the tools you used last, each with what waits there; filled with these when you have used fewer than four
const START_TOOLS = ["scout", "learn", "slides", "convert", "lifeask"];
const readArr = (k) => { const v = readJSON(k); return Array.isArray(v) ? v : []; };
export function PhoneHome({ navTo, onAsk, openAll, name, guardian, doIt, tools = [], openSide }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(null);
  const [tick, setTick] = useState(0);   // v6.28: what Home did (or undid) shows in Today and the two numbers at once
  const ar = getLang() === "ar";
  const hint = DO_HINTS[new Date().getMinutes() % DO_HINTS.length];
  const now = new Date();
  const data = useMemo(() => {
    const ledger = loadLedger(), o = moneyOverview(ledger);
    const fit = readJSON("attune:fit:v1"), tg = fit && fit.profile ? targetsOf(fit.profile) : null;
    const care = loadCare(), scout = loadScout(), courses = readArr("attune:daily:courses:v1"), slides = readArr("attune:slides:v1");
    const known = (id) => tools.some((t) => t[0] === id);
    const recent = [...new Set([...recentTools(), ...START_TOOLS])].filter(known).slice(0, 4);
    return { items: waitingList({ care, radar: loadRadar(), life: loadLife(), ledger, scout, courses }), o, hasLedger: !!ledger, kcal: todayFacts().kcal || 0, goal: tg && tg.kcal ? tg.kcal : 0, reminders: todayFacts().reminders || 0,
      recent: recent.map((id) => ({ t: tools.find((x) => x[0] === id), line: toolLine(id, { scout, courses, slides, ledger, care }) })) };
  }, [tick]);
  // v6.28: Home does it first (food → Fit, money → Money, a dose, a reminder, a debt…); only what it can't do goes to Chat
  const send = () => { const t = text.trim(); if (!t) return; setText(""); let r = null; try { r = doIt ? doIt(t) : null; } catch (e) { r = null; } if (r) { setDone({ ...r, id: Date.now() }); setTick((n) => n + 1); } else onAsk(t); };
  const date = now.toLocaleDateString(ar ? "ar-EG" : undefined, { weekday: "long", day: "numeric", month: "long" });
  const ICON = { scout: Binoculars, learn: GraduationCap, care: Pill };
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  return (
    <div className="calm -mx-3 px-4 pt-3 pb-6 space-y-4" style={{ minHeight: "calc(100vh - 60px)" }} data-testid="phone-home">
      <div className="flex items-start gap-2">
        {/* v6.29 (Ali: "a sidebar where I can see the history of my chats"): ☰ opens it — chats, search, places, pinned tools */}
        {openSide ? <button onClick={openSide} aria-label={tr("Chats and menu")} className="w-9 h-9 -ms-1.5 mt-1 rounded-full grid place-items-center c-sub shrink-0" data-testid="home-menu"><Menu size={21} /></button> : null}
        <div className="min-w-0"><p className="c-sub m-0">{date}</p><h1 className="text-[24px] font-bold m-0 tracking-tight">{tr(greeting(now))}{name ? ", " + name : ""}</h1></div></div>
      <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)" }}>
        <MessageCircle size={17} className="c-sub" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" data-testid="home-ask"
          placeholder={tr("Ask or add anything…")} className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px]" style={{ color: "var(--c-ink)" }} />
        {/* v6.27 Read it to me: any paper read aloud, explained and acted on */}
        <button onClick={() => openRead()} aria-label={tr("Read it to me")} title={tr("Read it to me")} className="w-8 h-8 rounded-full grid place-items-center c-sub" data-testid="home-read"><Camera size={17} /></button>
        <button onClick={send} aria-label={tr("Send")} className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="home-send"><ArrowUp size={16} /></button>
      </div>
      {done ? <DoResult key={done.id} r={done} navTo={navTo} onClose={() => setDone(null)} onUndo={() => setTick((n) => n + 1)} /> : <p className="c-sub text-[12.5px] m-0 -mt-2 px-1" dir="auto" data-testid="home-hint">{tr("Just say it:")} «{ar ? hint[1] : hint[0]}»</p>}
      {/* v6.28 declutter: a card with nothing to say is not shown (nothing due today, nothing spent and no budget) */}
      {data.items.length || data.reminders ? <div className="c-card" data-testid="home-today">
        <div className="flex items-center mb-1"><span className="c-lbl">{tr("What's waiting")}</span><span className="c-sub ms-auto">{data.items.length ? tr("{n} things", { n: data.items.length + (data.reminders || 0) }) : ""}</span></div>
        {data.items.length || data.reminders ? (
          <>
            {data.items.map((x, i) => x.from === "scout" || x.from === "learn" || x.low ? (
              <button key={i} onClick={() => navTo(x.from)} className="w-full flex items-center gap-3 py-2 text-start" data-testid={"home-wait-" + (x.low ? "supply" : x.from)}>
                {(() => { const I = x.low ? AlertTriangle : ICON[x.from]; return <I size={17} className={x.low ? "c-warn shrink-0" : "c-acc shrink-0"} />; })()}
                <b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{x.title}</b><ChevronRight size={15} className="c-sub shrink-0 rtl:-scale-x-100" /></button>
            ) : (
              <button key={i} onClick={() => navTo(x.from === "life" ? "life" : x.from === "radar" ? "radar" : x.from === "care" ? "care" : "money")} className="w-full flex items-center gap-3 py-2 text-start" data-testid="home-due">
                <span className="w-[18px] h-[18px] rounded-md shrink-0" style={{ border: "1.6px solid var(--c-mut)" }} />
                <span className="flex-1 min-w-0"><b className="block truncate text-[14px]" dir="auto">{x.title}</b><span className="c-sub">{x.dose ? (x.late ? tr("Late") : tr("Medicine due")) : x.late ? tr("Late") : new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></span>
                {x.dose ? null : <span className={"c-pill " + (x.late ? "late" : x.dir === "in" ? "" : "due")}><span className="c-num">{x.dir === "in" ? "+" : ""}{fmt(x.amount)}</span></span>}
              </button>))}
            {data.reminders ? <button onClick={() => navTo("reminders")} className="w-full flex items-center gap-3 py-2 text-start c-sub"><Zap size={15} />{tr("{n} reminders today", { n: data.reminders })}</button> : null}
          </>) : (
          null)}
      </div> : null}
      {/* v6.28 (Ali: "Fit & Food should be on the Home page"): today's food, water and the four meals — tap a meal to add to it */}
      <FitToday key={"fit" + tick} openFit={() => navTo("fit")} compact />
      {guardian || null}
      {data.o.monthOut || data.o.budget ? <div>
        <button className="c-card text-start w-full" onClick={() => navTo("money")} data-testid="home-spent">
          <span className="c-lbl">{tr("Spent this month")}</span>
          <div className="c-num text-[20px] font-bold mt-0.5">{fmt(data.o.monthOut)}</div>
          <div className="c-sub">{data.o.budget ? tr("of {b} {c}", { b: fmt(data.o.budget), c: data.o.cur }) : data.o.cur}</div>
          {data.o.budget ? <div className="c-bar mt-2"><i style={{ width: pct(data.o.monthOut, data.o.budget) + "%" }} /></div> : null}
        </button>
      </div> : null}
      {data.recent.length ? <div data-testid="home-recent">
        <p className="c-lbl m-0 mb-2">{tr("Recent")}</p>
        <div className="c-list">
          {data.recent.map(({ t: [id, label, sub, I], line }) => (
            <button key={id} onClick={() => navTo(id)} className="w-full text-start flex items-center gap-3 p-3" data-testid={"home-recent-" + id}>
              <span className="c-ic"><I size={16} /></span>
              <span className="flex-1 min-w-0"><b className="block text-[14px]">{tr(label)}</b><span className="c-sub block truncate" dir="auto">{line || tr(sub)}</span></span>
              <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" /></button>))}
        </div>
        <button onClick={openAll} className="c-acc text-[13px] font-medium mt-2" data-testid="home-all">{tr("All tools")} →</button>
      </div> : null}
    </div>);
}
