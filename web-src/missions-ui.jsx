/* ---- v6.37 Missions (agent A) — the page. Say a goal with a deadline; Attune keeps working on it: each time it opens it reads
   your data, forecasts the chance, re-plans and shows the ONE step for today; a morning notification gives the debrief.
   The numbers are code (missions.js). A buy mission also starts a Scout search, so the night search watches the ads.   */
import React, { useEffect, useMemo, useState } from "react";
import { Target, Trash2, Check, Pause, Play, ChevronDown, ChevronUp, AlertTriangle, Binoculars } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as M from "./missions.js";
import * as S from "./scout.js";

const j = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch (e) { return d; } };
const dataNow = () => ({ ledger: j("ledger.v3", null), fit: j("attune:fit:v1", null), market: S.loadMarket() });
const EXAMPLES = [["Save 60,000 by June", "عايز أوفر 60 ألف قبل يونيو"], ["Lose 6 kg before 20 January", "عايز أخس 6 كيلو قبل 20 يناير"], ["Buy a Corolla 2022 under 900k by 1 December", "أشتري كورولا 2022 بأقل من 900 ألف قبل 1 ديسمبر"]];
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
  const unit = m.kind === "weight" ? " kg" : "";
  return (
    <div className="c-card space-y-2.5" data-testid="mission">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--c-acc-soft, rgba(20,184,166,.12))" }}><Target size={18} className="c-acc" /></span>
        <div className="flex-1 min-w-0">
          <b className="block text-[14.5px] leading-snug" dir="auto">{m.title}</b>
          <span className="c-sub text-[12px]">{m.deadline ? tr("{d} days left", { d: e.days }) + " · " + m.deadline : tr("No deadline")}</span>
        </div>
        <span className={"c-pill " + cls} data-testid="mission-state">{tr(label)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--c-ln)" }} aria-hidden="true"><div className="h-full rounded-full" style={{ width: e.pct + "%", background: "var(--c-acc, #14b8a6)" }} /></div>
        <span className="c-num text-[12.5px] shrink-0" data-testid="mission-progress">{n(e.value, m.kind === "weight" ? 1 : 0)}{unit} / {n(e.target, m.kind === "weight" ? 1 : 0)}{unit}</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px]">{e.chance == null ? <span className="c-sub">{tr("No forecast yet")}</span> : <><span className="c-sub">{tr("Chance by the deadline")}</span> <b className="c-num" data-testid="mission-chance">{Math.round(e.chance * 100)}%</b></>}</span>
        <span className="c-acc"><Spark log={m.log} /></span>
      </div>
      {e.step ? <p className="text-[13.5px] rounded-lg p-2.5" style={{ background: "var(--c-bg2, rgba(148,163,184,.08))" }} dir="auto" data-testid="mission-step"><b>{tr("Today")}: </b>{ar ? e.step.ar : e.step.en}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button className="c-sub px-1 text-[12.5px] flex items-center gap-1" onClick={() => setWhy(!why)} aria-expanded={why} data-testid="mission-why">{why ? <ChevronUp size={14} /> : <ChevronDown size={14} />}{tr("Why")}</button>
        {m.kind === "buy" ? <button className="c-sub px-1 text-[12.5px] flex items-center gap-1" onClick={() => openScout(m)} data-testid="mission-scout"><Binoculars size={14} />{tr("Ads in Scout")}</button> : null}
        <button className="c-sub px-1 text-[12.5px] flex items-center gap-1" onClick={() => onChange({ ...m, status: m.status === "paused" ? "active" : "paused" })} data-testid="mission-pause">{m.status === "paused" ? <Play size={14} /> : <Pause size={14} />}{tr(m.status === "paused" ? "Resume" : "Pause")}</button>
        {e.state === "done" ? <button className="c-btn" onClick={() => onChange({ ...m, status: "done" })} data-testid="mission-done"><Check size={14} className="inline -mt-0.5 me-1" />{tr("Mark done")}</button> : null}
        <button className="c-sub px-1 ms-auto" aria-label={tr("Delete")} onClick={() => onDelete(m)}><Trash2 size={14} /></button>
      </div>
      {why ? <ul className="c-sub text-[12.5px] m-0 ps-5 grid gap-1" data-testid="mission-evidence">{e.evidence.map((x, i) => <li key={i} dir="auto">{ar ? x.ar : x.en}</li>)}
        {e.perDayNeed != null && e.left > 0 ? <li dir="auto">{m.kind === "weight" ? tr("Needed from now: {x} kg a week", { x: n(e.perDayNeed * 7, 1) }) : tr("Needed from now: {x} a month", { x: n(e.perDayNeed * 30) })}</li> : null}</ul> : null}
    </div>);
}

export function MissionsPage({ flash }) {
  const [data, setData] = useState(() => M.loadMissions());
  const [text, setText] = useState(() => { try { const t = localStorage.getItem("attune:missions:draft") || ""; localStorage.removeItem("attune:missions:draft"); return t; } catch (e) { return ""; } });   // typed on Home
  const [v, setV] = useState(0);
  useEffect(() => { const on = () => setV((x) => x + 1); window.addEventListener("storage", on); document.addEventListener("visibilitychange", on); return () => { window.removeEventListener("storage", on); document.removeEventListener("visibilitychange", on); }; }, []);
  const d = useMemo(dataNow, [v, data]);
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
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="missions-page">
      <div>
        <h2 className="text-[20px] font-bold m-0">{tr("Missions")}</h2>
        <p data-intro="" className="c-sub text-[12.5px] m-0">{tr("Say a goal with a deadline. Attune works on it every day: it reads your money, food and Scout ads, gives your real chance, and the one step for today.")}</p>
      </div>
      <div className="c-card space-y-2">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} dir="auto" data-testid="missions-input" placeholder={tr("e.g. «عايز أوفر 60 ألف قبل يونيو»")}
          className="w-full bg-transparent border rounded-xl p-3 text-[14px]" style={{ borderColor: "var(--c-ln)" }} />
        {text.trim() ? (parsed
          ? <p className="text-[12.5px] c-sub" data-testid="missions-read">{tr(parsed.kind === "save" ? "Save {t}" : parsed.kind === "weight" ? "Lose {t} kg" : "Buy it for {t} or less", { t: n(parsed.target) })}{parsed.deadline ? " · " + tr("by {d}", { d: parsed.deadline }) : " · " + tr("add a date (e.g. by June)")}</p>
          : <p className="text-[12.5px] c-sub">{tr("Say a number and a date: save 60,000 by June · lose 6 kg before 20 January · buy … under 900k by 1 December.")}</p>) : null}
        <div className="flex flex-wrap gap-1.5">
          {!text.trim() ? EXAMPLES.map(([en, a]) => <button key={en} className="c-pill" onClick={() => setText(ar ? a : en)} data-testid="missions-example">{ar ? a : en}</button>) : null}
          {text.trim() ? <button className="c-btn ms-auto" disabled={!parsed || !parsed.deadline} onClick={add} data-testid="missions-start">{tr("Start the mission")}</button> : null}
        </div>
      </div>
      {conflict ? <div className="c-card flex gap-2 text-[13px]" data-testid="missions-conflict"><AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
        <span>{tr("Your money missions need {a} a month together, but you keep about {b}. Pause one, or move a date.", { a: n(conflict.need), b: n(conflict.keep) })}</span></div> : null}
      {rows.length ? rows.map(({ m, e }) => <Card key={m.id} m={m} e={e} onChange={(x) => put(data.items.map((y) => (y.id === x.id ? x : y)))} onDelete={(x) => put(data.items.filter((y) => y.id !== x.id))}
        openScout={() => window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "scout" } }))} />)
        : <p className="c-sub text-[13px] text-center py-6">{tr("No missions yet. Start one above — a saving goal, a weight goal, or something to buy.")}</p>}
    </div>);
}

/** Home's line for the missions: the one most at risk (chance + today's step), or an invitation to start one. */
export function MissionsLine({ go }) {
  const data = M.loadMissions(), act = data.items.filter((m) => m.status === "active"), ar = getLang() === "ar";
  if (!act.length) return (
    <button onClick={go} className="c-card w-full text-start p-3 flex items-center gap-3" data-testid="home-missions">
      <Target size={17} className="c-acc shrink-0" />
      <span className="flex-1 min-w-0"><b className="block text-[14px]">{tr("Missions")}</b><span className="c-sub block text-[12.5px] truncate">{tr("A goal with a date — Attune works on it every day")}</span></span>
    </button>);
  const d = dataNow(), rows = act.map((m) => ({ m, e: M.evaluate(m, d) })).sort((a, b) => (a.e.chance ?? 1) - (b.e.chance ?? 1)), r = rows[0];
  return (
    <button onClick={go} className="c-card w-full text-start p-3 flex items-center gap-3" data-testid="home-missions">
      <Target size={17} className="c-acc shrink-0" />
      <span className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{r.m.title}</b>
        <span className="c-sub block text-[12.5px] truncate" dir="auto">{r.e.chance == null ? tr("Needs data") : tr("{c}% chance", { c: Math.round(r.e.chance * 100) })}{r.e.step ? " · " + (ar ? r.e.step.ar : r.e.step.en) : ""}</span></span>
      {act.length > 1 ? <span className="c-sub text-[11px] shrink-0">+{act.length - 1}</span> : null}
    </button>);
}
