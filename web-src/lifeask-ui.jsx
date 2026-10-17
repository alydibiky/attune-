/* ---- v6.28 Ask your life (mode "lifeask") — one question, answered by code from everything Attune keeps for you; the answer says
   where it came from and opens that tool. Phone: the question, examples, then the answer. Computer (layout A): asking on the left,
   the answer on the right. Logic: lifeask.js. Tests: tests/e2e_v731lifeask.py.                                                    */
import React, { useState } from "react";
import { Sparkles, Search, Mic, ChevronRight, MessageSquare, Lock } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as A from "./lifeask.js";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

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
  const field = "flex-1 min-w-0 rounded-xl px-3 py-2.5 text-[15px] border bg-transparent";
  const left = (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="flex gap-2" data-testid="lifeask-form">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Ask about your money, health, people, meals or deadlines…")} className={field} style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} dir="auto" data-testid="lifeask-q" />
        {voice ? <button type="button" onClick={voice} className="c-card px-3" aria-label={tr("Speak")}><Mic size={17} className="c-acc" /></button> : null}
        <button className="c-btn px-4" disabled={!q.trim()} data-testid="lifeask-go"><Search size={16} /></button>
      </form>
      <div><span className="c-lbl">{tr("Try")}</span>
        <div className="flex flex-wrap gap-2 mt-1.5">{A.EXAMPLES.map(([en, a]) => <button key={en} onClick={() => ask(ar ? a : en)} className="rounded-full border px-3 py-1.5 text-[13px] text-start" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} dir="auto" data-testid="lifeask-example">{ar ? a : en}</button>)}</div></div>
      {recent.length ? <div><span className="c-lbl">{tr("Asked before")}</span>
        <div className="mt-1 space-y-1">{recent.map((x) => <button key={x} onClick={() => ask(x)} className="block w-full text-start c-sub text-[13.5px] py-1" dir="auto">{x}</button>)}</div></div> : null}
      <p className="c-sub text-[12px] m-0 flex gap-1.5 items-start"><Lock size={13} className="shrink-0 mt-0.5" />{tr("Answered from your own records on this device, by code — nothing is sent anywhere, and every number can be checked in the tool it came from.")}</p>
    </div>);
  const answer = res ? (res.a ? (
    <div className="c-card space-y-3" data-testid="lifeask-answer" data-kind={res.a.kind}>
      <span className="c-lbl" dir="auto">{res.q}</span>
      <p className="text-[17px] leading-snug m-0 font-medium" dir="auto" data-testid="lifeask-text">{(ar ? res.a.ar : res.a.en).replace(/\*\*/g, "")}</p>
      {(res.a.rows || []).length ? <table className="w-full text-[13.5px] c-num" data-testid="lifeask-rows"><tbody>{res.a.rows.map(([k, v], i) => <tr key={i} className="border-t" style={{ borderColor: "var(--c-ln)" }}><td className="py-1.5 pe-3 c-sub whitespace-nowrap align-top" dir="auto">{k}</td><td className="py-1.5" dir="auto">{v}</td></tr>)}</tbody></table> : null}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="c-sub text-[12px]">{tr("From")}: {res.a.sources.map((s) => tr(TOOL[s] || s)).join(" · ")}</span>
        {res.a.open && TOOL[res.a.open] && navTo ? <button className="c-btn ms-auto inline-flex items-center gap-1" onClick={() => navTo(res.a.open)} data-testid="lifeask-open">{tr("Open {t}", { t: tr(TOOL[res.a.open]) })}<ChevronRight size={15} className="rtl:-scale-x-100" /></button> : null}
      </div>
    </div>) : (
    <div className="c-card space-y-2" data-testid="lifeask-none">
      <p className="m-0" dir="auto">{tr("Nothing in your own data answers this. Chat can answer general questions.")}</p>
      {askChat ? <button className="c-btn inline-flex items-center gap-1.5" onClick={() => askChat(res.q)} data-testid="lifeask-chat"><MessageSquare size={15} />{tr("Ask Chat")}</button> : null}
    </div>)) : null;
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="lifeask-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Sparkles size={20} className="c-acc" />{tr("Ask your life")}</h2>
        <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("One question, answered from everything Attune keeps for you — money, debts, medicines, lab results, meals, deadlines and notes.")}</p></div>
      <div className={PANES}><div className={LEFT}>{left}</div>
        <div className={RIGHT}>{answer || <div className="hidden lg:block"><DeskEmpty icon={Sparkles} title={tr("Your answer appears here")} testid="lifeask-empty" /></div>}</div></div>
    </div>);
}
