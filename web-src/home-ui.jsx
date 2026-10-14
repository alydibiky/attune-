/* ---- v6.27: the phone's Home in design A "Calm" (Ali picked it, 13 Oct 2026; mock-up: claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4)
   Greeting + date, an "Ask or add anything" box (→ Chat), a short TODAY card (what is due: People & plans, Money's bills —
   computed by code from their own data), two numbers (spent this month of the budget, food today of the goal), then the
   areas (Money · Health · Mind · Files · Places · All). The bottom bar is Home · Chat · Money · Health · Mind · All.
   Tests: tests/unit/v727home.test.mjs (todayList), tests/e2e_v727home.py.                                                       */
import React, { useMemo, useState } from "react";
import { MessageCircle, ArrowUp, Wallet, Heart, Brain, FileText, MapPin, LayoutGrid, Users, Zap } from "lucide-react";
import { tr } from "./i18n.js";
import { loadLife } from "./life.js";
import { loadRadar } from "./deadlines.js";
import { loadCare } from "./care.js";
import { todayList } from "./home.js";
import { loadLedger } from "./myledger.js";
import { moneyOverview, fmt } from "./money-calm.js";
import { todayFacts } from "./desk-ui.jsx";
import { targetsOf } from "./fithome.js";

function greeting(now = new Date()) { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

export function PhoneHome({ navTo, onAsk, openAll, name, guardian }) {
  const [text, setText] = useState("");
  const now = new Date();
  const data = useMemo(() => {
    const ledger = loadLedger(), o = moneyOverview(ledger);
    const fit = readJSON("attune:fit:v1"), tg = fit && fit.profile ? targetsOf(fit.profile) : null;
    return { items: todayList({ care: loadCare(), radar: loadRadar(), life: loadLife(), ledger }), o, hasLedger: !!ledger, kcal: todayFacts().kcal || 0, goal: tg && tg.kcal ? tg.kcal : 0, reminders: todayFacts().reminders || 0 };
  }, []);
  const send = () => { const t = text.trim(); if (!t) return; setText(""); onAsk(t); };
  const date = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const AREAS = [["money", "Money", Wallet], ["fit", "Health", Heart], ["memory", "Mind", Brain], ["convert", "Files", FileText], ["map", "Places", MapPin], ["all", "All", LayoutGrid]];
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  return (
    <div className="calm -mx-3 px-4 pt-3 pb-6 space-y-4" style={{ minHeight: "calc(100vh - 60px)" }} data-testid="phone-home">
      <div><p className="c-sub m-0">{date}</p><h1 className="text-[24px] font-bold m-0 tracking-tight">{tr(greeting(now))}{name ? ", " + name : ""}</h1></div>
      <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)" }}>
        <MessageCircle size={17} className="c-sub" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" data-testid="home-ask"
          placeholder={tr("Ask or add anything…")} className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px]" style={{ color: "var(--c-ink)" }} />
        <button onClick={send} aria-label={tr("Send")} className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "#fff" }}><ArrowUp size={16} /></button>
      </div>
      <div className="c-card" data-testid="home-today">
        <div className="flex items-center mb-1"><span className="c-lbl">{tr("Today")}</span><span className="c-sub ms-auto">{data.items.length ? tr("{n} things", { n: data.items.length + (data.reminders || 0) }) : ""}</span></div>
        {data.items.length || data.reminders ? (
          <>
            {data.items.map((x, i) => (
              <button key={i} onClick={() => navTo(x.from === "life" ? "life" : x.from === "radar" ? "radar" : x.from === "care" ? "care" : "money")} className="w-full flex items-center gap-3 py-2 text-start" data-testid="home-due">
                <span className="w-[18px] h-[18px] rounded-md shrink-0" style={{ border: "1.6px solid var(--c-mut)" }} />
                <span className="flex-1 min-w-0"><b className="block truncate text-[14px]" dir="auto">{x.title}</b><span className="c-sub">{x.dose ? (x.late ? tr("Late") : tr("Medicine due")) : x.late ? tr("Late") : new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></span>
                {x.dose ? null : <span className={"c-pill " + (x.late ? "late" : x.dir === "in" ? "" : "due")}><span className="c-num">{x.dir === "in" ? "+" : ""}{fmt(x.amount)}</span></span>}
              </button>))}
            {data.reminders ? <button onClick={() => navTo("reminders")} className="w-full flex items-center gap-3 py-2 text-start c-sub"><Zap size={15} />{tr("{n} reminders today", { n: data.reminders })}</button> : null}
          </>) : (
          <button onClick={() => navTo("life")} className="w-full text-start py-1.5 c-sub flex items-center gap-2" data-testid="home-empty"><Users size={15} />{tr("Nothing due. Add a debt, an installment or a bill in People & plans.")}</button>)}
      </div>
      {guardian || null}
      <div className="grid grid-cols-2 gap-3">
        <button className="c-card text-start" onClick={() => navTo("money")} data-testid="home-spent">
          <span className="c-lbl">{tr("Spent this month")}</span>
          <div className="c-num text-[20px] font-bold mt-0.5">{fmt(data.o.monthOut)}</div>
          <div className="c-sub">{data.o.budget ? tr("of {b} {c}", { b: fmt(data.o.budget), c: data.o.cur }) : data.o.cur}</div>
          {data.o.budget ? <div className="c-bar mt-2"><i style={{ width: pct(data.o.monthOut, data.o.budget) + "%" }} /></div> : null}
        </button>
        <button className="c-card text-start" onClick={() => navTo("fit")} data-testid="home-food">
          <span className="c-lbl">{tr("Food today")}</span>
          <div className="c-num text-[20px] font-bold mt-0.5">{fmt(data.kcal)}</div>
          <div className="c-sub">{data.goal ? tr("of {g} kcal", { g: fmt(data.goal) }) : "kcal"}</div>
          {data.goal ? <div className="c-bar mt-2"><i style={{ width: pct(data.kcal, data.goal) + "%" }} /></div> : null}
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2.5" data-testid="home-areas">
        {AREAS.map(([id, label, I]) => (
          <button key={id} onClick={() => (id === "all" ? openAll() : navTo(id))} data-testid={"home-area-" + id}
            className="c-card flex flex-col gap-1.5 text-start font-semibold text-[13px]" style={{ padding: 12 }}>
            <I size={18} className="c-acc" />{tr(label)}</button>))}
      </div>
    </div>);
}
