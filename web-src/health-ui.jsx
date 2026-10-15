/* ---- v6.28 Health (mode "health") — Ali: "Health opens Fit & Food, not a health page" and "Fit & Food should be on Home".
   One page for the body: Fit & Food today (calories against the goal, protein / carbohydrates / fat, water with + glass, the four
   meals — tap one to add to it), Family health (the next dose, late doses, a medicine running out, the last blood sugar) and Cycle.
   FitToday is also the card on Home. Everything is read from each tool's own data by code. Tests: tests/e2e_v732health.py.     */
import React, { useState } from "react";
import { Apple, Heart, Droplet, Plus, ChevronRight, AlertTriangle, Pill } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fit.js";
import { targetsOf } from "./fithome.js";
import { loadCare, dosesOn, lowSupply, insulinState } from "./care.js";
import { cycleLoad, cycleStats, dayKey as cycleKey } from "./cycle.jsx";

const MEAL = { breakfast: ["Breakfast", "الفطار"], lunch: ["Lunch", "الغداء"], dinner: ["Dinner", "العشاء"], snacks: ["Snacks", "سناكس"] };
const readFit = () => { try { return JSON.parse(localStorage.getItem("attune:fit:v1") || "null"); } catch (e) { return null; } };
const fmt = (n) => Math.round(n || 0).toLocaleString("en-US");

/** Fit & Food today: one card. openFit(meal?) opens Fit (on adding to that meal). */
export function FitToday({ openFit, compact = false }) {
  const ar = getLang() === "ar";
  const [fit, setFit] = useState(readFit);
  const key = F.today(), day = (fit && fit.days && fit.days[key]) || { meals: {}, water: 0 };
  const tot = F.dayTotals(day), tg = fit && fit.profile ? targetsOf(fit.profile) : null;
  const pct = tg && tg.kcal ? Math.min(100, Math.round((tot.kcal / tg.kcal) * 100)) : 0;
  const glasses = Math.round((tot.water || 0) / 250), goalGl = tg && tg.water ? Math.round(tg.water / 250) : 8;
  const addWater = () => {
    const f = readFit() || { profile: null, days: {}, weights: [] };
    const d = (f.days || {})[key] || { meals: {}, water: 0, workouts: [] };
    const n = { ...f, days: { ...(f.days || {}), [key]: { ...d, water: (d.water || 0) + 250 } } };
    try { localStorage.setItem("attune:fit:v1", JSON.stringify(n)); } catch (e) {}
    setFit(n);
  };
  const open = (meal) => { if (meal) { try { localStorage.setItem("attune:fit:openAdd", meal); } catch (e) {} } openFit && openFit(meal); };
  if (!fit || !fit.profile) return (
    <button className="c-card w-full text-start flex items-center gap-3" onClick={() => open("")} data-testid="fit-today-setup">
      <span className="c-ic"><Apple size={17} /></span><span className="flex-1"><b className="block">{tr("Fit & Food")}</b><span className="c-sub text-[12.5px]">{tr("Set it up in a minute — then log a meal by typing, saying or a photo.")}</span></span><ChevronRight size={16} className="c-sub rtl:-scale-x-100" /></button>);
  return (
    <div className="c-card space-y-2.5" data-testid="fit-today-card">
      <button className="w-full flex items-center gap-2 text-start" onClick={() => open("")}>
        <span className="c-ic"><Apple size={16} /></span><b className="flex-1">{tr("Fit & Food")}</b>
        <span className="c-num text-[13px]" data-testid="fit-today-kcal"><b>{fmt(tot.kcal)}</b><span className="c-sub"> / {fmt(tg.kcal)} {tr("kcal")}</span></span><ChevronRight size={15} className="c-sub rtl:-scale-x-100" /></button>
      <div className="c-bar"><i style={{ width: pct + "%" }} /></div>
      {!compact ? <div className="flex gap-3 text-[12px] c-sub c-num"><span>{tr("Protein")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.p)}</b>/{fmt(tg.protein)} g</span><span>{tr("Carbs")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.c)}</b>/{fmt(tg.carbs)} g</span><span>{tr("Fat")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.f)}</b>/{fmt(tg.fat)} g</span></div> : null}
      <div className="grid grid-cols-4 gap-1.5" data-testid="fit-today-meals">
        {F.MEALS.map((m) => { const items = (day.meals || {})[m] || [], k = items.reduce((a, x) => a + (x.kcal || 0), 0);
          return <button key={m} onClick={() => open(m)} className="rounded-xl border px-1.5 py-2 text-center" style={{ borderColor: "var(--c-ln)", background: items.length ? "var(--c-soft)" : "transparent", color: "var(--c-ink)" }} data-testid={"fit-today-" + m}>
            <span className="block text-[11.5px] c-sub">{ar ? MEAL[m][1] : MEAL[m][0]}</span>
            {items.length ? <span className="block c-num text-[13px] font-semibold">{fmt(k)}</span> : <Plus size={15} className="mx-auto c-acc" />}</button>; })}
      </div>
      <div className="flex items-center gap-2 text-[12.5px]"><Droplet size={14} className="c-acc" /><span className="c-sub flex-1 c-num">{tr("Water")} {glasses}/{goalGl} {tr("glasses")}</span>
        <button className="c-acc inline-flex items-center gap-1 font-medium" onClick={addWater} data-testid="fit-today-water"><Plus size={14} />{tr("glass")}</button></div>
    </div>);
}

export function HealthPage({ navTo, cycleOn }) {
  const ar = getLang() === "ar";
  const care = loadCare(), doses = dosesOn(care), next = doses.find((d) => !d.taken), late = doses.filter((d) => d.late).length;
  const low = lowSupply(care), ins = insulinState(care);
  const cyc = (() => { try { const st = cycleLoad(); return Object.keys(st.days || {}).length ? cycleStats(st, cycleKey(new Date())) : null; } catch (e) { return null; } })();
  const daysTo = cyc && cyc.nextStart ? Math.round((Date.parse(cyc.nextStart + "T12:00:00") - Date.parse(cycleKey(new Date()) + "T12:00:00")) / 86400000) : null;
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="health-page">
      <h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Heart size={20} className="c-acc" />{tr("Health")}</h2>
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start">
        <FitToday openFit={() => navTo("fit")} />
        <button className="c-card w-full text-start space-y-1.5" onClick={() => navTo("care")} data-testid="health-care">
          <span className="flex items-center gap-2"><span className="c-ic"><Pill size={16} /></span><b className="flex-1">{tr("Family health")}</b><ChevronRight size={15} className="c-sub rtl:-scale-x-100" /></span>
          {!care.meds.some((m) => !m.stopped) ? <span className="c-sub text-[12.5px] block">{tr("Medicines and reminders for the family, lab results over time")}</span> : <>
            {next ? <span className="block text-[13.5px]" dir="auto">{tr("Next")}: <b>{next.time} · {next.med.name}</b>{next.member && care.members.length > 1 ? " · " + next.member.name : ""}</span> : <span className="block text-[13.5px] c-pos">{tr("Every dose today is taken")}</span>}
            {late ? <span className="block text-[12.5px] c-neg">{tr("{n} late", { n: late })}</span> : null}
            {low.map((x) => <span key={x.med.id} className="flex gap-1 text-[12.5px] c-warn" dir="auto"><AlertTriangle size={13} className="mt-0.5" />{x.med.name}: {x.days <= 0 ? tr("runs out today") : (x.days === 1 ? tr("about 1 day left") : tr("about {n} days left", { n: x.days }))}</span>)}
            {ins.sugar ? <span className={"block text-[12.5px] " + (ins.sugar.low ? "c-neg" : "c-sub")}>{tr("Blood sugar")} {ins.sugar.value} {ins.sugar.unit}</span> : null}</>}
        </button>
        {cycleOn || cyc ? <button className="c-card w-full text-start space-y-1" onClick={() => navTo("cycle")} data-testid="health-cycle">
          <span className="flex items-center gap-2"><span className="c-ic"><Droplet size={16} /></span><b className="flex-1">{tr("Cycle")}</b><ChevronRight size={15} className="c-sub rtl:-scale-x-100" /></span>
          <span className="block text-[13.5px]">{!cyc ? tr("Log the first day of your period to see predictions.") : cyc.inPeriod ? tr("Period — day {n}", { n: cyc.cycleDay }) : cyc.late ? tr("{n} days late", { n: cyc.late }) : daysTo != null ? tr("Next period in {n} days", { n: daysTo }) : ""}</span></button> : null}
      </div>
    </div>);
}
