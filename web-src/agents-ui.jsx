/* ---- v8.0 Agents — design A, Ali's pick (25 Oct 2026): the box (one sentence makes an agent), quick chips, then each running
   agent as one calm card (what it watches, the last check, what it found) — Scout and Message alerts among them — and
   "See all → Agents report". Any app opens by its name ("open Uber", «افتح طلبات»). Agents never sign in, book or pay: a price
   is read, an order is copied into the app, a delivery is read from the store app's own notification. Logic: agents.js. */
import * as G from "./guardian.js";
import { noteProUse } from "./trialuse.js";
import React, { useEffect, useMemo, useState } from "react";
import { Send, ShoppingCart, Building2 as Hotel, Package, Utensils as UtensilsCrossed, Car, LayoutGrid as AppWindow, BellRing, Trash2, RefreshCw, ExternalLink, ChevronRight, ArrowLeft, AlertTriangle, Check, X, BookOpen, Newspaper } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as A from "./agents.js";
import * as R from "./agent-rules.js";
import * as HG from "./haggle.js";
import { HaggleView } from "./haggle-ui.jsx";
import { Ellipsis, Kanban, ListChecks, Plane, MessageCircle, Clock, Eye, Repeat, ShieldCheck, Heart, Share2 } from "lucide-react";
import * as A2 from "./agents2.js";
import * as L from "./lists.js";
import { loadReminders, saveReminders, syncToPhone } from "./actions.js";
import * as FL from "./flights.js";
import { loadBooking } from "./agent-ui.jsx";
import * as W from "./watch.js";
import { loadScout } from "./scout.js";
import { lookLinks } from "./agent.js";
import { agentLabels } from "./agent-ui.jsx";
import { useSubBack } from "./backstack.js";
import * as U from "./ui-kit.jsx";
import { MessagesPage, scheduleMessage } from "./messages-ui.jsx";

const I = (s) => "⁦" + s + "⁩";
// a number is kept left-to-right inside Arabic — but "8,400 جنيه" (a price already in Arabic order) is left as it is
const T = (k, v) => tr(k, v ? Object.fromEntries(Object.entries(v).map(([x, y]) => [x, /\d/.test(String(y)) && !/[\u0600-\u06ff]/.test(String(y)) ? I(y) : y])) : v);
// v9.0 (Ali: "the Arabic is stupid"): in Arabic a price reads "8,400 جنيه", not "EGP 8,400"
const AR_CUR = { EGP: "جنيه", SAR: "ريال", AED: "درهم", KWD: "دينار", QAR: "ريال قطري", USD: "دولار", EUR: "يورو", GBP: "جنيه إسترليني" };
const money = (n, cur) => { const v = Math.round(n).toLocaleString("en-US"); if (getLang() === "ar" && cur) return v + " " + (AR_CUR[cur] || cur); return (cur ? cur + " " : "") + v; };
const ago = (t, now = Date.now()) => { const m = Math.round((now - t) / 60000); return m < 60 ? T("{n} min ago", { n: Math.max(1, m) }) : m < 1440 ? T("{n} h ago", { n: Math.round(m / 60) }) : Math.round(m / 1440) === 1 ? tr("yesterday") : T("{n} days ago", { n: Math.round(m / 1440) }); };
const GROUPS = [["needs", "Needs you"], ["working", "Working"], ["done", "Done & paused"]];
// v9.6 (Ali picked A3): three columns — Watching · Found (incl. what needs you) · Done
const BOARD = [["working", "Watching"], ["found", "Found"], ["done", "Done"]];
const KIND_ICON = { reply: MessageCircle, send: Clock, slot: Eye, restock: Repeat, protect: ShieldCheck, clinic: Heart, trip: Plane, flight: Plane, follow: Newspaper, research: BookOpen, buy: ShoppingCart, watch: Hotel, track: Package, order: UtensilsCrossed, scout: Car, alert: BellRing, open: AppWindow };
// v9.4 (Ali: "easy, interactive, visually appealing"): the starters as a gallery — the six most used first, the rest under "More agents"
const CHIPS = [["reply", "Reply helper", "Who is waiting for my reply?", "مين مستني مني رد؟"],
  ["send", "Schedule a message", "", ""],
  ["slot", "Visa appointment", "Watch the Spain visa appointments", "راقب مواعيد فيزا اسبانيا"],
  ["clinic", "Find a doctor", "Find a dermatologist in Nasr City under 500", "دكتور جلدية في مدينة نصر أقل من 500"],
  ["trip", "Travel day", "My flight MS 753 tomorrow at 10:40 to Madrid", "طيارتي MS753 بكرة الساعة 10:40 لمدريد"],
  ["protect", "Price protection", "I bought AirPods Pro 2 for 9,450 on Amazon", "اشتريت ايربودز برو 2 ب 9450 من امازون"],
  ["restock", "Restock", "Tell me before I run out of things", "قولي قبل ما الحاجات تخلص"],
  ["buy", "Find & buy", "Buy me AirPods Pro 2 under 9,000", "اشتريلي ايربودز برو 2 بأقل من 9000"],
  ["flight", "Cheapest flight", "Cheapest flight from Cairo to Jeddah around 8 January, back after 5 nights, direct, morning", "ارخص طيارة من القاهرة لجدة حوالي 8 يناير، راجع بعد 5 ليالي، مباشر، الصبح"],
  ["watch", "Watch a price", "Tell me when hotels near the Haram are under 45k for 4 nights from 10 December", "نبهني لما فنادق الحرم تبقى أقل من 45 ألف لمدة 4 ليالي من 10 ديسمبر"],
  ["track", "Track a delivery", "Tell me when my Amazon order arrives", "قولي لما طلب أمازون يوصل"],
  ["order", "Order my usual", "Order my usual from Talabat", "اطلبلي أكلي المفضل من طلبات"],
  ["scout", "Scout ads", "Find me a used Hyundai Tucson 2022", "دورلي على هيونداي توسان 2022 مستعملة"],
  ["follow", "Follow a topic", "Keep me updated on electric cars in Egypt every week", "تابعلي أخبار العربيات الكهربا في مصر كل أسبوع"],
  ["research", "Research a topic", "Gather information on solar panels for a flat in Cairo", "جمعلي معلومات عن الطاقة الشمسية لشقة في القاهرة"],
  ["open", "Open an app", "Open Uber", "افتح أوبر"]];

/** v9.6 (Ali picked A4): an agent as a conversation — what you asked, what it did, its offers as DATES × the best on each date
 *  ("more than 1 option in more than 1 date"), its full card (every button), and a box to change it by typing. */
// v9.6: inside an agent's conversation the dates grid already shows every date — the card's own "More dates" list is left out
const InChat = React.createContext(false);
function DatesGrid({ a, grid, openBest }) {
  if (!grid || !grid.kind) return null;
  const cur = a.currency || "";
  const label = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }); } catch (e) { return d; } };
  const cols = Math.max(...grid.rows.map((r) => r.offers.length));
  return <div className="space-y-1.5" data-testid="agent-dates-grid">
    <p className="m-0 text-[12.5px] c-sub">{grid.kind !== "dates" ? tr("The price on each check:") : grid.rows.filter((r) => r.offers.length >= cols).length >= 2 && cols > 1
      ? T("The best {n} on each of {d} dates — tap one to open it:", { n: cols, d: grid.rows.length }) : T("The best offers on {d} dates — tap one to open it:", { d: grid.rows.length })}</p>
    <div className="grid gap-1.5" style={{ gridTemplateColumns: "64px repeat(" + cols + ", minmax(0,1fr))" }}>
      {grid.rows.map((r) => <React.Fragment key={r.date}>
        <span className="text-[12px] font-extrabold self-center" data-testid="agent-grid-date">{label(r.date)}{r.checkout && /^\d{4}-/.test(r.checkout) ? <span className="block text-[10.5px] c-sub font-bold">→ {label(r.checkout)}</span> : null}</span>
        {Array.from({ length: cols }, (_, k) => { const o = r.offers[k]; if (!o) return <span key={k} />;
          const best = grid.best && o.price === grid.best.price && (o.name || "") === (grid.best.name || "");
          return <button key={k} onClick={() => openBest(a, o)} data-testid={best ? "agent-grid-best" : "agent-grid-offer"}
            className={"rounded-[12px] p-1.5 text-center min-w-0 " + (best ? "bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" : "bg-[var(--c-surf-2)] border border-[var(--c-ln)]")}>
            <b className="block text-[12.5px] tabular-nums" dir="ltr">{money(o.price, o.currency || cur)}</b>
            {!R.isSiteName(o.name, a.site) ? <span className="block text-[10.5px] truncate opacity-85" dir="auto">{o.name}</span> : null}</button>; })}
      </React.Fragment>)}
    </div>
  </div>;
}
/* v9.9.13 Ali picked AG1 + AG2 + AC2 + AC3 + AH1 (combined page "OK1", MOCKUPS.md): the answer on top (the best so far, better than
   before?, Book this, See 3 more), every date × hotel as a chart, "Checks by itself" (night while charging, else a one-tap question),
   the plan in 4 lines; the conversation, dates grid and table behind "History". Logic: agents.js bestSoFar / bestChange /
   chartPoints / planLines (tested). */
// v9.9.19 (Ali's screenshot: "01/08 → 01/12" — January or August?): dates in words with the weekday, "Thu 8 Jan"
const dWords = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return d; } };
const dShort = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }); } catch (e) { return d; } };
const planText = (l) => { const [en, v] = l; if (v && Array.isArray(v.list)) return T(en, { list: v.list.map(([e2, v2]) => T(e2, v2)).join(" · ") });
  const iso = (x) => (/^\d{4}-\d{2}-\d{2}$/.test(String(x || "")) ? dShort(x) : x);
  return T(en, v ? { ...v, ...(v.p ? { p: money(v.p, "") } : {}), ...(v.a ? { a: iso(v.a) } : {}), ...(v.b ? { b: iso(v.b) } : {}) } : v); };
export function PlanCard({ a, onChange, testid = "agent-plan-lines" }) {
  return <div className={U.cardPad + " space-y-1.5"} data-testid={testid}>
    <b className="text-[14px]">{tr("My plan")}</b>
    <ol className="m-0 ps-5 space-y-0.5 text-[13px] c-sub">{A.planLines(a).map((l, i) => <li key={i} dir="auto" data-testid="agent-plan-line">{planText(l)}</li>)}</ol>
    {onChange ? <button onClick={onChange} className="min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold border border-[var(--c-ln)]" data-testid="agent-plan-change">{tr("Change")}</button> : null}
  </div>;
}
function OffersChart({ a, openBest }) {
  const c = A.chartPoints(a), [pick, setPick] = useState(null);
  if (!c.days.length || c.points.length < 2) return null;
  const W = 300, H = 160, L0 = 40, R0 = 8, T0 = 14, B0 = 26;
  const ps = c.points.map((p) => p.price), lo = Math.min(...ps, c.below || Infinity), hi = Math.max(...ps, c.below || 0);
  const pad = Math.max(1, (hi - lo) * 0.08), y0 = lo - pad, y1 = hi + pad;
  const X = (d) => c.days.length === 1 ? (L0 + W - R0) / 2 : L0 + (c.days.indexOf(d) / (c.days.length - 1)) * (W - L0 - R0 - 10) + 5;
  const Y = (v) => T0 + (1 - (v - y0) / (y1 - y0)) * (H - T0 - B0);
  const k = (v) => (v >= 1000 ? Math.round(v / 100) / 10 + "k" : String(Math.round(v)));
  const ticks = [lo, (lo + hi) / 2, hi];
  const sel = pick || c.best, rest = c.points.filter((p) => !p.best).slice(0, 2);
  return <div className={U.cardPad + " space-y-2"} data-testid="agent-chart">
    <b className="text-[14px]">{tr("Every date, every hotel")}</b>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={T("Best prices by start date — the lowest is {p} on {d}", { p: money(c.best.price, a.currency || ""), d: dShort(c.best.date) })}>
      {ticks.map((t, i) => <g key={i}><line x1={L0} x2={W - R0} y1={Y(t)} y2={Y(t)} stroke="var(--c-ln)" /><text x={2} y={Y(t) + 3} fontSize="9" fill="var(--c-mut)">{k(t)}</text></g>)}
      {c.below > 0 ? <g><line x1={L0} x2={W - R0} y1={Y(c.below)} y2={Y(c.below)} stroke="var(--c-neg)" strokeDasharray="4 3" /><text x={L0 + 2} y={Y(c.below) - 3} fontSize="9" fill="var(--c-neg)">{T("limit {p}", { p: k(c.below) })}</text></g> : null}
      {c.days.map((d) => <text key={d} x={X(d)} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--c-mut)">{dShort(d)}</text>)}
      {c.points.map((p, i) => <circle key={i} cx={X(p.date)} cy={Y(p.price)} r={p.best ? 7 : 4.5} fill={p.best ? "var(--c-acc)" : p.price <= (c.below || Infinity) ? "var(--c-blue, #2f5f9e)" : "var(--c-mut)"}
        stroke={sel === p ? "var(--c-ink)" : "none"} strokeWidth="2" style={{ cursor: "pointer" }} onClick={() => setPick(p)} data-testid={p.best ? "agent-chart-best" : "agent-chart-dot"}><title>{(p.name || a.site) + " · " + money(p.price, a.currency || "")}</title></circle>)}
    </svg>
    <p className="m-0 text-[11.5px] c-sub">{tr("Each dot = one hotel on that start date. Tap a dot to see the hotel.")}</p>
    {sel ? <div className="flex items-center gap-2 rounded-[12px] bg-[var(--c-surf-2)] border border-[var(--c-ln)] px-3 py-2" data-testid="agent-chart-pick">
      <span className="min-w-0 flex-1 text-[13px]" dir="auto"><b className="block truncate">{sel.name && !R.isSiteName(sel.name, a.site) ? sel.name : a.site}</b><span className="c-sub">{dShort(sel.date)}{sel.checkout ? " → " + dShort(sel.checkout) : ""}</span></span>
      <b className="tabular-nums text-[14px]" dir="ltr">{money(sel.price, a.currency || "")}</b>
      <button onClick={() => openBest(a, sel)} className="min-h-[38px] px-3 rounded-[10px] text-[12px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" data-testid="agent-chart-open">{tr("Book this")}</button></div> : null}
    {rest.map((p, i) => <div key={i} className="flex justify-between text-[13px] tabular-nums" data-testid="agent-chart-next"><span dir="auto" className="truncate">{dShort(p.date)} · {p.name && !R.isSiteName(p.name, a.site) ? p.name : a.site}</span><b dir="ltr">{money(p.price, a.currency || "")}</b></div>)}
  </div>;
}
function AgentOverview({ a, openBest, toggle, checkNow, busy, onPlan }) {
  const b = A.bestSoFar(a), ch = A.bestChange(a), [more, setMore] = useState(false);
  const last = [...(a.checks || [])].reverse()[0], others = A.knownOffers(a).filter((o) => o !== b).slice(0, 3);
  const nm = (o) => (o.name && !R.isSiteName(o.name, a.site) ? o.name : a.site);
  return <div className="space-y-2.5" data-testid="agent-overview">
    {b ? <div className="rounded-[18px] bg-[var(--c-soft)] p-3.5 space-y-1.5" data-testid="agent-best">
      <p className="m-0 text-[12.5px] font-extrabold c-sub">{tr("Your best so far")}</p>
      <p className="m-0 text-[26px] font-black tabular-nums leading-none" dir="ltr" data-testid="agent-best-price">{money(b.price, a.currency || "")}</p>
      <p className="m-0 text-[13.5px]" dir="auto">{nm(b)}{b.checkin ? " · " + dShort(b.checkin) + (b.checkout ? " → " + dShort(b.checkout) : "") : ""}{a.fields && a.fields.nights ? " · " + T("{n} nights", { n: a.fields.nights }) : ""}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {ch && ch.by > 0 ? <span className={U.tag("blue")} data-testid="agent-best-better">{T("↓ {x} since {t}", { x: money(ch.by, ""), t: ago(ch.since) })}</span>
          : ch && ch.by === 0 ? <span className={U.tag("gray")} data-testid="agent-best-same">{tr("No better price since the last checks")}</span> : null}
        {a.below > 0 ? <span className={"text-[12px] " + (b.price <= a.below ? "c-pos font-bold" : "c-sub")}>{T("limit {p}", { p: money(a.below, "") })}{b.price <= a.below ? " ✓" : ""}</span> : null}
      </div>
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        <button onClick={() => openBest(a, b)} className={U.btnP} data-testid="agent-best-book">{tr("Book this")}</button>
        {others.length ? <button onClick={() => setMore(!more)} className={U.btnS} data-testid="agent-best-more">{more ? tr("Hide") : T("See {n} more", { n: others.length })}</button> : null}
      </div>
      {more ? <div className="space-y-1 pt-1" data-testid="agent-best-others">{others.map((o, i) => <button key={i} onClick={() => openBest(a, o)} className="w-full flex justify-between gap-2 text-start text-[13px] rounded-[10px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-2.5 py-2">
        <span className="min-w-0 truncate" dir="auto">{nm(o)}{o.checkin ? " · " + dShort(o.checkin) : ""}</span><b className="tabular-nums" dir="ltr">{money(o.price, a.currency || "")}</b></button>)}</div> : null}
    </div> : <div className={U.cardPad} data-testid="agent-best-none"><p className="m-0 text-[13.5px]">{tr("No price yet — the first check finds one.")}</p></div>}
    <OffersChart a={a} openBest={openBest} />
    <div className={U.cardPad + " space-y-1"} data-testid="agent-auto">
      <label className="flex items-center justify-between gap-2 min-h-[40px]"><b className="text-[14px]">{tr("Checks by itself")}</b>
        <input type="checkbox" checked={a.on !== false} onChange={() => toggle(a)} className="w-6 h-6 accent-[var(--c-acc)]" data-testid="agent-auto-toggle" /></label>
      <p className="m-0 text-[12.5px] c-sub">{a.on === false ? tr("Paused — turn it on to check again") : A.needsBrowser(a) ? tr("Every night while the phone charges on Wi-Fi. If it can't, I ask you with one tap.") : T("Every {h} hours, even with Attune closed", { h: (a.rules && a.rules.hours) || 12 })}{last ? " · " + T("last {t}", { t: ago(last.at) }) : ""}</p>
      <p className="m-0 text-[12.5px] c-sub">{tr("Tells you only when a price beats your best.")}</p>
      <button onClick={() => checkNow(a)} disabled={busy} className={U.btnS + " mt-1"} data-testid="agent-auto-check"><RefreshCw size={14} />{busy ? tr("Checking…") : tr("Check now")}</button>
    </div>
    <PlanCard a={a} onChange={onPlan} />
  </div>;
}
function AgentChat({ c, back, openBest, setRules, understand, flash, toggle, checkNow, busy }) {
  const a = c.a, [text, setText] = useState(""), [busy0, setBusy] = useState(false), [said, setSaid] = useState("");
  // v9.9.13 AG1: a price watch opens on the answer; the rest is History
  const overview = a.kind === "watch" && !(a.fields && a.fields.flight) && !!toggle;
  const [hist, setHist] = useState(!overview);
  const inputRef = React.useRef(null);
  const msgs = A.agentChat(a);
  const send = async () => {
    const t = text.trim(); if (!t || busy0) return;
    let got = R.parseRule(t);
    if (!got && understand) { setBusy(true); try { got = R.cleanRules((await understand(t)) || {}); if (!Object.keys(got).length) got = null; } catch (e) { got = null; } setBusy(false); }
    if (!got) { setSaid(tr("I didn't understand that rule — try one of the examples.")); return; }
    setRules({ ...a, ruleLog: [...(a.ruleLog || []), { at: Date.now(), text: t }].slice(-10) }, R.mergeRules(a.rules || {}, got)); setText("");
    setSaid(T("Got it: {r}", { r: R.ruleChips(got).map((x) => tr(x.en, x.v)).join(" · ") }));
  };
  const bubble = "max-w-[88%] rounded-[16px] px-3 py-2 text-[13.5px] leading-snug";
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="agent-chat">
    <div className="flex items-center gap-2"><button onClick={back} className="w-11 h-11 grid place-items-center rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)]" aria-label={tr("Back")} data-testid="agent-chat-back"><ArrowLeft size={18} className="rtl:-scale-x-100" /></button>
      <b className="text-[17px] font-black min-w-0 truncate" dir="auto">{c.title}</b></div>
    {overview ? <AgentOverview a={a} openBest={openBest} toggle={toggle} checkNow={checkNow} busy={busy} onPlan={() => { try { inputRef.current && inputRef.current.focus(); } catch (e) {} }} /> : null}
    {overview ? <button onClick={() => setHist(!hist)} className="w-full min-h-[44px] text-[13px] font-extrabold c-sub" data-testid="agent-history-toggle" aria-expanded={hist}>{hist ? tr("Hide history") : tr("History ›")}</button> : null}
    {hist ? <><div className="flex flex-col gap-2">
      {msgs.map((m, i) => m.who === "me"
        ? <div key={i} className={bubble + " self-end bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] rounded-ee-[4px]"} dir="auto">{m.text}</div>
        : <div key={i} className={bubble + " self-start bg-[var(--c-surf)] border border-[var(--c-ln)] rounded-es-[4px]" + (m.found || m.better ? " font-extrabold" : "")} dir="auto" data-testid={m.better ? "agent-chat-better" : undefined}>
            {tr(m.T[0], Object.fromEntries(Object.entries(m.T[1] || {}).map(([k, v]) => [k, ["p", "b", "x"].includes(k) ? money(v, a.currency || "") : v])))}{m.found ? " 🎉" : ""}</div>)}
      {c.grid && c.grid.kind ? <div className={bubble + " self-stretch max-w-none bg-[var(--c-surf)] border border-[var(--c-ln)]"}><DatesGrid a={a} grid={c.grid} openBest={openBest} /></div> : null}
    </div>
    <InChat.Provider value={true}>{c.el}</InChat.Provider></> : null}
    <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 sticky bottom-2" data-testid="agent-chat-form">
      <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} dir="auto" className={U.inp + " flex-1"} placeholder={tr("Tell the agent: “only 5 stars”, “under 40,000”…")} data-testid="agent-chat-input" />
      <button className={U.btnP + " !h-11 !min-h-[44px]"} disabled={busy0} data-testid="agent-chat-send"><Send size={16} /></button>
    </form>
    {said ? <p className="m-0 text-[12.5px] c-sub" data-testid="agent-chat-said">{said}</p> : null}
  </div>;
}

export function AgentsPage({ native: N, nativeCall, navTo, flash, onScout, onResearch = null, onResearchBg = null, search = null, country = "EG", pro = true, openPlan = null, understandRule = null, drafter = null }) {
  const ar = getLang() === "ar";
  const [st, setSt] = useState(() => A.loadAgents());
  const [text, setText] = useState("");
  const [draft, setDraft] = useState(null);        // { text, d } — a sentence the agent is still asking about
  const [answer, setAnswer] = useState("");
  const [doCard, setDoCard] = useState(null);      // "do it now": the app links
  const [planDraft, setPlanDraft] = useState(null);   // v9.9.13 AH1: { sentence, d } — the plan shown before Start
  const [rep, setRep] = useState(false);
  const [busy, setBusy] = useState("");
  const [tabWant, setTabWant] = useState(() => { try { return localStorage.getItem("attune:agents:tab") || ""; } catch (e) { return ""; } });
  // v9.6 (Ali picked A3 + A4): the board is the Agents page; a tap on a card opens that agent's conversation
  // v9.8 A3 (Ali picked "what changed on top, then the list"): "new" is the page; List and Board stay one tap away
  const [view, setViewRaw] = useState(() => { try { return localStorage.getItem("attune:agents:view2") || "new"; } catch (e) { return "new"; } });
  const setView = (v) => { setViewRaw(v); try { localStorage.setItem("attune:agents:view2", v); } catch (e) {} };
  // (v9.8: a haggle started from Home opens straight on its page)
  const [chat, setChat] = useState(() => { try { const v = localStorage.getItem("attune:agents:openchat") || ""; if (v) localStorage.removeItem("attune:agents:openchat"); return v; } catch (e) { return ""; } });
  useSubBack(!!chat, () => setChat(""));
  const [msgs, setMsgs] = useState("");   // v9.7 Messages: "list" | "new"
  useSubBack(!!msgs, () => { setMsgs(""); setSt(A.loadAgents()); });
  const [focus, setFocus] = useState("");
  const openTab = (id) => { setTabWant(id); try { localStorage.setItem("attune:agents:tab", id); } catch (e) {} };
  useSubBack(rep, () => setRep(false));
  const put = (next) => setSt(A.saveAgents(next));
  const upd = (id, fn) => { const cur = A.loadAgents(); put({ ...cur, agents: cur.agents.map((y) => (y.id === id ? fn(y) : y)) }); };   // always on the saved list (a round outlives the render that started it)
  // v9.0 (Ali: "the Agents page takes a while to load"): the phone's app list (a slow Android call — every app's name) is read only
  // when a sentence needs it, and kept for the session; it used to be read before the page could show anything
  const appsRef = React.useRef(null);
  const installedNow = () => { if (appsRef.current) return appsRef.current; let l = []; try { l = JSON.parse(sessionStorage.getItem("attune:apps") || "null") || null; } catch (e) {}
    if (!l) { try { l = N && N.appsList ? JSON.parse(N.appsList() || "[]") : []; } catch (e) { l = []; } try { sessionStorage.setItem("attune:apps", JSON.stringify(l)); } catch (e) {} }
    return (appsRef.current = l); };
  const access = (() => { try { return !N || !N.payAccess || N.payAccess(); } catch (e) { return true; } })();
  // v9.8 (Ali's screenshot: "Scout · Tell me when the Huawei free clip…" next to "Huawei free clips 2"): a Scout search that is the
  // same thing as an agent is not listed twice (the agent shows it; Scout's ads still open from it)
  const scout = useMemo(() => A.withoutTwins(loadScout().goals || [], st.agents || []), [st]);
  const alerts = useMemo(() => W.loadWatch(), [st]);
  // the delivery notifications are read just after the page shows, not before
  const [hits, setHits] = useState([]);
  useEffect(() => { const t = setTimeout(() => { try { setHits(N && N.watchHits ? JSON.parse(N.watchHits() || "[]") : []); } catch (e) {} }, 60); return () => clearTimeout(t); }, [N, st]);

  // a sentence started on Home that still needs an answer continues here
  useEffect(() => {
    let d0 = ""; try { d0 = localStorage.getItem("attune:agents:draft") || ""; localStorage.removeItem("attune:agents:draft"); } catch (e) {}
    if (d0) { setText(d0); const d = A.parseAgent(d0, { country, installed: installedNow(), usual: st.usual, prefs: loadBooking() }); if (d && d.ask) setDraft({ text: d0, d }); else if (d && d.kind === "buy") start(d0, d); }
  }, []);
  // the phone's checks (AgentWatch.kt) come in; the price watches and the delivery rules go out
  useEffect(() => {
    const t = setTimeout(() => { try {
      const got = N && N.agentWatchTake ? JSON.parse(N.agentWatchTake() || "{}") : {};
      if (Object.keys(got).length) { const cur = A.loadAgents(); put({ ...cur, agents: A.takeChecks(cur.agents, got) }); }
    } catch (e) {} }, 30);
    return () => clearTimeout(t);
  }, []);
  // v9.0: sent to the phone after the page shows, and only when they changed (opening the page used to resend both every time)
  const sentRef = React.useRef("");
  useEffect(() => {
    const t = setTimeout(() => {
      const plan = JSON.stringify(A.watchPlan(st)), mine = st.agents.filter((a) => a.kind === "track").map(A.trackRule), key = plan + "|" + JSON.stringify(mine);
      let last = sentRef.current; try { last = last || sessionStorage.getItem("attune:agents:sent") || ""; } catch (e) {}
      if (key === last) return;
      sentRef.current = key; try { sessionStorage.setItem("attune:agents:sent", key); } catch (e) {}
      try { N && N.agentWatchPlan && N.agentWatchPlan(plan); } catch (e) {}
      try { N && N.agentWatchWords && N.agentWatchWords(JSON.stringify({ newBest: tr("Agents · a new best price"), tap: tr("Tap to open Agents."), ask: tr("Time to check {site} prices — tap and I'll do it (about 30 seconds)."), check: tr("Check") })); } catch (e) {}
      const others = W.loadWatch().filter((r) => !String(r.id).startsWith("agent-"));
      W.saveWatch([...others, ...mine], ar ? "ar" : "en");
    }, 120);
    return () => clearTimeout(t);
  }, [st]);

  const openApp = (app, url = "") => {
    if (!app) return;
    // v9.1 (Ali, 4 Nov: "if the app won't open, open it in Attune's browser like the agents do"): a web link → the site's own app when
    // it is on the phone, else Attune's browser (Best offer · Fill my details) — never an outside browser or the store
    const u = url || app.web || "";
    if (/^https:\/\//.test(u) && N && N.openInApp && N.agentOpen && nativeCall) {
      let r = {}; try { r = JSON.parse(N.openInApp(u) || "{}"); } catch (e) {}
      if (r.ok && r.how === "app") { flash && flash(T("Opening {app}", { app: app.label })); return; }
      // v9.5 (Ali: the Uber site kept loading inside Attune — "make it browser like the old"): the app isn't on the phone → its site
      // in the phone's own browser
      if (N.openInBrowser) { try { if (N.openInBrowser(u)) { flash && flash(T("Opening {app}", { app: app.label })); return; } } catch (e) {} }
      nativeCall("agentOpen", { url: u, title: app.label || "", profile: loadBooking(), rules: { cheapest: true }, labels: agentLabels(), search: true }).catch(() => {});
      return;
    }
    if (N && N.openAnyApp) {
      let r = {}; try { r = JSON.parse(N.openAnyApp(JSON.stringify({ pkg: app.pkg || "", url: url || "" })) || "{}"); } catch (e) {}
      if (!r.ok && app.web) try { JSON.parse(N.openAnyApp(JSON.stringify({ pkg: "", url: app.web }))); } catch (e) {}
      flash && flash(r.how === "store" ? T("{app} isn't on this phone — its store page opened", { app: app.label }) : T("Opening {app}", { app: app.label }));
      return;
    }
    try { window.open(url || app.web, "_blank"); } catch (e) {}
  };
  const orderNow = (a, typed) => {
    // v9.5 (Ali: "it does not know my usual order, so why didn't it ask"): no usual saved → the card asks first; the answer is kept
    if (typed != null) { const w = String(typed).trim(); if (!w) return; a = { ...a, what: w }; upd(a.id, (y) => ({ ...y, what: w })); setSt((s0) => { const n = { ...s0, usual: { ...(s0.usual || {}), [a.app.id]: w } }; try { A.saveAgents(n); } catch (e) {} return n; }); }
    if (!String(a.what || "").trim()) return;
    if (N && N.intent) {
      let r = {}; try { r = JSON.parse(N.intent(JSON.stringify({ kind: "link", url: a.app.web, app: a.app.pkg, copy: a.what })) || "{}"); } catch (e) {}
      if (r.ok !== false) { flash && flash(T("Your order is copied — paste it in {app}'s search, check it and press Order", { app: a.app.label })); return; }
    }
    try { navigator.clipboard && navigator.clipboard.writeText(a.what); } catch (e) {}
    openApp(a.app, a.app.web);
  };
  // v9.0 (Ali: "look everywhere — Amazon, noon, Jumia, Google, Facebook"): besides the stores, the open web — the app's own search
  // in English and Arabic (shops Attune doesn't know, price-comparison sites, public Facebook pages); each offer keeps its page's link
  const webRound = async (a) => {
    if (!search || !a.what) return [];
    const qn = a.q || a.what, qs = [qn + " price", qn + (country === "EG" ? " سعر في مصر" : " buy"), qn + " site:facebook.com", ...(a.said ? [a.said + " سعر"] : [])];
    const lists = await Promise.all(qs.map((q) => Promise.race([search(q).catch(() => null), new Promise((r) => setTimeout(() => r(null), 25000))])));
    const hits = []; for (const r of lists) for (const h of (r && r.hits) || []) if (!hits.some((x) => x.url === h.url)) hits.push(h);
    const got = A.webOffers(hits, a.what, { cur: a.currency || "" });
    if (a.said) for (const o of A.webOffers(hits, a.said, { cur: a.currency || "" })) if (!got.some((x) => x.href === o.href)) got.push(o);   // pages written in Arabic
    return got;
  };
  // a product in several stores: each store's results page in turn (closing by itself), then the web; the exact product, each
  // store's cheapest listing with its own link
  const storeRound = async (a) => {
    const seen = [];
    for (let i = 0; i < a.tries.length; i++) {
      const x = a.tries[i];
      flash && flash(T("Looking on {site} ({i} of {n})…", { site: x.site, i: i + 1, n: a.tries.length + (search ? 1 : 0) }));
      const r = await nativeCall("agentOpen", { url: x.url, title: (a.what || a.title) + " · " + x.site, profile: {}, rules: { cheapest: true, many: true }, labels: agentLabels(), search: true, watch: true, autoClose: true });
      for (const o of (r && r.top) || []) seen.push({ ...o, site: x.site, url: x.url });   // v9.8: url = the results page (href = its own page)
      if (r && r.reason === "closed") return { seen, stopped: true };
    }
    if (search) { flash && flash(tr("Looking on the rest of the web…")); try { seen.push(...(await webRound(a))); } catch (e) {} }
    return { seen, stopped: false };
  };
  const checkNow = async (a) => {
    if (N && N.agentOpen && nativeCall && a.what && a.tries && a.tries.length && !a.tries[0].checkin) {
      setBusy(a.id);
      try {
        const { seen } = await storeRound(a);
        const cur = A.loadAgents().agents.find((y) => y.id === a.id) || a;
        const best = A.bestAcross(seen, cur), w = best[0];
        const next0 = A.addCheck(cur, { price: w && w.price, how: "browser", href: w && (w.href || w.url), name: w && w.name, site: w && w.site });
        upd(a.id, () => ({ ...next0, best3: best.length ? best : cur.best3 || [], compared: seen.length, stores: [...new Set(seen.map((o) => o.site))].length }));
        flash && flash(w ? T("Cheapest now: {p} on {site}", { p: money(w.price, a.currency), site: w.site }) : tr("Couldn't see that exact product yet — I'll keep looking."));
      } catch (e) { flash && flash(String((e && e.message) || e)); }
      finally { setBusy(""); }
      return;
    }
    if (N && N.agentOpen && nativeCall) {
      setBusy(a.id);
      try {
        // v8.2: a hotel window → every start day in turn (4 nights from 10 Dec, 19 Dec … inside 10 Dec – 29 Jan); the cheapest wins
        // (v9.8: the person's conditions — free cancellation, breakfast — are Booking's own filters on its search page too)
        const tries = (a.tries && a.tries.length ? a.tries : [{ url: a.url }]).map((x) => ({ ...x, url: R.withHotelFilters(x.url, a.rules || {}) }));
        let best = null, seen = [], compared = 0;
        // v8.7 (Ali: "it keeps glitching when I press Check now"): several start days are checked in ONE window that moves from
        // day to day by itself — it used to open and close a window for each day
        if (tries.length > 1) {
          const fl = !!(a.fields && a.fields.flight);   // v9.2 flights: one window goes from site to site (Kayak, momondo, Google Flights…)
          const r = await nativeCall("agentOpen", { url: tries[0].url, title: a.title, profile: {}, rules: { cheapest: true, many: true, ...(fl ? { direct: (a.rules || {}).maxStops === 0, time: (a.rules || {}).timeOfDay || "" } : {}) }, labels: agentLabels(), search: true, watch: true, rounds: tries.map((x) => ({ url: x.url, checkin: x.checkin || (fl ? x.label || x.site : ""), checkout: x.checkout || "" })) });
          if (r && r.price > 0) best = { price: r.price, checkin: r.checkin, checkout: r.checkout };
          compared = (r && r.offers) || 0;
          for (const o of (r && r.top) || []) { const [st, dep] = String(o.checkin || "").split("|");   // v9.3 a window: "Kayak|2026-12-09" — the site and the day tried
            seen.push(fl ? { ...o, site: st || o.site || "", ...(dep ? { depart: dep } : {}), checkin: "", checkout: "", url: o.href || o.url || a.url } : { ...o, url: o.url || a.url }); }
          if (fl && r && r.price > 0) best = { price: r.price };
        } else for (let i = 0; i < tries.length; i++) {
          if (tries.length > 1) flash && flash(T("Checking {i} of {n}: {d}", { i: i + 1, n: tries.length, d: tries[i].checkin }));
          const r = await nativeCall("agentOpen", { url: tries[i].url, title: a.title + (tries[i].checkin ? " · " + tries[i].checkin : ""), profile: {}, rules: { cheapest: true }, labels: agentLabels(), search: true, watch: true, autoClose: tries.length > 1 });
          if (r && r.price > 0 && (!best || r.price < best.price)) best = { price: r.price, checkin: tries[i].checkin, checkout: tries[i].checkout };
          compared += (r && r.offers) || 0;
          for (const o of (r && r.top) || []) seen.push({ ...o, checkin: tries[i].checkin, checkout: tries[i].checkout, url: tries[i].url || a.url });
          if (r && r.reason === "closed") break;   // the person closed the browser: stop the round
        }
        const top0 = !(best && best.checkin) && seen.length ? seen.filter((o) => o.price > 0).sort((x, y) => x.price - y.price)[0] : null;
        const next0 = A.addCheck(a, { price: best && best.price, how: "browser", ...(top0 ? { href: top0.href || "", name: top0.name || "" } : {}), ...(best && best.checkin ? { checkin: best.checkin, checkout: best.checkout } : {}) });
        // v9.1 (Ali picked B): up to 10 offers for the podium + list; their photos are kept apart (this phone only)
        const keepN = a.fields && a.fields.flight ? 30 : tries.length > 1 ? 10 : 3;   // v9.2 flights: keep more — the board groups them
        const pool = a.fields && a.fields.flight ? seen.filter((o) => o.price > 0).sort((x, y) => x.price - y.price).map((o, i) => ({ ...o, key: (o.site || "") + i + "-" + o.price })) : null;
        const next0b = seen.length ? { ...next0, best3: A.savePhotos(a.id, pool ? pool.slice(0, keepN) : A.bestThree(seen, a.skip, a.taste, keepN)), compared } : compared ? { ...next0, compared } : next0;
        // v9.6 (Ali: "more than 1 option in more than 1 date"): the best 3 on each of the 6 cheapest dates checked
        const byDay = A.offersByDay(seen.filter((o) => R.followsRules ? R.followsRules(o, a.rules || {}) : true));
        const next = byDay.length >= 2 ? { ...next0b, byDay } : next0b;
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
      seen.push(...(await storeRound({ ...a, tries: a.tries || [] })).seen);
      const cur = A.loadAgents().agents.find((y) => y.id === a.id) || a;
      const all = A.bestAcross(seen, { what: a.what, said: a.said, taste: cur.taste }, 30);
      const next = { ...A.takeBuyRound(cur, all), stores: [...new Set(seen.map((o) => o.site))].length, best3: all.slice(0, 6) };
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
  // v8.7 (persona 4, idea 3): each "Not this one" is remembered with what it was; two alike → the agent learns it and says so once
  const learn = (y, o) => { const skipped = [...(y.skipped || []), { name: o.name, text: o.text, site: o.site, rating: o.rating }].slice(-10), taste = A.learnTaste(skipped);
    const news = A.tasteNews(y.taste || {}, taste); if (news.length) setTimeout(() => flash && flash(tr(news[0][0], news[0][1])), 50); return { skipped, taste }; };
  const notThis = (a) => { const k = String(a.pending.href || a.pending.name || "").slice(0, 120); upd(a.id, (y) => ({ ...y, ...learn(y, a.pending), skip: [...(y.skip || []), k], pending: null, step: "search" })); };
  // v8.7 (idea 2 "Attune Saves"): ordered below the first price seen → the difference is counted as saved (Guardian's log)
  const markDone = (a) => { try { if (a.pending && a.pending.price > 0) G.saveGuardian(G.agentSaved(G.loadGuardian(), a, a.pending.price)); } catch (e) {} upd(a.id, (y) => ({ ...y, step: "ordered", on: false })); };
  // v8.2 (2A): one of the best 3 — opens in Attune's browser on those days, ready for "Fill my details" (you choose and pay)
  const openBest = async (a, o) => {
    // v9.8 (Ali, 7 Nov: "fix it for good"): an offer whose link is its OWN page opens it (phone's browser / the site's app); an offer
    // with no such link is never sent to the search page — Attune's browser opens the results, finds THAT offer by name / price and
    // goes into its page (agent-kit goTo), and "Open in my browser" then carries the listing itself
    const how = R.offerOpen(a, o);
    if (!how.direct && N && N.agentOpen && nativeCall) { try { await nativeCall("agentOpen", { url: how.url, title: o.name || a.title, profile: loadBooking(), rules: { cheapest: true }, labels: { ...agentLabels(), opening: tr("Opening this offer's own page…") }, search: false, goto: how.goto }); } catch (e) {} return; }
    const url = how.direct ? how.url : R.offerUrl(a, o);   // v9.0: the exact listing, not the store's search page
    // v9.5 (Ali, 5 Nov: "it still does not open the specific listing … if you can't do it in the app make it browser like the old"):
    // the exact listing opens in the phone's own browser — store apps often drop a link on their home page
    if (N && N.openInBrowser) { try { if (N.openInBrowser(url)) return; } catch (e) {} }
    // v9.1 (Ali, 4 Nov: "it's hard to do anything in the Attune browser — can it open Booking itself, with all the sorting ready?"):
    // when the site's own app is on the phone, the offer opens THERE (its page, with the dates and guests in the link)
    // any site whose app is installed (Android decides: NativeBridge.openInApp); the list below is only for older Attune builds
    if (N && N.openInApp) { try { const r = JSON.parse(N.openInApp(url) || "{}"); if (r.ok && r.how === "app") return; } catch (e) {} }
    const pkg = N && N.openInApp ? null : (APP_OF.find(([re]) => re.test(url)) || [])[1];
    if (pkg && N && N.appsList && N.openAnyApp) {
      let has = false; try { has = JSON.parse(N.appsList() || "[]").some((x) => x.pkg === pkg); } catch (e) {}
      if (has) { try { const r = JSON.parse(N.openAnyApp(JSON.stringify({ pkg, url })) || "{}"); if (r.ok && r.how === "app") return; } catch (e) {} }
    }
    if (N && N.agentOpen && nativeCall) { try { await nativeCall("agentOpen", { url, title: o.name || a.title, profile: loadBooking(), rules: { cheapest: true }, labels: agentLabels(), search: !o.href }); } catch (e) {} return; }
    try { window.open(url, "_blank"); } catch (e) {}
  };
  const skipBest = (a, o) => put({ ...st, agents: st.agents.map((x) => { if (x.id !== a.id) return x; const l = learn(x, o); return { ...x, ...l, skip: [...(x.skip || []), o.key], best3: (x.best3 || []).filter((y) => y.key !== o.key && A.fitsTaste(y, l.taste)) }; }) });
  // v9.0 follow agents: a notification on the day (repeating; not in the Reminders list), each round a fresh deep research in Chat
  const followNote = (a, on = true) => {
    const id = "agent-follow-" + a.id;
    try { if (!on) { N && N.unschedule && N.unschedule(id); return; }
      N && N.schedule && N.schedule(JSON.stringify({ id, at: a.next, title: T("Research update: {t}", { t: a.topic.slice(0, 60) }), body: tr("Tap to read what's new"), repeat: a.every === "day" ? "daily" : a.every === "month" ? "monthly" : "weekly" })); } catch (e) {}
  };
  // v9.8 (Ali: "it went to Chat, so I have to keep the app open"): the research runs here, by itself, and its report stays on the agent;
  // Chat is only the fallback for an old build without it
  const runFollow = async (a) => {
    const q = A.followQuestion(a, (k, v) => tr(k, v));
    upd(a.id, (y) => A.followDone(y));
    if (onResearchBg) {
      flash && flash(tr("Researching in the background — you can leave Attune; I'll tell you when it's ready"));
      const r = await onResearchBg(a, q); setSt(A.loadAgents());
      if (r && !r.ok) flash && flash(r.why === "model" ? tr("Install an AI model in Engine to research") : r.why === "offline" ? tr("Offline lock is on — turn it off in Engine to search the web") : tr("The research didn't finish — try again"));
      return;
    }
    if (!onResearch) { flash && flash(tr("Research runs in Chat with the web on")); return; }
    onResearch(a.topic, q);
  };
  useEffect(() => {   // a follow notification tapped → that agent's round
    let id = ""; try { id = localStorage.getItem("attune:agents:run") || ""; localStorage.removeItem("attune:agents:run"); } catch (e) {}
    const a = id && A.loadAgents().agents.find((x) => x.id === id && x.kind === "follow");
    if (a) setTimeout(() => runFollow(a), 200);
  }, []);
  const remove = (a) => { if (a.kind === "follow") followNote(a, false); put({ ...st, agents: st.agents.filter((x) => x.id !== a.id) }); };
  // v9.9.13 AC3: the phone asked "Time to check … — tap and I'll do it" → open on that agent and check it now
  useEffect(() => { let id = ""; try { id = localStorage.getItem("attune:agents:checknow") || ""; if (id) localStorage.removeItem("attune:agents:checknow"); } catch (e) {}
    const a = id && A.loadAgents().agents.find((x) => x.id === id); if (a) { setChat(a.id); setTimeout(() => checkNow(a), 400); } }, []);
  const toggle = (a) => { if (a.kind === "follow") followNote(a, !a.on); put({ ...st, agents: st.agents.map((x) => (x.id === a.id ? { ...x, on: !x.on } : x)) }); };

  // ---- v9.4 the new agents' actions (agents2.js does the thinking; these only talk to the phone) ----
  const [schedOpen, setSchedOpen] = useState(false), [allStarters, setAllStarters] = useState(false);
  const remind = (id, at, title, body = "") => { const r = { id, at, title, body, repeat: "none" }; const list = [...loadReminders().filter((x) => x.id !== id), r]; saveReminders(list); try { syncToPhone(N, list); } catch (e) {} };
  // v9.7 Messages (Ali picked M3 + S1 + S2 + S3): one scheduler for the sentence, the composer and Home (messages-ui.jsx)
  const createSend = (d) => {
    const a = scheduleMessage({ app: d.app || "whatsapp", who: d.who, phone: d.phone || "", text: d.text, at: d.at, repeat: d.repeat || "none" }, N);
    setSt(A.loadAgents()); setSchedOpen(false);
    flash && flash(T("Scheduled: {who}, {t}", { who: a.who, t: whenTxt(a.at) }));
  };
  const createSendOld = (d) => {
    const chat = A2.chatFor(d.who, readInbox());
    const a = { ...A.makeAgent({ kind: "send", who: d.who, text: d.text, at: d.at }), key: chat ? chat.key : "", pkg: chat ? chat.pkg || "" : "com.whatsapp", phone: d.phone || "" };
    put({ ...A.loadAgents(), agents: [a, ...A.loadAgents().agents] }); openTab(a.id); setSchedOpen(false);
    try { N && N.schedule && N.schedule(JSON.stringify({ id: "msg-" + a.id, at: a.at, title: T("Message to {who}", { who: a.who }), body: a.text, repeat: "none",
      send: { key: a.key, pkg: a.pkg, phone: a.phone, text: a.text, who: a.who, sentTitle: T("Sent to {who}", { who: a.who }), dueTitle: T("Time to send to {who} — tap to open the chat", { who: a.who }) } })); } catch (e) {}
    flash && flash(T("Scheduled: {who}, {t}", { who: a.who, t: whenTxt(a.at) }));
  };
  const sendNow = (a) => {
    let r = {}; try { r = a.key && N && N.chatReply ? JSON.parse(N.chatReply(JSON.stringify({ key: a.key, text: a.text })) || "{}") : {}; } catch (e) {}
    try { N && N.unschedule && N.unschedule("msg-" + a.id); } catch (e) {}
    if (r.ok) { upd(a.id, (y) => ({ ...y, state: "sent", doneAt: Date.now() })); flash && flash(T("Sent to {who}", { who: a.who })); return; }
    const url = a.phone ? "https://wa.me/" + String(a.phone).replace(/\D/g, "") + "?text=" + encodeURIComponent(a.text) : "";
    try { navigator.clipboard && navigator.clipboard.writeText(a.text); } catch (e) {}
    try { N && N.openAnyApp && N.openAnyApp(JSON.stringify({ pkg: a.pkg || "", url })); } catch (e) {}
    upd(a.id, (y) => ({ ...y, state: "opened", doneAt: Date.now() }));
    flash && flash(url ? tr("The chat opens with the message written — tap Send") : T("Copied — {app} opens: paste it in {who}'s chat", { app: "WhatsApp", who: a.who }));
  };
  useEffect(() => { try { const log = N && N.sendLog ? JSON.parse(N.sendLog() || "[]") : []; if (log.length) { const cur = A.loadAgents(); put({ ...cur, agents: cur.agents.map((a) => { const x = log.find((l) => l.id === "msg-" + a.id); return x ? { ...a, state: x.ok ? "sent" : "opened", doneAt: x.at } : a; }) }); } } catch (e) {} }, []);
  const slotOpen = async (a, refresh = 0) => {
    if (!(N && N.agentOpen && nativeCall)) { try { window.open(a.url, "_blank"); } catch (e) {} return; }
    setBusy(a.id);
    try { const r = await nativeCall("agentOpen", { url: a.url, title: a.title, profile: {}, rules: {}, labels: agentLabels(), search: false, slot: true, ...(refresh ? { refresh } : {}) });
      if (r && typeof r.slot === "string") { upd(a.id, (y) => A.takeSlot(y, { text: r.slot, at: Date.now(), how: "browser" })); const st = A2.slotState(r.slot).state;
        flash && flash(st === "open" ? tr("A date is showing — book it now") : st === "none" ? tr("No appointments yet — I'll keep checking") : st === "login" ? tr("Log in once, then tap Check now again") : tr("Read the page — nothing clear yet")); } }
    catch (e) { flash && flash(String((e && e.message) || e)); } finally { setBusy(""); }
  };
  const tripRemind = (a) => { const p = A2.tripPlan(a, [], { drive: a.drive || 60 }), now = Date.now();
    if (p.checkIn > now) remind("trip-ci-" + a.id, p.checkIn, T("Check-in is open: {f}", { f: a.flight }), tr("Check in online now and pick your seat."));
    if (p.leaveBy > now) remind("trip-go-" + a.id, p.leaveBy, T("Leave for the airport now: {f}", { f: a.flight }), T("Takes off {t}", { t: whenTxt(a.at) }));
    upd(a.id, (y) => ({ ...y, reminded: true })); flash && flash(tr("Reminders set: when check-in opens and when to leave")); };
  const openSite = async (a, x) => { if (N && N.openInApp) { try { const r = JSON.parse(N.openInApp(x.url) || "{}"); if (r.ok && r.how === "app") return; } catch (e) {} }
    if (N && N.agentOpen && nativeCall) { try { await nativeCall("agentOpen", { url: x.url, title: a.title, profile: loadBooking(), rules: { cheapest: true }, labels: agentLabels(), search: false }); } catch (e) {} return; }
    try { window.open(x.url, "_blank"); } catch (e) {} };
  const startNew = (d) => {
    if (d.kind === "send") { createSend(d); return true; }
    if (!["reply", "slot", "restock", "protect", "clinic", "trip"].includes(d.kind)) return false;
    if (!pro && st.agents.filter((x) => x.on).length >= 1) { flash && flash(tr("Free includes 1 agent — Pro runs as many as you need")); openPlan && openPlan(); return true; }
    const a = A.makeAgent(d); noteProUse("agent"); openTab(a.id); put({ ...A.loadAgents(), agents: [a, ...A.loadAgents().agents] }); setText(""); setDraft(null);
    if (d.kind === "slot") { flash && flash(tr("Watching the appointments — the page opens now: log in once if it asks")); setTimeout(() => slotOpen(a), 300); }
    else if (d.kind === "trip") { setTimeout(() => tripRemind(a), 100); }
    else if (d.kind === "protect") { flash && flash(T("Watching the price of {w} for {n} days", { w: d.what, n: d.days })); setTimeout(() => checkNow(a), 300); }
    else flash && flash(d.kind === "reply" ? tr("Reply helper is on — it shows who is waiting for your answer") : d.kind === "restock" ? tr("Restock is on — it learns from what you buy in Money") : T("{s} in {c}: the booking sites are ready", { s: tr(d.spec), c: d.city }));
    return true;
  };
  const start = (sentence, d) => {
    if (d && !d.ask && startNew(d)) return;
    if (!d) { flash && flash(tr("Say what the agent should do — like the examples above")); return; }
    if (d.ask) { setDraft({ text: sentence, d }); setAnswer(""); return; }
    setDraft(null); setText(""); setDoCard(null);
    if (d.kind === "open") return openApp(d.app, "");
    if (d.kind === "do") { setDoCard(d); return; }
    if (d.kind === "scout") { onScout && onScout(sentence); return; }
    if (d.kind === "follow") {
      if (!pro && st.agents.filter((x) => x.on).length >= 1) { flash && flash(tr("Free includes 1 agent — Pro runs as many as you need")); openPlan && openPlan(); return; }
      const a = A.makeAgent(d); noteProUse("agent"); openTab(a.id); put({ ...st, agents: [a, ...st.agents] }); followNote(a, true);
      flash && flash(T("Following {t} — the first report now, then {e}", { t: d.topic.slice(0, 40), e: tr(d.every === "day" ? "every day" : d.every === "month" ? "every month" : "every week") }));
      setTimeout(() => runFollow(a), 400); return;
    }
    // v9.8 (Ali: "I made an agent to research a car — it went to Chat, so I have to keep the app open"): a one-off research is an agent
    // too — it runs here in the background, its report stays on its card, a notification says when it's ready (no repeat, no Chat)
    if (d.kind === "research") {
      if (onResearchBg) { const a = { ...A.makeAgent({ kind: "follow", topic: d.topic, every: "once", title: "Research · " + String(d.topic).slice(0, 70) }), every: "once", once: true };
        put({ ...st, agents: [a, ...st.agents] }); setTimeout(() => runFollow(a), 300); return; }
      if (onResearch) onResearch(d.topic); else flash && flash(tr("Research runs in Chat with the web on")); return; }
    if (d.kind === "alert") { W.saveWatch([W.newRule(d.rule), ...W.loadWatch()], ar ? "ar" : "en"); setSt({ ...st }); flash && flash(T("I'll tell you: {r}", { r: W.ruleText(d.rule, ar) })); return; }
    // v8.7 (Ali picked persona 3's point 2): agents that act are Pro — Free keeps one running agent to try
    if (!pro && st.agents.filter((x) => x.on).length >= 1) { flash && flash(tr("Free includes 1 agent — Pro runs as many as you need")); openPlan && openPlan(); return; }
    // v9.9.13 AH1 (Ali picked): a price watch first says its plan in 4 lines — Start / Change something
    if (d.kind === "watch" && !d.planOk) { setPlanDraft({ sentence, d }); setDraft(null); return; }
    setPlanDraft(null);
    const a = A.makeAgent(d); noteProUse("agent"); openTab(a.id);
    const usual = d.kind === "order" ? { ...st.usual, [d.app.id]: d.what } : st.usual;
    put({ ...st, usual, agents: [a, ...st.agents] });
    if (d.kind === "buy") { flash && flash(T("On it: I'll find {w} and ask you before buying", { w: d.what })); setTimeout(() => buyRound(a), 300); return; }
    flash && flash(d.kind === "watch" ? T("Watching {t} — I'll tell you under {p}", { t: d.title, p: money(d.below, d.currency) }) : d.kind === "track" ? T("I'll tell you when your {app} order is on its way and arriving", { app: d.app.label }) : T("Saved: {t}", { t: d.title }));
  };
  const sendHaggle = (a, sl) => {
    if (!sl.pending || !HG.safeText(sl.pending)) return;
    let auto = false; try { auto = !!(N && N.msgState && JSON.parse(N.msgState() || "{}").autoOn); } catch (e) {}
    scheduleMessage({ app: "whatsapp", who: T("Seller {n}", { n: sl.n }) + (sl.name ? " · " + sl.name : ""), phone: sl.phone, text: sl.pending, at: Date.now() + 3000, repeat: "none", ask: false, auto });
    upd(a.id, (h) => HG.sent(h, sl.id)); flash && flash(auto ? tr("Sent by itself") : tr("Tap the notification to send it in WhatsApp"));
  };
  const submit = (s) => { const sentence = (s || text).trim(); if (!sentence) return;
    // v9.8 N1: "negotiate a Tucson 2022 under 1,050,000…" / «فاصلي على…» → the Haggler, opened on its page to add the sellers
    { const hp = HG.parseHaggle(sentence); if (hp) { const h = HG.makeHaggle(hp); const cur = A.loadAgents(); put({ ...cur, agents: [h, ...cur.agents] }); setText(""); setChat(h.id); return; } }
    start(sentence, A.parseAgent(sentence, { country, installed: installedNow(), usual: st.usual, prefs: loadBooking() })); };
  const reply = () => { if (!draft) return; const s = A.withAnswer(draft.text, draft.d.ask, answer); start(s, A.parseAgent(s, { country, installed: installedNow(), usual: st.usual, prefs: loadBooking() })); };

  // v9.0 (Ali: "make each one a different tab"): one tab per running agent (+ each Scout goal, + the message alerts); the chosen
  // tab is remembered; a new agent opens on its own tab
  const tabs = [...st.agents.map((a) => ({ id: a.id, ...A.agentTab(a) })),
    ...scout.map((g) => ({ id: "scout-" + g.id, label: A.agentTab({ kind: "scout", title: g.text }).label, dot: !!(g.unseen || []).length, kind: "scout" })),
    ...(alerts.some((x) => !String(x.id).startsWith("agent-")) ? [{ id: "alerts", label: tr("Message alerts"), dot: false, kind: "alert" }] : [])];
  const tab = A.pickTab(tabs.map((x) => x.id), tabWant, tabs.filter((x) => x.dot).map((x) => x.id));
  if (rep) return <AgentsReport st={st} scout={scout} alerts={alerts} back={() => setRep(false)} />;
  const r = A.agentsReport(st, scout, alerts);
  const alertRules = alerts.filter((x) => !String(x.id).startsWith("agent-"));
  // v9.2: every agent (and each Scout goal, the message alerts) as { id, st, kind, title, site, price, el } — one list, grouped
  const setRules = (a, rules) => upd(a.id, (y) => ({ ...y, rules, ...(rules.below ? { below: rules.below } : {}), ...(a.ruleLog ? { ruleLog: a.ruleLog } : {}) }));
  const extra = { setRules, understand: understandRule, flash };
  const priceOf = (a) => { if (a.kind === "haggle") { const b = HG.bestOf(a).best; return b ? money(b.p, "") : ""; } const p = a.pending || a.found || (R.applyRules(a.best3 || [], a.rules)[0]); return p && p.price ? money(p.price, p.currency || a.currency) : ""; };
  const liveSt = (a) => a.kind === "reply" ? (a.on === false ? "paused" : A2.waitingChats(readInbox(), { hours: a.hours || 3 }).length ? "needs" : "working")
    : a.kind === "restock" ? (a.on === false ? "paused" : (() => { try { return A2.restockDue(JSON.parse(localStorage.getItem("ledger.v3") || "null"), { soon: 2 }).length ? "needs" : "working"; } catch (e) { return "working"; } })())
    : a.kind === "clinic" ? (a.on === false ? "paused" : "found")
    : a.kind === "haggle" ? (a.on === false ? "paused" : HG.bestOf(a).good.length || (a.sellers || []).some((x) => x.pending) ? "needs" : "working") : R.agentStatus(a);   // v9.4: the group follows what the card shows
  // v9.7 Messages: the scheduled messages are one card here (their own page has the list) — not one card each
  const sends = st.agents.filter((a) => a.kind === "send" && (a.state !== "sent" || (a.repeat && a.repeat !== "none")));
  const msgCard = sends.length ? [{ id: "messages", st: "working", kind: "send", title: T("Messages · {n} scheduled", { n: sends.length }), site: "", price: "",
    el: <div className={U.cardPad + " space-y-2"} data-testid="agent-send">
      <CardHead kind="send" title={T("Messages · {n} scheduled", { n: sends.length })} status="working" line={sends.slice(0, 2).map((a) => a.who + " · " + whenTxt(a.at)).join(" · ")} menu={[[tr("Open Messages"), () => setMsgs("list"), "agent-send-open-menu"]]} />
      <p className="m-0 text-[13px] c-sub truncate" dir="auto" data-testid="send-text">{sends[0].text}</p>
      <CardActions primary={{ label: tr("Open Messages"), icon: ChevronRight, onClick: () => setMsgs("list"), testid: "agent-send-open" }} /></div> }] : [];
  const cards = [...msgCard, ...st.agents.filter((a) => a.kind !== "send").map((a) => ({ id: a.id, a, grid: A.datesGrid(a), st: liveSt(a), kind: a.kind, title: a.kind === "follow" ? a.topic : a.said || a.what || a.title, site: siteOfAgent(a), price: priceOf(a),
      el: a.kind === "reply" ? <ReplyCard key={a.id} a={a} draft={drafter} onSchedule={() => setMsgs("new")} {...{ remove, toggle }} {...extra} />
        : a.kind === "send" ? <SendCard key={a.id} a={a} {...{ remove, toggle, sendNow }} />
        : a.kind === "slot" ? <SlotCard key={a.id} a={a} busy={busy === a.id} checkSlot={(x) => slotOpen(x)} watchSlot={(x) => slotOpen(x, 60)} setUrl={(x, s0) => upd(x.id, (y) => ({ ...y, url: s0.url, site: s0.name }))} setEvery={(x, m) => upd(x.id, (y) => ({ ...y, every: m }))} {...{ remove, toggle }} {...extra} />
        : a.kind === "restock" ? <RestockCard key={a.id} a={a} openMoney={() => navTo && navTo("money")} toList={(items) => { const st0 = L.loadLists(); const ex = L.findList(st0, ar ? "الطلبات" : "Shopping");
            const next = ex ? L.addItem(st0, ex.id, items.join(",")) : L.addList(st0, L.makeList({ name: ar ? "الطلبات" : tr("Shopping"), items, repeat: { every: "once" } })); L.saveLists(next); flash && flash(T("Added to your shopping list: {n}", { n: items.length })); }} findCheapest={(x) => submit((ar ? "اشتريلي " : "Buy me ") + x.item)} remindOn={(x) => { remind("restock-" + encodeURIComponent(x.item).slice(0, 40), Date.parse(x.due + "T09:00:00"), T("Running low: {w}", { w: x.item }), tr("Time to buy it again")); flash && flash(T("I'll remind you on {d}", { d: whenTxt(Date.parse(x.due + "T09:00:00")) })); }} {...{ remove, toggle }} {...extra} />
        : a.kind === "protect" ? <ProtectCard key={a.id} a={a} busy={busy === a.id} {...{ remove, toggle, checkNow, flash }} {...extra} />
        : a.kind === "haggle" ? <button key={a.id} onClick={() => setChat(a.id)} className={U.card + " w-full text-start p-3.5 space-y-0.5"} data-testid="haggle-card"><b className="block text-[14.5px]" dir="auto">{T("Negotiating · {w}", { w: a.what })}</b><span className="block text-[12.5px] c-sub">{(() => { const b = HG.bestOf(a); return b.best ? T("Best so far: {p} · talking to {n}", { p: money(b.best.p, ""), n: b.talking }) : T("Sellers · {n}", { n: (a.sellers || []).length }); })()}</span></button>
        : a.kind === "clinic" ? <ClinicCard key={a.id} a={a} {...{ remove, toggle, openSite }} {...extra} />
        : a.kind === "trip" ? <TripCard key={a.id} a={a} setDrive={(x, m) => upd(x.id, (y) => ({ ...y, drive: m, reminded: false }))} remindTrip={tripRemind} {...{ remove, toggle, navTo }} {...extra} />
        : a.kind === "follow" ? <FollowCard key={a.id} a={a} {...{ runFollow, remove, toggle }} {...extra} /> : a.kind === "buy" ? <BuyCard key={a.id} a={a} busy={busy === a.id} {...{ buyRound, confirmBuy, notThis, markDone, remove, toggle, openApp, openBest }} {...extra} />
        : <AgentCard key={a.id} a={a} hits={hits} busy={busy === a.id} {...{ checkNow, orderNow, openApp, remove, toggle, openBest, skipBest }} {...extra} /> })),
    ...scout.map((g) => ({ id: "scout-" + g.id, st: (g.unseen || []).length ? "found" : "working", kind: "scout", title: tr("Scout") + " · " + g.text, site: "", price: "",
      el: <div className={U.cardPad + " space-y-2"} data-testid="agents-scout">
        <CardHead kind="scout" title={g.text} status={(g.unseen || []).length ? "found" : "working"} menu={[[tr("Open Scout"), () => navTo && navTo("scout"), "agents-scout-open-menu"]]}
          line={T("{n} ads checked", { n: (g.seen || []).length }) + (g.lastRun ? " · " + ago(g.lastRun) : "") + ((g.unseen || []).length ? " · " + T("{n} new", { n: g.unseen.length }) : "")} />
        <CardActions primary={{ label: (g.unseen || []).length ? T("See {n} new ads", { n: g.unseen.length }) : tr("See the ads"), icon: ChevronRight, onClick: () => navTo && navTo("scout"), testid: "agents-scout-open" }} /></div> })),
    ...(alertRules.length ? [{ id: "alerts", st: "working", kind: "alert", title: T("Message alerts · {n}", { n: alertRules.length }), site: "", price: "",
      el: <div className={U.cardPad + " space-y-2"} data-testid="agents-alerts">
        <CardHead kind="alert" title={T("Message alerts · {n}", { n: alertRules.length })} status="working" line={alertRules.slice(0, 2).map((x) => W.ruleText(x, ar)).join(" · ")}
          menu={[[tr("Open the alerts"), () => navTo && navTo("reminders"), "agents-alerts-open-menu"]]} />
        <CardActions primary={{ label: tr("Open the alerts"), icon: ChevronRight, onClick: () => navTo && navTo("reminders"), testid: "agents-alerts-open" }} /></div> }] : [])];

  if (msgs) return <MessagesPage back={() => { setMsgs(""); setSt(A.loadAgents()); }} flash={flash} nativeCall={nativeCall} drafter={drafter} startNew={msgs === "new"} />;
  const open = chat && cards.find((c) => c.id === chat);
  if (open && open.a && open.a.kind === "haggle") return <HaggleView a={A.loadAgents().agents.find((x) => x.id === open.id) || open.a} back={() => setChat("")} upd={upd} flash={flash} send={sendHaggle} />;
  if (open) return <AgentChat c={open} back={() => setChat("")} openBest={openBest} setRules={setRules} understand={understandRule} flash={flash} toggle={toggle} checkNow={checkNow} busy={busy === open.id} />;
  return (
    <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="agents-page">
      <U.Head title={tr("Agents")} sub={tr("Tell an agent what to watch or do — it works on this phone, and never pays for you")} />
      {/* v8.7 (Ali picked P5-C): the same box as Home and every page — only the hint is the Agents' */}
      <U.PageBox value={text} setValue={setText} onSend={(t) => submit(t)} hint={tr("Tell an agent what to do…")} sendLabel={tr("Send")} ids={{ box: "agents-box", input: "agents-input", go: "agents-go" }} />
      {view !== "new" || !r.running || allStarters ? <div className="grid grid-cols-3 gap-2" data-testid="agents-chips">
        {(allStarters ? CHIPS : CHIPS.filter(([k]) => ["reply", "send", "flight", "slot", "buy", "watch"].includes(k))).map(([k, l, en, a]) => <button key={k}
          onClick={() => { if (k === "send") { setMsgs("new"); return; } setText(ar ? a : en); setDraft(null); try { document.querySelector("[data-testid=agents-input]").focus(); } catch (e) {} }}
          className="min-h-[84px] rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-2.5 flex flex-col items-center justify-center gap-1.5 text-center hover:border-[var(--c-acc)] active:scale-[.98] transition" data-testid={"agents-chip-" + k}>
          <span className="w-9 h-9 rounded-full bg-[var(--c-soft)] c-acc grid place-items-center">{React.createElement(KIND_ICON[k] || AppWindow, { size: 17 })}</span>
          <span className="text-[12.5px] font-extrabold leading-tight">{tr(l)}</span></button>)}
      </div> : null}
      <button onClick={() => setAllStarters(!allStarters)} className="w-full min-h-[40px] text-[13px] font-extrabold c-acc" aria-expanded={allStarters} data-testid="agents-more-starters">{allStarters ? tr("Fewer") : tr("More agents")} {allStarters ? "‹" : "›"}</button>
      {schedOpen ? <ScheduleForm nativeCall={nativeCall} onClose={() => setSchedOpen(false)} onDone={createSend} /> : null}
      {planDraft ? <div className="space-y-2" data-testid="agents-plan">
        <div className="self-end rounded-[16px] rounded-ee-[4px] px-3 py-2 bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[13.5px] font-bold ms-auto w-fit max-w-[88%]" dir="auto">{planDraft.sentence}</div>
        <p className="m-0 text-[14px] font-extrabold">{tr("Here's what I'll do:")}</p>
        <PlanCard a={A.makeAgent({ ...planDraft.d })} testid="agents-plan-lines" />
        <div className="flex gap-2"><button onClick={() => start(planDraft.sentence, { ...planDraft.d, planOk: true })} className={U.btnP} data-testid="agent-plan-start">{tr("Start")}</button>
          <button onClick={() => { setText(planDraft.sentence); setPlanDraft(null); }} className={U.btnS} data-testid="agent-plan-edit">{tr("Change something")}</button></div>
      </div> : null}
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
      {N && !access && st.agents.some((a) => a.kind === "track") ? <button onClick={() => { try { N.openPayAccess && N.openPayAccess(); } catch (e) {} }} className="w-full text-start min-h-[44px] rounded-[20px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-3 text-[12.5px] font-semibold text-[var(--c-warn)] flex gap-2" data-testid="agents-access">
        <AlertTriangle size={14} className="shrink-0 mt-0.5" />{tr("Delivery agents read the store app's notifications: turn on Notification access for Attune (Settings opens).")}</button> : null}

      {/* v9.2 (Ali picked 2A): one card shape for every agent; "Needs you" first, then Working, then Done — List or Board */}
      <div className="flex items-center gap-2 pt-1"><p className="flex-1 text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)] m-0" data-testid="agents-running">{T("Running · {n}", { n: r.running })}</p>
        {r.running ? <span className="inline-flex rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] p-0.5" role="group" aria-label={tr("View")} data-testid="agents-view">
          {[["new", "Cards", AppWindow], ["list", "List", ListChecks], ["board", "Board", Kanban]].map(([k, l, Ic]) => <button key={k} onClick={() => setView(k)} aria-pressed={view === k} data-testid={"agents-view-" + k}
            className={"min-h-[36px] px-3 rounded-full text-[12.5px] font-extrabold inline-flex items-center gap-1 " + (view === k ? "bg-[var(--c-soft)] text-[var(--c-acc)]" : "c-sub")}><Ic size={14} />{tr(l)}</button>)}</span> : null}</div>
      {view === "new" && r.running ? <AgentCardsA5 changes={A.whatChanged(st.agents)} cards={cards} runFollowA5={runFollow} openBest={openBest} openChat={(c) => (c.id === "messages" ? setMsgs("list") : setChat(c.id))} /> : null}
      {view === "board" && r.running ? <div className="flex gap-2.5 overflow-x-auto -mx-1 px-1 pb-2 snap-x" data-testid="agents-board">
        {BOARD.map(([k, l]) => { const items = cards.filter((c) => (k === "working" ? c.st === "working" : k === "done" ? c.st === "done" || c.st === "paused" : c.st === "found" || c.st === "needs"));
          return <div key={k} className="snap-start shrink-0 w-[200px] lg:w-auto lg:flex-1 rounded-[16px] bg-[var(--c-soft)] p-2 space-y-2" data-testid={"agents-col-" + k}>
            <p className="m-0 px-1 text-[11.5px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr(l)} · {items.length}</p>
            {items.map((c) => <button key={c.id} onClick={() => (c.id === "messages" ? setMsgs("list") : setChat(c.id))} className={U.card + " w-full text-start p-2.5 space-y-1" + (c.st === "needs" ? " ring-2 ring-[var(--c-warn)]" : c.st === "found" ? " ring-2 ring-[var(--c-acc)]" : "")} data-testid="agents-board-card">
              <span className="flex items-center gap-2">{c.site ? <SiteMark site={c.site} size={24} /> : <span className="c-acc">{React.createElement(KIND_ICON[c.kind] || AppWindow, { size: 16 })}</span>}
                <b className="text-[12.5px] leading-tight line-clamp-2 min-w-0" dir="auto">{c.title}</b></span>
              {c.price ? <b className="block text-[13px] tabular-nums">{c.price}</b> : null}
              {c.grid && c.grid.kind === "dates" ? <span className="block text-[11px] c-sub">{T("{n} offers · {d} dates", { n: c.grid.rows.reduce((x, r) => x + r.offers.length, 0), d: c.grid.rows.length })}</span> : null}</button>)}
            {!items.length ? <p className="m-0 px-1 text-[12px] c-sub">—</p> : null}</div>; })}
      </div> : null}
      {view === "list" ? GROUPS.map(([k, l]) => { const items = cards.filter((c) => (k === "working" ? c.st === "working" || c.st === "found" : k === "done" ? c.st === "done" || c.st === "paused" : c.st === k));
        if (!items.length) return null;
        return <section key={k} className="space-y-2.5" data-testid={"agents-group-" + k}>
          <p className={"m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase " + (k === "needs" ? "text-[var(--c-warn)]" : "c-sub")}>{tr(l)} · {items.length}</p>
          {items.map((c) => <div key={c.id} ref={focus === c.id ? (el) => { if (el) { el.scrollIntoView({ block: "start" }); setFocus(""); } } : undefined}>{c.el}</div>)}
        </section>; }) : null}
      {!r.running ? <p className={U.card + " p-4 m-0 text-[13.5px] c-sub"} data-testid="agents-empty">{tr("No agents yet. Tap an example above, or write your own — a price to watch, a delivery to track, your usual order, or any app to open.")}</p> : null}
      <button onClick={() => setRep(true)} className={U.card + " w-full text-start p-4 flex items-center justify-between font-extrabold"} data-testid="agents-open-report">
        <span>{tr("See all → Agents report")}</span><span className="c-sub text-[12.5px] font-bold">{T("Checks this week: {n}", { n: r.checks })}</span></button>
    </div>);
}

/* ---- v9.8 A3: what changed since yesterday (a find, a drop, one waiting for you) on top — each opens its listing at once — then
   every agent as ONE quiet row (tap → its conversation). Nothing else on the page. */
const CHANGE_LINE = { needs: "Waiting for your OK", found: "Found under your price", drop: "Price dropped", rise: "Price went up" };
/* ---- v9.8 A5 (Ali picked "one card per agent, its best offer inside" — MOCKUPS.md, https://claude.ai/artifact/2QaqFEiB5AyWHcmugbaZfC):
   each agent is one card: its site, what it watches, when it last looked and your conditions, then its best offer right there (name,
   days, price) with Open the listing — no extra tap. What changed since yesterday is a line on its own card ("Price dropped · was …").
   A card with no offer yet says what it is waiting for. */
function AgentCardsA5({ changes, cards, openBest, openChat, runFollowA5 }) {
  const LINE = { needs: "Waiting for your OK", found: "Found under your price", drop: "Price dropped", rise: "Price went up" };
  return <div className="space-y-2.5" data-testid="agents-a5">
    {cards.map((c) => { const a = c.a, ch = changes.find((x) => x.id === c.id), cur = (a && a.currency) || "";
      // v9.9.19: offers saved by older rounds are checked again with today's rules (a "FreeClip 2 · EGP 120" saved before stays out)
      const kept = a ? A.bestAcross(a.best3 || [], { ...a, checks: a.checks || [] }, 5) : [];
      const offers = a ? R.applyRules(kept, a.rules || {}) : [], fb = a && a.found && a.found.price ? { ...a.found, url: a.url, site: a.site } : null, o = offers[0] || (fb && A.believable(fb, a) ? fb : null);
      const last = a && (a.checks || []).length ? a.checks[a.checks.length - 1].at : a && a.lastRun;
      const chips = a ? R.ruleChips(a.rules || {}).filter((x) => x.key !== "autonomy" && x.key !== "hours").slice(0, 3).map((x) => tr(x.en, x.v)) : [];
      return <section key={c.id} className={U.card + " p-3.5 space-y-2"} style={ch ? { borderColor: ch.kind === "rise" ? "var(--c-neg)" : "var(--c-pos)" } : undefined} data-testid="agent-a5">
        <button onClick={() => openChat(c)} className="w-full flex items-center gap-2.5 text-start" data-testid="agent-a5-head">
          {c.site ? <SiteMark site={c.site} size={36} /> : <span className="w-9 h-9 rounded-[11px] bg-[var(--c-soft)] c-acc grid place-items-center shrink-0">{React.createElement(KIND_ICON[c.kind] || AppWindow, { size: 17 })}</span>}
          <span className="flex-1 min-w-0"><b className="block text-[14.5px] leading-tight" dir="auto">{c.title}</b>
            <span className="block text-[11.5px] c-sub truncate">{[last ? T("checked {t}", { t: ago(last) }) : tr(c.st === "done" ? "Done" : c.st === "paused" ? "Paused" : "Watching"), ...chips].join(" · ")}</span></span>
          <ChevronRight size={16} className="c-sub shrink-0 rtl:-scale-x-100" /></button>
        {ch ? <p className={"m-0 text-[12.5px] font-extrabold " + (ch.kind === "rise" ? "c-neg" : "c-pos")} data-testid="agent-a5-change">{tr(LINE[ch.kind])}{ch.was ? " · " + T("was {p}", { p: money(ch.was, cur) }) : ""}</p> : null}
        {a && a.kind === "follow" ? <><ReportBox a={a} />{!a.report && !a.researching ? <button onClick={() => runFollowA5 && runFollowA5(a)} className="w-full min-h-[40px] rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[13px] font-extrabold" data-testid="agent-a5-research">{tr("Research now")}</button> : null}</>
        : o && o.price ? <div className="rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] p-2.5 space-y-2" data-testid="agent-a5-offer">
          <div className="flex items-start gap-2"><span className="flex-1 min-w-0"><b className="block text-[14px] leading-snug" dir="auto">{o.name && !R.isSiteName(o.name, a.site) ? o.name : T("Best on {s}", { s: A.siteOfOffer(o) || a.site || "" })}</b>
            <span className="block text-[11.5px] c-sub" data-testid="agent-a5-offer-sub">{[o.checkin && o.checkout ? dWords(o.checkin) + " → " + dWords(o.checkout) : "",
              // v9.9.19 (Ali's screenshot: "Best on Amazon · noon" over "Amazon · noon"): the site is said once
              o.name && !R.isSiteName(o.name, a.site) ? A.siteOfOffer(o) : "", offers.length > 1 ? T("{n} more", { n: offers.length - 1 }) : ""].filter(Boolean).join(" · ")}</span></span>
            <b className="text-[16px] tabular-nums shrink-0" dir="ltr">{money(o.price, o.currency || cur)}</b></div>
          <button onClick={() => openBest(a, o)} className="w-full min-h-[40px] rounded-[12px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[13px] font-extrabold inline-flex items-center justify-center gap-1.5" data-testid="agent-a5-open"><ExternalLink size={14} />{tr("Open the listing")}</button>
        </div> : <p className="m-0 text-[12.5px] c-sub" dir="auto" data-testid="agent-a5-wait">{a && a.below ? T("Watching for under {p}", { p: money(a.below, cur) }) : c.price ? c.price : tr("Nothing found yet — it keeps checking.")}</p>}
      </section>; })}
  </div>;
}
function WhatsNew({ changes, cards, openBest, openChat }) {
  const cur = (a) => a.currency || "";
  const quiet = cards.filter((c) => !changes.some((x) => x.id === c.id));
  return <div className="space-y-3" data-testid="agents-new">
    <section className={U.card + " p-3.5 space-y-2"} style={{ borderColor: changes.length ? "var(--c-pos)" : undefined }} data-testid="agents-changes">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase" style={{ color: changes.length ? "var(--c-pos)" : "var(--c-mut)" }}>{T("New since yesterday · {n}", { n: changes.length })}</p>
      {!changes.length ? <p className="m-0 text-[13.5px] c-sub" data-testid="agents-changes-none">{tr("Nothing new since yesterday — your agents keep checking.")}</p> : null}
      {changes.map((x) => { const a = x.a, o = { name: x.name || "", price: x.price, href: x.href, site: a.site, url: a.url, currency: cur(a) };
        return <div key={x.id} className="flex items-center gap-2.5 py-1.5 border-t first:border-t-0 border-[var(--c-ln)]" data-testid="agents-change">
          <SiteMark site={a.site || a.url || ""} size={36} />
          <button onClick={() => openChat({ id: a.id })} className="flex-1 min-w-0 text-start">
            <b className="block text-[14px] leading-tight truncate" dir="auto">{x.name || a.title || a.what}</b>
            <span className="block text-[12px] c-sub truncate" dir="auto">{tr(CHANGE_LINE[x.kind])}{x.was ? " · " + T("was {p}", { p: money(x.was, cur(a)) }) : ""}</span></button>
          <span className="text-end shrink-0"><b className={"block text-[14px] tabular-nums " + (x.kind === "rise" ? "c-neg" : x.kind === "needs" ? "" : "c-pos")}>{money(x.price, cur(a))}</b>
            {x.kind !== "needs" ? <button onClick={() => openBest(a, o)} className="text-[12px] font-extrabold c-acc min-h-[32px]" data-testid="agents-change-open">{tr("Open the listing")}</button>
              : <button onClick={() => openChat({ id: a.id })} className="text-[12px] font-extrabold c-acc min-h-[32px]" data-testid="agents-change-ok">{tr("Look")}</button>}</span></div>; })}
    </section>
    {quiet.length ? <section className={U.card + " p-3.5"} data-testid="agents-quiet">
      <p className="m-0 mb-1 text-[12px] font-extrabold tracking-[0.06em] uppercase c-sub">{T("Watching · {n}", { n: quiet.length })}</p>
      {quiet.map((c) => <button key={c.id} onClick={() => openChat(c)} className="w-full flex items-center gap-2.5 py-2 border-t first:border-t-0 border-[var(--c-ln)] text-start min-h-[48px]" data-testid="agents-row">
        {c.site ? <SiteMark site={c.site} size={28} /> : <span className="w-7 h-7 rounded-[9px] bg-[var(--c-soft)] c-acc grid place-items-center shrink-0">{React.createElement(KIND_ICON[c.kind] || AppWindow, { size: 15 })}</span>}
        <span className="flex-1 min-w-0"><b className="block text-[13.5px] truncate" dir="auto">{c.title}</b>
          <span className="block text-[11.5px] c-sub truncate">{tr(c.st === "done" ? "Done" : c.st === "paused" ? "Paused" : c.st === "needs" ? "Needs you" : "Watching")}{c.price ? " · " + c.price : ""}</span></span>
        <ChevronRight size={16} className="c-sub shrink-0 rtl:-scale-x-100" /></button>)}
    </section> : null}
  </div>;
}

/* ---- v9.2 (Ali picked 2A: one pattern for every agent; "make sure that the hotel photos or at least a logo instead of the word
   booking.com"; "I can interact with the agents and set any rules I want and it understands") --------------------------------------- */
/** A site's mark, drawn by Attune in the brand's colours (never a picture fetched from the internet, never just the word). */
export function SiteMark({ site, size = 40, testid = "site-mark" }) {
  const [name, mark, bg, ink] = R.brandOf(site);
  return <span className="shrink-0 grid place-items-center font-black tracking-tight" title={name} aria-label={name} data-testid={testid}
    style={{ width: size, height: size, borderRadius: size * 0.3, background: bg, color: ink, fontSize: Math.round(size * (mark.length > 2 ? 0.3 : 0.42)), boxShadow: "inset 0 0 0 1px rgba(0,0,0,.06)" }}>{mark}</span>;
}
/** v9.2 round 3 (Ali, 5 Nov: "the agents page is not ideal nor consistent"): ONE header for every card on the page — agents, Scout
 *  goals and message alerts: the site's mark (or the kind's icon), the name, one line of what it is doing, its status, and ⋯. */
/** The offer an agent would open: the best one that follows its rules, else what it found. */
const bestOfferOf = (a) => { const k = R.applyRules(a.best3 || [], a.rules).filter((o) => o && o.price > 0).sort((x, y) => x.price - y.price);
  return k[0] || (a.found && (a.found.href || a.found.name) ? a.found : null); };
function CardHead({ site, kind, title, line, status, menu = [] }) {
  const [open, setOpen] = useState(false);
  const [label, tone] = R.STATUS[status] || R.STATUS.working;
  return <div className="flex gap-3 items-start" data-testid="agent-head">
    {site ? <SiteMark site={site} /> : <Ico k={kind} />}
    <div className="min-w-0 flex-1"><p className="m-0 font-extrabold text-[14.5px] leading-snug" dir="auto">{title}</p>
      {line ? <p className="m-0 text-[12.5px] c-sub leading-snug" dir="auto" data-testid="agent-line">{line}</p> : null}</div>
    <span className={U.tag(tone) + " shrink-0 mt-0.5"} data-testid="agent-status">{tr(label)}</span>
    {menu.length ? <span className="relative shrink-0"><button onClick={() => setOpen(!open)} aria-label={tr("More")} aria-expanded={open} className="w-9 h-9 -mt-1 rounded-full grid place-items-center c-sub hover:bg-[var(--c-soft)]" data-testid="agent-menu"><Ellipsis size={18} /></button>
      {open ? <span className={U.card + " absolute end-0 top-9 z-30 w-[210px] p-1.5 flex flex-col"} role="menu" onClick={() => setOpen(false)}>
        {menu.map(([l, fn, id, danger]) => <button key={id} onClick={fn} className={"min-h-[44px] px-3 rounded-[10px] text-start text-[14px] font-bold hover:bg-[var(--c-soft)] " + (danger ? "text-[var(--c-neg)]" : "")} data-testid={id}>{l}</button>)}
      </span> : null}</span> : <span className="w-9 shrink-0" />}
  </div>;
}
/** ONE button row for every card: the main action filled, at most one more outlined — the rest live in ⋯. */
function CardActions({ primary, secondary }) {
  const base = "min-h-[44px] px-4 rounded-[14px] text-[13.5px] font-extrabold inline-flex items-center justify-center gap-1.5";
  const B = (x, main) => x ? <button onClick={x.onClick} disabled={!!x.busy} className={base + (main ? " bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] flex-1" : " border border-[var(--c-ln)] bg-[var(--c-surf)] flex-1")} data-testid={x.testid}>
    {x.icon ? React.createElement(x.icon, { size: 15, className: x.busy ? "animate-spin" : "" }) : null}<span className="truncate">{x.label}</span></button> : null;
  return <div className="flex gap-2 pt-0.5" data-testid="agent-actions">{B(primary, true)}{B(secondary, false)}</div>;
}
const siteOfAgent = (a) => (a.kind === "watch" || a.kind === "buy") && a.site && !/^\d+ (stores|sites)$/.test(a.site) ? a.site : a.kind === "track" || a.kind === "order" ? (a.app && a.app.label) || "" : "";
/** The header of an agent: CardHead with its status and ⋯ (Rules · Open the site · Pause · Delete). */
function AgentHead({ a, kind, title, line, toggle, remove, onRules, status, extra = [] }) {
  const menu = [...(onRules ? [[tr("Rules"), onRules, "agent-rules-open"]] : []), ...extra, [a.on ? tr("Pause") : tr("Resume"), () => toggle(a), "agent-toggle"], [tr("Delete"), () => remove(a), "agent-delete", true]];
  return <CardHead site={siteOfAgent(a)} kind={kind} title={title} line={line} status={status || R.agentStatus(a)} menu={menu} />;
}
const RULE_HINT = { watch: ["only 4 stars", "walking under 500 m", "with breakfast", "check every 6 hours"], buy: ["new only", "not noon", "under 8,000"],
  flight: ["direct only", "1 bag", "morning", "EgyptAir only"], follow: ["check every day"] };
/** The agent's rules: chips (× removes one) and a box to tell it a new one in plain words — code reads it, else the phone's model. */
function AgentRules({ a, setRules, understand, flash, open, setOpen }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [said, setSaid] = useState("");
  const chips = R.ruleChips(a.rules || {});
  if (!chips.length && !open) return null;
  const add = async (t0) => {
    const t = String(t0 || text).trim(); if (!t || busy) return;
    let got = R.parseRule(t);
    if (!got && understand) { setBusy(true); try { got = R.cleanRules((await understand(t)) || {}); if (!Object.keys(got).length) got = null; } catch (e) { got = null; } setBusy(false); }
    if (!got) { setSaid(tr("I didn't understand that rule — try one of the examples.")); return; }
    setRules(a, R.mergeRules(a.rules || {}, got)); setText("");
    setSaid(T("Got it: {r}", { r: R.ruleChips(got).map((c) => tr(c.en, c.v)).join(" · ") }));
  };
  const hints = RULE_HINT[a.fields && a.fields.flight ? "flight" : a.kind] || RULE_HINT.watch;
  return <div className="rounded-[16px] bg-[var(--c-soft)] p-2.5 space-y-2" data-testid="agent-rules">
    {chips.length ? <div className="flex flex-wrap gap-1.5">{chips.map((c, k) => <button key={k} onClick={() => setRules(a, R.dropRule(a.rules, c.key, c.val))} aria-label={tr("Remove")}
      className="min-h-[32px] px-2.5 rounded-full bg-[var(--c-surf)] border border-[var(--c-acc)] text-[12.5px] font-extrabold text-[var(--c-acc)] inline-flex items-center gap-1" data-testid="agent-rule-chip">{tr(c.en, c.v)}<X size={12} /></button>)}
      {!open ? <button onClick={() => setOpen(true)} className="min-h-[32px] px-2.5 rounded-full border border-dashed border-[var(--c-acc)] text-[12.5px] font-extrabold text-[var(--c-acc)]" data-testid="agent-rule-more">+ {tr("Rule")}</button> : null}</div> : null}
    {open ? <>
      <form onSubmit={(e) => { e.preventDefault(); add(); }} className="flex gap-2">
        <input autoFocus value={text} onChange={(e) => setText(e.target.value)} dir="auto" className={U.inp + " flex-1"} placeholder={tr("Tell this agent a rule…")} data-testid="agent-rule-input" />
        <button disabled={busy || !text.trim()} className={U.btnS} aria-label={tr("Send")} data-testid="agent-rule-go">{busy ? "…" : <Send size={15} className="rtl:-scale-x-100" />}</button></form>
      <div className="flex flex-wrap gap-1.5">{hints.map((h) => <button key={h} onClick={() => add(tr(h))} className="min-h-[30px] px-2.5 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[12px] font-bold">{tr(h)}</button>)}</div>
    </> : null}
    {said ? <p className="m-0 text-[12.5px] font-bold" data-testid="agent-rule-said">{said}</p> : null}
  </div>;
}

function Ico({ k }) { return <span className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0">{React.createElement(KIND_ICON[k] || AppWindow, { size: 18 })}</span>; }

/** v8.6 a buy agent: its plan, what it found, and the person's decision (Order it / Not this one) — nothing is bought without it. */
function BuyCard({ a, busy, buyRound, confirmBuy, notThis, markDone, remove, toggle, openApp, openBest, setRules, understand, flash }) {
  const [ro, setRo] = useState(false);
  const small = "min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold inline-flex items-center gap-1.5 border border-[var(--c-ln)]";
  const p = a.pending, last = [...(a.checks || [])].reverse()[0];
  return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-buy">
    <AgentHead a={a} kind="buy" title={a.said || a.what} toggle={toggle} remove={remove} onRules={() => setRo(true)} />
    <div className="min-w-0">
      {a.said ? <p className="m-0 text-[12px] c-sub" dir="auto" data-testid="agent-searching-as">{T("Searching the stores as: {q}", { q: a.what })}</p> : null}
      <p className="m-0 text-[12.5px] c-sub" dir="auto">{a.site}{a.below > 0 ? " · " + T("under {p}", { p: money(a.below, a.currency) }) : ""}{last ? " · " + T("checked {t}", { t: ago(last.at) }) : ""}</p>
      <div className="mt-2 space-y-0.5" data-testid="agent-buy-plan">{A.buySteps(a).map((s, k) => <p key={k} className="m-0 text-[12px] flex items-center gap-1.5"><span className={s.done ? "text-[var(--c-acc)] font-black" : "c-sub"}>{s.done ? "✓" : "⏳"}</span><span className={s.done ? "" : "c-sub"}>{T(s.en, s.v)}</span></p>)}</div>
    </div>
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={ro} setOpen={setRo} />
    {p && a.step !== "ordered" ? <div className="rounded-[20px] border-2 border-[var(--c-acc)] p-3 space-y-2" data-testid="agent-buy-confirm">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-acc)]">{tr("Found it — do you want it?")}</p>
      <div className="flex items-start gap-2"><p className="m-0 flex-1 min-w-0 text-[14px] font-extrabold" dir="auto">{p.name}</p><b className="tabular-nums text-[15px] shrink-0">{money(p.price, p.currency)}</b></div>
      <p className="m-0 text-[11.5px] c-sub" dir="auto">{p.site}{p.text && p.text !== p.name ? " · " + p.text.replace(p.name, "").slice(0, 100) : ""}</p>
      <div className="flex gap-1.5 flex-wrap"><button onClick={() => confirmBuy(a)} className={small + " bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] border-transparent"} data-testid="agent-buy-yes"><Check size={14} />{tr("Order it")}</button>
        <button onClick={() => notThis(a)} className={small} data-testid="agent-buy-no">{tr("Not this one")}</button></div>
      <p className="m-0 text-[11px] c-sub">{tr("Order it opens the product, presses Buy now and fills your details. You check and pay — Attune never pays.")}</p>
    </div> : null}
    {R.applyRules(a.best3 || [], a.rules).length > 1 && a.step !== "ordered" ? <DealBoard a={{ ...a, best3: R.applyRules(a.best3, a.rules) }} openBest={openBest} skipBest={null} bars /> : null}
    {!p && a.nearest ? <p className="m-0 text-[12px] c-sub" dir="auto" data-testid="agent-buy-nearest">{T("Closest so far: {n} — {p}", { n: a.nearest.name || a.what, p: money(a.nearest.price, a.currency) })}</p> : null}
    {a.step === "ordered" ? <span className={U.tag("amber")} data-testid="agent-buy-ordered">{tr("Ordered — at checkout")}</span> : null}
    {/* v9.2 round 3: the same button row as every card (with a find waiting, "Order it" above is the main action) */}
    {a.step !== "ordered" ? (p ? <CardActions secondary={{ label: tr("Look again"), icon: RefreshCw, onClick: () => buyRound(a), busy, testid: "agent-buy-search" }} />
        : <CardActions primary={{ label: tr("Search now"), icon: RefreshCw, onClick: () => buyRound(a), busy, testid: "agent-buy-search" }} />)
      : <CardActions primary={{ label: tr("Done"), icon: Check, onClick: () => markDone(a), testid: "agent-buy-done" }} />}
    {a.what ? <LookToo a={a} openApp={openApp} /> : null}
  </div>;
}

/** v9.0 a follow agent: the topic, how often, the last and next report, Read now. */
/** v9.8: a research agent's report, kept on the agent — "researching…" while it runs, then the report (short, Read all, sources). */
function ReportBox({ a }) {
  const [all, setAll] = useState(false);
  if (a.researching && Date.now() - a.researching < 20 * 60000) return <p className="m-0 text-[12.5px] c-acc flex items-center gap-1.5" data-testid="agent-researching"><RefreshCw size={13} className="animate-spin" />{tr("Researching — you can leave Attune; a notification says when it's ready")}</p>;
  if (!a.report || !a.report.text) return null;
  const t = a.report.text, long = t.length > 420;
  return <div className="rounded-[14px] bg-[var(--c-bg)] border border-[var(--c-ln)] p-3 space-y-1.5" data-testid="agent-report">
    <p className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.05em] c-sub">{T("Report · {d}", { d: new Date(a.report.at).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }) })}</p>
    <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words" dir="auto" data-testid="agent-report-text">{(all || !long ? t : t.slice(0, 420) + "…").replace(/^#{1,6}\s*/gm, "").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/^\s*[-*]\s+/gm, "• ")}</div>
    {long ? <button onClick={() => setAll(!all)} className="text-[12.5px] font-extrabold c-acc min-h-[32px]" data-testid="agent-report-all">{all ? tr("Show less") : tr("Read all")}</button> : null}
    {all && (a.report.sources || []).length ? <ul className="m-0 ps-4 text-[12px] c-sub space-y-0.5">{a.report.sources.map((x, i) => <li key={i} className="truncate" dir="auto">{x.title || x.url}</li>)}</ul> : null}
  </div>;
}
function FollowCard({ a, runFollow, remove, toggle, setRules, understand, flash }) {
  const [ro, setRo] = useState(false);
  const small = "min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold inline-flex items-center gap-1.5 border border-[var(--c-ln)]";
  const last = (a.runs || []).slice(-1)[0], when = (t) => new Date(t).toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
  return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-follow">
    <AgentHead a={a} kind="follow" title={a.topic} toggle={toggle} remove={remove} onRules={() => setRo(true)} />
    <div className="min-w-0">
      <p className="m-0 text-[12.5px] c-sub">{a.once ? tr("One research · several sources") : tr(a.every === "day" ? "Every day" : a.every === "month" ? "Every month" : "Every week") + " · " + tr("several sources, what's new since the last report")}</p>
      {a.once ? null : <p className="m-0 text-[12px] c-sub" data-testid="agent-follow-when">{last ? T("Last report {d}", { d: when(last) }) + " · " : ""}{a.on ? T("Next {d}", { d: when(a.next) }) : tr("Paused")}</p>}</div>
    <ReportBox a={a} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={ro} setOpen={setRo} />
    <CardActions primary={{ label: a.report ? tr("Research again") : tr("Research now"), icon: BookOpen, onClick: () => runFollow(a), testid: "agent-follow-run" }} />
  </div>;
}

/** v9.0 (Ali: "Google, Facebook … everywhere"): the places that need a real browser or a login — one tap opens each, searched. */
function LookToo({ a, openApp }) {
  const country = (a.currency === "SAR" ? "SA" : a.currency === "AED" ? "AE" : a.currency === "EGP" ? "EG" : "");
  return <div className="flex flex-wrap items-center gap-1.5" data-testid="agent-look">
    <span className="text-[11.5px] c-sub">{a.stores ? T("Searched {n} places", { n: a.stores }) + " · " : ""}{tr("Look yourself too:")}</span>
    {lookLinks(a.q || a.what, country).map((l) => <button key={l.label} onClick={() => openApp && openApp({ pkg: "", label: l.label, web: l.url }, l.url)} className="min-h-[34px] px-2.5 rounded-[10px] text-[11.5px] font-extrabold border border-[var(--c-ln)] inline-flex items-center gap-1" data-testid="agent-look-link"><ExternalLink size={12} />{l.label}</button>)}
  </div>;
}

/** v9.0 (Ali picked "A and B in a smart way" for the results): the best deal big — the cheapest REAL store, how far under (or
 *  over) the limit, Open the listing — then every store as a bar against the limit line, each row opening its own listing. A
 *  cheaper deal from a Facebook post or an unknown shop is shown under the winner as "check the seller first". bars = the list only
 *  (a buy agent: its own "Found it" box is the winner). */
function DealBoard({ a, openBest, skipBest, bars = false }) {
  const b = A.dealBoard(a.best3, a.below || 0); if (!b) return null;
  const w = b.best, cur = a.currency || w.currency || "", n = (v) => Math.round(v).toLocaleString("en-US");
  return <div className="space-y-2.5" data-testid="agent-deal">
    {!bars ? <div className="rounded-[18px] border-2 border-[var(--c-acc)] px-3.5 py-3 space-y-1.5" data-testid="agent-deal-best">
      <p className="m-0 text-[11.5px] font-extrabold tracking-[0.07em] uppercase text-[var(--c-acc)]">{tr("Best deal now")}</p>
      <div className="flex items-baseline justify-between gap-2 flex-wrap"><b className="text-[24px] font-black tabular-nums text-[var(--c-acc)]">{money(w.price, cur)}</b>
        {b.gap != null ? <span className={U.tag(b.gap >= 0 ? "green" : "amber")} data-testid="agent-deal-gap">{b.gap >= 0 ? T("{a} under your limit", { a: n(b.gap) }) : T("{a} over your limit", { a: n(-b.gap) })}</span> : null}</div>
      <p className="m-0 text-[12.5px]" dir="auto"><b>{A.siteOfOffer(w)}</b>{w.name ? " · " + String(w.name).slice(0, 90) : ""}{w.rating ? " · ★ " + w.rating : ""}</p>
      <div className="flex gap-1.5 flex-wrap"><button onClick={() => openBest(a, w)} className="min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold inline-flex items-center gap-1.5 bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" data-testid="agent-deal-open"><ExternalLink size={14} />{tr("Open the listing")}</button>
        {skipBest ? <button onClick={() => skipBest(a, w)} className="min-h-[40px] px-3.5 rounded-[12px] text-[13px] font-extrabold border border-[var(--c-ln)]" data-testid="agent-deal-skip">{tr("Not this one")}</button> : null}</div>
      {b.cheaper ? <button onClick={() => openBest(a, b.cheaper.o)} className="w-full text-start text-[12px] rounded-[10px] px-2.5 py-2 bg-[var(--c-soft)]" dir="auto" data-testid="agent-deal-cheaper">
        {T("Cheaper on {site}: {p} — check the seller first", { site: A.siteOfOffer(b.cheaper.o), p: money(b.cheaper.o.price, cur) })}</button> : null}
    </div> : null}
    {b.bars ? <div className="space-y-1.5" data-testid="agent-deal-bars">
      <div className="flex gap-3 flex-wrap text-[11.5px] c-sub"><span className="inline-flex items-center gap-1"><i className="inline-block w-2.5 h-2.5 rounded-[3px] bg-[var(--c-acc)]" />{tr("cheapest")}</span>
        {b.limitPct != null ? <span className="inline-flex items-center gap-1"><i className="inline-block w-0.5 h-3 bg-[#B7791F]" />{T("your limit {p}", { p: n(a.below) })}</span> : null}
        {b.under != null ? <span>{T("{n} under your limit", { n: b.under })}</span> : null}</div>
      {b.rows.map((r, k) => <button key={k} onClick={() => openBest(a, r.o)} className="w-full grid grid-cols-[76px_1fr_auto] items-center gap-2 text-start min-h-[34px]" aria-label={T("Open {app}", { app: A.siteOfOffer(r.o) }) + " · " + money(r.o.price, cur)} data-testid="agent-deal-row">
        <span className="text-[12.5px] font-bold truncate" dir="auto">{A.siteOfOffer(r.o)}{r.unsure ? " ⚠" : ""}</span>
        <span className="relative h-[20px] rounded-[7px] bg-[var(--c-soft)] overflow-hidden"><span className={"absolute inset-y-0 start-0 rounded-[7px] " + (r.best ? "bg-[var(--c-acc)]" : "bg-[var(--c-acc)] opacity-35")} style={{ width: r.pct + "%" }} />
          {b.limitPct != null ? <span className="absolute -inset-y-0.5 w-0.5 bg-[#B7791F]" style={{ insetInlineStart: b.limitPct + "%" }} /> : null}</span>
        <span className="text-end tabular-nums text-[12.5px]"><b>{n(r.o.price)}</b>{r.diff ? <span className="block text-[10.5px] c-sub" dir="ltr">+{n(r.diff)}</span> : null}</span>
      </button>)}
      <p className="m-0 text-[11px] c-sub">{tr("Tap a store to open its listing")}</p>
    </div> : null}
  </div>;
}

/** v8.7 (Ali picked "A and B in a smart way"): the winner big, with why it wins; under it the others, each saying what it trades
 *  ("+2,100 · rated 9.4"); and "Compare side by side" opens them as a table, the best of each row in green. */
const RF = (a) => R.withRuleFound(a).found;   // v9.9.4: "found" follows the agent's rules
function BestFound({ a, small, openBest, skipBest }) {
  const [table, setTable] = useState(false);
  const c = A.compareOffers(a.best3, { below: a.below || 0 }), w = c.rows[0];
  const far = (d) => (d == null ? "—" : d >= 1000 ? (d / 1000).toFixed(1) + " km" : d + " m");
  const day = (o) => (o.checkin ? dWords(o.checkin) + (o.checkout ? " → " + dWords(o.checkout) : "") : "—");   // v9.9.19: words, not 01/08
  const tv = (x) => (x[1].a != null ? { a: Math.round(x[1].a).toLocaleString("en-US") } : x[1]);
  const green = "text-[var(--c-acc)] font-black";
  // v9.2 (Ali, 4 Nov: "agents still look like that" — blurred boxes, every hotel named "Booking.com"): offers read before the hotel
  // names and photos were read keep the old look until the next check — say so, so it is never taken for how it should look
  const stale = (a.best3 || []).length > 0 && a.best3.every((o) => !o.photo && R.isSiteName(o.name, a.site));
  return <div className="space-y-2" data-testid="agent-best3">
    {stale ? <p className="m-0 text-[12.5px] font-bold text-[var(--c-warn)]" data-testid="agent-stale">{tr("These offers were read before Attune could read the hotel names and photos — tap Check now to get them.")}</p> : null}
    <div className="flex items-baseline justify-between gap-2"><p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase c-sub">{tr("Best found")}</p>
      {c.rows.length > 1 ? <button onClick={() => setTable(!table)} className="text-[12.5px] font-extrabold text-[var(--c-acc)] min-h-[36px]" data-testid="agent-compare" aria-expanded={table}>{table ? tr("Hide the table") : tr("Compare side by side")}</button> : null}</div>
    {table ? <div className="overflow-x-auto rounded-[12px] border border-[var(--c-ln)]" data-testid="agent-compare-table">
      <table className="w-full text-[12px] border-collapse">
        <thead><tr><th className="text-start px-2 py-1.5"></th>{c.rows.map((r, k) => <th key={k} className="px-2 py-1.5 text-end font-extrabold max-w-[110px] truncate" dir="auto" data-testid="agent-compare-name">{offerName(r.o, a, k)}</th>)}</tr></thead>
        <tbody>{[["Total", (r) => r.o.price, (v) => money(v), "price"], ["A night", (r) => r.f.perNight, (v) => (v == null ? "—" : money(v)), "perNight"], ["Days", (r) => r.o, day, null],
          ["Walk", (r) => r.f.dist, far, "dist"], ["Rating", (r) => r.f.rating, (v) => (v == null ? "—" : v), "rating"]].filter(([l, get]) => l !== "A night" || c.rows.some((r) => r.f.perNight)).filter(([l, get]) => !["Walk", "Rating"].includes(l) || c.rows.some((r) => get(r) != null))
          .map(([l, get, show, key]) => <tr key={l} className="border-t border-[var(--c-ln)]"><td className="px-2 py-1.5 font-bold c-sub">{tr(l)}</td>
            {c.rows.map((r, k) => <td key={k} className={"px-2 py-1.5 text-end tabular-nums " + (key && get(r) != null && get(r) === c.best[key] ? green : "")}>{show(get(r))}</td>)}</tr>)}
          <tr className="border-t border-[var(--c-ln)]"><td></td>{c.rows.map((r, k) => <td key={k} className="px-2 py-1.5 text-end"><button onClick={() => openBest(a, r.o)} className="text-[12px] font-extrabold text-[var(--c-acc)] min-h-[32px]" data-testid="agent-compare-open">{tr("Open")}</button></td>)}</tr></tbody>
      </table></div>
    : <Podium a={a} c={c} far={far} day={day} tv={tv} openBest={openBest} skipBest={skipBest} />}
  </div>;
}

/** v9.1 (Ali, 3 Nov: the podium "looks like a cartoon … I want it much more visually appealing"; of 4 mock-ups he picked option 4,
 *  "A + C together"): the cheapest hotel big — its photo with a frosted-glass panel (name, days, walk, price, Book) — and the next
 *  ones as photo cards scrolling sideways; a tap on any of them opens it full screen like a story, with ‹ Book this offer › to go
 *  through all of them (and a swipe). No emojis, no medals; Booking opens only on Book. */
/** The shopping / booking apps whose links open inside the app itself (Android app links). */
const APP_OF = [[/(^|\.)booking\.com\//, "com.booking"], [/(^|\.)airbnb\.[a-z.]+\//, "com.airbnb.android"], [/(^|\.)amazon\.[a-z.]+\//, "com.amazon.mShop.android.shopping"],
  [/(^|\.)noon\.com\//, "com.noon.buyerapp"], [/(^|\.)jumia\.[a-z.]+\//, "com.jumia.android"]];
const glass = "bg-[rgba(16,18,19,.55)] backdrop-blur-xl border border-[rgba(255,255,255,.12)] text-[#fff]";
const pill = "text-[11px] font-semibold px-2.5 py-1 rounded-full " + glass;
// no photo yet (offline, or the site had none): a calm blurred colour field, its colours from the hotel's name — never an emoji
const tint = (s) => { let h = 0; for (const ch of String(s || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const a = h % 360, b = (a + 40) % 360;
  return { background: `radial-gradient(120% 90% at 20% 30%, hsl(${a} 30% 52%) 0%, transparent 60%), radial-gradient(100% 80% at 85% 75%, hsl(${b} 28% 36%) 0%, transparent 65%), hsl(${a} 18% 20%)` }; };
/** v9.2: an offer's own name — never just the website's ("Booking.com"): the first words of what the card said, else "Offer n". */
const textName = (o, a) => { if (!R.isSiteName(o.name, a.site)) return o.name;
  const t = String(o.text || "").split(/\s[·|•]\s|\n|(?=\s(?:EGP|SAR|AED|USD|€|\$)\s?\d)|\s\d[\d,.]{3,}/)[0].trim();
  return t && t.length >= 4 && !R.isSiteName(t, a.site) && !/^\d/.test(t) ? t.slice(0, 60) : ""; };
const offerName = (o, a, k = 0) => textName(o, a) || T("Offer {i}", { i: k + 1 });
function Podium({ a, c, far, day, tv, openBest, skipBest }) {
  const inChat = React.useContext(InChat);
  const [at, setAt] = useState(-1);
  const photos = useMemo(() => A.loadPhotos(a.id), [a.id, a.best3]);
  // v9.4 (Ali, 5 Nov: "Offer 3" on a blurred card, "very bad and confusing and does not open on the specific listing"): only an offer
  // the agent knows by its own name or page is a story; one read without them is a plain row — its days and price — whose button
  // says honestly what it opens (the site's hotels for those days), never "Book this offer"
  const named = (o) => !!(o.href && /^https:\/\//.test(o.href)) || !!textName(o, a);
  const rows = c.rows.filter((r) => named(r.o)), bare = c.rows.filter((r) => !named(r.o)), n = (v) => Math.round(v).toLocaleString("en-US");
  if (!rows.length) return <DateRows a={a} rows={bare} day={day} openBest={openBest} title="Cheapest dates" />;
  const w = rows[0];
  // v9.2 (Ali: "the hotel photos, or at least a logo instead of the word booking.com"): no photo → the site's own mark on the calm colour field
  const pic = (o, cls) => (photos[o.key] ? <img src={photos[o.key]} alt="" className={cls + " object-cover"} />
    : <span className={cls + " grid place-items-center"} style={tint(o.name)} aria-hidden="true" data-testid="agent-nophoto"><SiteMark site={o.site || o.href || a.url || a.site} size={cls.includes("inset-0") && !cls.includes("h-[112px]") ? 56 : 44} testid="agent-photo-mark" /></span>);
  const dates = a.tries && a.tries.length > 1 ? a.tries.length : 0, f = a.fields || {};
  return <div className="space-y-3" data-testid="agent-podium">
    <div className="flex items-end justify-between gap-2" data-testid="agent-podium-head"><div className="min-w-0">
      {f.city ? <p className="m-0 text-[10.5px] font-bold tracking-[0.16em] uppercase c-sub truncate" dir="auto">{String(f.city).split(",")[0]}{f.nights ? " · " + T("{n} nights", { n: f.nights }) : ""}</p> : null}
      <p className="m-0 text-[20px] font-extrabold tracking-[-0.02em]">{rows.length === 1 ? tr("The best offer") : T("{n} best offers", { n: rows.length })}</p></div>
      {dates ? <span className="text-[12px] c-sub shrink-0">{T("{n} dates checked", { n: dates })}</span> : null}</div>
    <div className="relative h-[300px] rounded-[26px] overflow-hidden" data-testid="agent-best">
      <button onClick={() => setAt(0)} className="absolute inset-0 w-full" aria-label={(w.o.name || a.site) + " · " + money(w.o.price, a.currency)} data-testid="agent-podium-open">{pic(w.o, "absolute inset-0 w-full h-full")}</button>
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,.25)] via-transparent to-[rgba(0,0,0,.5)]" />
      <div className="pointer-events-none absolute top-3 inset-x-3 flex justify-between gap-2"><span className="flex flex-wrap gap-1" data-testid="agent-why">{((A.compareOffers(rows.map((r) => r.o), { below: a.below || 0 }).why).length ? A.compareOffers(rows.map((r) => r.o), { below: a.below || 0 }).why : [["Cheapest", {}]]).slice(0, 2).map(([t, v], k) => <span key={k} className={pill}>{tr(t, v)}</span>)}</span>
        {w.f.rating != null ? <span className={pill + " shrink-0"}>★ {w.f.rating}</span> : null}</div>
      <div className={"absolute inset-x-2.5 bottom-2.5 rounded-[20px] px-4 py-3 " + glass}>
        <p className="m-0 text-[18px] font-bold tracking-[-0.01em] truncate" dir="auto" data-testid="agent-best-name">{offerName(w.o, a, 0)}</p>
        <p className="m-0 text-[12px] text-[rgba(255,255,255,.72)] truncate">{[w.o.checkin ? day(w.o) : "", w.f.dist != null ? T("{d} walk", { d: far(w.f.dist) }) : ""].filter(Boolean).join(" · ")}</p>
        <div className="flex items-center justify-between gap-2 mt-2"><div className="min-w-0"><b className="block text-[24px] font-bold tabular-nums tracking-[-0.02em] leading-tight">{money(w.o.price, a.currency)}</b>
          {w.f.perNight ? <span className="block text-[11.5px] text-[rgba(255,255,255,.68)] tabular-nums">{money(w.f.perNight, a.currency)} {tr("a night")}</span> : null}</div>
          <button onClick={() => openBest(a, w.o)} className="shrink-0 min-h-[44px] px-5 rounded-[14px] bg-[#F2F4F3] text-[#0B0D0E] text-[14px] font-bold" data-testid="agent-best-open">{tr("Book")}</button></div>
      </div>
    </div>
    {rows.length > 1 ? <>
      <div className="flex items-baseline justify-between px-0.5"><span className="text-[10.5px] font-bold tracking-[0.16em] uppercase c-sub">{tr("Next best")}</span>
        <button onClick={() => setAt(1)} className="text-[12.5px] font-bold text-[var(--c-acc)] min-h-[32px]" data-testid="agent-see-all">{tr("See all")}</button></div>
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-1 px-1 pb-1" style={{ scrollbarWidth: "none" }} data-testid="agent-more-list">
        {rows.slice(1).map((r, k) => <button key={k} onClick={() => setAt(k + 1)} className="snap-start shrink-0 w-[160px] text-start" data-testid="agent-more">
          <span className="relative block h-[112px] rounded-[18px] overflow-hidden">{pic(r.o, "absolute inset-0 w-full h-full")}<span className={pill + " absolute top-2 start-2"}>{k + 2}</span></span>
          <span className="block pt-2 px-0.5"><span className="block text-[13.5px] font-semibold truncate" dir="auto">{offerName(r.o, a, k + 1)}</span>
            <span className="block text-[11.5px] c-sub truncate">{[r.f.dist != null ? far(r.f.dist) : "", r.f.rating != null ? "★ " + r.f.rating : "", r.o.checkin && r.o.checkin !== w.o.checkin ? day(r.o) : ""].filter(Boolean).join(" · ")}</span>
            <span className="block text-[14.5px] font-bold tabular-nums mt-0.5">{money(r.o.price, a.currency)} <span className="text-[11px] font-medium c-sub" data-testid="agent-trade">+{n(r.o.price - w.o.price)}</span></span></span>
        </button>)}
      </div></> : null}
    {bare.length && !inChat ? <DateRows a={a} rows={bare} day={day} openBest={openBest} title="More dates" /> : null}
    {at >= 0 && rows[at] ? <OfferSheet a={a} rows={rows} at={at} setAt={setAt} pic={pic} far={far} day={day} n={n} openBest={openBest} skipBest={skipBest} /> : null}
  </div>;
}

/** v9.2 (Ali picked 3A: "make sure it's organised if I am seeing more than 1 option, and it gets the tickets from many places"): the
 *  answer first — the cheapest flight that follows the rules, big, with the sites it was on — then Cheapest · Fastest · Direct · Best
 *  time as tabs, the cheapest price of each day, then every other flight by price (one row per flight, however many sites showed it). */
function FlightBoard({ a, openBest }) {
  const f = (a.fields && a.fields.flight) || {};
  const g = useMemo(() => FL.organise(a.best3 || [], a.rules || {}, f), [a.best3, a.rules]);
  const [tab, setTab] = useState("cheapest");
  const [more, setMore] = useState(false);
  if (!g.rows.length) return <p className="m-0 text-[12.5px] font-bold text-[var(--c-warn)]" data-testid="agent-rules-none">{tr("No flight follows all your rules yet — the next check looks again.")}</p>;
  const TABS = [["cheapest", "Cheapest", g.cheapest], ["fastest", "Fastest", g.fastest], ["direct", "Direct", g.direct], ["bestTime", "Best time", g.bestTime]].filter(([, , r]) => r);
  const w = (TABS.find(([k]) => k === tab) || TABS[0])[2];
  const n = (v) => Math.round(v).toLocaleString("en-US");
  const stopsTxt = (x) => (x.stops === 0 ? tr("Direct") : x.stops === 1 ? tr("1 stop") : x.stops ? T("{n} stops", { n: x.stops }) : "");
  const dayTxt = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };
  const rest = g.rows.filter((r) => r !== w);
  return <div className="space-y-3" data-testid="flight-board">
    <div className="flex items-end justify-between gap-2"><p className="m-0 text-[18px] font-extrabold tracking-tight" data-testid="flight-count">{T("{n} flights", { n: g.rows.length })}</p>
      <span className="text-[12px] c-sub">{T("from {n} sites", { n: new Set((a.best3 || []).map((o) => o.site).filter(Boolean)).size })}{g.hidden ? " · " + T("{n} hidden by your rules", { n: g.hidden }) : ""}</span></div>
    {TABS.length > 1 ? <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${TABS.length}, minmax(0,1fr))` }} role="tablist" data-testid="flight-tabs">
      {TABS.map(([k, l, r]) => <button key={k} role="tab" aria-selected={w === r && tab === k} onClick={() => setTab(k)} data-testid={"flight-tab-" + k}
        className={"min-h-[52px] rounded-[14px] border px-2 py-1.5 text-start " + (tab === k ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)] bg-[var(--c-surf)]")}>
        <span className={"block text-[11.5px] font-extrabold " + (tab === k ? "c-acc" : "c-sub")}>{tr(l)}</span><b className="block text-[13.5px] tabular-nums">{n(r.o.price)}</b></button>)}</div> : null}
    {/* the answer */}
    <div className="rounded-[20px] border-2 border-[var(--c-acc)] p-3.5 space-y-2.5" data-testid="flight-best">
      <div className="flex items-center gap-2.5">{w.x.airline ? <SiteMark site={w.x.airline} size={36} /> : <Ico k="flight" />}
        <span className="min-w-0 flex-1"><b className="block text-[15px] truncate" dir="auto" data-testid="flight-best-airline">{w.x.airline || offerName(w.o, a, 0)}</b>
          <span className="block text-[12px] c-sub">{[w.x.date ? dayTxt(w.x.date) : f.depart ? dayTxt(f.depart) : "", stopsTxt(w.x), FL.fmtDur(w.x.dur)].filter(Boolean).join(" · ")}</span></span></div>
      {w.x.dep ? <div className="flex items-center justify-between gap-2" dir="ltr"><span><b className="block text-[20px] tabular-nums leading-none">{w.x.dep}</b><span className="text-[11.5px] c-sub">{f.from}</span></span>
        <span className="flex-1 h-px bg-[var(--c-ln)] mx-2 relative"><Plane size={14} className="absolute left-1/2 -translate-x-1/2 -top-[7px] c-sub bg-[var(--c-surf)]" /></span>
        <span className="text-end"><b className="block text-[20px] tabular-nums leading-none">{w.x.arr || "—"}</b><span className="text-[11.5px] c-sub">{f.to}</span></span></div> : null}
      <div className="flex items-end justify-between gap-2"><span className="min-w-0"><b className="block text-[24px] font-black tabular-nums leading-tight" data-testid="flight-best-price">{money(w.o.price, w.o.currency || a.currency)}</b>
        <span className="flex items-center gap-1 text-[11.5px] c-sub flex-wrap" data-testid="flight-best-sites">{w.sites.slice(0, 4).map((s) => <SiteMark key={s} site={s} size={18} />)}{w.sites.length > 1 ? T("on {n} sites — cheapest on {s}", { n: w.sites.length, s: w.sites[0] }) : w.sites[0] ? T("on {s}", { s: w.sites[0] }) : ""}</span></span>
        <button onClick={() => openBest(a, w.o)} className="shrink-0 min-h-[44px] px-5 rounded-[14px] bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))] text-[14px] font-extrabold" data-testid="flight-book">{tr("Book")}</button></div>
    </div>
    {(() => { const ad = FL.adviseBuy(a.checks, { depart: (w.o && w.o.depart) || f.depart || "" });   // v9.3 (Ali picked D3 A): buy now or wait — from its own checks
      return <div className="rounded-[16px] border border-[var(--c-ln)] p-3 space-y-1" data-testid="flight-advice" data-say={ad.say}>
        <p className="m-0 flex items-center justify-between gap-2"><b className={"text-[14.5px] " + (ad.say === "buy" ? "text-[var(--c-warn)]" : ad.say === "wait" ? "c-acc" : "")}>{ad.say === "buy" ? tr("Buy now") : ad.say === "wait" ? tr("Wait") : tr("Buy now or wait?")}</b>
          <span className="text-[11.5px] c-sub">{T("Confidence: {c}", { c: tr(ad.conf === "high" ? "high" : ad.conf === "medium" ? "medium" : "low") })} · {T("{n} checks", { n: ad.n })}</span></p>
        <p className="m-0 text-[12.5px] c-sub">{tr(ad.why)}{ad.low ? " · " + T("lowest seen {p}", { p: n(ad.low) }) : ""}</p></div>; })()}
    {f.window && g.days.length ? <p className="m-0 text-[11.5px] font-extrabold uppercase tracking-wide c-sub" data-testid="flight-days-label">{tr("Price by departure day")}</p> : null}
    {g.days.length > 1 || (f.window && g.days.length) ? <div className={f.window ? "grid grid-cols-4 gap-1.5" : "flex gap-1.5 overflow-x-auto pb-1"} data-testid="flight-days">{g.days.map((d) => { const lo = d.price === Math.min(...g.days.map((x) => x.price));
      return <span key={d.date} className={"shrink-0 min-w-[64px] rounded-[12px] border px-2 py-1.5 text-center " + (lo ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)]")} data-testid="flight-day">
        <span className="block text-[11px] font-bold c-sub">{dayTxt(d.date)}</span><b className={"block text-[12.5px] tabular-nums " + (lo ? "c-acc" : "")}>{n(d.price)}</b></span>; })}</div> : null}
    {rest.length ? <div className={U.card + " p-1.5"} data-testid="flight-list">
      {(more ? rest : rest.slice(0, 5)).map((r, k) => <button key={r.key} onClick={() => openBest(a, r.o)} className="w-full flex items-center gap-2.5 px-2 py-2.5 border-t border-[var(--c-ln)] first:border-t-0 text-start min-h-[56px]" data-testid="flight-row">
        {r.x.airline ? <SiteMark site={r.x.airline} size={30} /> : <Ico k="flight" />}
        <span className="min-w-0 flex-1"><b className="block text-[13.5px] truncate" dir="auto">{r.x.airline || offerName(r.o, a, k + 1)}{r.x.dep ? <span className="font-semibold c-sub tabular-nums" dir="ltr"> · {r.x.dep}{r.x.arr ? "–" + r.x.arr : ""}</span> : null}</b>
          <span className="block text-[11.5px] c-sub truncate">{[r.x.date ? dayTxt(r.x.date) : "", stopsTxt(r.x), FL.fmtDur(r.x.dur), r.sites.length > 1 ? T("{n} sites", { n: r.sites.length }) : r.sites[0] || ""].filter(Boolean).join(" · ")}</span></span>
        <span className="text-end shrink-0"><b className="block text-[14px] tabular-nums">{n(r.o.price)}</b><span className="text-[11px] c-sub tabular-nums">+{n(r.o.price - g.cheapest.o.price)}</span></span></button>)}
      {rest.length > 5 ? <button onClick={() => setMore(!more)} className="w-full min-h-[44px] text-[13px] font-extrabold c-acc" data-testid="flight-more">{more ? tr("Show fewer") : T("Show all {n}", { n: rest.length })}</button> : null}
    </div> : null}
  </div>;
}

/** One offer full screen, like a story: the photo, bars for where you are, name, days · walk · rating, price, ‹ Book this offer ›. */
/** v9.4: offers read without a hotel's name or page — a clear list of days and prices; the button opens the site for those days. */
function DateRows({ a, rows, day, openBest, title }) {
  const site = (R.brandOf(a.url || a.site) || [])[0] || a.site;
  return <div className="space-y-1.5" data-testid="agent-date-rows">
    <span className="block px-0.5 text-[10.5px] font-bold tracking-[0.16em] uppercase c-sub">{tr(title)}</span>
    {rows.map((r, k) => <div key={k} className="flex items-center gap-3 rounded-[16px] border border-[var(--c-ln)] px-3 py-2.5" data-testid="agent-date-row">
      <div className="min-w-0 flex-1"><p className="m-0 text-[14px] font-bold tabular-nums" dir="ltr">{r.o.checkin ? day(r.o) : site}</p>
        <p className="m-0 text-[12px] c-sub">{[r.f.nights ? T("{n} nights", { n: r.f.nights }) : "", k === 0 && title === "Cheapest dates" ? tr("Cheapest") : ""].filter(Boolean).join(" · ")}</p></div>
      <b className="shrink-0 tabular-nums text-[15px]">{money(r.o.price, a.currency)}</b>
      <button onClick={() => openBest(a, r.o)} className="shrink-0 min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" data-testid="agent-date-open">{T("Hotels on {site}", { site })}</button>
    </div>)}
  </div>;
}

function OfferSheet({ a, rows, at, setAt, pic, day, far, n, openBest, skipBest }) {
  const r = rows[at], w = rows[0], next = rows[at + 1];
  const go = (d) => setAt(Math.max(0, Math.min(rows.length - 1, at + d)));
  const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
  const [x0, setX0] = useState(null);
  useEffect(() => { const k = (e) => { if (e.key === "Escape") setAt(-1); if (e.key === "ArrowRight") go(rtl ? -1 : 1); if (e.key === "ArrowLeft") go(rtl ? 1 : -1); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [at, rows.length]);
  const sub = [r.o.checkin ? day(r.o) + (r.f.nights ? " · " + T("{n} nights", { n: r.f.nights }) : "") : "", r.f.dist != null ? T("{d} walk", { d: far(r.f.dist) }) : "", r.f.rating != null ? "★ " + r.f.rating : ""].filter(Boolean).join(" · ");
  const note = [r.f.perNight ? money(r.f.perNight, a.currency) + " " + tr("a night") : "", at === 0 ? (next ? T("{a} less than the next", { a: n(next.o.price - r.o.price) }) : "") : T("{a} more than the cheapest", { a: n(r.o.price - w.o.price) })].filter(Boolean).join(" · ");
  const side = "w-[52px] min-h-[52px] rounded-[16px] grid place-items-center disabled:opacity-30 " + glass;
  return <div className="fixed inset-0 z-[310] bg-[#000]" data-testid="agent-sheet" role="dialog" aria-modal="true"
    onTouchStart={(e) => setX0(e.touches[0].clientX)} onTouchEnd={(e) => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; setX0(null); if (Math.abs(dx) > 50) go((dx < 0) !== rtl ? 1 : -1); }}>
    <div className="absolute inset-0 sm:inset-y-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] sm:rounded-[28px] overflow-hidden">
      {pic(r.o, "absolute inset-0 w-full h-full")}
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.45),rgba(0,0,0,0)_22%,rgba(0,0,0,0)_45%,rgba(8,9,10,.93)_80%)]" />
      <div className="absolute top-0 inset-x-0 px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="flex gap-1">{rows.map((_, k) => <i key={k} className={"flex-1 h-[2.5px] rounded-full " + (k === at ? "bg-[#fff]" : k < at ? "bg-[rgba(255,255,255,.7)]" : "bg-[rgba(255,255,255,.3)]")} />)}</div>
        <div className="flex items-center justify-between mt-3"><span className={pill}>{T("Offer {i} of {n}", { i: at + 1, n: rows.length })}{at === 0 ? " · " + tr("Cheapest") : ""}</span>
          <button onClick={() => setAt(-1)} className={"w-10 h-10 rounded-full grid place-items-center " + glass} aria-label={tr("Close")} data-testid="agent-sheet-close"><X size={17} /></button></div>
      </div>
      <div className="absolute inset-x-0 bottom-0 px-5 pb-[max(18px,env(safe-area-inset-bottom))] text-[#fff]">
        <p className="m-0 text-[24px] font-bold tracking-[-0.02em] leading-tight" dir="auto" data-testid="agent-sheet-name">{offerName(r.o, a, at)}</p>
        {sub ? <p className="m-0 mt-1 text-[13px] text-[rgba(255,255,255,.72)]">{sub}</p> : null}
        <b className="block mt-4 text-[32px] font-bold tabular-nums tracking-[-0.02em] leading-none" data-testid="agent-sheet-price">{money(r.o.price, a.currency)}</b>
        {note ? <p className="m-0 mt-1.5 text-[12px] text-[rgba(255,255,255,.72)] tabular-nums">{note}</p> : null}
        <div className="grid grid-cols-[52px_1fr_52px] gap-2.5 mt-4">
          <button onClick={() => go(-1)} disabled={at === 0} className={side} aria-label={tr("Previous")} data-testid="agent-sheet-prev"><ChevronRight size={20} className="rotate-180 rtl:rotate-0" /></button>
          <button onClick={() => openBest(a, r.o)} className="min-h-[52px] rounded-[16px] bg-[#F2F4F3] text-[#0B0D0E] text-[15px] font-bold" data-testid="agent-sheet-book">{tr("Book this offer")}</button>
          <button onClick={() => go(1)} disabled={at >= rows.length - 1} className={side} aria-label={tr("Next")} data-testid="agent-sheet-next"><ChevronRight size={20} className="rtl:rotate-180" /></button>
        </div>
        <button onClick={() => { skipBest(a, r.o); setAt(-1); }} className="block mx-auto mt-2 min-h-[36px] px-3 text-[12.5px] text-[rgba(255,255,255,.62)]" data-testid="agent-sheet-skip">{tr("Not this one")}</button>
      </div>
    </div>
  </div>;
}

function AgentCard({ a, hits, busy, checkNow, orderNow, openApp, remove, toggle, openBest, skipBest, setRules, understand, flash }) {
  const small = "min-h-[40px] px-3 rounded-[12px] text-[12.5px] font-extrabold inline-flex items-center gap-1.5 border border-[var(--c-ln)]";
  const [ro, setRo] = useState(false);
  const ctl = null;   // v9.2: Pause / Delete live in the card's ⋯ menu (AgentHead)
  const rules = <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={ro} setOpen={setRo} />;
  if (a.kind === "watch") {
    const w = A.watchLine(a), last = [...(a.checks || [])].reverse()[0];
    return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-watch">
      <AgentHead a={a} kind={a.fields && a.fields.flight ? "flight" : "watch"} title={a.what && a.tries && a.tries.length && !a.tries[0].checkin ? a.said || a.what : a.title} toggle={toggle} remove={remove} onRules={() => setRo(true)}
        extra={a.url && !(a.tries && a.tries.length > 1 && !a.tries[0].checkin) ? [[T("Open {app}", { app: a.site }), () => openApp({ pkg: /booking\.com/.test(a.url) ? "com.booking" : /amazon\./.test(a.url) ? "com.amazon.mShop.android.shopping" : "", label: a.site, web: a.url }, a.url), "agent-open-site"]] : []} />
      <div className="flex gap-3 items-start"><div className="min-w-0 flex-1">
        {a.said ? <p className="m-0 text-[12px] c-sub" dir="auto" data-testid="agent-searching-as">{T("Searching the stores as: {q}", { q: a.what })}</p> : null}
        <p className="m-0 text-[12.5px] c-sub" dir="auto">{/^\d+ stores$/.test(a.site || "") ? T("{n} stores", { n: parseInt(a.site, 10) }) : /^\d+ sites$/.test(a.site || "") ? T("{n} sites", { n: parseInt(a.site, 10) }) : a.site}{a.below > 0 ? " · " + T("under {p}", { p: money(a.below, a.currency) }) : ""}{a.fields && a.fields.window ? " · " + T("{n} nights between {a} and {b}", { n: a.fields.nights, a: a.fields.window.from, b: a.fields.window.to }) : a.fields && a.fields.checkin ? " · " + a.fields.checkin + " → " + a.fields.checkout : ""}</p>
        <p className="m-0 text-[12.5px] c-sub" data-testid="agent-watch-last">{last ? (last.price ? T("Checked {t} · cheapest {p}", { t: ago(last.at), p: money(last.price, a.currency) }) + (last.checkin ? " (" + last.checkin + " → " + last.checkout + ")" : "") : T("Checked {t} · the site shows prices only in a browser — tap Check now", { t: ago(last.at) })) : tr("Not checked yet — tap Check now")}</p>
        {RF(a) ? <span className="flex flex-wrap items-center gap-1.5 mt-1.5"><span className={U.tag("amber")} data-testid="agent-found">{T("Found {p} — under your limit", { p: money(RF(a).price, a.currency) })}{RF(a).site ? " · " + RF(a).site : ""}</span>
            {RF(a).href && !(a.best3 || []).length ? <button onClick={() => openBest(a, { href: RF(a).href, name: RF(a).name })} className="min-h-[36px] px-2.5 rounded-[10px] text-[12px] font-extrabold inline-flex items-center gap-1 bg-[var(--c-btn,var(--c-acc))] text-[var(--c-on-btn,var(--c-on-acc))]" data-testid="agent-found-open"><ExternalLink size={13} />{tr("Open the listing")}</button> : null}</span>
          : null}
        {w.last && w.gap > 0 ? <span className="block text-[11.5px] c-sub mt-1">{T("{p} above your limit", { p: money(w.gap, a.currency) })}</span> : null}
        {/* v8.7 (persona 4, idea 4): its price over time, the lowest seen, and the cheapest weekday once there are 2 weeks of checks */}
        <PriceLine a={a} />
        {/* v8.2 (Ali picked 2A): its plan, step by step */}
        <div className="mt-2 space-y-0.5" data-testid="agent-plan">{A.planSteps(a).map((p, k) => <p key={k} className="m-0 text-[12px] flex items-center gap-1.5"><span className={p.done ? "text-[var(--c-acc)] font-black" : "c-sub"}>{p.done ? "✓" : "⏳"}</span><span className={p.done ? "" : "c-sub"}>{T(p.en, getLang() === "ar" && p.v && p.v.s ? { ...p.v, s: String(p.v.s).replace(/, /g, "، ") } : p.v)}</span></p>)}</div>
      </div></div>
      {rules}
      {/* v9.2: the offers that follow the agent's rules (stars, walk, sites, breakfast…) — agent-rules.js */}
      {(() => { if (a.fields && a.fields.flight) return (a.best3 || []).length ? <FlightBoard a={a} openBest={openBest} /> : null;   // v9.2: organise() applies the rules itself
        const kept = R.applyRules(a.best3 || [], a.rules), af = { ...a, best3: kept };
        if ((a.best3 || []).length && !kept.length) return <p className="m-0 text-[12.5px] font-bold text-[var(--c-warn)]" data-testid="agent-rules-none">{tr("No offer follows all your rules yet — the next check looks again.")}</p>;
        return kept.length ? ((kept[0] || {}).checkin ? <BestFound a={af} small={small} openBest={openBest} skipBest={skipBest} /> : <DealBoard a={af} openBest={openBest} skipBest={skipBest} />) : null; })()}
      {/* v9.2 round 3 (Ali: "when it opens Booking it doesn't open the specific listing"): the second button opens the BEST OFFER's own
          page (its link), not the site's search; the site itself is in ⋯ */}
      {(() => { const best = bestOfferOf(a);
        return <CardActions primary={{ label: tr("Check now"), icon: RefreshCw, onClick: () => checkNow(a), busy, testid: "agent-check" }}
          secondary={best ? { label: tr("Open the best offer"), icon: ExternalLink, onClick: () => openBest(a, best), testid: "agent-open" } : null} />; })()}
      {a.what ? <LookToo a={a} openApp={openApp} /> : null}
    </div>;
  }
  if (a.kind === "track") {
    const mine = hits.filter((h) => h.rule === "agent-" + a.id).slice(-1)[0];
    return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-track">
      <AgentHead a={a} kind="track" title={a.title} toggle={toggle} remove={remove} status={mine && a.on ? "found" : undefined}
        line={mine ? T("{app} said {t}: {m}", { app: a.app.label, t: ago(mine.ts), m: mine.text.slice(0, 90) }) : T("Reading {app}'s notifications — I tell you when it ships and when it arrives", { app: a.app.label })} />
      <CardActions primary={{ label: T("Open {app}", { app: a.app.label }), icon: ExternalLink, onClick: () => openApp(a.app, ""), testid: "agent-open" }} />
    </div>;
  }
  return <OrderCard a={a} toggle={toggle} remove={remove} orderNow={orderNow} />;
}
/** v9.5 (Ali: "when I press order my usual from Talabat it just opens Talabat home — it doesn't know my usual, so why didn't it
 *  ask"): with no usual saved the card asks for it (the place and the dish) before anything opens; Change edits it later. */
function OrderCard({ a, toggle, remove, orderNow }) {
  const [ed, setEd] = useState(a.what ? null : "");
  return <div className={U.cardPad + " space-y-2" + (a.on ? "" : " opacity-60")} data-testid="agent-order">
    <AgentHead a={a} kind="order" title={a.title} toggle={toggle} remove={remove} line={a.what || T("What is your usual from {app}?", { app: a.app.label })} />
    {ed != null ? <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (ed.trim()) { orderNow(a, ed); setEd(null); } }} data-testid="agent-order-ask">
      <p className="m-0 text-[13px] font-bold">{T("What is your usual from {app}?", { app: a.app.label })}</p>
      <input autoFocus value={ed} onChange={(e) => setEd(e.target.value)} dir="auto" className={U.inp} placeholder={tr("The place and the dish, e.g. Koshary Abou Tarek — large + rice pudding")} data-testid="agent-order-what" />
      <button type="submit" className={U.btnP + " w-full"} data-testid="agent-order-save">{T("Save and open {app}", { app: a.app.label })}</button>
    </form> : <>
      <p className="m-0 text-[11.5px] c-sub">{T("One tap opens {app} with your order copied — you press Order", { app: a.app.label })}</p>
      <CardActions primary={{ label: tr("Order now"), icon: Check, onClick: () => orderNow(a), testid: "agent-order-now" }} secondary={{ label: tr("Change"), icon: RefreshCw, onClick: () => setEd(a.what || ""), testid: "agent-order-change" }} />
    </>}
  </div>;
}

/** The Agents report: running, found and checks this week; every watch's checks. */
function AgentsReport({ st, scout, alerts, back }) {
  const r = A.agentsReport(st, scout, alerts);
  const KN = { buy: "Buy agents", watch: "Price watches", follow: "Topics followed", track: "Deliveries", order: "Usual orders", scout: "Scout goals", alert: "Message alerts" };
  return <div className="calm pt-1 pb-10 space-y-3 max-w-2xl" data-testid="agents-report">
    <div className="flex items-center gap-2"><button onClick={back} aria-label={tr("Back")} className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-surf)] border border-[var(--c-ln)]" data-testid="agents-report-back"><ArrowLeft size={17} className="rtl:-scale-x-100" /></button>
      <U.Head title={tr("Agents report")} sub={tr("What your agents did this week — on this phone")} /></div>
    <div className="grid grid-cols-3 gap-2.5"><U.Kpi label={tr("Running")} value={String(r.running)} testid="agents-kpi-running" /><U.Kpi label={tr("Found")} value={String(r.found)} testid="agents-kpi-found" /><U.Kpi label={tr("Checks")} value={String(r.checks)} sub={tr("this week")} testid="agents-kpi-checks" /></div>
    <div className={U.cardPad}>{Object.entries(r.by).map(([k, n]) => <div key={k} className="flex justify-between py-2 border-t border-[var(--c-ln)] first:border-t-0 text-[14px]"><span>{tr(KN[k])}</span><b className="tabular-nums">{n}</b></div>)}</div>
    {st.agents.filter((a) => a.kind === "watch").map((a) => <div key={a.id} className={U.cardPad + " space-y-1"} data-testid="agents-report-watch">
      <p className="m-0 font-extrabold" dir="auto">{a.title}</p>
      {(a.checks || []).slice().reverse().slice(0, 8).map((c, i) => <div key={i} className="flex justify-between text-[13px] c-sub"><span>{new Date(c.at).toLocaleString(dateLocale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {tr(c.how === "browser" ? "in the browser" : "by itself")}</span>
        <b className={c.price && c.price <= a.below ? "text-[var(--c-pos)]" : ""}>{c.price ? money(c.price, a.currency) : tr("no prices shown")}</b></div>)}
      {!(a.checks || []).length ? <p className="m-0 text-[13px] c-sub">{tr("Not checked yet — tap Check now")}</p> : null}
    </div>)}
  </div>;
}

const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], WD_AR = ["الحد", "الاتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
function PriceLine({ a }) {
  const h = A.priceHistory(a); if (!h) return null;
  const W = 220, H = 40, xs = h.points.map((p) => p.at), ys = h.points.map((p) => p.price), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const X = (v) => (x1 === x0 ? W / 2 : ((v - x0) / (x1 - x0)) * (W - 8) + 4), Y = (v) => (y1 === y0 ? H / 2 : H - 4 - ((v - y0) / (y1 - y0)) * (H - 8));
  const ar = getLang() === "ar";
  return <div className="mt-2" data-testid="agent-history">
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={tr("Price over time")}><polyline points={h.points.map((p) => `${X(p.at)},${Y(p.price)}`).join(" ")} fill="none" stroke="var(--c-acc)" strokeWidth="2" />
      <circle cx={X(h.low.at)} cy={Y(h.low.price)} r="3.5" fill="var(--c-pos, #1E7A43)" /></svg>
    <p className="m-0 text-[12px] c-sub">{tr("Lowest {p} on {d}", { p: money(h.low.price, a.currency), d: new Date(h.low.at).toLocaleDateString(dateLocale(), { day: "numeric", month: "short" }) })}
      {" · "}{h.trend === "down" ? tr("going down {c}%", { c: Math.abs(h.change) }) : h.trend === "up" ? tr("going up {c}%", { c: Math.abs(h.change) }) : tr("about the same")}
      {h.lowDay != null ? " · " + tr("usually cheapest on {d}", { d: (ar ? WD_AR : WD)[h.lowDay] }) : ""}</p>
  </div>;
}


/* ---- v9.4 the new agents (Ali, 5 Nov: G1–G7 — "easy, interactive, visually appealing, smooth and consistent across all agents; global").
   Every card is the same shape as the others: CardHead (icon · name · what it is doing · status · ⋯) → its body → ONE button row →
   its rules. The logic is in agents2.js (pure, tested). */
const N2 = () => (typeof window !== "undefined" ? window.AttuneNative : null);
const readInbox = () => { const n = N2(); try { return n && n.chatInbox ? JSON.parse(n.chatInbox() || "[]") : []; } catch (e) { return []; } };
const whenTxt = (t) => { try { const d = new Date(t), n = new Date(), tm = new Date(); tm.setDate(n.getDate() + 1);
  const day = d.toDateString() === n.toDateString() ? tr("today") : d.toDateString() === tm.toDateString() ? tr("tomorrow") : d.toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
  return day + " " + d.toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
const waitTxt = (ms) => { const h = Math.floor(ms / 36e5); return h >= 24 ? T("{n} days", { n: Math.floor(h / 24) }) : h >= 1 ? T("{n} h", { n: h }) : T("{n} min", { n: Math.max(1, Math.round(ms / 6e4)) }); };
const APP_NAME = { whatsapp: "WhatsApp", telegram: "Telegram", messenger: "Messenger", signal: "Signal", instagram: "Instagram", sms: "SMS", gmail: "Gmail", email: "Email", teams: "Teams", slack: "Slack" };
const appName = (x) => APP_NAME[String(x || "").toLowerCase()] || x || "";
const countryName = (cc) => { try { return new Intl.DisplayNames([getLang() === "arb" ? "ar" : getLang() || "en"], { type: "region" }).of(cc) || cc; } catch (e) { return cc; } };
const Row = ({ children, testid }) => <div className="rounded-[14px] border border-[var(--c-ln)] p-2.5 space-y-2" data-testid={testid}>{children}</div>;
const Avatar = ({ name }) => <span className="w-9 h-9 rounded-full bg-[var(--c-soft)] c-acc grid place-items-center text-[13px] font-extrabold shrink-0">{String(name || "?").trim().slice(0, 1).toUpperCase()}</span>;

/** G1 — who is waiting for your answer, a draft in your words, sent into exactly that chat; and scheduled messages. */
export function ReplyCard({ a, draft, flash, remove, toggle, setRules, understand, onSchedule }) {
  const [tick, setTick] = useState(0), [open, setOpen] = useState(""), [text, setText] = useState(""), [busy, setBusy] = useState(false), [rules, setRulesOpen] = useState(false);
  const items = useMemo(readInbox, [tick]);
  const wait = A2.waitingChats(items, { hours: a.hours || 3 });
  const pick = async (x) => { setOpen(x.key); setText(""); if (!draft) return; setBusy(true); try { setText(await draft(A2.draftPrompt(x))); } catch (e) {} setBusy(false); };
  const send = (x) => {
    const t = text.trim(); if (!t) return; const n = N2();
    let r = {}; try { r = n && n.chatReply ? JSON.parse(n.chatReply(JSON.stringify({ key: x.key, text: t })) || "{}") : {}; } catch (e) {}
    if (r.ok) { flash && flash(T("Sent to {who}", { who: x.who })); setOpen(""); setTick((k) => k + 1); return; }
    try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) {}
    try { n && n.openAnyApp && n.openAnyApp(JSON.stringify({ pkg: x.pkg || "", url: "" })); } catch (e) {}
    flash && flash(T("Copied — {app} opens: paste it in {who}'s chat", { app: appName(x.app) || "WhatsApp", who: x.who }));
  };
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-reply">
    <AgentHead a={a} kind="reply" title={tr("Reply helper")} status={wait.length ? "needs" : a.on === false ? "paused" : "working"} {...{ toggle, remove }} onRules={() => setRulesOpen(!rules)}
      line={wait.length ? T("{n} waiting for your reply", { n: wait.length }) : tr("No one is waiting for your reply")} />
    {wait.slice(0, 4).map((x) => <Row key={x.key} testid="reply-row">
      <div className="flex gap-2.5 items-start"><Avatar name={x.who} />
        <div className="flex-1 min-w-0"><b className="block text-[14px] truncate" dir="auto">{x.who} <span className="c-sub font-semibold text-[12px]">· {appName(x.app)} · {T("waiting {t}", { t: waitTxt(x.waited) })}</span></b>
          <p className="m-0 text-[13px] c-sub" dir="auto">{x.text}</p></div></div>
      {open === x.key ? <div className="space-y-2">
        <textarea value={busy ? tr("Writing a draft…") : text} onChange={(e) => setText(e.target.value)} dir="auto" rows={2} className={U.area} placeholder={tr("Write your reply…")} data-testid="reply-text" />
        <div className="flex flex-wrap gap-1.5">{A2.QUICK.map((q) => <button key={q} onClick={() => setText(tr(q))} className="min-h-[32px] px-2.5 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" data-testid="reply-quick">{tr(q)}</button>)}</div>
        <CardActions primary={{ label: x.canReply ? tr("Send") : tr("Copy and open the chat"), icon: Send, onClick: () => send(x), testid: "reply-send" }} secondary={{ label: tr("Later"), onClick: () => setOpen(""), testid: "reply-later" }} />
      </div> : <button onClick={() => pick(x)} className="text-[13px] font-extrabold c-acc min-h-[36px]" data-testid="reply-open">{draft ? tr("Draft a reply") : tr("Reply")} ›</button>}
    </Row>)}
    <CardActions primary={{ label: tr("Schedule a message"), icon: Clock, onClick: () => onSchedule && onSchedule(), testid: "reply-schedule" }} secondary={{ label: tr("Check again"), icon: RefreshCw, onClick: () => setTick((k) => k + 1), testid: "reply-refresh" }} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rules} setOpen={setRulesOpen} />
  </div>;
}

/** A scheduled message: who, what, when — sent by itself through that chat when it can, else the chat opens with it written. */
export function SendCard({ a, remove, toggle, sendNow }) {
  const st = a.state === "sent" ? T("Sent {t}", { t: whenTxt(a.doneAt || a.at) }) : a.state === "opened" ? tr("The chat opened with it written — tap Send there") : T("Goes {t}", { t: whenTxt(a.at) });
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-send">
    <AgentHead a={a} kind="send" title={T("Message to {who}", { who: a.who })} line={st} {...{ toggle, remove }} />
    <div className="msg rounded-[14px] bg-[var(--c-soft)] p-2.5 text-[13.5px]" dir="auto" data-testid="send-text">{a.text}</div>
    {a.state === "scheduled" ? <CardActions primary={{ label: tr("Send now"), icon: Send, onClick: () => sendNow(a), testid: "send-now" }} /> : null}
  </div>;
}
/** The form behind "Schedule a message": the person (or a contact from the phone), the words, the time. */
export function ScheduleForm({ onDone, onClose, nativeCall }) {
  const [who, setWho] = useState(""), [phone, setPhone] = useState(""), [text, setText] = useState("");
  const [at, setAt] = useState(() => { const d = new Date(Date.now() + 3600e3); d.setMinutes(0, 0, 0); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); });
  const pickC = async () => { try { const c = await nativeCall("contactPick", {}); if (c) { setWho(c.name || who); setPhone(c.phone || ""); } } catch (e) {} };
  const ok = who.trim() && text.trim() && Date.parse(at) > Date.now();
  return <div className={U.cardPad + " space-y-2.5"} data-testid="schedule-form">
    <div className="flex items-center gap-2"><b className="flex-1 text-[15px]">{tr("Schedule a message")}</b><button onClick={onClose} aria-label={tr("Close")} className="w-9 h-9 grid place-items-center c-sub"><X size={16} /></button></div>
    <div className="flex gap-2"><input value={who} onChange={(e) => setWho(e.target.value)} dir="auto" placeholder={tr("To whom?")} className={U.inp + " flex-1"} data-testid="schedule-who" />
      {nativeCall ? <button onClick={pickC} className={U.btnS} data-testid="schedule-contact">{tr("Contacts")}</button> : null}</div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" rows={2} placeholder={tr("The message")} className={U.area} data-testid="schedule-text" />
    <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={U.inp} dir="ltr" data-testid="schedule-at" />
    <p className="m-0 text-[12px] c-sub">{tr("At that time Attune sends it through the chat's own Reply when it can; otherwise the chat opens with the message written — one tap on Send.")}</p>
    <CardActions primary={{ label: tr("Schedule"), icon: Clock, onClick: () => ok && onDone({ kind: "send", who: who.trim(), phone, text: text.trim(), at: Date.parse(at) }), testid: "schedule-go" }} />
  </div>;
}

/** G2 — a visa / appointment page: open · none · log in · couldn't read, the dates it shows, check now, watch while open. */
export function SlotCard({ a, remove, toggle, checkSlot, watchSlot, setUrl, setEvery, busy , setRules, understand, flash}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const s = a.slot || {}, d0 = (s.dates || [])[0];
  const dayTxt = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };
  const box = s.state === "open" ? ["border-[var(--c-pos)] bg-[var(--c-soft)]", T("A date is showing: {d}", { d: dayTxt(d0) }), tr("Book it now — slots go fast.")]
    : s.state === "none" ? ["border-[var(--c-ln)]", tr("No appointments yet"), tr("I'll keep checking and tell you the moment one shows.")]
    : s.state === "login" ? ["border-[var(--c-warn)]", tr("Log in once"), tr("Open the page, log in — then I can read it.")]
    : s.state ? ["border-[var(--c-ln)]", tr("Couldn't read the page"), tr("Tap Check now — the page opens in Attune.")] : ["border-[var(--c-ln)]", tr("Not checked yet"), tr("Tap Check now to read the page.")];
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-slot">
    <AgentHead a={a} onRules={() => setRulesOpen(!rulesOpen)} kind="slot" title={a.dest ? T("Visa appointments · {c}", { c: countryName(a.dest) }) : tr("Appointment watch")} {...{ toggle, remove }}
      line={T("Checks every {n} min", { n: a.every || 30 }) + (s.at ? " · " + ago(s.at) : "") + (a.site ? " · " + a.site : "")} />
    <div className={"rounded-[16px] border-2 p-3 space-y-0.5 " + box[0]} data-testid="slot-state" data-state={s.state || ""}>
      <b className="block text-[16px]">{box[1]}</b><span className="block text-[12.5px] c-sub">{box[2]}</span>
      {(s.dates || []).length > 1 ? <span className="block text-[12.5px] font-bold">{tr("Also:")} {(s.dates || []).slice(1, 4).map(dayTxt).join(" · ")}</span> : null}</div>
    {(a.sites || []).length > 1 ? <div className="flex flex-wrap gap-1.5">{a.sites.map((x) => <button key={x.url} onClick={() => setUrl(a, x)} aria-pressed={x.url === a.url}
      className={"min-h-[32px] px-2.5 rounded-full border text-[12.5px] font-bold " + (x.url === a.url ? "border-[var(--c-acc)] c-acc" : "border-[var(--c-ln)]")} data-testid="slot-site">{x.name}</button>)}</div> : null}
    <div className="flex flex-wrap gap-1.5 items-center"><span className="text-[12px] c-sub font-bold">{tr("Check every")}</span>{[15, 30, 60].map((m) => <button key={m} onClick={() => setEvery(a, m)} aria-pressed={(a.every || 30) === m}
      className={"min-h-[30px] px-2.5 rounded-full border text-[12px] font-bold " + ((a.every || 30) === m ? "border-[var(--c-acc)] c-acc" : "border-[var(--c-ln)]")} data-testid="slot-every">{T("{n} min", { n: m })}</button>)}</div>
    <CardActions primary={{ label: s.state === "open" ? tr("Open now") : tr("Check now"), icon: s.state === "open" ? ExternalLink : RefreshCw, busy, onClick: () => checkSlot(a), testid: "slot-check" }}
      secondary={{ label: tr("Watch while open"), icon: Eye, onClick: () => watchSlot(a), testid: "slot-watch" }} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rulesOpen} setOpen={setRulesOpen} />
  </div>;
}

/** G3 — what you buy again and again, before it runs out (from Money). */
export function RestockCard({ a, remove, toggle, findCheapest, remindOn, toList, openMoney , setRules, understand, flash}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const L = (() => { try { return JSON.parse(localStorage.getItem("ledger.v3") || "null"); } catch (e) { return null; } })();
  const due = A2.restockDue(L, { soon: 7 });
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-restock">
    <AgentHead a={a} onRules={() => setRulesOpen(!rulesOpen)} kind="restock" title={tr("Restock")} status={due.some((x) => x.daysLeft <= 2) ? "needs" : a.on === false ? "paused" : "working"} {...{ toggle, remove }}
      line={due.length ? T("{n} running low this week", { n: due.length }) : tr("Nothing is running low")} />
    {due.length ? due.slice(0, 5).map((x) => <Row key={x.item} testid="restock-row">
      <div className="flex items-center gap-2"><b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{x.item}</b>
        <span className={U.tag(x.daysLeft <= 0 ? "red" : x.daysLeft <= 2 ? "amber" : "gray")}>{x.daysLeft <= 0 ? tr("due now") : T("{n} days left", { n: x.daysLeft })}</span></div>
      <p className="m-0 text-[12px] c-sub">{T("You buy it every {n} days", { n: x.every })}{x.price ? " · " + T("usually {p}", { p: Math.round(x.price).toLocaleString("en-US") }) : ""}</p>
      <div className="flex gap-2"><button onClick={() => findCheapest(x)} className={U.btnP + " flex-1 h-10! min-h-[40px]!"} data-testid="restock-find">{tr("Find the cheapest")}</button>
        <button onClick={() => remindOn(x)} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="restock-remind">{tr("Remind me")}</button></div>
    </Row>) : <p className="m-0 text-[13px] c-sub" data-testid="restock-empty">{tr("I learn from Money: anything you buy 3 times or more at a steady pace shows here before it runs out.")}</p>}
    <CardActions primary={due.length ? { label: tr("Add to my shopping list"), icon: ListChecks, onClick: () => toList(due.map((x) => x.item)), testid: "restock-list" } : { label: tr("Open Money"), icon: ChevronRight, onClick: () => openMoney(), testid: "restock-money" }} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rulesOpen} setOpen={setRulesOpen} />
  </div>;
}

/** G4 — what you paid, the price today, the days left to return; a drop → the money you can ask back, and the message. */
export function ProtectCard({ a, remove, toggle, checkNow, busy, flash , setRules, understand}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const now0 = ((a.checks || []).filter((c) => c.price > 0).slice(-1)[0] || {}).price || 0;
  const s = A2.protectState(a, now0);
  const share = () => { const n = N2(); try { if (n && n.share) n.share(s.message); else navigator.clipboard && navigator.clipboard.writeText(s.message); } catch (e) {} flash && flash(tr("The message is ready — send it to the store")); };
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-protect">
    <AgentHead a={a} onRules={() => setRulesOpen(!rulesOpen)} kind="protect" title={a.what} {...{ toggle, remove }} line={T("Watching the price for {n} more days", { n: s.daysLeft }) + (a.site ? " · " + a.site : "")} />
    <div className="grid grid-cols-2 gap-2 text-center">
      <div className="rounded-[14px] border border-[var(--c-ln)] p-2"><span className="block text-[11.5px] c-sub font-bold">{tr("You paid")}</span><b className="text-[17px] tabular-nums">{money(a.paid, a.currency)}</b></div>
      <div className="rounded-[14px] border border-[var(--c-ln)] p-2"><span className="block text-[11.5px] c-sub font-bold">{tr("Today")}</span><b className={"text-[17px] tabular-nums " + (s.drop ? "text-[var(--c-pos)]" : "")} data-testid="protect-now">{now0 ? money(now0, a.currency) : "—"}</b></div></div>
    {s.drop ? <div className="rounded-[16px] border-2 border-[var(--c-pos)] bg-[var(--c-soft)] p-3 space-y-1" data-testid="protect-drop"><b className="block text-[15px]">{T("{p} back possible", { p: money(s.back, a.currency) })}</b>
      <span className="block text-[12.5px] c-sub">{T("{n} days left to ask or return it", { n: s.daysLeft })}</span></div> : null}
    <CardActions primary={s.drop ? { label: tr("Ask for the difference"), icon: Share2, onClick: share, testid: "protect-ask" } : { label: tr("Check now"), icon: RefreshCw, busy, onClick: () => checkNow(a), testid: "protect-check" }}
      secondary={s.drop ? { label: tr("Check now"), icon: RefreshCw, onClick: () => checkNow(a), testid: "protect-check" } : null} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rulesOpen} setOpen={setRulesOpen} />
  </div>;
}

/** G5 — a specialty in a city: the country's booking sites (searched already), Google Maps everywhere. */
export function ClinicCard({ a, remove, toggle, openSite , setRules, understand, flash}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-clinic">
    <AgentHead a={a} onRules={() => setRulesOpen(!rulesOpen)} kind="clinic" title={tr(a.spec === "ent" ? "ENT doctor" : a.spec.replace(/^\w/, (c) => c.toUpperCase())) + " · " + a.city} {...{ toggle, remove }} status={a.on === false ? "paused" : "found"}
      line={(a.below ? T("under {p}", { p: a.below.toLocaleString("en-US") }) + " · " : "") + T("{n} places to book", { n: (a.tries || []).length })} />
    <div className="grid gap-2">{(a.tries || []).map((x) => <button key={x.url} onClick={() => openSite(a, x)} className="min-h-[52px] rounded-[14px] border border-[var(--c-ln)] px-3 flex items-center gap-2.5 text-start" data-testid="clinic-site">
      <SiteMark site={x.site} size={30} /><span className="flex-1 min-w-0"><b className="block text-[14px]">{x.site}</b><span className="block text-[12px] c-sub truncate">{T("{s} in {c}, ready to book", { s: tr(a.spec), c: a.city })}</span></span><ChevronRight size={16} className="c-sub rtl:rotate-180" /></button>)}</div>
    <p className="m-0 text-[12px] c-sub">{tr("You choose the doctor and book on the site — Attune never books or pays for you.")}</p>
    <CardActions primary={{ label: T("Open {s}", { s: ((a.tries || [])[0] || {}).site || "" }), icon: ExternalLink, onClick: () => openSite(a, a.tries[0]), testid: "clinic-open" }} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rulesOpen} setOpen={setRulesOpen} />
  </div>;
}

/** G6 — the travel day: check-in opens, leave home by, at the airport by, take-off; the gate and delays from the airline's notifications. */
export function TripCard({ a, remove, toggle, setDrive, remindTrip, navTo , setRules, understand, flash}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  const notes = (() => { const n = N2(); try { return n && n.recallNotes ? JSON.parse(n.recallNotes() || "[]") : []; } catch (e) { return []; } })();
  const p = A2.tripPlan(a, notes, { drive: a.drive || 60 });
  const tm = (t) => { try { return new Date(t).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };
  const rows = [[tr("Check-in opens"), whenTxt(p.checkIn), p.checkInOpen], [tr("Leave home by"), whenTxt(p.leaveBy), p.leaveSoon], [tr("At the airport by"), tm(p.atAirport), false], [tr("Takes off"), whenTxt(a.at), false]];
  return <div className={U.cardPad + " space-y-2.5"} data-testid="agent-trip">
    <AgentHead a={a} onRules={() => setRulesOpen(!rulesOpen)} kind="trip" title={a.flight + (a.toName ? " · " + a.toName : "")} {...{ toggle, remove }} line={whenTxt(a.at)} />
    {p.gate || p.status ? <div className="flex flex-wrap gap-1.5">{p.gate ? <span className={U.tag("blue")} data-testid="trip-gate">{T("Gate {g}", { g: p.gate })}</span> : null}
      {p.status ? <span className={U.tag(p.status === "delayed" || p.status === "cancelled" ? "red" : "green")} data-testid="trip-status">{tr(p.status === "delayed" ? "Delayed" : p.status === "cancelled" ? "Cancelled" : "Boarding")}</span> : null}</div> : null}
    <div className="space-y-1" data-testid="trip-plan">{rows.map(([l, v, hot]) => <div key={l} className={"flex items-center gap-2 min-h-[36px] px-2 rounded-[10px] " + (hot ? "bg-[var(--c-soft)]" : "")}>
      <span className={"w-2 h-2 rounded-full shrink-0 " + (hot ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]")} /><span className="flex-1 text-[13.5px] font-bold">{l}</span><span className="text-[13px] tabular-nums c-sub">{v}</span></div>)}</div>
    <div className="flex flex-wrap gap-1.5 items-center"><span className="text-[12px] c-sub font-bold">{tr("Drive to the airport")}</span>{[30, 45, 60, 90].map((m) => <button key={m} onClick={() => setDrive(a, m)} aria-pressed={(a.drive || 60) === m}
      className={"min-h-[30px] px-2.5 rounded-full border text-[12px] font-bold " + ((a.drive || 60) === m ? "border-[var(--c-acc)] c-acc" : "border-[var(--c-ln)]")} data-testid="trip-drive">{T("{n} min", { n: m })}</button>)}</div>
    <CardActions primary={{ label: a.reminded ? tr("Reminders are set") : tr("Remind me on the day"), icon: Clock, onClick: () => remindTrip(a), testid: "trip-remind" }} secondary={{ label: tr("Travel checklist"), icon: ListChecks, onClick: () => navTo && navTo("lists"), testid: "trip-list" }} />
    <AgentRules a={a} setRules={setRules} understand={understand} flash={flash} open={rulesOpen} setOpen={setRulesOpen} />
  </div>;
}
