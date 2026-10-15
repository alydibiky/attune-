/* ---- v6.28 Scout (mode "scout") — goals that hunt for days. Left: a new goal (examples) and your goals; right: the selected goal's
   finds, best first — each with every wish ✓ / ✗ / "not stated" quoting the ad, the fair price, a price drop, the same ad on other
   sites, 👍 / 👎, the ad, and a ready message to the seller. Runs: "Check now", and by itself when Attune opens (each goal at most
   twice a day; the computer app also while it stays open). A strong NEW find (or a price drop) → a notification.
   Logic: scout.js. Tests: tests/unit/v731scout.test.mjs, tests/e2e_v731scout.py.                                                   */
import React, { useEffect, useState } from "react";
import { Binoculars, Plus, RefreshCw, Trash2, ThumbsUp, ThumbsDown, ExternalLink, Copy, Check, X, HelpCircle, TrendingDown, Loader2, Pause, Play } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as S from "./scout.js";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

const EXAMPLES = [
  ["3-bedroom flat for rent in Maadi under 15,000, not ground floor, near the metro", "شقة ٣ غرف للإيجار في المعادي أقل من ١٥ ألف مش دور أرضي قريبة من المترو"],
  ["Hyundai Tucson 2019 to 2021 under 900k, one owner, no accident, automatic", "هيونداي توسان من 2019 لـ 2021 أقل من 900 ألف أول مالك بدون حوادث أوتوماتيك"],
  ["iPhone 16 Pro 256GB new under 70,000", "ايفون 16 برو 256 جيجا جديد أقل من 70 ألف"],
  ["Data analyst job in Cairo, remote, full-time", "وظيفة محلل بيانات في القاهرة عن بعد دوام كامل"],
  ["Crane hire 100 ton in 6th of October", "إيجار ونش 100 طن في 6 أكتوبر"],
];
const KIND = { rent: ["Flat to rent", "شقة للإيجار"], "buy-home": ["Home to buy", "عقار للشراء"], car: ["Car", "سيارة"], product: ["Product", "منتج"], job: ["Job", "وظيفة"], tender: ["Tender", "مناقصة"], service: ["Service / supplier", "خدمة / مورد"] };
const fmt = (v) => Math.round(v).toLocaleString("en-US");

/** One run of a goal with the app's own web search. search(q) → { hits }. → { goal (updated), tell: [ads worth a notification], run } */
export async function runScoutGoal(goal, search, onStep, now = Date.now()) {
  const qs = S.searchesFor(goal.g), hits = [];
  for (let i = 0; i < qs.length; i++) {
    onStep && onStep(i + 1, qs.length, qs[i]);
    try { const r = await search(qs[i]); for (const h of (r && r.hits) || []) if (!hits.some((x) => x.url === h.url)) hits.push(h); } catch (e) { /* one site failing never stops the run */ }
  }
  // (no ad page at all → the item's own words, plain — some sites only show up that way)
  if (!hits.some((h) => S.isAdPage(h.url, h.text || ""))) {
    for (const q of S.fallbackSearches(goal.g)) { try { const r = await search(q); for (const h of (r && r.hits) || []) if (!hits.some((x) => x.url === h.url)) hits.push(h); } catch (e) {} }
  }
  const run = S.runGoal(goal, hits, { now });
  return { goal: { ...goal, seen: run.seen, lastRun: now, lastCount: run.found.length, lastHits: hits.length }, tell: S.worthTelling(run), run };
}
export function tellText(goal, tell, ar) {
  const a = tell[0], price = a.facts.price ? fmt(a.facts.price) + " " + (a.facts.cur || "") : "";
  const why = a.dropped > 0 ? (ar ? `انخفض ${fmt(a.dropped)}` : `dropped ${fmt(a.dropped)}`) : a.fair && a.fair.pct <= -5 ? (ar ? `أقل ${-a.fair.pct}% من المشابه` : `${-a.fair.pct}% below similar`) : "";
  return { title: (ar ? "الكشّاف: " + tell.length + " نتيجة جديدة قوية" : `Scout: ${tell.length} strong new find${tell.length === 1 ? "" : "s"}`) + " — " + (goal.g.what || goal.text).slice(0, 40),
    body: [a.title, price, why].filter(Boolean).join(" · ") };
}

export function ScoutPage({ search, remind, flash, openLink, incoming, clearIncoming }) {
  const ar = getLang() === "ar";
  const [data, setData] = useState(() => S.loadScout());
  const put = (d) => setData(S.saveScout(d));
  const [sel, setSel] = useState(() => (S.loadScout().goals[0] || {}).id || null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(null);   // { id, i, n, q }
  const [copied, setCopied] = useState("");
  const goal = data.goals.find((x) => x.id === sel) || null;
  const run = async (gl) => {
    if (!search) { flash && flash(tr("Scout searches the web from the Android app or the computer app.")); return; }
    setBusy({ id: gl.id, i: 0, n: 0, q: "" });
    const r = await runScoutGoal(gl, search, (i, n, q) => setBusy({ id: gl.id, i, n, q }));
    const d = S.loadScout(); put({ ...d, goals: d.goals.map((x) => (x.id === gl.id ? { ...r.goal, votes: x.votes, taste: x.taste, on: x.on } : x)) });
    setBusy(null);
    if (r.tell.length && remind) { const t = tellText(gl, r.tell, ar); remind({ id: "scout-" + gl.id, at: Date.now() + 1500, repeat: "none", title: t.title, body: t.body }); }
    flash && flash(r.run.found.length ? tr("{n} matches found", { n: r.run.found.length }) : r.goal.lastHits ? tr("Nothing matches yet — Scout keeps looking") : tr("The sites didn't answer — try again in a while"));
  };
  const add = (t) => { const s = String(t || text).trim(); if (!s) return; const r = S.addGoal(data, s); put(r.data); setSel(r.goal.id); setText(""); setTimeout(() => run(r.goal), 50); };
  // a goal typed on Home ("find me a flat in Maadi…") arrives here and starts
  useEffect(() => { if (incoming && incoming.text) { add(incoming.text); clearIncoming && clearIncoming(); } }, [incoming && incoming.id]);
  const vote = (ad, up) => {
    const d = S.loadScout();
    put({ ...d, goals: d.goals.map((x) => (x.id !== goal.id ? x : { ...x, votes: { ...(x.votes || {}), [ad.id]: up ? 1 : -1 }, taste: S.learn(x.taste, ad, up) })) });
  };
  const found = goal ? S.runGoal(goal, [], { now: Date.now() }).found : [];
  const field = "w-full rounded-xl px-3 py-2.5 text-[14.5px] border bg-transparent";
  const left = (
    <div className="space-y-4">
      <div className="c-card space-y-2">
        <span className="c-lbl">{tr("What should Scout look for?")}</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" placeholder={tr("e.g. a 3-bedroom flat for rent in Maadi under 15,000, not ground floor")} className={field} style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="scout-text" />
        <button className="c-btn inline-flex items-center gap-1.5" disabled={!text.trim()} onClick={() => add()} data-testid="scout-add"><Plus size={15} />{tr("Start scouting")}</button>
        <div className="flex flex-wrap gap-1.5 pt-1">{EXAMPLES.map(([en, a]) => <button key={en} onClick={() => setText(ar ? a : en)} className="rounded-full border px-2.5 py-1 text-[12px] text-start" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} dir="auto" data-testid="scout-example">{ar ? a : en}</button>)}</div>
      </div>
      {data.goals.length ? <div className="space-y-2" data-testid="scout-goals"><span className="c-lbl">{tr("Your goals")}</span>
        {data.goals.map((x) => (
          <div key={x.id} className="c-card flex items-start gap-2" style={x.id === sel ? { borderColor: "var(--c-acc)" } : {}} data-testid="scout-goal">
            <button className="flex-1 min-w-0 text-start" onClick={() => setSel(x.id)}>
              <b className="block text-[14px]" dir="auto">{x.g.what || x.text}</b>
              <span className="c-sub text-[12px]">{tr(KIND[x.g.kind] ? KIND[x.g.kind][0] : "Search")}{x.g.max ? " · ≤ " + fmt(x.g.max) : ""}{x.g.place ? " · " + x.g.place : ""} · {x.lastRun ? tr("{n} matches", { n: x.lastCount || 0 }) + " · " + new Date(x.lastRun).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : tr("not run yet")}{x.on === false ? " · " + tr("paused") : ""}</span>
              {busy && busy.id === x.id ? <span className="c-acc text-[12px] flex items-center gap-1 mt-0.5" data-testid="scout-busy"><Loader2 size={12} className="animate-spin" />{tr("Searching {i} of {n}…", { i: busy.i, n: busy.n })}</span> : null}
            </button>
            <button className="c-sub p-1" aria-label={tr("Check now")} title={tr("Check now")} disabled={!!busy} onClick={() => run(x)} data-testid="scout-run"><RefreshCw size={15} /></button>
            <button className="c-sub p-1" aria-label={x.on === false ? tr("Resume") : tr("Pause")} title={x.on === false ? tr("Resume") : tr("Pause")} onClick={() => put({ ...data, goals: data.goals.map((y) => (y.id === x.id ? { ...y, on: y.on === false } : y)) })}>{x.on === false ? <Play size={15} /> : <Pause size={15} />}</button>
            <button className="c-sub p-1" aria-label={tr("Delete")} onClick={() => { put({ ...data, goals: data.goals.filter((y) => y.id !== x.id) }); if (sel === x.id) setSel(null); }}><Trash2 size={15} /></button>
          </div>))}</div> : null}
      <p className="c-sub text-[12px] m-0">{tr("Scout checks each goal when you open Attune (at most twice a day) and whenever you tap Check now, and tells you only about strong new finds or price drops. It reads public ads only and never contacts anyone or pays for you.")}</p>
    </div>);
  const results = goal ? (
    <div className="space-y-3" data-testid="scout-results">
      <div className="c-card space-y-1"><b dir="auto">{goal.g.what || goal.text}</b>
        <div className="flex flex-wrap gap-1.5 text-[12px]">
          {goal.g.max ? <span className="c-pill">≤ {fmt(goal.g.max)}</span> : null}{goal.g.place ? <span className="c-pill">{goal.g.place}</span> : null}
          {goal.g.wish.map((w) => <span key={w.k} className="c-pill">{ar ? w.say[1] : w.say[0]}</span>)}</div></div>
      {!found.length ? <p className="c-sub" data-testid="scout-none">{goal.lastRun ? tr("Nothing that matches yet. Scout keeps looking — you'll be told when something good appears.") : tr("Searching…")}</p> : null}
      {found.slice(0, 30).map((a) => {
        const vote0 = (goal.votes || {})[a.id];
        const msg = S.sellerMessage(a, goal.g, { ar });
        return (
          <div key={a.id} className="c-card space-y-2" data-testid="scout-ad">
            <div className="flex items-start gap-3">
              {a.image ? <img src={a.image} alt="" className="w-20 h-16 object-cover rounded-lg shrink-0" /> : null}
              <div className="flex-1 min-w-0">
                <b className="block text-[14.5px] leading-snug" dir="auto">{a.title || a.site}</b>
                <span className="c-sub text-[12px]">{a.site}{(a.also || []).length ? " · " + tr("also on {s}", { s: a.also.map((x) => x.site).join(", ") }) : ""}</span>
              </div>
              <div className="text-end shrink-0">{a.facts.price ? <div className="c-num font-bold" data-testid="scout-price">{fmt(a.facts.price)} <span className="c-sub text-[11px]">{a.facts.cur}</span></div> : null}
                <div className="c-num text-[12px] c-acc" data-testid="scout-score">{a.score}/100</div></div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[12px]">
              {a.fair ? <span className={"c-pill " + (a.fair.pct > 10 ? "late" : "")} data-testid="scout-fair">{a.fair.pct <= -3 ? tr("{p}% below similar", { p: -a.fair.pct }) : a.fair.pct >= 3 ? tr("{p}% above similar", { p: a.fair.pct }) : tr("a fair price")}{a.fair.basis === "m2" ? " " + tr("(per m²)") : ""}</span> : null}
              {a.cheapest ? <span className="c-pill" data-testid="scout-cheapest">{tr("cheapest of {n} stores", { n: a.cheapest })}</span> : null}
              {a.dropped > 0 ? <span className="c-pill" data-testid="scout-drop"><TrendingDown size={11} className="inline" /> {tr("dropped {v}", { v: fmt(a.dropped) })}</span> : null}
            </div>
            <ul className="m-0 p-0 list-none space-y-0.5 text-[13px]" data-testid="scout-checks">
              {a.check.ok.map((x) => <li key={"o" + x.k} className="flex gap-1.5"><Check size={14} className="c-pos shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : x.en}{x.quote ? <span className="c-sub"> — «{x.quote}»</span> : null}</span></li>)}
              {a.check.bad.map((x) => <li key={"b" + x.k} className="flex gap-1.5"><X size={14} className="c-neg shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : x.en}{x.quote ? <span className="c-sub"> — «{x.quote}»</span> : null}</span></li>)}
              {a.check.unknown.map((x) => <li key={"u" + x.k} className="flex gap-1.5 c-sub"><HelpCircle size={14} className="shrink-0 mt-0.5" /><span dir="auto">{ar ? x.ar : x.en} — {tr("not stated in the ad")}</span></li>)}
            </ul>
            <div className="flex flex-wrap gap-2 items-center pt-1">
              <button className="c-btn inline-flex items-center gap-1" onClick={() => (openLink ? openLink(a.url, a.title) : window.open(a.url, "_blank"))} data-testid="scout-open"><ExternalLink size={14} />{tr("Open the ad")}</button>
              <button className="c-sub inline-flex items-center gap-1 px-1" onClick={() => { try { navigator.clipboard.writeText(msg); } catch (e) {} setCopied(a.id); flash && flash(tr("Message copied — paste it to the seller")); }} title={msg} data-testid="scout-msg">{copied === a.id ? <Check size={14} /> : <Copy size={14} />}{tr("Message to the seller")}</button>
              <span className="ms-auto flex gap-1">
                <button className={"p-1.5 rounded-lg " + (vote0 === 1 ? "c-acc" : "c-sub")} aria-label={tr("Good match")} onClick={() => vote(a, true)} data-testid="scout-up"><ThumbsUp size={15} /></button>
                <button className={"p-1.5 rounded-lg " + (vote0 === -1 ? "c-neg" : "c-sub")} aria-label={tr("Not for me")} onClick={() => vote(a, false)} data-testid="scout-down"><ThumbsDown size={15} /></button></span>
            </div>
          </div>); })}
    </div>) : <DeskEmpty icon={Binoculars} title={tr("Your finds appear here")} testid="scout-empty" />;
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="scout-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Binoculars size={20} className="c-acc" />{tr("Scout")}</h2>
        <p className="c-sub m-0 lg:max-w-[70ch]">{tr("Say once what you're looking for — a flat, a car, a product, a job, a supplier. Scout searches the sites that matter, checks every wish against what each ad says, tells you if the price is fair, and lets you know when something good appears.")}</p></div>
      <div className={PANES}><div className={LEFT}>{left}</div><div className={RIGHT}>{results}</div></div>
    </div>);
}
