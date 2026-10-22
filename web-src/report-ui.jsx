/* ---- v7.0 My report — Gemini's design in Direction 2 "Quiet Atelier" (Ali approved the mock-up, 22 Oct 2026; option C): the
   numbers of the day as KPI tiles with a bar, and "This week" — what was spent each day (bars) and eaten (a line), drawn in SVG.
   Pure display: Home (home-ui.jsx) passes what it already knows. Tests: tests/e2e_v748commands.py (My report), v750report. */
import React from "react";
import { tr } from "./i18n.js";

const n0 = (n) => Math.round(+n || 0).toLocaleString("en-US");
const Tile = ({ label, value, pill, pct, tone, testid, sub }) => (
  <div className="c-card space-y-2 !p-3.5" data-testid={testid}>
    <div className="flex items-center justify-between gap-2">
      <span className="c-sub text-[12px] font-bold truncate">{label}</span>
      {pill ? <span className={"c-pill" + (tone === "late" ? " late" : tone === "due" ? " due" : "")}>{pill}</span> : null}
    </div>
    <b className={"block c-num text-[clamp(17px,4.6vw,21px)] font-black tracking-tight whitespace-nowrap " + (tone === "pos" ? "c-pos" : "")} dir="ltr">{value}</b>
    {pct != null ? <div className="c-bar"><i style={{ width: Math.max(2, Math.min(100, pct)) + "%", ...(tone === "warm" ? { background: "var(--c-acc-2)" } : {}) }} /></div> : null}
    {sub ? <span className="c-sub block text-[11px] truncate">{sub}</span> : null}
  </div>);

/** The four tiles: safe to spend today · spent this month · food today · cranes working (only for Fleet users). */
export function ReportTiles({ safe, spentMonth, cur, kcal, goal, fleetK }) {
  const tiles = [];
  if (safe && safe.cur) tiles.push(<Tile key="safe" testid="home-num-spend" label={tr("Safe today")} value={n0(safe.today) + " " + safe.cur}
    pill={safe.today > 0 ? tr("On track") : tr("Spent")} tone={safe.today > 0 ? "" : "late"} pct={safe.perDay > 0 ? (safe.today / safe.perDay) * 100 : null} />);
  if (spentMonth != null && cur) tiles.push(<Tile key="month" testid="home-num-month" label={tr("Spent this month")} value={n0(spentMonth) + " " + cur} tone="warm" />);
  if (goal) tiles.push(<Tile key="kcal" testid="home-num-kcal" label={tr("Food today")} value={n0(kcal) + " kcal"} pill={Math.round((kcal / goal) * 100) + "%"} pct={(kcal / goal) * 100} />);
  if (fleetK) tiles.push(<Tile key="cranes" testid="home-num-cranes" label={tr("Cranes out")} value={`${fleetK.working} / ${fleetK.cranes}`} tone="pos" pct={fleetK.cranes ? (fleetK.working / fleetK.cranes) * 100 : null} />);
  if (!tiles.length) return null;
  return <div className="grid grid-cols-2 gap-2.5" data-testid="home-numbers">{tiles}</div>;
}

/** "This week": spend bars and a calories line, seven days, today in terracotta. Hidden when the week is empty. */
export function WeekChart({ week, cur }) {
  if (!week || !week.some((d) => d.spend > 0 || d.kcal > 0)) return null;
  const W = 340, H = 120, base = 96, top = 14, step = (W - 30) / 7;
  const maxS = Math.max(1, ...week.map((d) => d.spend)), maxK = Math.max(1, ...week.map((d) => d.kcal));
  const y = (v, m) => base - ((base - top) * v) / m;
  const pts = week.map((d, i) => `${20 + step * i + step / 2},${y(d.kcal, maxK)}`).join(" ");
  const hasK = week.some((d) => d.kcal > 0), hasS = week.some((d) => d.spend > 0);
  return (
    <div className="c-card space-y-2" data-testid="home-week">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <b className="text-[14px]">{tr("This week")}</b>
        <span className="flex items-center gap-3 text-[11px] c-sub">
          {hasS ? <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: "var(--c-acc)" }} />{tr("Spent")}{cur ? " (" + cur + ")" : ""}</span> : null}
          {hasK ? <span className="inline-flex items-center gap-1"><i className="w-3 h-0.5 inline-block" style={{ background: "var(--c-acc-2)" }} />kcal</span> : null}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 8}`} className="w-full h-auto" role="img" aria-label={tr("This week")}>
        <line x1="16" y1={top} x2={W - 6} y2={top} stroke="var(--c-ln)" strokeDasharray="3 3" />
        <line x1="16" y1={(top + base) / 2} x2={W - 6} y2={(top + base) / 2} stroke="var(--c-ln)" strokeDasharray="3 3" />
        <line x1="16" y1={base} x2={W - 6} y2={base} stroke="var(--c-ln)" />
        {hasS ? week.map((d, i) => { const h = Math.max(d.spend > 0 ? 3 : 0, base - y(d.spend, maxS)); return h ? <rect key={d.day} x={20 + step * i + step / 2 - 9} y={base - h} width="18" height={h} rx="5" fill={d.today ? "var(--c-acc-2)" : "var(--c-acc)"}><title>{d.label}: {n0(d.spend)}</title></rect> : null; }) : null}
        {hasK ? <polyline points={pts} fill="none" stroke="var(--c-acc-2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity={hasS ? 0.9 : 1} /> : null}
        {week.map((d, i) => <text key={"t" + d.day} x={20 + step * i + step / 2} y={H + 4} fontSize="10" textAnchor="middle" fill={d.today ? "var(--c-ink)" : "var(--c-mut)"} fontWeight={d.today ? 800 : 400}>{d.label}</text>)}
      </svg>
    </div>);
}
