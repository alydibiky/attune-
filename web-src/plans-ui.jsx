/* ---- v6.32: People & plans grows — split bills, gold & currency savings, the car (roadmap ideas, all code-first) ------------
   The same one box on People & plans reads them (split.js, gold.js, car.js); these are their draft previews and their cards on the
   right. Tests: tests/e2e_v736plans.py.                                                                                          */
import React, { useState } from "react";
import { Car, Trash2, Wallet, Check } from "lucide-react";
import { tr } from "./i18n.js";
import { fmt } from "./money-calm.js";
import { summary, toZakat } from "./gold.js";
import { carStats } from "./car.js";

const field = "w-full rounded-lg px-2.5 py-1.5 text-[14px] border bg-transparent c-num";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };
const SERVICE = { oil: "Oil change", filter: "Filters", tyres: "Tyres", brakes: "Brakes", battery: "Battery", service: "Service", wash: "Car wash" };
const who = (p) => (p === "me" ? tr("You") : p || tr("Someone"));

/** The preview of what was read, before it is saved. */
export function PlanDraft({ d }) {
  if (d.kind === "split") return (
    <div data-testid="split-draft">
      <span className="c-lbl">{tr("Split bill")}</span>
      <div className="mt-1 font-bold" dir="auto">{(d.title ? d.title + " · " : "") + fmt(d.total) + " " + d.currency + " · " + tr("{n} ways", { n: d.count })}</div>
      <div className="mt-2 space-y-1">{d.shares.map((s, i) => <div key={i} className="flex c-sub" dir="auto"><span className="flex-1">{who(s.person)}</span><span className="c-num">{fmt(s.amount)}</span></div>)}</div>
      <div className="c-sub mt-2" dir="auto">{d.debts.length ? d.debts.map((x) => x.dir === "in" ? tr("{p} owes you {a}", { p: x.person, a: fmt(x.amount) }) : tr("You owe {p} {a}", { p: x.person, a: fmt(x.amount) })).join(" · ") : tr("No names given — nothing to remember, just the sums.")}</div>
    </div>);
  if (d.kind === "holding") { const h = d.holding; return (
    <div data-testid="gold-draft"><span className="c-lbl">{tr("Savings")}</span>
      <div className="mt-1 font-bold" dir="auto">{h.kind === "cash" ? fmt(h.amount) + " " + h.currency : tr(h.kind === "gold" ? "{g} g of gold, {k}k" : "{g} g of silver", { g: h.grams, k: h.karat })}</div>
      {h.cost ? <div className="c-sub">{tr("Paid {a}", { a: fmt(h.cost) + " " + h.costCurrency })}</div> : null}</div>); }
  if (d.kind === "car") { const e = d.entry; return (
    <div data-testid="car-draft"><span className="c-lbl">{tr("My car")}</span>
      <div className="mt-1 font-bold" dir="auto">{e.kind === "fuel" ? tr("Fuel") + (e.amount ? " · " + fmt(e.amount) : "") + (e.liters ? " · " + e.liters + " L" : "")
        : e.kind === "service" ? tr(SERVICE[e.service] || "Service") + (e.amount ? " · " + fmt(e.amount) : "")
        : e.kind === "deadline" ? (e.deadline.title || "") + " · " + e.deadline.date : tr("Odometer")}</div>
      {e.km ? <div className="c-sub c-num">{fmt(e.km)} km</div> : null}
      {e.kind === "deadline" ? <div className="c-sub">{tr("Goes to the Deadline Radar — a warning before it ends")}</div> : null}</div>); }
  return null;
}

/** Gold, silver and money kept in other currencies: today's worth, the gain, the niṣāb and the zakat. */
export function GoldCard({ data, put, flash }) {
  const s = summary(data.items, data.prices);
  const setP = (k, v) => put({ ...data, prices: { ...data.prices, [k]: +String(v).replace(/[^\d.]/g, "") || 0 } });
  const setFx = (c, v) => put({ ...data, prices: { ...data.prices, fx: { ...(data.prices.fx || {}), [c]: +String(v).replace(/[^\d.]/g, "") || 0 } } });
  const curs = [...new Set(data.items.filter((x) => x.kind === "cash").map((x) => x.currency))];
  const hasGold = data.items.some((x) => x.kind === "gold"), hasSilver = data.items.some((x) => x.kind === "silver");
  return (
    <div className="c-card" data-testid="gold-card">
      <div className="flex items-start gap-3"><span className="c-ic"><Wallet size={16} /></span>
        <div className="flex-1 min-w-0"><b className="block">{tr("Gold & savings")}</b>
          <div className="c-sub">{s.pure ? tr("{g} g of pure gold", { g: s.pure }) : ""}{s.pure && s.silver ? " · " : ""}{s.silver ? tr("{g} g of silver", { g: s.silver }) : ""}</div></div>
        <div className="text-end"><span className="c-lbl">{tr("Worth today")}</span><div className="c-num font-bold" data-testid="gold-total">{s.total ? fmt(s.total) : "—"}</div></div></div>
      {s.gain ? <div className={"mt-2 c-num " + (s.gain >= 0 ? "c-pos" : "c-neg")} data-testid="gold-gain">{(s.gain >= 0 ? "+" : "") + fmt(s.gain)}{s.gainPct != null ? " (" + s.gainPct + "%)" : ""} {tr("since you bought")}</div> : null}
      <div className="grid grid-cols-2 gap-2 mt-3">
        {hasGold || !data.items.length ? <label className="c-sub text-[12px]">{tr("Gold 24k, a gram")}<input className={field} style={st} inputMode="decimal" value={data.prices.gold24 || ""} onChange={(e) => setP("gold24", e.target.value)} data-testid="gold-price" /></label> : null}
        {hasSilver ? <label className="c-sub text-[12px]">{tr("Silver, a gram")}<input className={field} style={st} inputMode="decimal" value={data.prices.silver || ""} onChange={(e) => setP("silver", e.target.value)} /></label> : null}
        {curs.map((c) => <label key={c} className="c-sub text-[12px]">{tr("1 {c} in your money", { c })}<input className={field} style={st} inputMode="decimal" value={(data.prices.fx || {})[c] || ""} onChange={(e) => setFx(c, e.target.value)} data-testid={"fx-" + c} /></label>)}
      </div>
      {s.nisabValue != null ? (
        <div className="c-sub mt-3" data-testid="gold-zakat">{s.reaches ? (s.zakat != null ? tr("Above the niṣāb ({n}). Zakat on what you've held a lunar year: {z}", { n: fmt(s.nisabValue), z: fmt(s.zakat) }) : tr("Above the niṣāb ({n})", { n: fmt(s.nisabValue) }))
          : tr("Below the niṣāb ({n}) — no zakat on this alone", { n: fmt(s.nisabValue) })}{s.waiting.length && s.reaches ? " · " + tr("{n} not held a year yet", { n: s.waiting.length }) : ""}</div>) : null}
      {s.missing.length ? <div className="c-sub mt-2 text-[12px]">{tr("Add today's price to see what it is worth: {m}", { m: s.missing.map((m) => tr(m)).join(", ") })}</div> : null}
      <div className="mt-3 space-y-1">{data.items.map((h) => (
        <div key={h.id} className="flex items-center gap-2 text-[13px]" data-testid="gold-item">
          <span className="flex-1 truncate" dir="auto">{h.note}</span>
          <span className="c-num c-sub">{(s.rows.find((r) => r.id === h.id) || {}).worth != null ? fmt(s.rows.find((r) => r.id === h.id).worth) : ""}</span>
          <button className="c-sub" aria-label={tr("Delete")} onClick={() => window.confirm(tr("Delete this?")) && put({ ...data, items: data.items.filter((x) => x.id !== h.id) })}><Trash2 size={13} /></button></div>))}</div>
      <button className="c-btn mt-3 flex items-center gap-1.5" data-testid="gold-to-zakat" onClick={() => flash && flash(toZakat(data) ? tr("Sent to Zakat in Money") : tr("Open Money once first, then send"))}><Check size={14} />{tr("Send to Zakat")}</button>
    </div>);
}

/** The car: litres per 100 km, cost per km, fuel this month, and what is due next. */
export function CarCard({ car, put }) {
  const [all, setAll] = useState(false);
  const s = carStats(car);
  const log = [...car.log].reverse();
  return (
    <div className="c-card" data-testid="car-card">
      <div className="flex items-start gap-3"><span className="c-ic"><Car size={16} /></span>
        <div className="flex-1 min-w-0"><b className="block">{tr("My car")}</b><div className="c-sub c-num">{s.kmNow ? fmt(s.kmNow) + " km" : ""}</div></div>
        <div className="text-end"><span className="c-lbl">{tr("Fuel this month")}</span><div className="c-num font-bold">{fmt(s.fuelMonth)}</div></div></div>
      {s.per100 != null || s.costKm != null ? <div className="grid grid-cols-2 gap-2 mt-3">
        <div><span className="c-lbl">{tr("Litres per 100 km")}</span><div className="c-num font-bold" data-testid="car-per100">{s.per100 ?? "—"}</div></div>
        <div><span className="c-lbl">{tr("Fuel cost per km")}</span><div className="c-num font-bold">{s.costKm ?? "—"}</div></div></div>
        : <div className="c-sub mt-2 text-[12.5px]">{tr("Two fill-ups with the km on the meter, and it works out your fuel use.")}</div>}
      {s.next.length ? <div className="mt-3 space-y-1" data-testid="car-next">{s.next.slice(0, 4).map((n) => (
        <div key={n.service} className="flex items-center gap-2 text-[13px]"><span className="flex-1">{tr(SERVICE[n.service])}</span>
          <span className={"c-pill " + (n.due ? "late" : "due")}>{[n.dueKm ? fmt(n.dueKm) + " km" : "", n.dueDate || ""].filter(Boolean).join(" · ")}</span></div>))}</div> : null}
      {log.length ? <div className="mt-3 space-y-1">{(all ? log : log.slice(0, 3)).map((e) => (
        <div key={e.id} className="flex items-center gap-2 text-[12.5px] c-sub">
          <span className="flex-1 truncate">{e.date} · {e.kind === "fuel" ? tr("Fuel") + (e.liters ? " " + e.liters + " L" : "") : e.kind === "service" ? tr(SERVICE[e.service] || "Service") : tr("Odometer")}{e.km ? " · " + fmt(e.km) + " km" : ""}</span>
          <span className="c-num">{e.amount ? fmt(e.amount) : ""}</span>
          <button aria-label={tr("Delete")} onClick={() => window.confirm(tr("Delete this?")) && put({ ...car, log: car.log.filter((x) => x.id !== e.id) })}><Trash2 size={12} /></button></div>))}
        {log.length > 3 ? <button className="c-sub text-[12px]" onClick={() => setAll(!all)}>{all ? tr("Show less") : tr("Show all {n}", { n: log.length })}</button> : null}</div> : null}
    </div>);
}
