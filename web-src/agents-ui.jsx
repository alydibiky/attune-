/* ---- v8.0 Agents — design A, Ali's pick (25 Oct 2026): the box (one sentence makes an agent), quick chips, then each running
   agent as one calm card (what it watches, the last check, what it found) — Scout and Message alerts among them — and
   "See all → Agents report". Any app opens by its name ("open Uber", «افتح طلبات»). Agents never sign in, book or pay: a price
   is read, an order is copied into the app, a delivery is read from the store app's own notification. Logic: agents.js. */
import { noteProUse } from "./trialuse.js";
import React, { useEffect, useMemo, useState } from "react";
import { Send, ShoppingCart, Building2 as Hotel, Package, Utensils as UtensilsCrossed, Car, LayoutGrid as AppWindow, BellRing, Trash2, RefreshCw, ExternalLink, ChevronRight, ArrowLeft, AlertTriangle, Check } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as A from "./agents.js";
import { loadBooking } from "./agent-ui.jsx";
import * as W from "./watch.js";
import { loadScout } from "./scout.js";
import { agentLabels } from "./agent-ui.jsx";
import { useSubBack } from "./backstack.js";
import * as U from "./ui-kit.jsx";

const I = (s) => "⁦" + s + "⁩";
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) ? I(y) : y])) : v);
const money = (n, cur) => (cur ? cur + " " : "") + Math.round(n).toLocaleString("en-US");
const ago = (t, now = Date.now()) => { const m = Math.round((now - t) / 60000); return m < 60 ? T("{n} min ago", { n: Math.max(1, m) }) : m < 1440 ? T("{n} h ago", { n: Math.round(m / 60) }) : T("{n} days ago", { n: Math.round(m / 1440) }); };
const KIND_ICON = { buy: ShoppingCart, watch: Hotel, track: Package, order: UtensilsCrossed, scout: Car, alert: BellRing, open: AppWindow };
const CHIPS = [["buy", "Find & buy", "Buy me AirPods Pro 2 under 9,000", "اشتريلي ايربودز برو 2 بأقل من 9000"],
  ["watch", "Watch a price", "Tell me when hotels near the Haram are under 45k for 4 nights from 10 December", "نبهني لما فنادق الحرم تبقى أقل من 45 ألف لمدة 4 ليالي من 10 ديسمبر"],
  ["track", "Track a delivery", "Tell me when my Amazon order arrives", "قولي لما طلب أمازون يوصل"],
  ["order", "Order my usual", "Order my usual from Talabat", "اطلبلي أكلي المفضل من طلبات"],
  ["scout", "Scout ads", "Find me a used Hyundai Tucson 2022", "دورلي على هيونداي توسان 2022 مستعملة"],
  ["open", "Open an app", "Open Uber", "افتح أوبر"]];

export function AgentsPage({ native: N, nativeCall, navTo, flash, onScout, country = "EG", pro = true, openPlan = null }) {
  const ar = getLang() === "ar";
  const [st, setSt] = useState(() => A.loadAgents());
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);        // { text, d } — a sentence the agent is still asking about
  const [answer, setAnswer] = useState("");
  const [doCard, setDoCard] = useState(null);      // "do it now": the app links
  const [rep, setRep] = useState(false);
  const [busy, setBusy] = useState("");
  useSubBack(rep, () => setRep(false));
  const put = (next) => setSt(A.saveAgents(next));
  const upd = (id, fn) => { const cur = A.loadAgents(); put({ ...cur, agents: cur.agents.map((y) => (y.id === id ? fn(y) : y)) }); };   // always on the saved list (a round outlives the render that started it)
  const installed = useMemo(() => { try { return N && N.appsList ? JSON.parse(N.appsList() || "[]") : []; } catch (e) { return []; } }, [N]);
  const access = (() => { try { return !N || !N.payAccess || N.payAccess(); } catch (e) { return true; } })();
  const scout = useMemo(() => loadScout().goals || [], [st]);
  const alerts = useMemo(() => W.loadWatch(), [st]);
  const hits = useMemo(() => { try { return N && N.watchHits ? JSON.parse(N.watchHits() || "[]") : []; } catch (e) { return []; } }, [N, st]);

  // a sentence started on Home that still needs an answer continues here
  useEffect(() => {
    let d0 = ""; try { d0 = localStorage.getItem("attune:agents:draft") || ""; localStorage.removeItem("attune:agents:draft"); } catch (e) {}
    if (d0) { setText(d0); const d = A.parseAgent(d0, { country, installed, usual: st.usual, prefs: loadBooking() }); if (d && d.ask) setDraft({ text: d0, d }); else if (d && d.kind === "buy") start(d0, d); }
  }, []);
  // the phone's checks (AgentWatch.kt) come in; the price watches and the delivery rules go out
  useEffect(() => {
    try {
      const got = N && N.agentWatchTake ? JSON.parse(N.agentWatchTake() || "{}") : {};
      if (Object.keys(got).length) put({ ...st, agents: A.takeChecks(st.agents, got) });
    } catch (e) {}
  }, []);
  useEffect(() => {
    try { N && N.agentWatchPlan && N.agentWatchPlan(JSON.stringify(A.watchPlan(st))); } catch (e) {}
    const others = W.loadWatch().filter((r) => !String(r.id).startsWith("agent-"));
    const mine = st.agents.filter((a) => a.kind === "track").map(A.trackRule);
    W.saveWatch([...others, ...mine], ar ? "ar" : "en");
  }, [st]);

  const openApp = (app, url = "") => {
    if (!app) return;
    if (N && N.openAnyApp) {
      let r = {}; try { r = JSON.parse(N.openAnyApp(JSON.stringify({ pkg: app.pkg || "", url: url || "" })) || "{}"); } catch (e) {}
      if (!r.ok && app.web) try { JSON.parse(N.openAnyApp(JSON.stringify({ pkg: "", url: app.web }))); } catch (e) {}
      flash && flash(r.how === "store" ? T("{app} isn't on this phone — its store page opened", { app: app.label }) : T("Opening {app}", { app: app.label }));
      return;
    }
    try { window.open(url || app.web, "_blank"); } catch (e) {}
  };
  const orderNow = (a) => {
    if (N && N.intent) {
      let r = {}; try { r = JSON.parse(N.intent(JSON.stringify({ kind: "link", url: a.app.web, app: a.app.pkg, copy: a.what })) || "{}"); } catch (e) {}
      if (r.ok !== false) { flash && flash(T("Your order is copied — paste it in {app}'s search, check it and press Order", { app: a.app.label })); return; }
    }
    try { navigator.clipboard && navigator.clipboard.writeText(a.what); } catch (e) {}
    openApp(a.app, a.app.web);
  };
  const checkNow = async (a) => {
    if (N && N.agentOpen && nativeCall) {
      setBusy(a.id);
      try {
        // v8.2: a hotel window → every start day in turn (4 nights from 10 Dec, 19 Dec … inside 10 Dec – 29 Jan); the cheapest wins
        const tries = a.tries && a.tries.length ? a.tries : [{ url: a.url }];
        let best = null, seen = [], compared = 0;
        for (let i = 0; i < tries.length; i++) {
          if (tries.length > 1) flash && flash(T("Checking {i} of {n}: {d}", { i: i + 1, n: tries.length, d: tries[i].checkin }));
          const r = await nativeCall("agentOpen", { url: tries[i].url, title: a.title + (tries[i].checkin ? " · " + tries[i].checkin : ""), profile: {}, rules: { cheapest: true }, labels: agentLabels(), search: true, watch: true, autoClose: tries.length > 1 });
          if (r && r.price > 0 && (!best || r.price < best.price)) best = { price: r.price, checkin: tries[i].checkin, checkout: tries[i].checkout };
          compared += (r && r.offers) || 0;
          for (const o of (r && r.top) || []) seen.push({ ...o, checkin: tries[i].checkin, checkout: tries[i].checkout, url: tries[i].url || a.url });
          if (r && r.reason === "closed") break;   // the person closed the browser: stop the round
        }
        const next0 = A.addCheck(a, { price: best && best.price, how: "browser", ...(best && best.checkin ? { checkin: best.checkin, checkout: best.checkout } : {}) });
        const next = seen.length ? { ...next0, best3: A.bestThree(seen, a.skip), compared } : compared ? { ...next0, compared } : next0;
        put({ ...st, agents: st.agents.map((x) => (x.id === a.id ? next : x)) });
        flash && flash(best ? (best.checkin ? T("Cheapest now: {p} ({d})", { p: money(best.price, a.currency), d: best.checkin + " → " + best.checkout }) : T("Cheapest now: {p}", { p: money(best.price, a.currency) })) : tr("No prices on that page — search on the site, then tap Best offer"));
      } catch (e) { flash && flash(String((e && e.message) || e)); }
      finally { setBusy(""); }
      return;
    }
    try { window.open(a.url, "_blank"); } catch (e) {}
  };
  // v8.6 buy agent (Ali: "when they find the item they come to me for confirmation, then order"): a round reads every store's
  // results, code picks the exact product (not a case), the card asks — "Order it" opens it, presses Buy now, fills the details
  const buyRound = async (a) => {
    if (!(N && N.agentOpen && nativeCall)) { try { window.open(a.url, "_blank"); } catch (e) {} return; }
    setBusy(a.id); const seen = [];
    try {
      for (let i = 0; i < (a.tries || []).length; i++) {
        const x = a.tries[i];
        flash && flash(T("Looking on {site} ({i} of {n})…", { site: x.site, i: i + 1, n: a.tries.length }));
        const r = await nativeCall("agentOpen", { url: x.url, title: a.title + " · " + x.site, profile: {}, rules: { cheapest: true, many: true }, labels: agentLabels(), search: true, watch: true, autoClose: true });
        for (const o of (r && r.top) || []) seen.push({ ...o, site: x.site, url: x.url });
        if (r && r.reason === "closed") break;
      }
      const next = A.takeBuyRound(A.loadAgents().agents.find((y) => y.id === a.id) || a, seen);
      upd(a.id, () => next);
      flash && flash(next.pending ? T("Found it: {n} — {p}. Order it?", { n: next.pending.name.slice(0, 50), p: money(next.pending.price, next.pending.currency) })
        : next.nearest ? T("Not under your limit yet — closest {p} on {site}. I'll keep looking.", { p: money(next.nearest.price, a.currency), site: next.nearest.site }) : tr("Couldn't see that exact product yet — I'll keep looking."));
    } catch (e) { flash && flash(String((e && e.message) || e)); }
    finally { setBusy(""); }
  };
  const confirmBuy = async (a) => {
    const p = a.pending; if (!p) return;
    const prof = loadBooking();
    upd(a.id, (y) => ({ ...y, step: "ordering" }));
    if (N && N.agentOpen && nativeCall) {
      try {
        const r = await nativeCall("agentOpen", { url: p.href || p.url, title: p.name, profile: prof, rules: {}, labels: agentLabels(), search: false, buy: true });
        const done = !!(r && (r.payment || r.bought));
        upd(a.id, (y) => ({ ...y, step: done ? "ordered" : "confirm", ordered: done ? { at: Date.now(), ...p, paid: !!r.payment } : null }));
        flash && flash(done ? tr("Taken to checkout — your details are filled; you pay there. Tap Done here once ordered.") : tr("Not finished — tap Order it again whenever you want."));
      } catch (e) { flash && flash(String((e && e.message) || e)); }
      return;
    }
    try { window.open(p.href || p.url, "_blank"); } catch (e) {}
  };
  const notThis = (a) => { const k = String(a.pending.href || a.pending.name || "").slice(0, 120); upd(a.id, (y) => ({ ...y, skip: [...(y.skip || []), k], pending: null, step: "search" })); };
  const markDone = (a) => upd(a.id, (y) => ({ ...y, step: "ordered", on: false }));
  // v8.2 (2A): one of the best 3 — opens in Attune's browser on those days, ready for "Fill my details" (you choose and pay)
  const openBest = async (a, o) => {
    if (N && N.agentOpen && nativeCall) { try { await nativeCall("agentOpen", { url: o.url || a.url, title: o.name || a.title, profile: loadBooking(), rules: { cheapest: true }, labels: agentLabels(), search: true }); } catch (e) {} return; }
    try { window.open(o.url || a.url, "_blank"); } catch (e) {}
  };
  const skipBest = (a, o) => put({ ...st, agents: st.agents.map((x) => (x.id === a.id ? { ...x, skip: [...(x.skip || []), o.key], best3: (x.best3 || []).filter((y) => y.key !== o.key) } : x)) });
  const remove = (a) => put({ ...st, agents: st.agents.filter((x) => x.id !== a.id) });
  const toggle = (a) => put({ ...st, agents: st.agents.map((x) => (x.id === a.id ? { ...x, on: !x.on } : x)) });

  const start = (sentence, d) => {
    if (!d) { flash && flash(tr("Say what the agent should do — like the examples above")); return; }
    if (d.ask) { setDraft({ text: sentence, d }); setAnswer(""); return; }
    setDraft(null); setText(""); setDoCard(null);
    if (d.kind === "open") return openApp(d.app, "");
    if (d.kind === "do") { setDoCard(d); return; }
    if (d.kind === "scout") { onScout && onScout(sentence); return; }
    if (d.kind === "alert") { W.saveWatch([W.newRule(d.rule), ...W.loadWatch()], ar ? "ar" : "en"); setSt({ ...st }); flash && flash(T("I'll tell you: {r}", { r: W.ruleText(d.rule, ar) })); return; }
    // v8.7 (Ali picked persona 3's point 2): agents that act are Pro — Free keeps one running agent to try
    if (!pro && st.agents.filter((x) => x.on).length >= 1) { flash && flash(tr("Free includes 1 agent — Pro runs as many as you need")); openPlan && openPlan(); return; }
    const a = A.makeAgent(d); noteProUse("agent");
    const usual = d.kind === "order" ? { ...st.usual, [d.app.id]: d.what } : st.usual;
    put({ ...st, usual, agents: [a, ...st.agents] });
    if (d.kind === "buy") { flash && flash(T("On it: I'll find {w} and ask you before buying", { w: d.what })); setTimeout(() => buyRound(a), 300); return; }
    flash && flash(d.kind === "watch" ? T("Watching {t} — I'll tell you under {p}", { t: d.title, p: money(d.below, d.currency) }) : d.kind === "track" ? T("I'll tell you when your {app} order is on its way and arriving", { app: d.app.label }) : T("Saved: {t}", { t: d.title }));
  };
  const submit = (s) => { const sentence = (s || text).trim(); if (!sentence) return; start(sentence, A.parseAgent(sentence, { country, installed, usual: st.usual, prefs: loadBooking() })); };
  const reply = () => { if (!draft) return; const s = A.withAnswer(draft.text, draft.d.ask, answer); start(s, A.parseAgent(s, { country, installed, usual: st.usual, prefs: loadBooking() })); };

  if (rep) return <AgentsReport st={st} scout={scout} alerts={alerts} back={() => setRep(false)} />;
  const r = A.agentsReport(st, scout, alerts);
  const alertRules = alerts.filter((x) => !String(x.id).startsWith("agent-"));
  return (
    <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="agents-page">
      <U.Head title={tr("Agents")} sub={tr("Tell an agent what to watch or do — it works on this phone, and never pays for you")} />
      <form onSubmit={(e) => { e.preventDefault(); submit(); }} className={U.card + " flex items-center gap-2 p-2 ps-4"}>
        <input value={text} onChange={(e) => setText(e.target.value)} dir="auto" placeholder={tr("Tell an agent what to do…")} className="flex-1 min-w-0 bg-transparent outline-none text-[15px] min-h-[44px]" data-testid="agents-input" />
        <button aria-label={tr("Send")} className="w-11 h-11 rounded-full grid place-items-center bg-[var(--c-acc)] text-[var(--c-on-acc)] shrink-0" data-testid="agents-go"><Send size={17} className="rtl:-scale-x-100" /></button>
      </form>
      <div className="flex flex-wrap gap-2" data-testid="agents-chips">
        {CHIPS.map(([k, l, en, a]) => <button key={k} onClick={() => { setText(ar ? a : en); setDraft(null); }} className={U.chip(false)} data-testid={"agents-chip-" + k}>{React.createElement(KIND_ICON[k], { size: 15 })}{tr(l)}</button>)}
      </div>
      {draft ? <div className={U.cardPad + " space-y-2"} data-testid="agents-ask">
        <p className="m-0 text-[14px] font-bold" dir="auto">{T(draft.d.ask, { ...(draft.d.v || {}), app: draft.d.app ? draft.d.app.label : "", x: draft.d.name || "" })}</p>
        <form onSubmit={(e) => { e.preventDefault(); reply(); }} className="flex gap-2">
          <input autoFocus value={answer} onChange={(e) => setAnswer(e.target.value)} dir="auto" className={U.inp + " flex-1"} data-testid="agents-answer" />
          <button className={U.btnP + " !h-11 !min-h-[44px]"} data-testid="agents-answer-go">{tr("OK")}</button>
        </form></div> : null}
      {doCard ? <div className={U.cardPad + " space-y-2"} data-testid="agents-do">
        <p className="m-0 text-[14px] font-extrabold" dir="auto">{doCard.title}</p>
        {doCard.plan.missing.length ? <p className="m-0 text-[13px] text-[var(--c-warn)]">{doCard.plan.missing.map((m) => (typeof m === "string" ? tr(m) : tr(m.t, m.v))).join(" · ")}</p>
          : <div className="flex flex-wrap gap-2">{doCard.plan.links.map((l) => <button key={l.label} onClick={() => window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: l, plan: doCard.plan } }))} className={U.btnS} data-testid="agents-do-link"><ExternalLink size={14} />{l.label}</button>)}</div>}
        <p className="m-0 text-[11.5px] c-sub">{tr("The app opens with your search ready — you choose and pay there.")}</p></div> : null}
      {N && !access && st.agents.some((a) => a.kind === "track") ? <button onClick={() => { try { N.openPayAccess && N.openPayAccess(); } catch (e) {} }} className="w-full text-start min-h-[44px] rounded-[16px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-3 text-[12.5px] font-semibold text-[var(--c-warn)] flex gap-2" data-testid="agents-access">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />{tr("Delivery agents read the store app's notifications: turn on Notification access for Attune (Settings opens).")}</button> : null}

      <p className="text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0 pt-1" data-testid="agents-running">{T("Running · {n}", { n: r.running })}</p>
      {st.agents.map((a) => a.kind === "buy" ? <BuyCard key={a.id} a={a} busy={busy === a.id} {...{ buyRound, confirmBuy, notThis, markDone, remove, toggle }} /> : <AgentCard key={a.id} a={a} hits={hits} busy={busy === a.id} {...{ checkNow, orderNow, openApp, remove, toggle, openBest, skipBest }} />)}
      {scout.map((g) => <button key={g.id} onClick={() => navTo && navTo("scout")} className={U.card + " w-full text-start p-3.5 flex gap-3 items-start"} data-testid="agents-scout">
        <Ico k="scout" /><span className="min-w-0 flex-1"><span className="block font-extrabold text-[14.5px]" dir="auto">{tr("Scout")} · {g.text}</span>
          <span className="block text-[12.5px] c-sub">{T("{n} ads checked", { n: (g.seen || []).length })}{g.lastRun ? " · " + ago(g.lastRun) : ""}</span>
          {(g.unseen || []).length ? <span className={U.tag("amber") + " mt-1.5"}>{T("{n} new", { n: g.unseen.length })}</span> : <span className={U.tag("blue") + " mt-1.5"}>{tr("Watching")}</span>}</span>
        <ChevronRight size={17} className="c-sub rtl:rotate-180 mt-2" /></button>)}
      {alertRules.length ? <button onClick={() => navTo && navTo("reminders")} className={U.card + " w-full text-start p-3.5 flex gap-3 items-start"} data-testid="agents-alerts">
        <Ico k="alert" /><span className="min-w-0 flex-1"><span className="block font-extrabold text-[14.5px]">{T("Message alerts · {n}", { n: alertRules.length })}</span>
          <span className="block text-[12.5px] c-sub truncate" dir="auto">{alertRules.slice(0, 2).map((x) => W.ruleText(x, ar)).join(" · ")}</span></span>
        <ChevronRight size={17} className="c-sub rtl:rotate-180 mt-2" /></button> : null}
      {!r.running ? <p className={U.card + " p-4 m-0 text-[13.5px] c-sub"} data-testid="agents-empty">{tr("No agents yet. Tap an example above, or write your own — a price to watch, a delivery to track, your usual order, or any app to open.")}</p> : null}
      <button onClick={() => setRep(true)} className={U.card + " w-full text-start p-4 flex items-center justify-between font-extrabold"} data-testid="agents-open-report">
        <span>{tr("See all → Agents report")}</span><span className="c-sub text-[12.5px] font-bold">{T("Checks this week: {n}", { n: r.checks })}</span></button>
    </div>);
}

function Ico({ k }) { return <span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0">{React.createElement(KIND_ICON[k] || AppWindow, { size: 18 })}</span>; }

/** v8.6 a buy agent: its plan, what it found, and the person's decision (Order it / Not this one) — nothing is bought without it. */
function BuyCard({ a, busy, buyRound, confirmBuy, notThis, markDone, remove, toggle }) {
  const small = "min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold inline-flex items-center gap-1.5 border border-[var(--c-ln)]";
  const p = a.pending, last = [...(a.checks || [])].reverse()[0];
  return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-buy">
    <div className="flex gap-3 items-start"><Ico k="buy" /><div className="min-w-0 flex-1">
      <p className="m-0 font-extrabold text-[14.5px]" dir="auto">{a.what}</p>
      <p className="m-0 text-[12.5px] c-sub" dir="auto">{a.site}{a.below > 0 ? " · " + T("under {p}", { p: money(a.below, a.currency) }) : ""}{last ? " · " + T("checked {t}", { t: ago(last.at) }) : ""}</p>
      <div className="mt-2 space-y-0.5" data-testid="agent-buy-plan">{A.buySteps(a).map((s, k) => <p key={k} className="m-0 text-[12px] flex items-center gap-1.5"><span className={s.done ? "text-[var(--c-acc)] font-black" : "c-sub"}>{s.done ? "✓" : "⏳"}</span><span className={s.done ? "" : "c-sub"}>{T(s.en, s.v)}</span></p>)}</div>
    </div></div>
    {p && a.step !== "ordered" ? <div className="rounded-[16px] border-2 border-[var(--c-acc)] p-3 space-y-2" data-testid="agent-buy-confirm">
      <p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-acc)]">{tr("Found it — do you want it?")}</p>
      <div className="flex items-start gap-2"><p className="m-0 flex-1 min-w-0 text-[14px] font-extrabold" dir="auto">{p.name}</p><b className="tabular-nums text-[15px] shrink-0">{money(p.price, p.currency)}</b></div>
      <p className="m-0 text-[11.5px] c-sub" dir="auto">{p.site}{p.text && p.text !== p.name ? " · " + p.text.replace(p.name, "").slice(0, 100) : ""}</p>
      <div className="flex gap-1.5 flex-wrap"><button onClick={() => confirmBuy(a)} className={small + " bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent"} data-testid="agent-buy-yes"><Check size={14} />{tr("Order it")}</button>
        <button onClick={() => notThis(a)} className={small} data-testid="agent-buy-no">{tr("Not this one")}</button></div>
      <p className="m-0 text-[11px] c-sub">{tr("Order it opens the product, presses Buy now and fills your details. You check and pay — Attune never pays.")}</p>
    </div> : null}
    {!p && a.nearest ? <p className="m-0 text-[12px] c-sub" dir="auto" data-testid="agent-buy-nearest">{T("Closest so far: {n} — {p}", { n: a.nearest.name || a.what, p: money(a.nearest.price, a.currency) })}</p> : null}
    {a.step === "ordered" ? <span className={U.tag("amber")} data-testid="agent-buy-ordered">{tr("Ordered — at checkout")}</span> : null}
    <div className="flex flex-wrap gap-1.5 items-center">
      {a.step !== "ordered" ? <button onClick={() => buyRound(a)} disabled={busy} className={small + (p ? "" : " bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent")} data-testid="agent-buy-search"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{p ? tr("Look again") : tr("Search now")}</button>
        : <button onClick={() => markDone(a)} className={small} data-testid="agent-buy-done"><Check size={14} />{tr("Done")}</button>}
      <span className="flex gap-1.5 ms-auto"><button onClick={() => toggle(a)} className={small} data-testid="agent-toggle">{a.on ? tr("Pause") : tr("Resume")}</button>
        <button onClick={() => remove(a)} aria-label={tr("Delete")} className={small} data-testid="agent-delete"><Trash2 size={14} /></button></span></div>
  </div>;
}

function AgentCard({ a, hits, busy, checkNow, orderNow, openApp, remove, toggle, openBest, skipBest }) {
  const small = "min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold inline-flex items-center gap-1.5 border border-[var(--c-ln)]";
  const ctl = <span className="flex gap-1.5 ms-auto"><button onClick={() => toggle(a)} className={small} data-testid="agent-toggle">{a.on ? tr("Pause") : tr("Resume")}</button>
    <button onClick={() => remove(a)} aria-label={tr("Delete")} className={small} data-testid="agent-delete"><Trash2 size={14} /></button></span>;
  if (a.kind === "watch") {
    const w = A.watchLine(a), last = [...(a.checks || [])].reverse()[0];
    return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-watch">
      <div className="flex gap-3 items-start"><Ico k="watch" /><div className="min-w-0 flex-1">
        <p className="m-0 font-extrabold text-[14.5px]" dir="auto">{a.title}</p>
        <p className="m-0 text-[12.5px] c-sub" dir="auto">{a.site} · {T("under {p}", { p: money(a.below, a.currency) })}{a.fields && a.fields.window ? " · " + T("{n} nights between {a} and {b}", { n: a.fields.nights, a: a.fields.window.from, b: a.fields.window.to }) : a.fields && a.fields.checkin ? " · " + a.fields.checkin + " → " + a.fields.checkout : ""}</p>
        <p className="m-0 text-[12.5px] c-sub" data-testid="agent-watch-last">{last ? (last.price ? T("Checked {t} · cheapest {p}", { t: ago(last.at), p: money(last.price, a.currency) }) + (last.checkin ? " (" + last.checkin + " → " + last.checkout + ")" : "") : T("Checked {t} · the site shows prices only in a browser — tap Check now", { t: ago(last.at) })) : tr("Not checked yet — tap Check now")}</p>
        {a.found ? <span className={U.tag("amber") + " mt-1.5"} data-testid="agent-found">{T("Found {p} — under your limit", { p: money(a.found.price, a.currency) })}</span>
          : <span className={U.tag("blue") + " mt-1.5"}>{a.on ? tr("Watching · twice a day") : tr("Paused")}</span>}
        {w.last && w.gap > 0 ? <span className="block text-[11.5px] c-sub mt-1">{T("{p} above your limit", { p: money(w.gap, a.currency) })}</span> : null}
        {/* v8.2 (Ali picked 2A): its plan, step by step */}
        <div className="mt-2 space-y-0.5" data-testid="agent-plan">{A.planSteps(a).map((p, k) => <p key={k} className="m-0 text-[12px] flex items-center gap-1.5"><span className={p.done ? "text-[var(--c-acc)] font-black" : "c-sub"}>{p.done ? "✓" : "⏳"}</span><span className={p.done ? "" : "c-sub"}>{T(p.en, p.v)}</span></p>)}</div>
      </div></div>
      {(a.best3 || []).length ? <div className="space-y-1.5" data-testid="agent-best3">
        <p className="m-0 text-[11px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("Best 3 right now")}</p>
        {a.best3.map((o, k) => <div key={k} className="rounded-[14px] border border-[var(--c-ln)] px-3 py-2" data-testid="agent-best">
          <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><p className="m-0 text-[13.5px] font-extrabold" dir="auto">{o.name || a.site}</p>
            <p className="m-0 text-[11.5px] c-sub line-clamp-2" dir="auto">{[o.checkin ? o.checkin + " → " + o.checkout : "", o.text && o.text !== o.name ? o.text.replace(o.name, "").slice(0, 110) : ""].filter(Boolean).join(" · ")}</p></div>
            <b className="tabular-nums text-[14px] shrink-0">{money(o.price, a.currency)}</b></div>
          <div className="flex gap-1.5 mt-1.5"><button onClick={() => openBest(a, o)} className={small + " bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent"} data-testid="agent-best-open"><ExternalLink size={13} />{tr("Open it")}</button>
            <button onClick={() => skipBest(a, o)} className={small} data-testid="agent-best-skip">{tr("Not this one")}</button></div>
        </div>)}
      </div> : null}
      <div className="flex flex-wrap gap-1.5 items-center"><button onClick={() => checkNow(a)} disabled={busy} className={small + " bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent"} data-testid="agent-check"><RefreshCw size={14} className={busy ? "animate-spin" : ""} />{tr("Check now")}</button>
        <button onClick={() => openApp({ pkg: /booking\.com/.test(a.url) ? "com.booking" : /amazon\./.test(a.url) ? "com.amazon.mShop.android.shopping" : "", label: a.site, web: a.url }, a.url)} className={small} data-testid="agent-open"><ExternalLink size={14} />{T("Open {app}", { app: a.site })}</button>{ctl}</div>
    </div>;
  }
  if (a.kind === "track") {
    const mine = hits.filter((h) => h.rule === "agent-" + a.id).slice(-1)[0];
    return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-track">
      <div className="flex gap-3 items-start"><Ico k="track" /><div className="min-w-0 flex-1">
        <p className="m-0 font-extrabold text-[14.5px]" dir="auto">{a.title}</p>
        <p className="m-0 text-[12.5px] c-sub" dir="auto">{mine ? T("{app} said {t}: {m}", { app: a.app.label, t: ago(mine.ts), m: mine.text.slice(0, 90) }) : T("Reading {app}'s notifications — I tell you when it ships and when it arrives", { app: a.app.label })}</p>
        <span className={U.tag(mine ? "amber" : "blue") + " mt-1.5"}>{mine ? tr("Update") : a.on ? tr("Watching") : tr("Paused")}</span></div></div>
      <div className="flex flex-wrap gap-1.5 items-center"><button onClick={() => openApp(a.app, "")} className={small} data-testid="agent-open"><ExternalLink size={14} />{T("Open {app}", { app: a.app.label })}</button>{ctl}</div>
    </div>;
  }
  return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-order">
    <div className="flex gap-3 items-start"><Ico k="order" /><div className="min-w-0 flex-1">
      <p className="m-0 font-extrabold text-[14.5px]" dir="auto">{a.title}</p>
      <p className="m-0 text-[12.5px] c-sub" dir="auto">{a.what}</p>
      <p className="m-0 text-[11.5px] c-sub">{T("One tap opens {app} with your order copied — you press Order", { app: a.app.label })}</p></div></div>
    <div className="flex flex-wrap gap-1.5 items-center"><button onClick={() => orderNow(a)} className={small + " bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent"} data-testid="agent-order-now"><Check size={14} />{tr("Order now")}</button>{ctl}</div>
  </div>;
}

/** The Agents report: running, found and checks this week; every watch's checks. */
function AgentsReport({ st, scout, alerts, back }) {
  const r = A.agentsReport(st, scout, alerts);
  const KN = { buy: "Buy agents", watch: "Price watches", track: "Deliveries", order: "Usual orders", scout: "Scout goals", alert: "Message alerts" };
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="agents-report">
    <div className="flex items-center gap-2"><button onClick={back} aria-label={tr("Back")} className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)]" data-testid="agents-report-back"><ArrowLeft size={17} className="rtl:-scale-x-100" /></button>
      <U.Head title={tr("Agents report")} sub={tr("What your agents did this week — on this phone")} /></div>
    <div className="grid grid-cols-3 gap-2.5"><U.Kpi label={tr("Running")} value={String(r.running)} testid="agents-kpi-running" /><U.Kpi label={tr("Found")} value={String(r.found)} testid="agents-kpi-found" /><U.Kpi label={tr("Checks")} value={String(r.checks)} sub={tr("this week")} testid="agents-kpi-checks" /></div>
    <div className={U.cardPad}>{Object.entries(r.by).map(([k, n]) => <div key={k} className="flex justify-between py-2 border-t border-[var(--c-ln)] first:border-t-0 text-[14px]"><span>{tr(KN[k])}</span><b className="tabular-nums">{n}</b></div>)}</div>
    {st.agents.filter((a) => a.kind === "watch").map((a) => <div key={a.id} className={U.cardPad + " space-y-1"} data-testid="agents-report-watch">
      <p className="m-0 font-extrabold" dir="auto">{a.title}</p>
      {(a.checks || []).slice().reverse().slice(0, 8).map((c, i) => <div key={i} className="flex justify-between text-[13px] c-sub"><span>{new Date(c.at).toLocaleString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {tr(c.how === "browser" ? "in the browser" : "by itself")}</span>
        <b className={c.price && c.price <= a.below ? "text-[var(--c-pos)]" : ""}>{c.price ? money(c.price, a.currency) : tr("no prices shown")}</b></div>)}
      {!(a.checks || []).length ? <p className="m-0 text-[13px] c-sub">{tr("Not checked yet — tap Check now")}</p> : null}
    </div>)}
  </div>;
}
