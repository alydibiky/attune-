/* ---- v6.28 Ask your life (mode "lifeask") — one question, answered by code from everything Attune keeps for you; the answer says
   where it came from and opens that tool. Phone: the question, examples, then the answer. Computer (layout A): asking on the left,
   the answer on the right. Logic: lifeask.js. Tests: tests/e2e_v731lifeask.py.                                                    */
import React, { useState } from "react";
import { Sparkles, Search, Mic, ChevronRight, MessageSquare, Lock } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as A from "./lifeask.js";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";
import { page, cardPad, btnP, btnS, inp, label, chip, h1, muted } from "./ui-kit.jsx";

/** v6.38 (H3): the answer's chart — bars (money by month, food by day) or a line (lab results, sugar). Code-drawn SVG. */
export function AnswerChart({ chart, ar }) {
  const pts = chart.points, W = 320, H = 140, pad = 18, max = Math.max(...pts.map((p) => p.value), 1), min = chart.type === "line" ? Math.min(...pts.map((p) => p.value)) : 0;
  const span = max - min || 1, x = (i) => pad + (i + 0.5) * ((W - 2 * pad) / pts.length), y = (v) => H - 22 - ((v - min) / span) * (H - 44);
  const bw = Math.max(4, ((W - 2 * pad) / pts.length) * 0.62), lab = (p) => (ar && p.labelAr ? p.labelAr : p.label);
  const fmt = (v) => (v >= 10000 ? Math.round(v / 1000) + "k" : Math.round(v * 10) / 10).toLocaleString("en-US");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40" role="img" aria-label={tr("Chart")} data-testid="lifeask-chart" data-type={chart.type} data-points={pts.length} dir="ltr">
      {chart.type === "bar" ? pts.map((p, i) => <g key={i}>
        <rect x={x(i) - bw / 2} y={y(p.value)} width={bw} height={Math.max(0, H - 22 - y(p.value))} rx="2" fill={chart.mark && p.key >= chart.mark ? "var(--c-acc, #14b8a6)" : "var(--c-ln, #475569)"} data-testid="lifeask-bar" />
        {pts.length <= 8 ? <text x={x(i)} y={y(p.value) - 3} fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.75">{fmt(p.value)}</text> : null}
      </g>) : <>
        <polyline fill="none" stroke="var(--c-acc, #14b8a6)" strokeWidth="2.2" points={pts.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")} />
        {pts.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.value)} r="2.8" fill="var(--c-acc, #14b8a6)" /><text x={x(i)} y={y(p.value) - 5} fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.75">{fmt(p.value)}</text></g>)}
      </>}
      {pts.map((p, i) => (pts.length <= 12 || i % Math.ceil(pts.length / 8) === 0 ? <text key={"l" + i} x={x(i)} y={H - 8} fontSize="8.5" textAnchor="middle" fill="currentColor" opacity="0.6">{lab(p)}</text> : null))}
      {chart.mark ? (() => { const i = pts.findIndex((p) => p.key >= chart.mark); return i >= 0 ? <g><line x1={x(i) - bw / 2 - 3} x2={x(i) - bw / 2 - 3} y1="8" y2={H - 20} stroke="currentColor" strokeDasharray="3 3" opacity="0.5" /><text x={x(i) - bw / 2 - 1} y="12" fontSize="8.5" fill="currentColor" opacity="0.75">{chart.markLabel ? chart.markLabel[ar ? 1 : 0] : ""}</text></g> : null; })() : null}
    </svg>);
}

const TOOL = { money: "Money", life: "People & plans", care: "Family health", fit: "Fit & Food", radar: "Deadline Radar", reminders: "Reminders", memory: "Mind" };
const RECENT = "attune:lifeask:recent";
const loadRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };

export function LifeAskPage({ navTo, askChat, listen }) {
  const ar = getLang() === "ar";
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);     // { q, a } — a = the answer, or null (nothing in your data)
  const [recent, setRecent] = useState(loadRecent);
  const ask = (text) => {
    const t = String(text || q).trim(); if (!t) return;
    setQ(t);
    const a = A.askLife(t, A.loadStores());
    setRes({ q: t, a });
    const r = [t, ...recent.filter((x) => x !== t)].slice(0, 6); setRecent(r);
    try { localStorage.setItem(RECENT, JSON.stringify(r)); } catch (e) {}
  };
  const voice = listen ? async () => { try { const t = await listen(ar ? "ar-EG" : "en-US", () => {}); if (t) ask(t); } catch (e) {} } : null;
  const field = inp + " flex-1 h-12 min-h-[48px]";
  const left = (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2" data-testid="lifeask-form">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Ask about your money, health, people, meals or deadlines…")} className={field} dir="auto" data-testid="lifeask-q" />
        {voice ? <button type="button" onClick={voice} className={btnS + " min-w-[48px] h-12 min-h-[48px]"} aria-label={tr("Speak")}><Mic size={17} className="text-[var(--c-acc)]" /></button> : null}
        <button className={btnP + " min-w-[48px] px-4"} disabled={!q.trim()} data-testid="lifeask-go"><Search size={16} /></button>
      </form>
      <div><span className={label}>{tr("Try")}</span>
        <div className="flex flex-wrap gap-2 mt-2">{A.EXAMPLES.map(([en, a]) => <button key={en} onClick={() => ask(ar ? a : en)} className={chip(false) + " h-auto min-h-[44px] py-2 whitespace-normal text-start text-[var(--c-ink)]"} dir="auto" data-testid="lifeask-example">{ar ? a : en}</button>)}</div></div>
      {recent.length ? <div><span className={label}>{tr("Asked before")}</span>
        <div className="mt-1 space-y-1">{recent.map((x) => <button key={x} onClick={() => ask(x)} className={"block w-full min-h-[44px] text-start text-[13.5px] py-2 hover:text-[var(--c-ink)] " + muted} dir="auto">{x}</button>)}</div></div> : null}
      <p className="c-sub text-[12px] m-0 flex gap-1.5 items-start"><Lock size={13} className="shrink-0 mt-0.5" />{tr("Answered from your own records on this device, by code — nothing is sent anywhere, and every number can be checked in the tool it came from.")}</p>
    </div>);
  const answer = res ? (res.a ? (
    <div className={cardPad + " space-y-3"} data-testid="lifeask-answer" data-kind={res.a.kind}>
      <span className={label} dir="auto">{res.q}</span>
      <p className="text-[17px] leading-snug m-0 font-medium" dir="auto" data-testid="lifeask-text">{(ar ? res.a.ar : res.a.en).replace(/\*\*/g, "")}</p>
      {res.a.chart ? <AnswerChart chart={res.a.chart} ar={ar} /> : null}
      {(res.a.rows || []).length ? <table className="w-full text-[13.5px] c-num" data-testid="lifeask-rows"><tbody>{res.a.rows.map(([k, v], i) => <tr key={i} className="border-t" style={{ borderColor: "var(--c-ln)" }}><td className="py-1.5 pe-3 c-sub whitespace-nowrap align-top" dir="auto">{k}</td><td className="py-1.5" dir="auto">{v}</td></tr>)}</tbody></table> : null}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="c-sub text-[12px]">{tr("From")}: {res.a.sources.map((s) => tr(TOOL[s] || s)).join(" · ")}</span>
        {res.a.open && TOOL[res.a.open] && navTo ? <button className={btnP + " ms-auto"} onClick={() => navTo(res.a.open)} data-testid="lifeask-open">{tr("Open {t}", { t: tr(TOOL[res.a.open]) })}<ChevronRight size={15} className="rtl:rotate-180" /></button> : null}
      </div>
    </div>) : (
    <div className={cardPad + " space-y-3"} data-testid="lifeask-none">
      <p className="m-0" dir="auto">{tr("Nothing in your own data answers this. Chat can answer general questions.")}</p>
      {askChat ? <button className={btnP} onClick={() => askChat(res.q)} data-testid="lifeask-chat"><MessageSquare size={15} />{tr("Ask Chat")}</button> : null}
    </div>)) : null;
  return (
    <div className={page + " rounded-[22px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="lifeask-page">
      <div><h2 className={h1 + " flex items-center gap-2"}><Sparkles size={20} className="text-[var(--c-acc)]" />{tr("Ask your life")}</h2>
        <p data-intro="" className={"m-0 mt-0.5 text-[13px] lg:max-w-[70ch] " + muted}>{tr("One question, answered from everything Attune keeps for you — money, debts, medicines, lab results, meals, deadlines and notes.")}</p></div>
      <div className={PANES}><div className={LEFT}>{left}</div>
        <div className={RIGHT}>{answer || <div className="hidden lg:block"><DeskEmpty icon={Sparkles} title={tr("Your answer appears here")} testid="lifeask-empty" /></div>}</div></div>
    </div>);
}
