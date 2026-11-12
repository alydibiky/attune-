/* ---- v9.9.18 M1 Salary sorter (Ali picked A — a checklist with amounts). The salary that arrived (two parts within 3 days = one),
   the plan — taken the first time from the person's own monthly payments (rent, gam'eya, instalments, money to someone each month)
   and editable (a fixed amount or a % of the salary) — each row ticked as it is paid, and what is left to spend, exact to the coin
   (salarysort.js, tested on 10,000 salaries in 30 currencies). A row that doesn't fit the salary is flagged, never silently cut.
   Opens from the Automations page, from Home when a salary came in the last 5 days, and from "salary" in Chat. */
import React, { useState } from "react";
import { tr } from "./i18n.js";
import { salaryOf, sortSalary } from "./salarysort.js";
import { loadLedger } from "./myledger.js";
import { loadLife } from "./life.js";
import { card as kCard, btnP, btnS, inp, label } from "./ui-kit.jsx";
const card = kCard + " p-4", DAY = 864e5;
export const SP_KEY = "attune:salaryplan:v1";
const get = () => { try { return JSON.parse(localStorage.getItem(SP_KEY) || "null"); } catch (e) { return null; } };
const put = (v) => { try { localStorage.setItem(SP_KEY, JSON.stringify(v)); } catch (e) {} return v; };
const SAL = /salary|payroll|wage|مرتب|راتب|maaş|gaji|sueldo|salaire|gehalt|salário|stipendio|зарплат|تنخواہ|حقوق|वेतन|বেতন|mshahara|เงินเดือน|lương|工资|給料|월급/i;
/** The salaries in Money (income marked salary, or with the word in any of the 20 languages). */
export function incomesNow(L = loadLedger()) {
  const acc = {}; for (const a of (L && L.accounts) || []) acc[a.id] = a.currency;
  return ((L && L.txns) || []).filter((t) => t.type === "income" && (t.cat === "salary" || SAL.test(t.note || "")))
    .map((t) => ({ at: t.at || Date.parse(t.date + "T12:00:00"), amount: +t.amount, currency: t.currency || acc[t.account] || "EGP", salary: true }));
}
/** The first plan: the person's own monthly money out (rent, gam'eya, instalments, monthly payments). */
export function planFromLife(life = loadLife()) {
  return ((life && life.items) || []).filter((c) => c.dir !== "in" && (!c.payer || c.payer === "me") && c.amount > 0 && (c.every || "month") === "month" && /^(rent|circle|installment|regular)$/.test(c.kind))
    .map((c) => ({ id: "l" + c.id, name: c.kind === "rent" ? tr("Rent") : c.title || c.person || tr("Payment"), amount: c.amount }));
}
export function loadPlan() { const v = get(); return v && Array.isArray(v.plan) ? v : { plan: planFromLife(), ticks: {} }; }
/** The salary of the last `days` days, for Home. */
export function freshSalary(now = Date.now(), days = 5) { const s = salaryOf(incomesNow(), now); return s && now - s.at <= days * DAY ? s : null; }

export function SalaryPage({ flash }) {
  const [st, setSt] = useState(loadPlan), [edit, setEdit] = useState(null);
  const sal = salaryOf(incomesNow()), key = sal ? String(sal.at) : "", ticks = new Set((st.ticks || {})[key] || []);
  const sorted = sal ? sortSalary(sal, st.plan.map((p) => ({ ...p, done: ticks.has(p.id) }))) : null;
  const save = (n) => setSt(put(n));
  const tick = (id, on) => { const s = new Set(ticks); on ? s.add(id) : s.delete(id); save({ ...st, ticks: { [key]: [...s] } }); };
  const fmt = (n) => (+n).toLocaleString(undefined, { maximumFractionDigits: 3 });
  if (!sal) return <div className={card} data-testid="salary-none"><p className="m-0 text-[14px]">{tr("No salary in Money yet. When it arrives, its plan shows here.")}</p></div>;
  const leftNow = sorted.rows.filter((r) => !r.over && !ticks.has(r.id)).reduce((a, r) => a + r.amount, 0);
  return (
    <div className="calm space-y-3 text-[var(--c-ink)]" data-testid="salary-page">
      <div className={card + " flex items-center justify-between"} data-testid="salary-head">
        <div><p className="m-0 text-[14px] font-extrabold">{tr("Salary arrived")}</p><p className="m-0 text-[12.5px] text-[var(--c-mut)]">{new Date(sal.at).toLocaleDateString(undefined, { day: "numeric", month: "long" })}{sal.parts > 1 ? " · " + tr("{n} parts", { n: sal.parts }) : ""}</p></div>
        <span className="text-[18px] font-extrabold" style={{ color: "var(--c-pos, #1e7a43)" }}>+{fmt(sal.amount)} {sal.currency}</span></div>
      {!edit ? <div className={card + " space-y-1"} data-testid="salary-plan">
        <p className={label}>{tr("Your plan")}</p>
        {!sorted.rows.length ? <p className="m-0 text-[13.5px] text-[var(--c-mut)]">{tr("Nothing planned yet — add where the salary goes.")}</p> : null}
        {sorted.rows.map((r) => <label key={r.id} className={"flex items-center gap-2 min-h-[48px] border-t border-[var(--c-ln)] first-of-type:border-0 " + (ticks.has(r.id) ? "opacity-60" : "")} data-testid="salary-row">
          <input type="checkbox" checked={ticks.has(r.id)} disabled={r.over} onChange={(e) => tick(r.id, e.target.checked)} className="w-5 h-5 accent-[var(--c-acc)]" />
          <span className="flex-1 text-[14px]" dir="auto">{r.name}{r.over ? <span className="block text-[12px]" style={{ color: "var(--c-neg, #b3261e)" }}>{tr("Doesn't fit in this salary")}</span> : null}</span>
          <span className="text-[14px] font-bold tabular-nums">{fmt(r.amount)}</span></label>)}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--c-ln)]" data-testid="salary-left"><span className="text-[14px] font-extrabold">{tr("Left to spend")}</span><span className="text-[16px] font-extrabold text-[var(--c-acc)] tabular-nums">{fmt(sorted.left)}</span></div>
        {leftNow > 0 ? <p className="m-0 text-[12.5px] text-[var(--c-mut)]" data-testid="salary-topay">{tr("Still to pay: {a}", { a: fmt(leftNow) })}</p> : null}
        <div className="flex gap-2 pt-1">
          <button className={btnP} onClick={() => { save({ ...st, ticks: { [key]: sorted.rows.filter((r) => !r.over).map((r) => r.id) } }); flash && flash(tr("All marked done")); }} data-testid="salary-all">{tr("Mark the rest done")}</button>
          <button className={btnS} onClick={() => setEdit(st.plan.map((p) => ({ ...p, v: p.pct != null ? p.pct + "%" : String(p.amount) })))} data-testid="salary-edit">{tr("Edit plan")}</button></div>
      </div> : <div className={card + " space-y-2"} data-testid="salary-editbox">
        <p className={label}>{tr("Edit plan")}</p>
        <p className="m-0 text-[12.5px] text-[var(--c-mut)]">{tr("An amount, or a share like 10%")}</p>
        {edit.map((p, i) => <div key={p.id} className="flex gap-2 items-center" data-testid="salary-editrow">
          <input value={p.name} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={inp + " flex-1"} aria-label={tr("Name")} dir="auto" />
          <input value={p.v} onChange={(e) => setEdit(edit.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} className={inp} style={{ width: 96, flex: "none" }} inputMode="decimal" aria-label={tr("Amount")} />
          <button className="min-h-[40px] px-2 text-[18px]" onClick={() => setEdit(edit.filter((_, j) => j !== i))} aria-label={tr("Delete")}>×</button></div>)}
        <button className="text-[13.5px] font-extrabold text-[var(--c-acc)] min-h-[40px]" onClick={() => setEdit([...edit, { id: "p" + Date.now().toString(36), name: "", v: "" }])} data-testid="salary-add">+ {tr("Add a part")}</button>
        <div className="flex gap-2"><button className={btnP} data-testid="salary-save" onClick={() => {
          const plan = edit.map((p) => { const v = String(p.v).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[,\s]/g, ""); const pct = /%$/.test(v); const n = parseFloat(v);
            return p.name.trim() && n > 0 ? { id: p.id, name: p.name.trim(), ...(pct ? { pct: n } : { amount: n }) } : null; }).filter(Boolean);
          save({ ...st, plan }); setEdit(null); flash && flash(tr("Saved")); }}>{tr("Save")}</button>
          <button className={btnS} onClick={() => setEdit(null)}>{tr("Cancel")}</button></div>
      </div>}
    </div>);
}
/** Home: "Salary arrived — sort it" while a fresh salary has unticked parts. */
export function SalaryHomeCard() {
  let s = null; try { s = freshSalary(); } catch (e) {}
  if (!s) return null;
  const st = loadPlan(), done = new Set((st.ticks || {})[String(s.at)] || []), sorted = sortSalary(s, st.plan);
  if (!sorted || !sorted.rows.length || sorted.rows.every((r) => r.over || done.has(r.id))) return null;
  const n = sorted.rows.filter((r) => !r.over && !done.has(r.id)).length;
  return <button onClick={() => { try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "salary" } })); } catch (e) {} }} data-testid="home-salary"
    className="w-full text-start rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-4 py-3 flex items-center justify-between gap-2">
    <span><span className="block text-[14px] font-extrabold">{tr("Salary arrived — sort it")}</span><span className="block text-[12.5px] text-[var(--c-mut)]">{(n === 1 ? tr("1 part to pay · {a} left to spend", { a: (+sorted.left).toLocaleString() }) : tr("{n} parts to pay · {a} left to spend", { n, a: (+sorted.left).toLocaleString() }))}</span></span>
    <span className="text-[var(--c-acc)]">›</span></button>;
}
