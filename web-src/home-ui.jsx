/* ---- v6.27: the phone's Home in design A "Calm" (Ali picked it, 13 Oct 2026; mock-up: claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4)
   Greeting + date, an "Ask or add anything" box (→ Chat), a short TODAY card (what is due: People & plans, Money's bills —
   computed by code from their own data), two numbers (spent this month of the budget, food today of the goal), then the
   areas (v6.29: replaced by "Recent" — the last 4 tools with what waits there; TODAY became "What's waiting": also new Scout
   finds, cards to review and a medicine running out). The bottom bar is Home · Chat · Money · Scout · Mind · All (v6.29).
   Tests: tests/unit/v727home.test.mjs (todayList), tests/e2e_v727home.py.                                                       */
import React, { useMemo, useState } from "react";
import { MessageCircle, ArrowUp, Camera, Zap, Menu, ChevronRight, Binoculars, GraduationCap, Pill, AlertTriangle, Apple, FileText, Wallet, Heart, Briefcase, BookOpen, ImageIcon, LayoutGrid } from "lucide-react";
import { RecallCard } from "./recall-ui.jsx";
import { tr, getLang } from "./i18n.js";
import { loadLife } from "./life.js";
import { loadRadar } from "./deadlines.js";
import { loadCare } from "./care.js";
import { waitingList, toolLine, todayLine } from "./home.js";
import { loadScout } from "./scout.js";
import { recentTools } from "./side-ui.jsx";
import { loadLedger } from "./myledger.js";
import { moneyOverview, fmt } from "./money-calm.js";
import { todayFacts } from "./desk-ui.jsx";
import { targetsOf } from "./fithome.js";
import { openRead } from "./readaloud-ui.jsx";
import { DoResult, DO_HINTS } from "./doit-ui.jsx";
import { FitToday } from "./health-ui.jsx";
import { tickRegular, payRadar } from "./regular.js";
import { MissionsLine } from "./missions-ui.jsx";

function greeting(now = new Date()) { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

// v6.29 (Ali picked A): the tools you used last, each with what waits there; filled with these when you have used fewer than four
const START_TOOLS = ["scout", "learn", "slides", "convert", "lifeask"];
const WORK = ["business", "fleet", "crane", "field", "convert", "translate", "pdfchat", "slides", "cv", "code", "studio", "map", "travel", "video"];
const LINE_APP = { fit: "Food", money: "Money", reminders: "Reminder" };
const LINE_COL = { fit: "#B35C0F", money: "#1F6BBF", reminders: "#6B4FB8" };
const readArr = (k) => { const v = readJSON(k); return Array.isArray(v) ? v : []; };
export function PhoneHome({ navTo, onAsk, openAll, name, guardian, doIt, tools = [], openSide, minimal = false, openFitAdd = null }) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(null);
  const [tick, setTick] = useState(0);   // v6.28: what Home did (or undid) shows in Today and the two numbers at once
  const [note, setNote] = useState("");   // v6.34: "Recorded in Money: 600 EGP — Maid"
  const ar = getLang() === "ar";
  const hint = DO_HINTS[new Date().getMinutes() % DO_HINTS.length];
  const now = new Date();
  const data = useMemo(() => {
    const ledger = loadLedger(), o = moneyOverview(ledger);
    const fit = readJSON("attune:fit:v1"), tg = fit && fit.profile ? targetsOf(fit.profile) : null;
    const care = loadCare(), scout = loadScout(), courses = readArr("attune:daily:courses:v1"), slides = readArr("attune:slides:v1");
    const known = (id) => tools.some((t) => t[0] === id);
    const recent = [...new Set([...recentTools(), ...START_TOOLS])].filter(known).slice(0, 4);
    return { items: waitingList({ care, radar: loadRadar(), life: loadLife(), ledger, scout, courses }), o, hasLedger: !!ledger, fitOn: !!(fit && fit.profile), kcal: todayFacts().kcal || 0, goal: tg && tg.kcal ? tg.kcal : 0, reminders: todayFacts().reminders || 0,
      recent: recent.map((id) => ({ t: tools.find((x) => x[0] === id), line: toolLine(id, { scout, courses, slides, ledger, care }) })),
      // v6.36 layout 1A: the four areas' one-line state
      learn: (() => { const c = courses.find((x) => x && Array.isArray(x.plan) && x.plan.length); return c ? { title: c.topic || c.title || "", n: (c.lessons || []).filter((l) => l.read).length, of: c.plan.length } : null; })(),
      work: [...new Set(recentTools())].filter((id) => WORK.includes(id)).slice(0, 2).map((id) => (tools.find((x) => x[0] === id) || [id, id])[1]),
      // v6.43 (Ali picked "1 + the Today line"): today across the apps, by time
      line: minimal ? todayLine({ fit, ledger, reminders: readJSON("attune:reminders:v1"), now: Date.now() }).line : [] };
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
      {minimal ? (
        /* v6.43 option 1 (Ali): one big box — say anything, Attune does it in every app it touches */
        <div className="rounded-[26px] p-4 space-y-2" style={{ background: "var(--c-surf)", boxShadow: "0 2px 10px rgba(16,32,28,.10)" }} data-testid="home-box">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} dir="auto" data-testid="home-ask" rows={2}
            placeholder={tr("Say anything — «koshari for lunch, paid 85», «remind me at 9», «find a Tucson 2022»")} className="w-full resize-none bg-transparent focus:outline-none text-[16.5px] font-semibold leading-snug placeholder:font-normal" style={{ color: "var(--c-ink)" }} />
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => (openFitAdd ? openFitAdd() : navTo("fit"))} aria-label={tr("Food photo")} title={tr("Food photo")} className="w-10 h-10 rounded-full grid place-items-center c-sub" style={{ background: "var(--c-bg)" }} data-testid="home-quick-food"><Apple size={18} /></button>
            <button onClick={() => openRead()} aria-label={tr("Read it to me")} title={tr("Read it to me")} className="w-10 h-10 rounded-full grid place-items-center c-sub" style={{ background: "var(--c-bg)" }} data-testid="home-read"><Camera size={18} /></button>
            <button onClick={send} aria-label={tr("Send")} className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="home-send"><ArrowUp size={18} /></button>
          </div>
        </div>) : (
      <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)" }}>
        <MessageCircle size={17} className="c-sub" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" data-testid="home-ask"
          placeholder={tr("Ask or add anything…")} className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px]" style={{ color: "var(--c-ink)" }} />
        {/* v6.27 Read it to me: any paper read aloud, explained and acted on */}
        <button onClick={() => openRead()} aria-label={tr("Read it to me")} title={tr("Read it to me")} className="w-8 h-8 rounded-full grid place-items-center c-sub" data-testid="home-read"><Camera size={17} /></button>
        <button onClick={send} aria-label={tr("Send")} className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="home-send"><ArrowUp size={16} /></button>
      </div>)}
      {/* v6.36 layout 1A (Ali picked it): one box, three quick starts under it — tools are reached by asking, not from a list */}
      <RecallCard text={text} navTo={navTo} className="-mt-1" />
      {minimal ? null : <div className="flex gap-2 overflow-x-auto -mt-1 pb-0.5" data-testid="home-quick">
        {[[Apple, "Food photo", () => (openFitAdd ? openFitAdd() : navTo("fit")), "home-quick-food"], [FileText, "A file", () => navTo("pdfchat"), "home-quick-file"], [Binoculars, "Find for me", () => navTo("scout"), "home-quick-scout"]].map(([I, l, go, id]) => (
          <button key={id} onClick={go} className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" }} data-testid={id}><I size={14} className="c-acc" />{tr(l)}</button>))}
      </div>}
      {done ? <DoResult key={done.id} r={done} navTo={navTo} onClose={() => setDone(null)} onUndo={() => setTick((n) => n + 1)} /> : minimal ? null : <p className="c-sub text-[12.5px] m-0 -mt-2 px-1" dir="auto" data-testid="home-hint">{tr("Just say it:")} «{ar ? hint[1] : hint[0]}»</p>}
      {/* v6.28 declutter: a card with nothing to say is not shown (nothing due today, nothing spent and no budget) */}
      {data.items.length || data.reminders || note ? <div className="c-card" data-testid="home-today">
        <div className="flex items-center mb-1"><span className="c-lbl">{minimal ? tr("Needs you") : tr("Attune suggests")}</span><span className="c-sub ms-auto">{data.items.length ? (data.items.length + (data.reminders || 0) === 1 ? tr("1 thing") : tr("{n} things", { n: data.items.length + (data.reminders || 0) })) : ""}</span></div>
        {data.items.length || data.reminders || note ? (
          <>
            {data.items.map((x, i) => x.pay ? (
              // v6.34 (Ali): the maid's Saturday, a subscription's or a bill's day — "Paid?": tick = the expense in Money at once
              <div key={i} className="w-full flex items-center gap-3 py-2" data-testid={x.pay.kind === "radar" ? "home-pay-radar" : "home-regular"}>
                <button onClick={() => {
                    const r = x.pay.kind === "radar" ? payRadar(x.pay.id, true) : tickRegular(x.pay.id, x.pay.i, true);
                    if (r.recorded) setNote(tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: x.pay.cur, t: x.title }));
                    else { if (x.pay.kind !== "radar") tickRegular(x.pay.id, x.pay.i, false); navTo("money"); }
                    setTick((n) => n + 1); }}
                  aria-label={tr("Paid")} className="w-[22px] h-[22px] rounded-md shrink-0" style={{ border: "1.8px solid var(--c-acc)" }} data-testid="home-regular-tick" />
                <button onClick={() => navTo(x.pay.kind === "radar" ? "radar" : "life")} className="flex-1 min-w-0 text-start"><b className="block truncate text-[14px]" dir="auto">{x.title}</b>
                  <span className={x.late ? "c-neg" : "c-sub"}>{x.late ? tr("Was due {d} — paid?", { d: new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) }) : tr("Due today — paid? Tick it")}</span></button>
                {x.pay.kind === "radar" ? <button onClick={() => { payRadar(x.pay.id, false); setNote(tr("Marked as not renewed — {t}", { t: x.title })); setTick((n) => n + 1); }} className="c-sub text-[12px] shrink-0 px-1" data-testid="home-pay-no">{tr("No")}</button> : null}
                <span className="c-pill due"><span className="c-num">{fmt(x.amount)}</span></span>
              </div>
            ) : x.from === "scout" || x.from === "learn" || x.low ? (
              <button key={i} onClick={() => navTo(x.from)} className="w-full flex items-center gap-3 py-2 text-start" data-testid={"home-wait-" + (x.low ? "supply" : x.from)}>
                {(() => { const I = x.low ? AlertTriangle : ICON[x.from]; return <I size={17} className={x.low ? "c-warn shrink-0" : "c-acc shrink-0"} />; })()}
                <b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{x.title}</b><ChevronRight size={15} className="c-sub shrink-0 rtl:-scale-x-100" /></button>
            ) : (
              <button key={i} onClick={() => navTo(x.from === "life" ? "life" : x.from === "radar" ? "radar" : x.from === "care" ? "care" : "money")} className="w-full flex items-center gap-3 py-2 text-start" data-testid="home-due">
                <span className="w-[18px] h-[18px] rounded-md shrink-0" style={{ border: "1.6px solid var(--c-mut)" }} />
                <span className="flex-1 min-w-0"><b className="block truncate text-[14px]" dir="auto">{x.title}</b><span className="c-sub">{x.dose ? (x.late ? tr("Late") : tr("Medicine due")) : x.late ? tr("Late") : new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></span>
                {x.dose ? null : <span className={"c-pill " + (x.late ? "late" : x.dir === "in" ? "" : "due")}><span className="c-num">{x.dir === "in" ? "+" : ""}{fmt(x.amount)}</span></span>}
              </button>))}
            {note ? <p className="c-pos text-[13px] m-0 py-1" data-testid="home-regular-note" dir="auto">✓ {note}</p> : null}
            {data.reminders ? <button onClick={() => navTo("reminders")} className="w-full flex items-center gap-3 py-2 text-start c-sub"><Zap size={15} />{tr("{n} reminders today", { n: data.reminders })}</button> : null}
          </>) : (
          null)}
      </div> : null}
      {!minimal ? <>
      {/* v6.28 (Ali: "Fit & Food should be on the Home page"): today's food, water and the four meals — tap a meal to add to it */}
        {/* v6.31 minimal: the "set it up" card is an advert — Home shows Fit & Food once it has your numbers */}
        {minimal && !data.fitOn ? null : <FitToday key={"fit" + tick} openFit={() => navTo("fit")} compact />}
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
                <span className="flex-1 min-w-0"><b className="block text-[14px]">{tr(label)}</b>{line || !minimal ? <span className="c-sub block truncate" dir="auto">{line || tr(sub)}</span> : null}</span>
                <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" /></button>))}
          </div>
          <button onClick={openAll} className="c-acc text-[13px] font-medium mt-2" data-testid="home-all">{tr("All tools")} →</button>
        </div> : null}
      </> : <>
      {/* v6.43 option 1: the apps are one row of names (no tiles) */}
      <div className="flex flex-wrap gap-2" data-testid="home-areas">
        {[["fit", "Food", "home-area-health"], ["money", "Money", "home-area-money"], ["business", "Business", "home-app-business"], ["learn", "Learn", "home-app-learn"], ["studio", "Photos", "home-app-studio"], ["chat", "Chat", "home-app-chat"], ["scout", "Scout", "home-app-scout"]].map(([m, label, id]) => (
          <button key={m} onClick={() => navTo(m)} className="home-chip" data-testid={id}>{tr(label)}</button>))}
        <button onClick={openAll} className="home-chip home-chip-all" data-testid="home-all">{tr("All")}</button>
      </div>
      {guardian || null}
      <MissionsLine go={() => navTo("missions")} />
      {/* v6.43: one line for today across the apps — what you ate, spent, and what is still ahead */}
      <div data-testid="home-line">
        <p className="c-lbl m-0 mb-2">{tr("Today")}</p>
        {data.line.length ? <div className="space-y-2">
          {data.line.map((x, i) => (
            <button key={i} onClick={() => navTo(x.open)} className="w-full flex items-start gap-3 text-start" data-testid={"home-line-" + x.app}>
              <span className="w-12 shrink-0 pt-3 text-[12.5px] font-extrabold c-sub c-num">{x.hm}</span>
              <span className={"flex-1 min-w-0 c-card p-3 " + (x.ahead ? "opacity-80" : "")}>
                <span className="block text-[11px] font-extrabold tracking-wide" style={{ color: LINE_COL[x.app] || "var(--c-acc)" }}>{tr(LINE_APP[x.app] || x.app).toUpperCase()}</span>
                <b className="block text-[14px] truncate" dir="auto">{x.title}</b>{x.sub ? <span className="c-sub block text-[12.5px] truncate" dir="auto">{x.sub}</span> : null}</span>
            </button>))}
        </div> : <p className="c-sub text-[13px] m-0" data-testid="home-line-empty">{tr("Nothing yet today — tell the box what you ate, spent or need to remember.")}</p>}
      </div>
      </>}
    </div>);
}
