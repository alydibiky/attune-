/* ---- v6.37 Missions (agent A) — the page. Say a goal with a deadline; Attune keeps working on it: each time it opens it reads
   your data, forecasts the chance, re-plans and shows the ONE step for today; a morning notification gives the debrief.
   The numbers are code (missions.js). A buy mission also starts a Scout search, so the night search watches the ads.   */
import React, { useEffect, useMemo, useState } from "react";
import { Target, Trash2, Check, Pause, Play, ChevronDown, ChevronUp, AlertTriangle, Binoculars } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as M from "./missions.js";
import * as S from "./scout.js";
import * as LS from "./lifesim.js";
import { loadFleet } from "./fleet-store.js";
import { page, cardPad, card as kCard, btnP, inp, area, label as kLabel, h1, chip } from "./ui-kit.jsx";

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
// v6.44: Learn's courses (a "finish the course" mission) and Fleet (company missions; IndexedDB, read once, then kept here)
let FLEET = null, fleetAsk = null;
function useFleet() {
  const [, set] = useState(0);
  useEffect(() => { if (!fleetAsk) fleetAsk = loadFleet().then((f) => { FLEET = f; }).catch(() => {}); let on = true; fleetAsk.then(() => on && set((x) => x + 1)); return () => { on = false; }; }, []);
  return FLEET;
}
const dataNow = () => ({ ledger: j("ledger.v3", null), fit: j("attune:fit:v1", null), market: S.loadMarket(), courses: j("attune:daily:courses:v1", []), fleet: FLEET });
const EXAMPLES = [["Save 60,000 by June", "عايز أوفر 60 ألف قبل يونيو"], ["Lose 6 kg before 20 January", "عايز أخس 6 كيلو قبل 20 يناير"], ["Buy a Corolla 2022 under 900k by 1 December", "أشتري كورولا 2022 بأقل من 900 ألف قبل 1 ديسمبر"]];
// v6.44: what was read, per kind ({t} the number, {c} the spending category)
const READ = { save: "Save {t}", weight: "Lose {t} kg", buy: "Buy it for {t} or less", cap: "Spend at most {t} on {c}", debt: "Pay off the debt (from Money → People)", learn: "Finish the course (from Learn)", revenue: "Company: Fleet earns {t}", collect: "Company: collect {t} from clients" };
const CAT_NAME = { food: "food", groceries: "groceries", transport: "transport", shopping: "shopping", fun: "going out", coffee: "coffee", health: "health", gifts: "gifts" };
const STATE = { done: ["Done", "ok"], ahead: ["Ahead", "ok"], "on-track": ["On track", "due"], behind: ["Behind", "late"], late: ["Deadline passed", "late"], unknown: ["Needs data", ""] };
const n = (v, d = 0) => (Math.round(Number(v) * 10 ** d) / 10 ** d).toLocaleString("en-US", { maximumFractionDigits: d });

/** The morning notification (08:30 tomorrow) with today's debrief — re-made every time the missions are looked at. */
export function scheduleMorning(missions, data, now = Date.now()) {
  const N = typeof window !== "undefined" && window.AttuneNative; if (!N) return;
  const lines = M.debrief(missions, data, now, getLang() === "ar" ? "ar" : "en");
  try {
    if (!lines.length) { N.unschedule && N.unschedule("missions-morning"); return; }
    const d = new Date(now); d.setHours(8, 30, 0, 0); if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    const body = lines.slice(0, 3).map((l) => `${l.title.slice(0, 40)} — ${l.head}`).join(" · ");
    N.schedule && N.schedule(JSON.stringify({ id: "missions-morning", at: d.getTime(), open: "missions", title: tr("Your missions today"), body }));
  } catch (e) {}
}

/** The chance over the days (from each day's log). */
function Spark({ log }) {
  const pts = (log || []).filter((x) => x.c != null).slice(-30);
  if (pts.length < 2) return null;
  const w = 120, h = 28, x = (i) => (i / (pts.length - 1)) * w, y = (c) => h - (c / 100) * h;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label={tr("Chance over the last days")} data-testid="mission-spark">
      <polyline fill="none" stroke="currentColor" strokeWidth="1.6" points={pts.map((p, i) => `${x(i)},${y(p.c)}`).join(" ")} />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].c)} r="2.6" fill="currentColor" />
    </svg>);
}

function Card({ m, e, onChange, onDelete, openScout }) {
  const [why, setWhy] = useState(false);
  const ar = getLang() === "ar";
  const [label, cls] = STATE[e.state] || STATE.unknown;
  const unit = m.kind === "weight" ? " kg" : m.kind === "learn" ? " " + tr("lessons") : "";
  return (
    <div className={cardPad + " space-y-3"} data-testid="mission">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-[12px] grid place-items-center shrink-0 bg-[var(--c-soft)]"><Target size={18} className="c-acc" /></span>
        <div className="flex-1 min-w-0">
          <b className="block text-[15px] font-extrabold leading-snug" dir="auto">{m.title}</b>
          <span className="c-sub text-[12px] tabular-nums">{m.deadline ? tr("{d} days left", { d: e.days }) + " · " + m.deadline : tr("No deadline")}</span>
        </div>
        <span className={"c-pill " + cls} data-testid="mission-state">{tr(label)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--c-ln)" }} aria-hidden="true"><div className="h-full rounded-full" style={{ width: e.pct + "%", background: "var(--c-acc)" }} /></div>
        <span className="c-num tabular-nums text-[13px] font-extrabold shrink-0" data-testid="mission-progress">{m.kind === "cap" ? tr("spent") + " " : ""}{n(e.value, m.kind === "weight" ? 1 : 0)}{m.kind === "learn" ? "" : unit} / {n(e.target, m.kind === "weight" ? 1 : 0)}{unit}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px]">{e.chance == null ? <span className="c-sub">{tr("No forecast yet")}</span> : <><span className="c-sub">{tr("Chance by the deadline")}</span> <b className="c-num tabular-nums text-[16px] font-black" data-testid="mission-chance">{Math.round(e.chance * 100)}%</b></>}</span>
        <span className="c-acc"><Spark log={m.log} /></span>
      </div>
      {e.step ? <p className="text-[13.5px] rounded-[20px] p-3 m-0 bg-[var(--c-soft)]" dir="auto" data-testid="mission-step"><b>{tr("Today")}: </b>{ar ? e.step.ar : tr(e.step.en)}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button className="min-h-[44px] px-2 rounded-[12px] text-[13px] font-bold flex items-center gap-1.5 c-sub hover:text-[var(--c-ink)]" onClick={() => setWhy(!why)} aria-expanded={why} data-testid="mission-why">{why ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{tr("Why")}</button>
        {m.kind === "buy" ? <button className="min-h-[44px] px-2 rounded-[12px] text-[13px] font-bold flex items-center gap-1.5 c-sub hover:text-[var(--c-ink)]" onClick={() => openScout(m)} data-testid="mission-scout"><Binoculars size={14} />{tr("Ads in Scout")}</button> : null}
        <button className="min-h-[44px] px-2 rounded-[12px] text-[13px] font-bold flex items-center gap-1.5 c-sub hover:text-[var(--c-ink)]" onClick={() => onChange({ ...m, status: m.status === "paused" ? "active" : "paused" })} data-testid="mission-pause">{m.status === "paused" ? <Play size={14} /> : <Pause size={14} />}{tr(m.status === "paused" ? "Resume" : "Pause")}</button>
        {e.state === "done" ? <button className={btnP + " !h-11 !min-h-[44px] !text-[14px]"} onClick={() => onChange({ ...m, status: "done" })} data-testid="mission-done"><Check size={15} />{tr("Mark done")}</button> : null}
        <button className="w-11 h-11 grid place-items-center rounded-[12px] c-sub hover:text-[var(--c-neg)] ms-auto" aria-label={tr("Delete")} onClick={() => onDelete(m)}><Trash2 size={15} /></button>
      </div>
      {why ? <ul className="c-sub text-[12.5px] m-0 ps-5 grid gap-1" data-testid="mission-evidence">{e.evidence.map((x, i) => <li key={i} dir="auto">{ar ? x.ar : tr(x.en)}</li>)}
        {e.perDayNeed != null && e.left > 0 ? <li dir="auto">{m.kind === "weight" ? tr("Needed from now: {x} kg a week", { x: n(e.perDayNeed * 7, 1) }) : tr("Needed from now: {x} a month", { x: n(e.perDayNeed * 30) })}</li> : null}</ul> : null}
    </div>);
}

export function MissionsPage({ flash }) {
  const [data, setData] = useState(() => M.loadMissions());
  const [text, setText] = useState(() => { try { const t = localStorage.getItem("attune:missions:draft") || ""; localStorage.removeItem("attune:missions:draft"); return t; } catch (e) { return ""; } });   // typed on Home
  const [v, setV] = useState(0);
  const fleet = useFleet();
  useEffect(() => { const on = () => setV((x) => x + 1); window.addEventListener("storage", on); document.addEventListener("visibilitychange", on); return () => { window.removeEventListener("storage", on); document.removeEventListener("visibilitychange", on); }; }, []);
  const d = useMemo(dataNow, [v, data, fleet]);
  const now = Date.now();
  const rows = useMemo(() => data.items.filter((m) => m.status !== "done").map((m) => ({ m, e: M.evaluate(m, d, now) })), [data, d]);
  // each look writes today's point on the chance line and re-makes the morning notification
  useEffect(() => {
    if (!data.items.length) return;
    const items = data.items.map((m) => { const r = rows.find((x) => x.m.id === m.id); return r && m.status === "active" ? M.logDay(m, r.e, now) : m; });
    if (JSON.stringify(items.map((x) => x.log)) !== JSON.stringify(data.items.map((x) => x.log))) setData(M.saveMissions({ ...data, items }));
    scheduleMorning(data.items, d, now);
  }, [rows]);
  const put = (items) => setData(M.saveMissions({ ...data, items }));
  const parsed = text.trim() ? M.parseMission(text, now) : null;
  const add = () => {
    if (!parsed) return;
    let m = M.startMission(parsed, d, now);
    if (m.kind === "buy") {   // the ads side of a buy mission: a Scout search, watched at night too
      try { const r = S.addGoal(S.loadScout(), m.item + (m.target ? " under " + m.target : ""), now); S.saveScout(r.data); m = { ...m, scoutId: r.goal.id, marketKey: S.marketKey(r.goal.g) };
        const N = window.AttuneNative; N && N.scoutNightPlan && N.scoutNightPlan(JSON.stringify(S.nightPlan(r.data))); } catch (e) {}
    }
    put([m, ...data.items]); setText(""); flash && flash(tr("Mission started — Attune works on it every day"));
  };
  const conflict = M.conflicts(data.items, d, now);
  const ar = getLang() === "ar";
  return (
    <div className={page + " rounded-[20px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="missions-page">
      <div>
        <h2 className={h1}>{tr("Missions")}</h2>
        <p data-intro="" className="c-sub text-[12.5px] m-0">{tr("Say a goal with a deadline. Attune works on it every day: it reads your money, food and Scout ads, gives your real chance, and the one step for today.")}</p>
      </div>
      <div className={cardPad + " space-y-2.5"}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="missions-input" placeholder={tr("e.g. “Save 60,000 by June”")}
          className={area} />
        {text.trim() ? (parsed
          ? <p className="text-[12.5px] c-sub" data-testid="missions-read">{tr(READ[parsed.kind] || "Buy it for {t} or less", { t: n(parsed.target), c: tr(CAT_NAME[parsed.cat] || "everything") })}{parsed.deadline ? " · " + tr("by {d}", { d: parsed.deadline }) : " · " + tr("add a date (e.g. by June)")}</p>
          : <p className="text-[12.5px] c-sub">{tr("Say a number and a date: save 60,000 by June · lose 6 kg before 20 January · buy … under 900k by 1 December · spend no more than 3,000 on food this month · pay off Ahmed's debt by December · finish the Turkish course by December.")}</p>) : null}
        <div className="flex flex-wrap gap-1.5">
          {!text.trim() ? EXAMPLES.map(([en, a]) => <button key={en} className={chip(false) + " !h-auto min-h-[40px] py-2 !whitespace-normal text-start"} onClick={() => setText(ar ? a : en)} data-testid="missions-example">{ar ? a : en}</button>) : null}
          {text.trim() ? <button className={btnP + " ms-auto"} disabled={!parsed || !parsed.deadline} onClick={add} data-testid="missions-start">{tr("Start the mission")}</button> : null}
        </div>
      </div>
      {conflict ? <div className={cardPad + " flex gap-2 text-[13px] !border-[var(--c-warn)]/40"} data-testid="missions-conflict"><AlertTriangle size={16} className="shrink-0 mt-0.5 text-[var(--c-warn)]" />
        <span>{tr("Your money missions need {a} a month together, but you keep about {b}. Pause one, or move a date.", { a: n(conflict.need), b: n(conflict.keep) })}</span></div> : null}
      {rows.length ? rows.map(({ m, e }) => <Card key={m.id} m={m} e={e} onChange={(x) => put(data.items.map((y) => (y.id === x.id ? x : y)))} onDelete={(x) => put(data.items.filter((y) => y.id !== x.id))}
        openScout={() => window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "scout" } }))} />)
        : <p className={cardPad + " c-sub text-[13px] text-center !py-6 m-0"}>{tr("No missions yet. Start one above — a saving goal, a weight goal, something to buy, a spending limit, a debt or a course.")}</p>}
      <DecisionLab />
    </div>);
}

/** v6.38 Missions phase 2 — "Test a big decision" (the Life Simulator): two options, thousands of futures from your own Money
    history, 1 / 3 / 5 years, in today's pounds, with stress tests. lifesim.js does the numbers. */
const OPT0 = [{ name: "Cash", now: "900000", monthly: "", months: "", value: "900000" }, { name: "Installments", now: "200000", monthly: "15000", months: "60", value: "900000" }];
function DecisionLab() {
  const ar = getLang() === "ar";
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState(() => { try { return JSON.parse(localStorage.getItem("attune:lifesim:v1") || "null") || OPT0.map((o) => ({ ...o, name: tr(o.name) })); } catch (e) { return OPT0; } });
  const [rates, setRates] = useState({ inflation: "25", certificate: "20" });
  const [res, setRes] = useState(null), [err, setErr] = useState("");
  const num = (v) => Number(String(v || "").replace(/[,\s]/g, "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))) || 0;
  const run = () => {
    setErr("");
    const ms = M.moneySense(j("ledger.v3", null), Date.now(), 365), B = LS.monthlyBlocks(ms.net, ms.inc);
    if (!B) { setRes(null); return setErr(tr("The simulator needs at least a month of your income and spending in Money.")); }
    try { localStorage.setItem("attune:lifesim:v1", JSON.stringify(opts)); } catch (e) {}
    const options = opts.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), now: num(o.now), monthly: num(o.monthly), months: num(o.months), value: num(o.value) }));
    const sim = LS.simulate({ blocks: B, balance: ms.balance, options, rates: { inflation: num(rates.inflation) / 100, certificate: num(rates.certificate) / 100 } });
    setRes({ sim, cur: ms.cur, months: ms.net.length });
  };
  const box = inp + " !text-[14px] tabular-nums";
  const field = (i, k, ph) => <input value={opts[i][k]} onChange={(e) => setOpts(opts.map((o, j2) => (j2 === i ? { ...o, [k]: e.target.value } : o)))} placeholder={tr(ph)} dir={k === "name" ? "auto" : "ltr"} inputMode={k === "name" ? "text" : "decimal"} className={box} style={{ borderColor: "var(--c-ln)" }} data-testid={`lifesim-${k}-${i}`} />;
  const fmt = (v) => n(v);
  const v = res && res.sim ? LS.verdict(res.sim) : null;
  return (
    <div className={cardPad + " space-y-3"} data-testid="lifesim">
      <button onClick={() => setOpen((x) => !x)} className="w-full text-start min-h-[44px] flex items-center justify-between gap-2" data-testid="lifesim-open">
        <span><b className="block text-[15px] font-extrabold">{tr("Test a big decision")}</b><span className="c-sub text-[12.5px]">{tr("Cash or installments, a new flat, a second car — see 2,000 futures from your own money before you decide.")}</span></span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
      {open ? <>
        <div className="grid sm:grid-cols-2 gap-2">{opts.map((o, i) => (
          <div key={i} className="rounded-[20px] border bg-[var(--c-bg)] p-3 space-y-2" style={{ borderColor: "var(--c-ln)" }}>
            {field(i, "name", "Option name")}
            <label className="text-[11.5px] c-sub block">{tr("Pay now")}{field(i, "now", "0")}</label>
            <div className="grid grid-cols-2 gap-1.5"><label className="text-[11.5px] c-sub">{tr("Then every month")}{field(i, "monthly", "0")}</label><label className="text-[11.5px] c-sub">{tr("For months")}{field(i, "months", "0")}</label></div>
            <label className="text-[11.5px] c-sub block">{tr("What you get is worth")}{field(i, "value", "0")}</label>
          </div>))}</div>
        <div className="flex flex-wrap gap-3 text-[12px] c-sub items-center">
          <label className="flex items-center gap-1">{tr("Inflation")} <input value={rates.inflation} onChange={(e) => setRates({ ...rates, inflation: e.target.value })} className={box + " w-14"} style={{ borderColor: "var(--c-ln)" }} dir="ltr" data-testid="lifesim-infl" />%</label>
          <label className="flex items-center gap-1">{tr("Bank certificate")} <input value={rates.certificate} onChange={(e) => setRates({ ...rates, certificate: e.target.value })} className={box + " w-14"} style={{ borderColor: "var(--c-ln)" }} dir="ltr" data-testid="lifesim-cert" />%</label>
          <button className={btnP + " ms-auto"} onClick={run} data-testid="lifesim-run">{tr("Run the futures")}</button>
        </div>
        {err ? <p className="text-[12.5px] c-warn m-0" data-testid="lifesim-err">{err}</p> : null}
        {res && res.sim ? <div className="space-y-2" data-testid="lifesim-result">
          {v ? <p className="text-[14px] font-medium m-0" dir="auto" data-testid="lifesim-verdict">{tr(v[0], v[1])}</p> : null}
          <div className="overflow-x-auto"><table className="w-full text-[12.5px] c-num tabular-nums">
            <thead><tr className="c-sub text-start"><th className="text-start py-1 pe-2">{tr("Option")}</th><th className="pe-2">{tr("Never runs out")}</th><th className="pe-2">{tr("Cash in 1 year")}</th><th className="pe-2">{tr("3 years")}</th><th className="pe-2">{tr("5 years")}</th><th>{tr("Owned after 5 years")}</th></tr></thead>
            <tbody>{res.sim.results.map((x) => <tr key={x.name} className="border-t" style={{ borderColor: "var(--c-ln)" }} data-testid="lifesim-row">
              <td className="py-1.5 pe-2 font-medium" dir="auto">{x.base ? tr("Don't do it") : x.name}{x.name === res.sim.best ? " ✓" : ""}</td>
              <td className={"pe-2 " + (x.ok < 0.9 ? "c-neg" : "c-pos")}>{Math.round(x.ok * 100)}%</td>
              <td className="pe-2">{fmt(x.at[1].p50)}</td><td className="pe-2">{fmt(x.at[3].p50)}</td><td className="pe-2">{fmt(x.at[5].p50)}</td><td>{fmt(x.worth5)}</td></tr>)}</tbody></table></div>
          <p className={kLabel + " m-0 pt-1"}>{tr("Stress tests: chance cash never runs out")}</p>
          <div className="overflow-x-auto"><table className="w-full text-[12.5px] c-num tabular-nums" data-testid="lifesim-stress"><tbody>
            {LS.STRESS.map((sc) => <tr key={sc.id} className="border-t" style={{ borderColor: "var(--c-ln)" }}><td className="py-1 pe-2" dir="auto">{ar ? sc.ar : tr(sc.en)}</td>
              {res.sim.results.filter((x) => !x.base).map((x) => { const st = x.stress.find((y) => y.id === sc.id); return <td key={x.name} className={"pe-2 " + (st.ok < 0.9 ? "c-neg" : "")}>{x.name}: {Math.round(st.ok * 100)}%</td>; })}</tr>)}
          </tbody></table></div>
          <p className="c-sub text-[11px] m-0">{tr("Median of 2,000 futures in today's {c}, from your last {d} days in Money. Installments are fixed, so inflation makes them smaller each month; savings earn the certificate rate. A model, not a promise.", { c: res.cur, d: res.months })}</p>
        </div> : null}
      </> : null}
    </div>);
}

/** Home's line for the missions: the one most at risk (chance + today's step), or an invitation to start one. */
/** v6.46 Home A: the active mission most at risk → { title, chance, step } (or null). Re-reads Fleet once it has loaded. */
export function useTopMission() {
  const fleet = useFleet();
  return useMemo(() => {
    try {
      const act = M.loadMissions().items.filter((m) => m.status === "active"); if (!act.length) return null;
      const d = dataNow(), r = act.map((m) => ({ m, e: M.evaluate(m, d) })).sort((a, b) => (a.e.chance ?? 1) - (b.e.chance ?? 1))[0];
      return { title: r.m.title, chance: r.e.chance, step: r.e.step ? (getLang() === "ar" ? r.e.step.ar : tr(r.e.step.en)) : "" };
    } catch (e) { return null; }
  }, [fleet]);
}
export function MissionsLine({ go }) {
  useFleet();
  const data = M.loadMissions(), act = data.items.filter((m) => m.status === "active"), ar = getLang() === "ar";
  if (!act.length) return (
    <button onClick={go} className={kCard + " w-full text-start p-3.5 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)]"} data-testid="home-missions">
      <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-soft)] shrink-0"><Target size={18} className="c-acc" /></span>
      <span className="flex-1 min-w-0"><b className="block text-[14.5px] font-extrabold">{tr("Missions")}</b><span className="c-sub block text-[12.5px] truncate">{tr("A goal with a date — Attune works on it every day")}</span></span>
    </button>);
  const d = dataNow(), rows = act.map((m) => ({ m, e: M.evaluate(m, d) })).sort((a, b) => (a.e.chance ?? 1) - (b.e.chance ?? 1)), r = rows[0];
  return (
    <button onClick={go} className={kCard + " w-full text-start p-3.5 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)]"} data-testid="home-missions">
      <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-soft)] shrink-0"><Target size={18} className="c-acc" /></span>
      <span className="flex-1 min-w-0"><b className="block text-[14.5px] font-extrabold truncate" dir="auto">{r.m.title}</b>
        <span className="c-sub block text-[12.5px] tabular-nums truncate" dir="auto">{r.e.chance == null ? tr("Needs data") : tr("{c}% chance", { c: Math.round(r.e.chance * 100) })}{r.e.step ? " · " + (ar ? r.e.step.ar : tr(r.e.step.en)) : ""}</span></span>
      {act.length > 1 ? <span className="c-sub text-[11px] shrink-0">+{act.length - 1}</span> : null}
    </button>);
}
