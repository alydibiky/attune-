/* ---- v8.7 (Ali picked the money planner's option A, 28 Oct): one page for the month — the income split into fixed · savings ·
   everyday · free, the savings goals (emergency, travel, a car…) with this month's share, and everyday spending from the last
   3 months. Logic in planner.js (Actual Budget's envelope idea, MIT). The Home box does the same in words («خطة الشهر»).       */
import React, { useMemo, useState } from "react";
import { Plus, PiggyBank } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { loadPots, savePots, addPot, fundPot, planMonth } from "./planner.js";
import { loadLedger } from "./myledger.js";
import { loadLife } from "./life.js";
import { homeCurrency } from "./locale.js";
import { fmt } from "./money-calm.js";
import * as U from "./ui-kit.jsx";

const KIND_NAME = { emergency: ["Emergency", "الطوارئ"], travel: ["Travel", "السفر"], car: ["Car", "العربية"], eid: ["Eid", "العيد"], school: ["School", "المدارس"], wedding: ["Wedding", "الجواز"] };
const CAT_NAME = { food: ["Food", "الأكل"], groceries: ["Groceries", "البقالة"], transport: ["Transport", "المواصلات"], shopping: ["Shopping", "المشتريات"], health: ["Health", "الصحة"],
  fun: ["Going out", "الخروج"], other: ["Other", "حاجات تانية"], education: ["Education", "التعليم"], home: ["Home", "البيت"], gifts: ["Gifts", "الهدايا"] };
const COL = { fixed: "#4A5852", pots: "var(--c-acc)", flex: "#7FB8A0", free: "#C9E7D8" };

export function PlannerPage({ flash }) {
  const [pots, setPots] = useState(() => loadPots());
  const [tick, setTick] = useState(0);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(""), [target, setTarget] = useState(""), [by, setBy] = useState(""), [how, setHow] = useState("month");   // how: "month" (a fixed amount each month) | "target"
  const [put, setPut] = useState({});
  const ar = getLang() === "ar";
  const ledger = useMemo(() => loadLedger(), [tick]), cur = homeCurrency(ledger);
  const plan = useMemo(() => planMonth({ ledger, life: loadLife(), pots, now: Date.now() }), [ledger, pots, tick]);
  const save = (p) => setPots(savePots(p));
  const monthName = new Date(plan.month + "-15").toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { month: "long" });
  const parts = [["fixed", tr("Fixed"), plan.fixedTotal], ["pots", tr("Savings"), plan.potsTotal], ["flex", tr("Everyday"), plan.flexTotal], ["free", tr("Free"), plan.free]];
  const total = Math.max(1, plan.income || parts.reduce((a, p) => a + p[2], 0));
  const nm = (p) => (KIND_NAME[p.kind] ? KIND_NAME[p.kind][ar ? 1 : 0] : p.name);
  const addGoal = () => {
    const t = +String(target).replace(/,/g, ""); if (!name.trim() || !(t > 0)) return;
    save(addPot(pots, how === "month" ? { name: name.trim(), kind: "other", target: 0, per: t } : { name: name.trim(), kind: "other", target: t, by: /^\d{4}-\d{2}$/.test(by) ? by : "" }));
    setName(""); setTarget(""); setBy(""); setAdding(false);
  };
  return (
    <div className={U.page + " rounded-2xl p-4 md:p-6 space-y-3.5 lg:space-y-[18px]"} data-testid="planner-page">
      <h2 className={U.h1 + " flex items-center gap-2"}><PiggyBank size={20} className="c-acc" />{tr("{m} plan", { m: monthName })}</h2>
      <div className="space-y-3.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
        <div className={U.cardPad + " space-y-3"} data-testid="planner-split">
          <div className="flex items-baseline justify-between"><span className={U.label}>{tr("Income")}</span><b className="text-[22px] font-black tabular-nums" dir="ltr">{fmt(plan.income)} {cur}</b></div>
          <div className="flex h-3 rounded-full overflow-hidden bg-[var(--c-surf-2)]" aria-hidden="true">{parts.map(([k, , v]) => v > 0 ? <i key={k} style={{ width: (v / total) * 100 + "%", background: COL[k] }} /> : null)}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">{parts.map(([k, l, v]) => (
            <div key={k} className="flex items-center gap-2 text-[13.5px] font-semibold" data-testid={"planner-" + k}><i className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: COL[k] }} /><span className="flex-1">{l}</span><b className="tabular-nums" dir="ltr">{fmt(v)}</b></div>))}</div>
          {plan.short > 0 ? <p className="m-0 text-[13px] font-bold text-[var(--c-warn)]">{tr("Short by {a} this month", { a: fmt(plan.short) + " " + cur })}</p> : null}
          {plan.tips.map(([t, v], i) => <p key={i} className={"m-0 text-[12.5px] " + U.muted} data-testid="planner-tip">{tr(t, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typeof x === "number" && k !== "p" ? fmt(x) + " " + cur : x])))}</p>)}
        </div>
        {plan.pots.length ? <div className={U.cardPad + " space-y-1.5"} data-testid="planner-year">
          <p className={U.label + " m-0"}>{tr("This year ({y})", { y: plan.year.year })}</p>
          <div className="flex items-baseline justify-between text-[14px] font-semibold"><span>{tr("Saved in a year at this pace")}</span><b className="tabular-nums text-[18px] c-acc" dir="ltr">{fmt(plan.year.savedPerYear)} {cur}</b></div>
          <div className="flex items-baseline justify-between text-[14px] font-semibold"><span>{tr("Saved by 31 December")}</span><b className="tabular-nums" dir="ltr">{fmt(plan.year.byYearEnd)} {cur}</b></div>
          {plan.pots.map((p) => <div key={p.id} className={"flex justify-between text-[12.5px] " + U.muted}><span dir="auto">{nm(p)}</span><span className="tabular-nums" dir="ltr">{fmt(p.monthly)} × 12 = {fmt(p.yearly)}</span></div>)}
        </div> : null}
        <div className="space-y-2.5" data-testid="planner-goals">
          <p className={U.label + " m-0"}>{tr("Savings goals")}</p>
          {plan.pots.map((p) => (
            <div key={p.id} className={U.cardPad + " space-y-1.5"} data-testid="planner-goal">
              <div className="flex items-baseline justify-between gap-2"><b className="text-[15px] font-extrabold" dir="auto">{nm(p)}</b><span className="text-[14px] font-black tabular-nums c-acc" dir="ltr">{fmt(p.monthly)} {tr("/ month")}</span></div>
              <div className="h-2 rounded-full bg-[var(--c-surf-2)] overflow-hidden"><i className="block h-2 rounded-full bg-[var(--c-acc)]" style={{ width: Math.min(100, p.target ? ((p.saved || 0) / p.target) * 100 : 0) + "%" }} /></div>
              <div className={"text-[12.5px] " + U.muted}>{p.per > 0 && !p.target ? tr("{a} saved · {y} a year · {e} by 31 Dec", { a: fmt(p.saved || 0), y: fmt(p.yearly), e: fmt(p.byYearEnd) }) : tr("{a} of {b}", { a: fmt(p.saved || 0), b: fmt(p.target) })}{p.by ? " · " + tr("by {d}", { d: new Date(p.by + "-15").toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { month: "long", year: "numeric" }) }) : ""}{p.kind === "emergency" ? " · " + tr("3 months of spending") : ""}</div>
              <div className="flex gap-2 pt-0.5">
                <input className={U.inp + " h-10! min-h-[40px]!"} inputMode="decimal" placeholder={fmt(p.monthly || 0)} value={put[p.id] || ""} onChange={(e) => setPut({ ...put, [p.id]: e.target.value })} aria-label={tr("Amount")} data-testid="planner-put-amount" />
                <button className={U.btnS + " h-10! min-h-[40px]! shrink-0"} onClick={() => { const a = +String(put[p.id] || p.monthly || 0).replace(/,/g, ""); if (a > 0) { save(fundPot(pots, p.id, a)); setPut({ ...put, [p.id]: "" }); flash && flash(tr("Put aside — Safe to spend keeps it apart")); } }} data-testid="planner-put">{tr("Put money in")}</button>
              </div>
            </div>))}
          {adding ? <div className={U.cardPad + " space-y-2"} data-testid="planner-new">
            <input className={U.inp} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Goal (car, Eid, school…)")} dir="auto" data-testid="planner-new-name" />
            <div className="flex gap-1.5">{[["month", tr("Every month")], ["target", tr("A total by a date")]].map(([k, l]) => <button key={k} type="button" className={U.chip(how === k)} onClick={() => setHow(k)} data-testid={"planner-how-" + k}>{l}</button>)}</div>
            {how === "month" ? <><input className={U.inp} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tr("Amount every month")} data-testid="planner-new-target" />
              {+String(target).replace(/,/g, "") > 0 ? <p className={"m-0 text-[12.5px] " + U.muted} data-testid="planner-new-year">{tr("= {y} in a year", { y: fmt(+String(target).replace(/,/g, "") * 12) })}</p> : null}</>
            : <div className="grid grid-cols-2 gap-2"><input className={U.inp} inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={tr("Target")} data-testid="planner-new-target" />
              <input type="month" className={U.inp} value={by} onChange={(e) => setBy(e.target.value)} aria-label={tr("By")} data-testid="planner-new-by" /></div>}
            <button className={U.btnP + " w-full"} onClick={addGoal} data-testid="planner-new-save">{tr("Save goal")}</button>
          </div> : <button className={U.btnS + " w-full"} onClick={() => setAdding(true)} data-testid="planner-new-open"><Plus size={16} />{tr("New goal (car, Eid, school…)")}</button>}
          {!plan.pots.some((p) => p.kind === "emergency") ? <button className={U.btnS + " w-full " + U.muted} onClick={() => save(addPot(pots, { name: ar ? "الطوارئ" : "Emergency", kind: "emergency", target: 0 }))} data-testid="planner-emergency">{tr("Start an emergency fund (3 months of spending)")}</button> : null}
        </div>
      </div>
      <div className={U.cardPad} data-testid="planner-everyday">
        <p className={U.label + " m-0 mb-2"}>{tr("Everyday (your last 3 months)")}</p>
        {plan.flexible.length ? <div className="space-y-1.5">{plan.flexible.slice(0, 8).map((f) => (
          <div key={f.cat} className="flex items-center justify-between text-[14px] font-semibold"><span>{CAT_NAME[f.cat] ? CAT_NAME[f.cat][ar ? 1 : 0] : f.cat}</span>
            <span className="tabular-nums" dir="ltr">{f.plan !== f.avg ? <s className={U.muted + " me-2 text-[12.5px]"}>{fmt(f.avg)}</s> : null}<b>{fmt(f.plan)}</b></span></div>))}</div>
          : <p className={"m-0 text-[13px] " + U.muted}>{tr("After a month of spending in Money, your usual food, transport and shopping show here.")}</p>}
      </div>
      {plan.fixed.length ? <div className={U.cardPad} data-testid="planner-fixed">
        <p className={U.label + " m-0 mb-2"}>{tr("Fixed this month")}</p>
        <div className="space-y-1.5">{plan.fixed.map((f, i) => <div key={i} className="flex items-center justify-between text-[14px] font-semibold"><span dir="auto" className={f.paid ? "line-through " + U.muted : ""}>{f.what}</span><b className="tabular-nums" dir="ltr">{fmt(f.amount)}</b></div>)}</div>
      </div> : null}
    </div>);
}
