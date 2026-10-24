/* ---- v6.28 Health (mode "health") — Ali: "Health opens Fit & Food, not a health page" and "Fit & Food should be on Home".
   One page for the body: Fit & Food today (calories against the goal, protein / carbohydrates / fat, water with + glass, the four
   meals — tap one to add to it), Family health (the next dose, late doses, a medicine running out, the last blood sugar) and Cycle.
   FitToday is also the card on Home. Everything is read from each tool's own data by code. Tests: tests/e2e_v732health.py.     */
import React, { useState } from "react";
import { Apple, Heart, Droplet, Plus, ChevronRight, AlertTriangle, Pill, Check } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as F from "./fit.js";
import { targetsOf } from "./fithome.js";
import { loadCare, saveCare, markTaken, dosesOn, lowSupply, insulinState } from "./care.js";
import { cycleLoad, cycleStats, dayKey as cycleKey } from "./cycle.jsx";
import { cardPad, page, h1, tag } from "./ui-kit.jsx";
import { HealthBox, HealthReport, HealthReportCta } from "./health-calm-ui.jsx";   // v7.3 Gemini's Area 2: Health
import { healthReport } from "./health-report.js";
import { useSubBack } from "./backstack.js";
import { sharePdf } from "./books-docs.jsx";

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
    <button className={"calm " + cardPad + " w-full text-start flex items-center gap-3 min-h-[56px] hover:border-[var(--c-acc)]"} onClick={() => open("")} data-testid="fit-today-setup">
      <span className="c-ic"><Apple size={17} /></span><span className="flex-1"><b className="block font-extrabold">{tr("Fit & Food")}</b><span className="c-sub text-[12.5px]">{tr("Set it up in a minute — then log a meal by typing, saying or a photo.")}</span></span><ChevronRight size={16} className="c-sub rtl:rotate-180" /></button>);
  return (
    <div className={"calm " + cardPad + " space-y-3"} data-testid="fit-today-card">
      <button className="w-full min-h-[44px] flex items-center gap-2 text-start" onClick={() => open("")}>
        <span className="c-ic"><Apple size={16} /></span><span className="flex-1 min-w-0"><b className="block font-extrabold">{tr("Fit & Food")}</b>
          {tg && tg.kcal ? <span className="block c-sub text-[12px] tabular-nums" data-testid="fit-today-left">{tot.kcal <= tg.kcal ? tr("{n} kcal left today", { n: fmt(tg.kcal - tot.kcal) }) : tr("{n} kcal above today's target", { n: fmt(tot.kcal - tg.kcal) })}</span> : null}</span>
        <span className="c-num tabular-nums text-[13px]" data-testid="fit-today-kcal"><b className="text-[17px] font-black">{fmt(tot.kcal)}</b><span className="c-sub"> / {fmt(tg.kcal)} {tr("kcal")}</span></span><ChevronRight size={15} className="c-sub rtl:rotate-180" /></button>
      <div className="c-bar"><i style={{ width: pct + "%" }} /></div>
      {!compact ? <div className="flex justify-between gap-2 text-[12px] c-sub c-num whitespace-nowrap"><span>{tr("Protein")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.p)}</b>/{fmt(tg.protein)} g</span><span>{tr("Carbs")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.c)}</b>/{fmt(tg.carbs)} g</span><span>{tr("Fat")} <b style={{ color: "var(--c-ink)" }}>{fmt(tot.f)}</b>/{fmt(tg.fat)} g</span></div> : null}
      <div className="grid grid-cols-4 gap-1.5" data-testid="fit-today-meals">
        {F.MEALS.map((m) => { const items = (day.meals || {})[m] || [], k = items.reduce((a, x) => a + (x.kcal || 0), 0);
          return <button key={m} onClick={() => open(m)} className="rounded-[16px] border px-1.5 py-2 min-h-[52px] text-center transition-colors duration-150" style={{ borderColor: items.length ? "var(--c-acc)" : "var(--c-ln)", background: items.length ? "var(--c-soft)" : "transparent", color: "var(--c-ink)" }} data-testid={"fit-today-" + m}>
            <span className="block text-[11px] c-sub truncate" style={{ wordBreak: "keep-all" }}>{ar ? MEAL[m][1] : MEAL[m][0]}</span>
            {items.length ? <span className="block c-num tabular-nums text-[13px] font-extrabold">{fmt(k)}</span> : <Plus size={15} className="mx-auto c-acc" />}</button>; })}
      </div>
      <div className="flex items-center gap-2 text-[12.5px]"><Droplet size={14} className="c-acc" /><span className="c-sub flex-1 c-num">{tr("Water")} {glasses}/{goalGl} {tr("glasses")}</span>
        <button className="c-acc min-h-[44px] px-2 inline-flex items-center gap-1 font-extrabold" onClick={addWater} data-testid="fit-today-water"><Plus size={14} />{tr("glass")}</button></div>
    </div>);
}

/** v7.3 (Gemini's Area 2): Family health today — the next doses with Take, and a medicine running out. */
function FamilyToday({ navTo, wide, tick }) {
  const [care, setCare] = useState(() => loadCare());
  React.useEffect(() => { setCare(loadCare()); }, [tick]);
  const doses = dosesOn(care), next = doses.filter((d) => !d.taken), late = doses.filter((d) => d.late).length;
  const low = lowSupply(care), ins = insulinState(care), any = care.meds.some((m) => !m.stopped);
  const take = (d) => setCare(saveCare(markTaken(loadCare(), d.key)));
  const who = (d) => (d.member && care.members.length > 1 ? d.member.name : "");
  return (
    <div className={cardPad + " w-full space-y-2.5"} data-testid="health-care">
      <button className="w-full min-h-[40px] flex items-center gap-2 text-start" onClick={() => navTo("care")} data-testid="health-care-open">
        <span className="c-ic"><Pill size={16} /></span><b className="flex-1 font-extrabold">{tr("Family health")}</b>
        {any ? <span className={tag("gray") + " tabular-nums"}>{doses.length === 1 ? tr("1 dose today") : tr("{n} doses today", { n: doses.length })}</span> : null}<ChevronRight size={15} className="c-sub rtl:rotate-180" /></button>
      {!any ? <span className="c-sub text-[12.5px] block">{tr("Medicines and reminders for the family, lab results over time")}</span> : <>
        {!next.length ? <span className="block text-[13.5px] c-pos font-bold">{tr("Every dose today is taken")}</span> : null}
        {(wide ? doses.filter((d) => !d.taken).slice(0, 2) : next.slice(0, 1)).map((d) => (
          <div key={d.key} className="flex items-center justify-between gap-2 rounded-[14px] px-3 py-2.5 min-h-[52px]" style={{ background: "var(--c-surf-2)" }} data-testid="health-dose">
            <span className="min-w-0" dir="auto"><span className="block text-[13.5px] font-extrabold truncate">{d === next[0] ? tr("Next") + ": " : ""}<span className="tabular-nums">{d.time}</span> · {d.med.name}{d.med.dose ? " " + d.med.dose : ""}</span>
              {who(d) || d.late ? <span className={"block text-[12px] " + (d.late ? "c-warn font-bold" : "c-sub")}>{who(d)}{who(d) && d.late ? " · " : ""}{d.late ? tr("late") : ""}</span> : null}</span>
            <button className="shrink-0 min-h-[36px] px-3 rounded-full text-[12.5px] font-extrabold border inline-flex items-center gap-1" style={{ borderColor: "var(--c-acc)", color: "var(--c-acc)", background: "var(--c-soft)" }} onClick={() => take(d)} data-testid="health-dose-take"><Check size={13} />{tr("Take")}</button>
          </div>))}
        {late > 1 ? <span className="block text-[12.5px] c-warn font-bold">{tr("{n} late", { n: late })}</span> : null}
        {low.map((x) => (
          <div key={x.med.id} className="flex items-center gap-2 rounded-[12px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "color-mix(in srgb, var(--c-warn) 12%, transparent)", color: "var(--c-warn)" }} dir="auto">
            <AlertTriangle size={14} className="shrink-0" /><span className="flex-1 min-w-0">{x.med.name}: {x.days <= 0 ? tr("runs out today") : (x.days === 1 ? tr("about 1 day left") : tr("about {n} days left", { n: x.days }))}{x.left != null ? " (" + tr("{n} left", { n: x.left }) + ")" : ""}</span>
            <button className="shrink-0 min-h-[32px] underline font-extrabold" onClick={() => navTo("care")} data-testid="health-refill">{tr("I refilled")}</button></div>))}
        {ins.sugar ? <span className={"block text-[12.5px] " + (ins.sugar.low ? "c-neg" : "c-sub")}>{tr("Blood sugar")} {ins.sugar.value} {ins.sugar.unit}</span> : null}</>}
    </div>);
}

/** v7.3: Cycle today — kind words, never red. */
function CycleToday({ navTo, wide, onLog }) {
  const cyc = (() => { try { const st = cycleLoad(); return Object.keys(st.days || {}).length ? cycleStats(st, cycleKey(new Date())) : null; } catch (e) { return null; } })();
  const daysTo = cyc && cyc.nextStart ? Math.round((Date.parse(cyc.nextStart + "T12:00:00") - Date.parse(cycleKey(new Date()) + "T12:00:00")) / 86400000) : null;
  const status = !cyc ? "" : cyc.inPeriod ? tr("Period — day {n}", { n: cyc.cycleDay }) : cyc.late ? tr("{n} days late", { n: cyc.late }) : daysTo != null ? tr("Next period in {n} days", { n: daysTo }) : "";
  const exp = cyc && cyc.nextStart ? (() => { try { return new Date(cyc.nextStart + "T12:00:00").toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "long" }); } catch (e) { return cyc.nextStart; } })() : "";
  return (
    <div className={cardPad + " w-full space-y-2"} data-testid="health-cycle">
      <button className="w-full min-h-[40px] flex items-center gap-2 text-start" onClick={() => navTo("cycle")} data-testid="health-cycle-open">
        <span className="c-ic"><Droplet size={16} /></span><b className="flex-1 font-extrabold">{tr("Cycle")}</b>
        {status ? <span className={tag("gray") + " tabular-nums"}>{status}</span> : null}<ChevronRight size={15} className="c-sub rtl:rotate-180" /></button>
      <span className="block text-[13px] c-sub">{!cyc ? tr("Log the first day of your period to see predictions.") : cyc.late && exp ? tr("Expected {d} — a few days either way is common.", { d: exp }) : exp ? tr("Expected {d}.", { d: exp }) : ""}</span>
      {wide ? <div className="flex flex-wrap gap-2 pt-1">
        <button className="min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold border" style={{ borderColor: "var(--c-acc)", color: "var(--c-acc)", background: "var(--c-soft)" }} onClick={onLog} data-testid="health-period-today">{tr("Period started today")}</button>
        <button className="min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-bold border c-sub" style={{ borderColor: "var(--c-ln)" }} onClick={() => navTo("cycle")}>{tr("Calendar")} →</button></div> : null}
    </div>);
}

/** v7.3 Health in two levels (Gemini's "Area 2: Health"): the calm view first, its Health Report one tap away. */
export function HealthPage({ navTo, cycleOn, doIt, onAsk, listen, openFitAdd }) {
  const [rep, setRep] = useState(false);
  const [tick, setTick] = useState(0);
  useSubBack(rep, () => setRep(false));
  const [listening, setListening] = useState(false);
  const wide = typeof window !== "undefined" && window.innerWidth >= 1024;
  const ar = getLang() === "ar";
  const date = new Date().toLocaleDateString(ar ? "ar-EG" : undefined, { weekday: "long", day: "numeric", month: "long" });
  const hasCycle = (() => { try { return Object.keys(cycleLoad().days || {}).length > 0; } catch (e) { return false; } })();
  // the box: the same reader as the Home box (food, a dose, a period, money, a reminder…); "health report" opens level 2; the rest → Chat
  const submit = async (t) => {
    if (/^\/?(health )?report$|^(my )?health report|تقرير الصح/i.test(t.trim())) { setRep(true); return null; }
    let r = null; try { r = doIt ? doIt(t) : null; } catch (e) { r = null; }
    setTick((n) => n + 1);
    if (r && r.lines) return { ...r, open: (m) => navTo(m), after: () => setTick((n) => n + 1) };
    if (r && r.answer) return { answer: ar ? r.answer.ar || r.answer : r.answer.en || r.answer };
    if (onAsk) { onAsk(t); return null; }
    return { answer: tr("Write what you ate, a dose or your period — or ask") };
  };
  const voice = listen ? async () => { setListening(true); let t = ""; try { t = await listen(ar ? "ar-EG" : ""); } catch (e) {} setListening(false); return t; } : null;
  const report = React.useMemo(() => {
    if (!rep) return null;
    const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
    return healthReport({ fit: j("attune:fit:v1"), care: loadCare(), cycle: cycleLoad(), cycleStats });
  }, [rep, tick]);
  const range = (() => { const f = (d) => d.toLocaleDateString(ar ? "ar-EG" : undefined, { day: "numeric", month: "short" }); const a = new Date(); a.setDate(a.getDate() - 6); return f(a) + " – " + f(new Date()); })();
  const printPdf = () => {
    if (!report) return;
    const esc = (x) => String(x == null ? "" : x).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const f = report.fit, w = report.weight, m = report.meds;
    const html = `<!doctype html><html dir="${ar ? "rtl" : "ltr"}"><head><meta charset="utf-8"><style>body{font-family:system-ui,"Noto Sans Arabic",sans-serif;color:#16201C;margin:32px;font-size:12px}h1{font-size:20px;margin:0 0 4px}p{color:#4A5852}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{padding:6px 8px;border-bottom:1px solid #E2EAE5;text-align:start}td.n{text-align:end}</style></head><body>
<h1>${esc(tr("Health Report"))}</h1><p>${esc(range)}</p>
<h3>${esc(tr("Calories this week"))}</h3><table>${f.rows.map((r) => `<tr><td>${r.day}</td><td class="n">${r.kcal} kcal</td><td class="n">${(r.water / 1000).toFixed(2)} L</td></tr>`).join("")}</table>
${w ? `<h3>${esc(tr("Weight trend"))}</h3><table>${w.points.map((p) => `<tr><td>${p.d}</td><td class="n">${p.kg} kg</td><td class="n">${p.avg} kg</td></tr>`).join("")}</table>` : ""}
${m.rows.length ? `<h3>${esc(tr("Family medicines & labs"))}</h3><table>${m.rows.map((r) => `<tr><td>${esc((r.member ? r.member.name + " · " : "") + r.med.name + " " + (r.med.dose || ""))}</td><td class="n">${r.taken}/${r.due}</td><td class="n">${r.pct == null ? "" : r.pct + "%"}</td></tr>`).join("")}</table>` : ""}
${report.lab ? `<h3>${esc(report.lab.test)}</h3><table>${report.lab.list.map((l) => `<tr><td>${esc(l.date)}</td><td class="n">${l.value} ${esc(l.unit || "")}</td></tr>`).join("")}</table>` : ""}
<p>${esc(tr("Worked out on this phone from your own entries. Not medical advice."))}</p></body></html>`;
    sharePdf({ html, name: "attune-health-report", text: tr("Health Report") });
  };
  if (rep && report) return (
    <div className={page + " rounded-2xl p-4 md:p-6"} style={{ minHeight: "70vh" }} data-testid="health-page" data-view="report">
      <HealthReport r={report} back={() => setRep(false)} openCare={() => navTo("care")} openCycle={() => navTo("cycle")} openFit={() => navTo("fit")} printPdf={printPdf} rangeLabel={range} />
    </div>);
  return (
    <div className={page + " rounded-2xl p-4 md:p-6 space-y-3.5 lg:space-y-[18px]"} style={{ minHeight: "70vh" }} data-testid="health-page" data-view="calm">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0"><h2 className={h1 + " flex items-center gap-2"}><Heart size={20} className="c-acc" />{tr("Health")}</h2>
          <p className="m-0 mt-0.5 text-[13px] font-semibold c-sub hidden lg:block">{date} · {tr("Today in one calm look")}</p></div>
        <span className={tag("blue") + " lg:hidden"}>{new Date().toLocaleDateString(ar ? "ar-EG" : undefined, { weekday: "long", day: "numeric", month: "short" })}</span>
      </div>
      <HealthBox wide={wide} onSubmit={submit} onPhoto={openFitAdd || (() => navTo("fit"))} onVoice={voice} listening={listening} />
      <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4 lg:items-start" key={tick}>
        <FitToday openFit={() => navTo("fit")} />
        <FamilyToday navTo={navTo} wide={wide} tick={tick} />
        <div className="space-y-3 lg:space-y-4">
          {cycleOn || hasCycle ? <CycleToday navTo={navTo} wide={wide} onLog={async () => { await submit(ar ? "الدورة جات النهارده" : "period started today"); setTick((n) => n + 1); }} /> : null}
          <HealthReportCta onClick={() => setRep(true)} wide={wide} />
        </div>
      </div>
    </div>);
}
