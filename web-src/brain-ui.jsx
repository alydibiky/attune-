/* ---- v9.9.37 BR-4 the Attune brain (Ali picked BR-4 = BR-1 + BR-2 + BR-3): "What Attune knows" (facts with their source, Forget, Not
   right), Chat answers "how am I doing?" at once from them, the facts go with every question to the AI, and the Sunday analysis on Home.
   Pro; Free keeps the morning "Attune noticed" card. Recomputed every time Attune opens and every minute while it is open (lifefacts.js). */
import React, { useEffect, useMemo, useState } from "react";
import { tr } from "./i18n.js";
import * as F from "./lifefacts.js";
import { allowed } from "./plan.js";
import { proGate } from "./plan-ui.jsx";
import { progressOf } from "./life.js";
import { billsOf } from "./bills.js";
import { insights, loadSeen } from "./insights.js";
import { allStores } from "./connected.js";
import { loadDir } from "./entities.js";
import { getLang } from "./i18n.js";

const j = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
export const loadMem = () => j(F.BRAIN_KEY, {});
const saveMem = (m) => { try { localStorage.setItem(F.BRAIN_KEY, JSON.stringify(m)); } catch (e) {} return m; };
/** Everything the brain reads, from the stores. */
export function brainStores(now = Date.now()) {
  const N = typeof window !== "undefined" && window.AttuneNative;
  const ledger = j("ledger.v3", {}), notes = (() => { try { return N && N.recallNotes ? JSON.parse(N.recallNotes() || "[]") : []; } catch (e) { return []; } })();
  let noticed = []; try { noticed = insights(allStores(), loadDir(), { now, seen: loadSeen() }); } catch (e) {}
  return { ledger, life: j("attune:life:v1", { items: [] }), radar: j("attune:radar:v1", { items: [] }), notes, minds: j("attune:notifmind:v1", {}),
    agents: j("attune:agents:v1", { agents: [] }), bills: (() => { try { return billsOf(ledger, now); } catch (e) { return []; } })(), noticed, lang: getLang() };
}
export function brainFacts(now = Date.now()) { try { return F.facts(brainStores(now), loadMem(), { now, progress: progressOf }); } catch (e) { return []; } }
/** One fact as a line in the person's language. */
export const factText = (f) => (f.text ? f.text : tr(f.T[0], f.T[1]));
/** The lines that go with a question to the AI (Pro): the facts whose words meet the question's, else the 4 strongest. */
export function brainKnown(q, max = 6) {
  if (!allowed("brain")) return [];
  const all = brainFacts(); if (!all.length) return [];
  const words = String(q || "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3);
  const hit = all.filter((f) => { const t = (factText(f) + " " + (f.person || "") + " " + f.area).toLowerCase(); return words.some((w) => t.includes(w)); });
  return (hit.length ? hit : all.slice(0, 4)).slice(0, max).map((f) => factText(f) + " (" + tr(f.src) + ")");
}
/** Chat: "how am I doing?" → the card, by code, at once (Pro). null = not this question / Free. */
export function brainAnswer(q) {
  if (!F.BRAIN_ASK.test(String(q || "")) || !allowed("brain")) return null;
  const all = brainFacts().filter((f) => f.area !== "mine").slice(0, 6), mine = brainFacts().filter((f) => f.area === "mine").slice(0, 2);
  if (!all.length && !mine.length) return { tone: "emerald", title: tr("I don't know much yet — set up your life and I'll learn."), detail: "", actions: [[tr("Set up your life"), "open:setup"]] };
  return { tone: "emerald", title: tr("What I know right now"), detail: [...mine, ...all].map((f) => "• " + factText(f) + "  · " + tr(f.src)).join("\n"), actions: [[tr("What Attune knows"), "open:brain"]] };
}

const AREAS = [["mine", "What you told me"], ["money", "Money"], ["people", "People"], ["messages", "Waiting for you"], ["papers", "Papers"], ["bills", "Bills"], ["agents", "Agents"], ["noticed", "Attune noticed"]];
function BrainPageInner({ back }) {
  const [tick, setTick] = useState(0), [fix, setFix] = useState(null), [txt, setTxt] = useState("");
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const list = useMemo(() => brainFacts(), [tick]);
  const act = (m) => { saveMem(m); setTick((x) => x + 1); };
  return <div className="calm space-y-3 p-4 max-w-[680px] mx-auto" data-testid="brain-page">
    <div className="flex items-center gap-2">{back ? <button onClick={back} className="min-h-[44px] min-w-[44px] px-2 text-[18px]" aria-label={tr("Back")}>‹</button> : null}<h2 className="m-0 text-[20px] font-black">{tr("What Attune knows")}</h2></div>
    <p className="m-0 text-[13px] c-sub" dir="auto">{tr("{n} facts · worked out on this phone from your money, people, papers, messages and agents — each with where it came from.", { n: list.length })}</p>
    {list.length ? AREAS.map(([a, title]) => { const xs = list.filter((f) => f.area === a); if (!xs.length) return null;
      return <div key={a} className="c-card space-y-2" data-testid="brain-area" data-area={a}><b className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)]">{tr(title)}</b>
        {xs.map((f) => <div key={f.id} className="space-y-1 border-t border-[var(--c-ln)] first-of-type:border-t-0 pt-1.5" data-testid="brain-fact" data-id={f.id}>
          <p className="m-0 text-[14px]" dir="auto">{factText(f)}</p>
          <div className="flex items-center gap-3 text-[12px]"><span className="c-sub flex-1 min-w-0 truncate">{tr("From: {s}", { s: tr(f.src) })}</span>
            {f.mine ? null : <button onClick={() => { setFix(f.id); setTxt(""); }} className="min-h-[36px] font-bold underline" data-testid="brain-wrong">{tr("Not right")}</button>}
            <button onClick={() => act(F.forget(loadMem(), f.id))} className="min-h-[36px] min-w-[44px] font-bold underline c-sub" data-testid="brain-forget">{tr("Forget")}</button></div>
          {fix === f.id ? <div className="flex gap-2"><input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder={tr("What's right?")} className="flex-1 min-w-0 h-10 rounded-[10px] border border-[var(--c-ln)] bg-[var(--c-surf)] px-3 text-[14px]" data-testid="brain-fix-text" id="brain-fix-text" dir="auto" />
            <button onClick={() => { act(F.correct(loadMem(), f.id, txt, Date.now(), F.sameSubject(f, list, factText))); setFix(null); }} className="h-10 px-3 rounded-[10px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="brain-fix-save">{tr("Save")}</button></div> : null}
        </div>)}</div>; })
      : <div className="c-card"><p className="m-0 text-[14px]" dir="auto">{tr("I don't know much yet — set up your life and I'll learn.")}</p></div>}
  </div>;
}
export const BrainPage = proGate("brain", "What Attune knows", BrainPageInner);

/** Home (Pro): one row to the page, and on Sunday (or Monday if missed) the week in a few lines. */
export function BrainHome({ quiet = false }) {
  const [, bump] = useState(0);
  useEffect(() => { const t = setInterval(() => bump((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  if (quiet || !allowed("brain")) return null;
  const list = brainFacts(), now = Date.now();
  const seenW = (() => { try { return localStorage.getItem("attune:brain:week") || ""; } catch (e) { return ""; } })();
  const showW = F.weeklyDue(now, seenW), w = showW ? F.weekly(brainStores(now), { now }) : null;
  const open = (m) => { try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: m } })); } catch (e) {} };
  return <>
    {w && (w.spent || w.waiting || w.papers) ? <div className="c-card space-y-1.5" style={{ background: "var(--c-soft)" }} data-testid="brain-week">
      <span className="block text-[11px] font-extrabold uppercase tracking-[0.08em] text-[var(--c-mut)]">{tr("Sunday analysis")}</span>
      {w.spent ? <p className="m-0 text-[13.5px]" dir="auto">{w.pct == null ? tr("This week: {s} spent.", { s: F.n0(w.spent) + " " + w.cur }) : tr(w.pct >= 0 ? "This week: {s} spent — {p}% more than last week." : "This week: {s} spent — {p}% less than last week.", { s: F.n0(w.spent) + " " + w.cur, p: Math.abs(w.pct) })}</p> : null}
      {w.waiting ? <p className="m-0 text-[13.5px]" dir="auto">{tr("{n} people are waiting for you.", { n: w.waiting })}</p> : null}
      {w.papers ? <p className="m-0 text-[13.5px]" dir="auto">{tr("{n} papers end within 30 days.", { n: w.papers })}</p> : null}
      <div className="flex gap-2"><button onClick={() => open("brain")} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="brain-week-open">{tr("See everything")}</button>
        <button onClick={() => { try { localStorage.setItem("attune:brain:week", F.weekKey(now)); } catch (e) {} bump((x) => x + 1); }} className="h-10 px-3 c-sub text-[13px]" data-testid="brain-week-ok">{tr("OK")}</button></div>
    </div> : null}
    {list.length ? <button onClick={() => open("brain")} className="c-card w-full text-start flex items-center gap-3" data-testid="brain-row">
      <span className="text-[18px]" aria-hidden="true">🧠</span><span className="flex-1 min-w-0"><b className="block text-[14px]">{tr("What Attune knows")}</b><span className="block text-[12px] c-sub truncate" dir="auto">{tr("{n} facts", { n: list.length })} · {factText(list[0])}</span></span><span className="text-[var(--c-acc)] text-lg rtl:-scale-x-100">›</span></button> : null}
  </>;
}
