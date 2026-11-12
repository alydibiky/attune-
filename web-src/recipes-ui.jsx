/* ---- v9.9.18 AU3 (Ali picked A — a gallery of life moments, on the Automations page). The tiles that fit the person's own data
   (recipes.js gallery); tap one → its rules, each with on / off (the ones whose data are missing are off and say so) → "Switch on N"
   saves them through rulestore.js (time rules become reminders with their real dates — Ramadan only during Ramadan, a trip's packing
   two days before it). */
import React, { useMemo, useState } from "react";
import { tr } from "./i18n.js";
import { gallery } from "./recipes.js";
import * as RS from "./rulestore.js";
import { loadLedger } from "./myledger.js";
import { loadLife } from "./life.js";
import { loadDayset } from "./dayset.js";
import { loadErrands } from "./errands.js";
import { loadTrip } from "./travel.js";
import { loadAuto } from "./autom.js";
import { weekendOf } from "./country.js";
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
/** What the person's data say, for recipes.js. */
export function profileNow(now = Date.now()) {
  const L = loadLedger() || { txns: [] }, life = loadLife(), fam = get("attune:family:v1", { members: [] }), dir = get("attune:people:v1", { items: [] });
  const sal = (L.txns || []).filter((t) => t.type === "income" && (t.cat === "salary" || /salary|payroll|مرتب|راتب/i.test(t.note || ""))).sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
  const items = life.items || [], errs = loadErrands(), trip = loadTrip();
  const lic = errs.filter((e) => e.kind === "carLicence" && e.date).map((e) => Date.parse(e.date + "T12:00:00")).sort((a, b) => a - b)[0] || 0;
  const tripAt = (trip && (trip.depart || trip.start)) ? Date.parse(String(trip.depart || trip.start).slice(0, 10) + "T12:00:00") : 0;
  return { salaryDay: sal ? +String(sal.date).slice(8, 10) : 0, rent: (items.find((c) => c.kind === "rent") || {}).amount || 0, gameya: (items.find((c) => c.kind === "circle") || {}).amount || 0,
    carFund: Object.keys((loadAuto() || {}).pots || {})[0] || "", family: (fam.members || []).map((m) => m.name), car: errs.some((e) => /^car|driving/.test(e.kind)) || lic > 0, licenceAt: lic,
    kids: ((dir.items || []).filter((p) => /\b(son|daughter|kid|child)\b|ابن|بنت|ولد/i.test(p.role || "")).length), tripAt, baby: false, prayersOn: !!(loadDayset() || {}).prayers, weekend: weekendOf() };
}
export function RecipesGallery({ flash, schedule, native, lang }) {
  const [open, setOpen] = useState(null), [off, setOff] = useState({}), [v, setV] = useState(0);
  const tiles = useMemo(() => { try { return gallery(profileNow()); } catch (e) { return []; } }, [v]);
  const done = useMemo(() => new Set(RS.loadRules().map((r) => r.recipe).filter(Boolean)), [v]);
  if (!tiles.length) return null;
  const t = tiles.find((x) => x.id === open);
  const switchOn = () => { const chosen = t.rules.filter((x) => x.on && !off[x.id]);
    for (const x of chosen) RS.saveRule({ ...x.rule, title: tr(x.title), do: [{ type: "remind", text: tr(x.title) }], recipe: t.id }, { schedule, native, lang });
    flash && flash(tr("{n} switched on", { n: chosen.length })); setOpen(null); setOff({}); setV((y) => y + 1); try { window.dispatchEvent(new Event("attune-rules")); } catch (e) {} };
  return (
    <div className="space-y-2" data-testid="recipes">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-mut)]">{tr("Recipes")}</p>
      <div className="grid grid-cols-2 gap-2">{tiles.map((x) => <button key={x.id} onClick={() => { setOpen(open === x.id ? null : x.id); setOff({}); }} aria-pressed={open === x.id} data-testid={"recipe-" + x.id}
        className={"text-start rounded-[16px] border p-3 min-h-[86px] " + (open === x.id ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)] bg-[var(--c-surf)]")}>
        <span className="block text-[18px]">{x.icon}</span><span className="block text-[14px] font-extrabold">{tr(x.title)}</span>
        <span className="block text-[12px] text-[var(--c-mut)]">{done.has(x.id) ? tr("On") : tr(x.why, { n: x.n, d: x.d })}</span></button>)}</div>
      {t ? <div className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-1" data-testid="recipe-open">
        {t.rules.map((x) => <label key={x.id} className={"flex items-center gap-2 py-1.5 text-[14px] " + (x.on ? "" : "opacity-50")} data-testid="recipe-rule">
          <input type="checkbox" disabled={!x.on} checked={x.on && !off[x.id]} onChange={(e) => setOff({ ...off, [x.id]: !e.target.checked })} className="w-5 h-5 accent-[var(--c-acc)]" />
          <span className="flex-1" dir="auto">{tr(x.title)}</span>{!x.on ? <span className="text-[11.5px] text-[var(--c-mut)]">{tr("not in your data")}</span> : null}</label>)}
        <button className="min-h-[44px] px-4 rounded-[12px] font-extrabold text-[14px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} onClick={switchOn} data-testid="recipe-switch">{tr("Switch on {n}", { n: t.rules.filter((x) => x.on && !off[x.id]).length })}</button>
      </div> : null}
    </div>);
}
