/* ---- v9.9.24 B6 X2 Upkeep section (Errands page; Ali picked A + a plain "Done"; combined screen OK'd 12 Nov). The car's services (car.js,
   whichever comes first: km or months) and the home's (every N months / days, or learned from when it was done), the most urgent first;
   each with a bar, Done and Done + cost (the cost goes into Money). Logic: upkeep.js. */
import React, { useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { upkeepLines, doneHome } from "./upkeep.js";
import { loadCar, saveCar, addCarEntry } from "./car.js";
import { loadLedger } from "./myledger.js";
import { appendToLedger } from "./paylog.js";
import { btnP, btnS, inp, label } from "./ui-kit.jsx";
const KEY = "attune:upkeep:v1";
const SVC = { oil: "Oil change", filter: "Filters", tyres: "Tyres", brakes: "Brakes", battery: "Battery", service: "Service" };
const loadHome = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && Array.isArray(j.items) ? j.items : []; } catch (e) { return []; } };
const saveHome = (items) => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, items })); } catch (e) {} return items; };
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const day = (s) => { try { const d = new Date(s + "T12:00:00"); return d.toLocaleDateString(dateLocale() || "en-GB", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" }); } catch (e) { return s; } };
const n0 = (v) => Math.round(v).toLocaleString("en-US");
function toMoney(m) { if (!m) return true; const led = loadLedger(); if (!led) return false; const r = appendToLedger(led, [m]); if (!r.ids.length) return false; try { localStorage.setItem("ledger.v3", JSON.stringify(r.ledger)); } catch (e) {} return true; }
export function UpkeepSection({ flash }) {
  const [home, setHome] = useState(loadHome), [car, setCar] = useState(loadCar), [cost, setCost] = useState({}), [add, setAdd] = useState(null);
  const lines = upkeepLines({ car: car && car.log && car.log.length ? car : null, home });
  // the car: both limits, whichever comes first ("at 20,000 km or 12 Nov 2027")
  const sub = (l) => l.kind === "car" ? [l.dueKm ? tr("{a} of {b} km", { a: n0(l.kmNow), b: n0(l.dueKm) }) + (l.kmLeft != null ? " · " + (l.kmLeft > 0 ? tr("{n} km left", { n: n0(l.kmLeft) }) : tr("over by {n} km", { n: n0(-l.kmLeft) })) : "") : "",
      l.due ? (l.dueKm ? tr("or {d}, whichever comes first", { d: day(l.due) }) : tr("next {d}", { d: day(l.due) })) : ""].filter(Boolean).join(" · ")
    : [l.everyMonths ? tr("every {n} months", { n: l.everyMonths }) : l.learned ? tr("about every {n} days", { n: l.everyDays }) : l.everyDays ? tr("every {n} days", { n: l.everyDays }) : tr("Done once — set how often, or Attune learns it"),
       l.due ? tr("next {d}", { d: day(l.due) }) : ""].filter(Boolean).join(" · ");
  const done = (l, withCost) => {
    const c = withCost ? +(cost[l.id] || 0) : 0; if (withCost && !(c > 0)) { flash && flash(tr("Type the cost first")); return; }
    const m = c > 0 ? { type: "expense", amount: c, note: l.kind === "car" ? tr(SVC[l.service] || "Car") : l.name, date: iso(Date.now()), cat: l.kind === "car" ? "transport" : "home" } : null;
    if (l.kind === "car") { const n = addCarEntry(car, { kind: "service", service: l.service, km: l.kmNow || 0, amount: c, date: iso(Date.now()) }); saveCar(n); setCar(n); }
    else { const it = home.find((x) => x.id === l.id); setHome(saveHome(home.map((x) => (x.id === l.id ? doneHome(it, { cost: c }).item : x)))); }
    const ok = toMoney(m); setCost({ ...cost, [l.id]: "" });
    flash && flash(m ? (ok ? tr("Done — {a} added to Money", { a: n0(c) }) : tr("Done — open Money once to keep the cost")) : tr("Done"));
  };
  return <div className="space-y-2" data-testid="upkeep">
    <div className="flex items-center justify-between gap-2"><p className={label + " m-0"}>{tr("Upkeep")}</p>
      <button className={btnS + " h-10! min-h-[40px]!"} onClick={() => setAdd({ name: "", every: "" })} data-testid="upkeep-add">+ {tr("Add")}</button></div>
    {add ? <div className="rounded-[16px] p-3 space-y-2" style={{ background: "var(--c-soft)" }} data-testid="upkeep-form">
      <input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} placeholder={tr("e.g. Water filter, gas cylinder, AC service")} className={inp} dir="auto" data-testid="upkeep-name" />
      <div className="flex items-center gap-2"><span className="text-[13px] c-sub shrink-0">{tr("Every")}</span>
        <input value={add.every} onChange={(e) => setAdd({ ...add, every: e.target.value })} inputMode="numeric" placeholder="6" className={inp + " w-20!"} data-testid="upkeep-every" />
        <span className="text-[13px] c-sub">{tr("months (leave empty — Attune learns it)")}</span></div>
      <div className="flex gap-2"><button className={btnP} disabled={!add.name.trim()} onClick={() => { setHome(saveHome([...home, { id: "u" + Date.now().toString(36), name: add.name.trim(), ...(+add.every > 0 ? { everyMonths: +add.every } : {}), log: [{ date: iso(Date.now()) }] }])); setAdd(null); }} data-testid="upkeep-save">{tr("Save — done today")}</button>
        <button className={btnS} onClick={() => setAdd(null)}>{tr("Cancel")}</button></div></div> : null}
    {lines.map((l) => <div key={l.id} className="rounded-[16px] border p-3 space-y-2" style={{ borderColor: l.dueNow ? "var(--c-warn)" : "var(--c-ln)", background: "var(--c-surf)" }} data-testid="upkeep-line" data-id={l.id} data-due={l.dueNow ? "1" : ""}>
      <div className="flex items-baseline gap-2"><b className="flex-1 text-[14.5px]" dir="auto">{l.kind === "car" ? "🚗 " + tr(SVC[l.service] || l.service) : l.name}</b>
        {l.dueNow ? <span className="text-[11px] font-extrabold c-warn">{tr("Due")}</span> : null}</div>
      <p className="m-0 text-[12.5px] c-sub" data-testid="upkeep-sub">{sub(l)}</p>
      {l.due || l.dueKm ? <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c-soft)" }}><div className="h-full" style={{ width: Math.min(100, Math.round(l.progress * 100)) + "%", background: l.dueNow ? "var(--c-warn)" : "var(--c-acc)" }} /></div> : null}
      <div className="flex flex-wrap items-center gap-2"><button className={btnS + " h-10! min-h-[40px]!"} onClick={() => done(l, false)} data-testid="upkeep-done">{tr("Done")}</button>
        <input value={cost[l.id] || ""} onChange={(e) => setCost({ ...cost, [l.id]: e.target.value })} inputMode="decimal" placeholder={tr("Cost")} className={inp + " w-24! h-10! min-h-[40px]!"} data-testid="upkeep-cost" />
        <button className={btnP + " h-10! min-h-[40px]!"} onClick={() => done(l, true)} data-testid="upkeep-done-cost">{tr("Done + cost")}</button></div>
    </div>)}
    {!lines.length && !add ? <p className="m-0 text-[13px] c-sub" data-testid="upkeep-empty">{tr("Car services appear here once you log one in Follow-ups — e.g. “oil change 1,500 at 45,000 km”. Add home things too — the water filter, the gas cylinder.")}</p> : null}
  </div>;
}
