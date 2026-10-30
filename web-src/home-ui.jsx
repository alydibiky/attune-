/* ---- v6.27: the phone's Home in design A "Calm" (Ali picked it, 13 Oct 2026; mock-up: claude.ai/artifact/ES7tU5XVeN4wPDWSPf3wV4)
   Greeting + date, an "Ask or add anything" box (→ Chat), a short TODAY card (what is due: People & plans, Money's bills —
   computed by code from their own data), two numbers (spent this month of the budget, food today of the goal), then the
   areas (v6.29: replaced by "Recent" — the last 4 tools with what waits there; TODAY became "What's waiting": also new Scout
   finds, cards to review and a medicine running out). The bottom bar is Home · Chat · Money · Scout · Mind · All (v6.29).
   Tests: tests/unit/v727home.test.mjs (todayList), tests/e2e_v727home.py.                                                       */
import { myCountry } from "./country.js";
import React, { useEffect, useMemo, useState } from "react";
import { EmptyStart } from "./ui-kit.jsx";
import { loadAgents } from "./agents.js";
import { Paperclip, MessageCircle, ArrowUp, Camera, Zap, Menu, ChevronRight, Binoculars, GraduationCap, Pill, AlertTriangle, Apple, FileText, Wallet, Heart, Briefcase, BookOpen, ImageIcon, LayoutGrid, Mic, Phone, Globe, Sparkles } from "lucide-react";
import { nowCard, homeNumbers, noticed, onThisDay, weekRhythm } from "./home-now.js";
import { ReportTiles, WeekChart } from "./report-ui.jsx";   // v7.0 My report (Gemini, Direction 2)
import { dayTotals } from "./fit.js";
import { live as fleetLive, kpis as fleetKpis } from "./fleet.js";
import { safeToSpend } from "./safespend.js";
import { setChequeStatus } from "./fleet.js";
import { saveFleet } from "./fleet-store.js";
import { RecallCard } from "./recall-ui.jsx";
import { useSubBack } from "./backstack.js";
import { tr, getLang, dateLocale } from "./i18n.js";
import { loadLife } from "./life.js";
import { monthReview, reviewLines } from "./monthreview.js";
import { NOT_IN_PLAY } from "./buildflags.js";
import { trialNote } from "./trialuse.js";
import { loadRadar } from "./deadlines.js";
import { loadCare } from "./care.js";
import { waitingList, toolLine, todayLine } from "./home.js";
import { loadScout } from "./scout.js";
import { recentTools } from "./side-ui.jsx";
import { loadLedger } from "./myledger.js";
import { moneyOverview, fmt } from "./money-calm.js";
import { todayFacts } from "./desk-ui.jsx";
import { targetsOf } from "./fithome.js";
import { openRead } from "./readaloud-ui.jsx";
import { DoResult, DO_HINTS } from "./doit-ui.jsx";
import { FitToday } from "./health-ui.jsx";
import { tickRegular, payRadar } from "./regular.js";
import { MissionsLine, useTopMission } from "./missions-ui.jsx";
import { loadFleet } from "./fleet-store.js";
import { route as cmdRoute } from "./cmdrun.js";
import * as K from "./commands.js";
import * as W from "./whereis.js";
import { SlashMenu, Attached, BoxOptions, AskCard, ConfirmCard, LinesCard, TodoCard, MapCard, FoundCard, JobCards, TripPin, tripLive, useJobs, say, BoxModes, takeBoxMode, BOX_HINT } from "./cmdbox-ui.jsx";
import { LifeAnswer } from "./lifeask-ui.jsx";
import { EmailCard } from "./email-ui.jsx";
import * as LA from "./lifeask.js";
import { connectNow, pickPerson } from "./connected.js";

function greeting(now = new Date()) { const h = now.getHours(); return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; }
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }

// v6.29 (Ali picked A): the tools you used last, each with what waits there; filled with these when you have used fewer than four
const START_TOOLS = ["scout", "learn", "slides", "convert", "memory"];
const WORK = ["business", "fleet", "crane", "field", "convert", "translate", "pdfchat", "slides", "cv", "code", "studio", "map", "travel", "video"].filter((m) => !NOT_IN_PLAY.has(m));
const LINE_APP = { fit: "Food", money: "Money", reminders: "Reminder", fleet: "Fleet", country: "Holiday", care: "Health", life: "Payment", radar: "Deadline", learn: "Learn" };
const LINE_COL = { fit: "#B35C0F", money: "#1F6BBF", reminders: "#6B4FB8", fleet: "#2E7D4F", country: "#A0522D", care: "#B83B5E", life: "#1F6BBF", radar: "#8A5A00", learn: "#0E7C86" };
const readArr = (k) => { const v = readJSON(k); return Array.isArray(v) ? v : []; };
// v8.7 (V-D): nothing written anywhere yet — no money, food, reminders, people & plans, dates or agents
const freshApp = () => { try {
  const j = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
  const n = (v, k) => (v ? (Array.isArray(v) ? v.length : Array.isArray(v[k]) ? v[k].length : Object.keys(v[k] || {}).length) : 0);
  return !n(j("ledger.v3"), "txns") && !n(j("attune:fit:v1"), "days") && !n(j("attune:reminders:v1"), "items") && !n(j("attune:life:v1"), "items")
    && !n(j("attune:radar:v1"), "items") && !n(j("attune:agents:v1"), "agents");
} catch (e) { return false; } };
/** v8.7 P3-7: Money & Follow-ups · Fit & Food · Agents — one live line each, a tap opens the place. */
function HeroCards({ data, navTo }) {
  const ar = getLang() === "ar", f = (v) => Math.round(v || 0).toLocaleString("en-US");
  const cards = [];
  // 1 — money and what to follow
  const safe = data.safe, first = (data.items || [])[0];
  cards.push({ k: "money", label: tr("Money & Follow-ups"), col: "#157A52", open: "money",
    big: safe && data.hasLedger ? tr("{a} safe to spend today", { a: f(safe.today) }) : tr("Write what you spend — Attune keeps the count"),
    sub: first ? first.title : tr("Nothing to follow today") });
  // 2 — food against the goal
  cards.push({ k: "fit", label: tr("Fit & Food"), col: "#B4560E", open: "fit",
    big: data.fitOn && data.goal ? tr("{a} of {b} kcal", { a: f(data.kcal), b: f(data.goal) }) : data.kcal ? tr("{a} kcal today", { a: f(data.kcal) }) : tr("Snap your lunch"),
    sub: data.fitOn && data.goal > 0 ? (data.goal > data.kcal ? tr("{a} left today", { a: f(data.goal - data.kcal) }) : tr("Goal reached today")) : tr("A photo, a barcode or “2 eggs and foul”") });
  // 3 — agents: one waiting for an OK first, else the newest find
  let A = []; try { A = (loadAgents().agents || []).filter((a) => a.on !== false); } catch (e) {}
  const wait = A.find((a) => a.pending && a.step === "confirm"), found = A.filter((a) => a.found).sort((a, b) => (b.found.at || 0) - (a.found.at || 0))[0];
  cards.push({ k: "agents", label: tr("Agents"), col: "#3B5BA9", open: "agents",
    big: wait ? `${wait.pending.name}: ${f(wait.pending.price)}` : found ? `${found.title || found.what}: ${f(found.found.price)}` : A.length ? tr("{n} agents watching", { n: A.length }) : tr("Watch a price, track a delivery"),
    sub: wait ? tr("Waiting for your OK to buy") : found ? tr("Found for you") : A.length ? tr("They tell you when something changes") : tr("“Find me AirPods under 9,000”") });
  return (
    <div className="space-y-2" data-testid="home-hero">
      {cards.map((c) => (
        <button key={c.k} onClick={() => navTo(c.open)} className="c-card w-full text-start p-3.5 flex items-center gap-3" data-testid={"home-hero-" + c.k}>
          <span className="flex-1 min-w-0">
            <span className="block text-[12px] font-extrabold tracking-wide" style={{ color: c.col }}>{c.label.toUpperCase()}</span>
            <b className="block text-[16px] font-extrabold truncate" dir="auto">{c.big}</b>
            <span className="c-sub block text-[13px] truncate" dir="auto">{c.sub}</span></span>
          <ChevronRight size={18} className="c-acc shrink-0 rtl:-scale-x-100" /></button>))}
    </div>);
}

export function PhoneHome({ navTo, onAsk, openAll, name, guardian, doIt, tools = [], openSide, minimal = false, openFitAdd = null, listen = null, startCall = null, cmd = null, trial = null }) {
  const [text, setText] = useState("");
  // v6.48 Chat runs the app (CHAT_RUNS_APP.md, option A): "/" commands, files, the two box options, the answer card, the jobs
  const [files, setFiles] = useState([]);
  const [web, setWeb] = useState(false);
  // v7.6 (Ali): Chat · Your life · Translate are three pills in the box (the separate pages are gone)
  const [boxMode, setBoxMode] = useState(takeBoxMode);
  const [life, setLife] = useState(null);   // { q, a } — Your life's answer, under the box
  useEffect(() => { const on = (e) => { setBoxMode(takeBoxMode() || e.detail); setLife(null); }; window.addEventListener("attune-box-mode", on); return () => window.removeEventListener("attune-box-mode", on); }, []);
  const tr2 = boxMode === "translate";
  const [panel, setPanel] = useState(null);       // the outcome being shown (cmdrun.js)
  // v8.7 (persona 4, idea 10): something shared from another app — one line, Yes does it, No keeps it as a note
  useEffect(() => { const on = (e) => { const d = e.detail || {}; if (d.text) setPanel({ type: "shared", text: d.text, q: d.q }); };
    window.addEventListener("attune-home-shared", on); return () => window.removeEventListener("attune-home-shared", on); }, []);
  const fileRef = React.useRef(null);
  const jobList = useJobs(cmd && cmd.jobs);
  const [trip, setTrip] = useState(() => (cmd && cmd.trip ? cmd.trip() : null));
  const [done, setDone] = useState(null);
  const [tick, setTick] = useState(0);   // v6.28: what Home did (or undid) shows in Today and the two numbers at once
  const [note, setNote] = useState("");   // v6.34: "Recorded in Money: 600 EGP — Maid"
  // v6.44: Fleet & rentals lives in IndexedDB (async) — read once for the Today line (cranes working, cheques, service)
  const [fleet, setFleet] = useState(null);
  useEffect(() => { if (!minimal) return; let on = true; loadFleet().then((f) => { if (on && f) setFleet(f); }).catch(() => {}); return () => { on = false; }; }, [minimal]);
  const ar = getLang() === "ar";
  const hint = DO_HINTS[new Date().getMinutes() % DO_HINTS.length];
  const now = new Date();
  const data = useMemo(() => {
    const ledger = loadLedger(), o = moneyOverview(ledger);
    const fit = readJSON("attune:fit:v1"), tg = fit && fit.profile ? targetsOf(fit.profile) : null;
    const care = loadCare(), scout = loadScout(), courses = readArr("attune:daily:courses:v1"), slides = readArr("attune:slides:v1");
    const known = (id) => tools.some((t) => t[0] === id);
    const recent = [...new Set([...recentTools(), ...START_TOOLS])].filter(known).slice(0, 4);
    return { items: waitingList({ care, radar: loadRadar(), life: loadLife(), ledger, scout, courses }), o, hasLedger: !!ledger, fitOn: !!(fit && fit.profile), kcal: todayFacts().kcal || 0, goal: tg && tg.kcal ? tg.kcal : 0, reminders: todayFacts().reminders || 0,
      recent: recent.map((id) => ({ t: tools.find((x) => x[0] === id), line: toolLine(id, { scout, courses, slides, ledger, care }) })),
      // v6.36 layout 1A: the four areas' one-line state
      learn: (() => { const c = courses.find((x) => x && Array.isArray(x.plan) && x.plan.length); return c ? { title: c.topic || c.title || "", n: (c.lessons || []).filter((l) => l.read).length, of: c.plan.length } : null; })(),
      work: [...new Set(recentTools())].filter((id) => WORK.includes(id)).slice(0, 2).map((id) => (tools.find((x) => x[0] === id) || [id, id])[1]),
      // v6.43 (Ali picked "1 + the Today line"): today across the apps, by time
      line: minimal ? todayLine({ fit, ledger, fleet, care, life: loadLife(), radar: loadRadar(), courses, reminders: readJSON("attune:reminders:v1"), country: myCountry(), now: Date.now() }).line : [],
      // v6.46 Home A (Ali picked it): what you can spend today, for the numbers and "Attune noticed"
      // v7.0 My report: the last 7 days (spent, eaten) for the week chart
      week: minimal ? weekRhythm({ ledger, days: fit && fit.days, kcalOf: dayTotals, locale: dateLocale() }) : [],
      safe: minimal && ledger ? (() => { try { return safeToSpend({ ledger, life: loadLife(), radar: loadRadar() }); } catch (e) { return null; } })() : null, scout };
  }, [tick, fleet]);
  const mission = useTopMission();
  // v6.50 option C (Ali): Home is calm (the box, what runs, one Right-now card, 3 lines of the day); "My report" has the rest —
  // the numbers, what needs you, the whole day, missions, what Attune noticed. Opened by "See all", "/report", «وريني التقرير».
  const [rep, setRep] = useState(false);
  useEffect(() => { const on = () => setRep(true); window.addEventListener("attune-my-report", on); return () => window.removeEventListener("attune-my-report", on); }, []);
  useSubBack(minimal && rep, () => setRep(false));
  const now1 = minimal ? nowCard({ needs: data.items, fleet, country: myCountry(), now: Date.now() }) : null;
  const nums = minimal ? homeNumbers({ safe: data.safe, kcal: data.kcal, kcalGoal: data.fitOn ? data.goal : 0, fleet, mission }) : [];
  const seen = minimal ? noticed({ safe: data.safe, mission, fleet, scout: data.scout, past: cmd && cmd.api ? onThisDay(cmd.api.records()) : null }) : null;
  const [heard, setHeard] = useState(false);
  // the mic: the phone listens and writes what you said into the box (then Send does it, like typing)
  const speak = async () => { if (!listen || heard) return; setHeard(true); try { const t = await listen(ar ? "ar-EG" : "", (p) => setText(p)); if (t) setText(t); } catch (e) {} setHeard(false); };
  // RIGHT NOW's buttons: done here, saved in the app they belong to
  const act = async (c, a) => {
    if (a.id === "open") return openLine(c.open);
    if (c.from === "fleet" && (a.id === "cleared" || a.id === "bounced") && fleet) {
      try { const next = setChequeStatus(fleet, c.ref, a.id); await saveFleet(next); setFleet(next); setNote(a.id === "cleared" ? tr("Marked cleared in Fleet") : tr("Marked bounced in Fleet — it stays owed")); } catch (e) { setNote(String((e && e.message) || e)); }
      return setTick((n) => n + 1);
    }
    if (c.ref && (a.id === "paid" || a.id === "notRenewed")) {
      const pay = c.ref;
      if (a.id === "notRenewed") { payRadar(pay.id, false); setNote(tr("Marked as not renewed — {t}", { t: c.title })); }
      else { const r = pay.kind === "radar" ? payRadar(pay.id, true) : tickRegular(pay.id, pay.i, true); if (r && r.recorded) setNote(tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: pay.cur, t: c.title })); else navTo(pay.kind === "radar" ? "radar" : "life"); }
      return setTick((n) => n + 1);
    }
    openLine(c.open);
  };
  // v6.28: Home does it first (food → Fit, money → Money, a dose, a reminder, a debt…); only what it can't do goes to Chat
  const doOld = (t) => { let r = null; try { r = doIt ? doIt(t) : null; } catch (e) { r = null; } if (r) { setDone({ ...r, id: Date.now() }); setTick((n) => n + 1); return true; } return false; };
  // v6.48: what the box does — a "/" command, or a sentence that means one (asks when it could mean two), else Chat as before
  const show = (o, t) => {
    setPanel(null); setDone(null);
    if (!o) return;
    const lines = (ls) => setPanel({ type: "lines", lines: ls });
    switch (o.type) {
      case "doit": if (!doOld(o.text)) onAsk(o.text); return;
      case "chat": if (o.web && cmd && cmd.chatWeb) cmd.chatWeb(o.text); else onAsk(o.text); return;
      case "open": return /^panel:/.test(o.mode) ? window.dispatchEvent(new CustomEvent("attune-panel", { detail: o.mode.slice(6) })) : o.mode === "report" ? setRep(true) : o.mode === "food-photo" ? (openFitAdd ? openFitAdd() : navTo("fit")) : o.mode === "read" ? openRead() : o.mode === "all" ? openAll() : openLine(o.mode);
      case "job": cmd.jobs.add(o.spec); setFiles([]); return;
      case "todoAdd": cmd.mind.add({ kind: "todo", title: o.item.slice(0, 90), text: o.item, tags: ["todo"], meta: { todo: true, done: false } }); return lines([{ en: `Added to your to-do list: ${o.item}`, ar: `اتضافت للمهام: ${o.item}`, open: "memory" }]);
      case "whereSave": cmd.mind.add(W.whereRecord(o.set)); return lines([{ en: `Got it: ${o.set.thing} — ${o.set.place}.`, ar: `تمام: ${o.set.thing} — ${o.set.place}.`, open: "memory" }]);
      case "rememberNote": cmd.mind.add({ kind: "note", title: o.text.slice(0, 70), text: o.text, tags: ["remember"] }); return lines([{ en: "Kept in your Mind.", ar: "اتحفظت في العقل.", open: "memory" }]);
      case "rememberFiles": if (cmd.rememberFiles) cmd.rememberFiles(o.files, o.label); setFiles([]); return lines([{ en: `Keeping ${o.files.length > 1 ? o.files.length + " files" : o.files[0].name} in your Mind${o.label ? " as “" + o.label + "”" : ""}…`, ar: `بحفظ ${o.files.length > 1 ? o.files.length + " ملفات" : o.files[0].name} في العقل${o.label ? " على إنه «" + o.label + "»" : ""}…`, open: "memory" }]);
      case "travel": { const name = cmd.travel(o.code); setTrip(cmd.trip()); return lines([{ en: `Your trip to ${name} is pinned on Home until it ends.`, ar: `سفرية ${name} متثبتة في الرئيسية لحد ما تخلص.`, open: "travel" }]); }
      case "need": if (o.what === "file") { if (fileRef.current) { fileRef.current.dataset.after = t; fileRef.current.click(); } return lines([{ en: "Attach the file, then send again.", ar: "ضيف الملف وابعت تاني." }]); }
        setText(t.endsWith(" ") ? t : t + " "); return lines([{ en: "Write what it's about after the command.", ar: "اكتب الكلام بعد الأمر." }]);
      default: setPanel({ ...o, text: o.text || t });
    }
  };
  const send = (kindPicked) => {
    let t = text.trim();
    if (!t && !files.length && !kindPicked) return;
    setLife(null);
    if (boxMode === "life" && t && !t.startsWith("/")) {
      setText(""); setPanel(null); setDone(null);
      let a = null; try { a = LA.askLife(t, LA.loadStores()); } catch (e) { a = null; }
      // v8.7: a question about the world (a score, the weather) → the chat, with the web
      if (a && a.kind === "world" && cmd) { show({ type: "chat", text: t, web: true }, t); return; }
      setLife({ q: t, a }); return;
    }
    if (minimal && cmd) {
      if (tr2 && t && !t.startsWith("/")) t = "/translate " + t;
      if (web && t && !t.startsWith("/")) { setText(""); show({ type: "chat", text: t, web: true }, t); return; }
      setText("");
      let o = null; try { o = cmdRoute(t, { files, api: cmd.api, prefs: K.loadPrefs() }); } catch (e) { o = null; }
      // v8.8: a question for Chat that names someone two cards could be — «Which Ahmed?» here first, then Chat answers for him
      if (o && o.type === "chat" && !o.web) { const cx = connectNow(o.text || t); if (cx && cx.ask) { setPanel({ type: "who", text: o.text || t, ask: cx.ask }); return; } }
      show(o, t); return;
    }
    if (!t) return; setText(""); if (!doOld(t)) onAsk(t);
  };
  const pickAsk = (kind) => { const a = panel; K.savePrefs(K.learn(K.loadPrefs(), a.sig, kind)); let o = null; try { o = cmdRoute(a.text, { files, api: cmd.api, kind }); } catch (e) {} show(o, a.text); };
  // Fleet & rentals is a view inside Business: open Business, then ask it for the Fleet view (as a shared crane order does)
  const openLine = (m) => { if (!m) return; if (m !== "fleet-rentals") return navTo(m); navTo("business"); setTimeout(() => window.dispatchEvent(new CustomEvent("attune-biz-view", { detail: "fleet" })), 80); };
  const date = now.toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { weekday: "long", day: "numeric", month: "long" });
  const ICON = { scout: Binoculars, learn: GraduationCap, care: Pill };
  const pct = (a, b) => (b > 0 ? Math.min(100, Math.round((a / b) * 100)) : 0);
  return (
    <div className="calm -mx-3 px-4 pt-3 pb-6 space-y-4" style={{ minHeight: "calc(100vh - 60px)" }} data-testid="phone-home">
      {minimal && rep ? null : <div className="flex items-start gap-2">
        {/* v6.29 (Ali: "a sidebar where I can see the history of my chats"): ☰ opens it — chats, search, places, pinned tools */}
        {openSide ? <button onClick={openSide} aria-label={tr("Chats and menu")} className="w-9 h-9 -ms-1.5 mt-1 rounded-full grid place-items-center c-sub shrink-0" data-testid="home-menu"><Menu size={21} /></button> : null}
        <div className="min-w-0"><p className="c-sub m-0">{date}</p><h1 className="text-[24px] font-black m-0 tracking-tight">{tr(greeting(now))}{name ? ", " + name : ""}</h1></div></div>}
      {minimal && rep ? (
        <div className="flex items-center gap-2.5" data-testid="my-report">
          <button onClick={() => setRep(false)} aria-label={tr("Home")} title={tr("Home")} className="w-11 h-11 rounded-full grid place-items-center shrink-0" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" }} data-testid="my-report-back">
            <ChevronRight size={19} className="rotate-180 rtl:rotate-0" /></button>
          <div className="min-w-0"><h2 className="text-[20px] font-black m-0 tracking-tight">{tr("My report")}</h2><p className="c-sub m-0 text-[12px]">{date}</p></div></div>
      ) : minimal ? (
        /* v6.43 option 1 (Ali): one big box — say anything, Attune does it in every app it touches */
        <div className="rounded-[20px] p-4 space-y-3" style={{ background: "var(--c-surf)", border: "1.5px solid var(--c-acc)", boxShadow: "0 2px 10px rgba(16,32,28,.10)" }} data-testid="home-box">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} dir="auto" data-testid="home-ask" rows={2}
            placeholder={BOX_HINT[boxMode] ? tr(BOX_HINT[boxMode]) : cmd ? tr("Type / for a command, or just say it…") : tr("Say anything — «koshari for lunch, paid 85», «remind me at 9», «find a Tucson 2022»")} className="w-full resize-none bg-transparent focus:outline-none text-[16.5px] font-semibold leading-snug placeholder:font-normal" style={{ color: "var(--c-ink)" }} />
          {cmd ? <Attached files={files} onRemove={(i) => setFiles((f) => f.filter((_, k) => k !== i))} /> : null}
          {cmd ? <input ref={fileRef} type="file" multiple className="hidden" data-testid="box-file-input" onChange={(e) => { const add = [...(e.target.files || [])].slice(0, 20); e.target.value = ""; if (add.length) setFiles((f) => [...f, ...add].slice(0, 20)); }} /> : null}
          <BoxModes mode={boxMode} setMode={(m) => { setBoxMode(m); setLife(null); }} />
          <div className="flex items-center justify-end gap-2 pt-2.5 border-t" style={{ borderColor: "var(--c-ln)" }}>
            {/* v6.50 (Ali: "everything via the Home box"): attach · mic · send — the rest is typed ("/food", "/read", "/money"…) */}
            {cmd ? <button onClick={() => fileRef.current && fileRef.current.click()} aria-label={tr("Attach a file, photo, video or recording")} className="w-10 h-10 rounded-full grid place-items-center c-sub" style={{ background: "var(--c-surf-2, var(--c-bg))" }} data-testid="box-attach"><Paperclip size={18} /></button> : null}
            <span className="flex-1" />
            {/* Voice (design A): the orb opens "Ya Attune" — talk and it acts, messages included */}
            <button onClick={() => window.dispatchEvent(new CustomEvent("attune-voice"))} aria-label={tr("Ya Attune — talk to it")} title={tr("Ya Attune — talk to it")} data-testid="home-voice"
              className="w-10 h-10 rounded-full grid place-items-center"><span className="w-6 h-6 rounded-full block" style={{ background: "radial-gradient(circle at 40% 35%,#7fe0cf,#2c8f80 60%,#173530)", boxShadow: "0 0 0 4px rgba(79,194,175,.15)" }} /></button>
            {listen ? <button onClick={speak} aria-label={tr("Speak")} title={tr("Speak")} className={"w-10 h-10 rounded-full grid place-items-center " + (heard ? "animate-pulse" : "c-sub")} style={{ background: heard ? "var(--c-soft)" : "var(--c-surf-2, var(--c-bg))" }} data-testid="home-mic"><Mic size={18} /></button> : null}
            <button onClick={() => send()} aria-label={tr("Send")} className="w-10 h-10 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="home-send"><ArrowUp size={18} /></button>
          </div>
        </div>) : (
      <div className="flex items-center gap-2 rounded-full px-3 py-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)" }}>
        <MessageCircle size={17} className="c-sub" />
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} dir="auto" data-testid="home-ask"
          placeholder={tr("Ask or add anything…")} className="flex-1 min-w-0 bg-transparent focus:outline-none text-[15px]" style={{ color: "var(--c-ink)" }} />
        {/* v6.27 Read it to me: any paper read aloud, explained and acted on */}
        {/* v8.7 (persona 4, idea 9): one camera that knows what it sees — receipt, plate, bill, page, sign, barcode */}
        {cmd && cmd.smartPhoto ? <label aria-label={tr("Smart camera")} title={tr("Smart camera")} className="w-8 h-8 rounded-full grid place-items-center c-sub cursor-pointer" data-testid="home-smartcam"><ImageIcon size={17} />
          <input type="file" accept="image/*" capture="environment" className="hidden" data-testid="home-smartcam-input" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) cmd.smartPhoto(f); }} /></label> : null}
        <button onClick={() => openRead()} aria-label={tr("Read it to me")} title={tr("Read it to me")} className="w-8 h-8 rounded-full grid place-items-center c-sub" data-testid="home-read"><Camera size={17} /></button>
        <button onClick={send} aria-label={tr("Send")} className="w-8 h-8 rounded-full grid place-items-center" style={{ background: "var(--c-acc)", color: "#fff" }} data-testid="home-send"><ArrowUp size={16} /></button>
      </div>)}
      {/* v6.36 layout 1A (Ali picked it): one box, three quick starts under it — tools are reached by asking, not from a list */}
      {minimal && !rep && cmd ? <SlashMenu text={text} onPick={(c) => (c.group === "open" ? (setText(""), show({ type: "open", mode: c.app }, "")) : setText("/" + (getLang() === "ar" ? c.ar[0] : c.id) + " "))} /> : null}
      {minimal && !rep && cmd && panel ? (
        panel.type === "email" ? <EmailCard key={panel.text} text={panel.text} write={cmd && cmd.api && cmd.api.write} onClose={() => setPanel(null)} />
        : panel.type === "ask" ? <AskCard ask={panel} onPick={pickAsk} onClose={() => setPanel(null)} />
        : panel.type === "who" ? <div className="rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-3.5 space-y-2" data-testid="home-who">
            <p className="m-0 text-[15px] font-black">{tr("Which {n}?", { n: panel.ask.key.replace(/^./, (x) => x.toUpperCase()) })}</p>
            <p className="m-0 text-[12.5px] text-[var(--c-mut)]">{tr("You have more than one — pick him and I'll remember for next time.")}</p>
            <div className="flex flex-wrap gap-1.5">{panel.ask.choices.map((c) => <button key={c.id} className="min-h-[44px] px-3.5 rounded-full border border-[var(--c-ln)] text-[13.5px] font-extrabold hover:border-[var(--c-acc)]" data-testid="home-who-pick"
              onClick={() => { pickPerson(panel.text, c.id); const q = panel.text; setPanel(null); onAsk(q); }} dir="auto">{c.label}</button>)}
              <button className="min-h-[44px] px-3 text-[13px] font-bold text-[var(--c-mut)]" onClick={() => { setPanel(null); navTo("people"); }}>{tr("Someone else")}</button></div></div>
        : panel.type === "shared" ? <ConfirmCard q={panel.q} onYes={() => { const t = panel.text; setPanel(null); doOld(t); }}
            onNo={() => { const t = panel.text; setPanel({ type: "lines", lines: [{ en: "Kept as a note in Mind.", ar: "اتحفظت ملاحظة في «العقل»." }] }); try { window.dispatchEvent(new MessageEvent("attune-share", { data: { kind: "share", text: t, asNote: true } })); } catch (e) {} }} />
        : panel.type === "confirm" ? <ConfirmCard q={panel.q} onYes={() => show({ type: "whereSave", set: panel.set }, "")} onNo={() => setPanel({ type: "lines", lines: [{ en: `OK — still ${panel.was}.`, ar: `تمام — لسه ${panel.was}.` }] })} />
        : panel.type === "lines" ? <LinesCard lines={panel.lines} onOpen={(m) => { setPanel(null); openLine(m); }} onClose={() => setPanel(null)} />
        : panel.type === "todos" ? <TodoCard items={panel.items} onTick={(x) => cmd.mind.update(x.id, (r) => ({ ...r, meta: { ...(r.meta || {}), done: true, doneAt: Date.now() } }))} onOpen={() => { setPanel(null); navTo("memory"); }} onClose={() => setPanel(null)} />
        : panel.type === "map" ? <MapCard place={panel.place} metro={panel.metro} onMap={() => { setPanel(null); cmd.openMap(panel.place); }} onMetro={() => { setPanel(null); cmd.openMetro(panel.metro); }} onClose={() => setPanel(null)} />
        : panel.type === "found" ? <FoundCard q={panel.q} items={panel.items} onOpen={(r) => { setPanel(null); cmd.openRecord(r); }} onClose={() => setPanel(null)} />
        : null) : null}
      {minimal && !rep && life ? <LifeAnswer res={life} navTo={(m) => { setLife(null); navTo(m); }} askChat={(q) => { setLife(null); onAsk(q); }} onClose={() => setLife(null)} /> : null}
      {minimal && !rep && boxMode === "translate" ? <button onClick={() => navTo("translate")} className="-mt-1 min-h-[40px] text-[13px] font-bold c-acc inline-flex items-center gap-1" data-testid="box-translate-more">{tr("Talk with someone, a photo or a document")}<ChevronRight size={15} className="rtl:rotate-180" /></button> : null}
      {minimal && !rep && cmd ? <JobCards list={jobList} jobs={cmd.jobs} onSave={(f) => cmd.saveFile(f)} onCopy={(t) => cmd.copy(t)} onOpen={(m) => openLine(m)} /> : null}
      {minimal && !rep && cmd && tripLive(trip) ? <TripPin trip={trip} name={cmd.countryName(trip.country)} onOpen={() => navTo("travel")} onEnd={() => { cmd.endTrip(); setTrip(cmd.trip()); }} /> : null}
      <RecallCard text={text} navTo={navTo} className="-mt-1" />
      {/* persona 9 (Ali picked H-E): on the 1st–3rd, last month in one card (monthreview.js); × hides it for that month */}
      {!rep ? <MonthCard /> : null}
      {!rep && trial ? <TrialLine trial={trial} /> : null}
      {/* v6.50: no row of Chat's tools here — "/chat", "/translate", "/remember"… from the box (Ali: one Translate, one place) */}
      {/* v6.46 Home A: RIGHT NOW — the one thing that matters most, with its buttons (home-now.js) */}
      {now1 && !rep ? <div className="rounded-[20px] p-4 space-y-2.5" style={{ boxShadow: "0 4px 14px rgba(16,32,28,.16)", background: now1.level === "bad" ? "#B42318" : "var(--c-acc)", color: now1.level === "bad" ? "#fff" : "var(--c-on-acc, #fff)" }} data-testid="home-now" data-kind={now1.kind}>
        <p className="m-0 text-[11.5px] font-extrabold tracking-wide opacity-90">{tr("RIGHT NOW")}{now1.sub ? " · " + now1.sub : ""}</p>
        <button onClick={() => openLine(now1.open)} className="block w-full text-start text-[17px] font-extrabold leading-snug" style={{ color: "inherit" }} dir="auto" data-testid="home-now-title">{now1.title}</button>
        <div className="flex gap-2 flex-wrap">{now1.actions.map((a, i) => (
          <button key={a.id} onClick={() => act(now1, a)} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold" style={i ? { border: "1px solid currentColor", color: "inherit" } : now1.level === "bad" ? { background: "#fff", color: "#B42318" } : { background: "var(--c-surf)", color: "var(--c-ink)" }} data-testid={"home-now-" + a.id}>{a.label}</button>))}</div>
      </div> : null}
      {/* v8.7 (Ali agreed P3-7, option A done lightly): the 3 hero jobs as 3 live cards — the same three the store page and the
          paywall promise. The box, "Right now" and "Your day" stay. */}
      {minimal && !rep && !freshApp() ? <HeroCards data={data} navTo={navTo} /> : null}
      {minimal && rep ? <><ReportTiles safe={data.safe} spentMonth={data.hasLedger ? data.o.monthOut : null} cur={data.o && data.o.cur} kcal={data.kcal} goal={data.fitOn ? data.goal : 0}
          fleetK={(() => { try { return fleet && fleetLive(fleet.cranes || []).length ? fleetKpis(fleet) : null; } catch (e) { return null; } })()} />
        <WeekChart week={data.week} cur={data.o && data.o.cur} /></> : null}
      {!minimal && nums.length ? <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${nums.length}, minmax(0, 1fr))` }} data-testid="home-numbers">
        {nums.map((x) => <button key={x.k} onClick={() => openLine(x.open)} className="c-card text-start p-2.5" data-testid={"home-num-" + x.k}>
          <span className="c-sub block text-[11px] font-bold truncate">{x.label}</span><b className="c-num block text-[16px]">{x.value}</b></button>)}
      </div> : null}
      {minimal ? null : <div className="flex gap-2 overflow-x-auto -mt-1 pb-0.5" data-testid="home-quick">
        {[[Apple, "Food photo", () => (openFitAdd ? openFitAdd() : navTo("fit")), "home-quick-food"], [FileText, "A file", () => navTo("pdfchat"), "home-quick-file"], [Binoculars, "Find for me", () => navTo("scout"), "home-quick-scout"]].map(([I, l, go, id]) => (
          <button key={id} onClick={go} className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px]" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" }} data-testid={id}><I size={14} className="c-acc" />{tr(l)}</button>))}
      </div>}
      {done ? <DoResult key={done.id} r={done} navTo={navTo} onClose={() => setDone(null)} onUndo={() => setTick((n) => n + 1)} /> : minimal ? null : <p className="c-sub text-[12.5px] m-0 -mt-2 px-1" dir="auto" data-testid="home-hint">{tr("Just say it:")} «{ar ? hint[1] : hint[0]}»</p>}
      {/* v6.28 declutter: a card with nothing to say is not shown (nothing due today, nothing spent and no budget) */}
      {(() => { if (now1 && now1.from !== "fleet") data.items = data.items.filter((x) => x.title !== now1.title); return null; })()}
      {(!minimal || rep) && (data.items.length || data.reminders || note) ? <div className="c-card" data-testid="home-today">
        <div className="flex items-center mb-1"><span className="c-lbl">{minimal ? tr("Needs you") : tr("Attune suggests")}</span><span className="c-sub ms-auto">{data.items.length ? (data.items.length + (data.reminders || 0) === 1 ? tr("1 thing") : tr("{n} things", { n: data.items.length + (data.reminders || 0) })) : ""}</span></div>
        {data.items.length || data.reminders || note ? (
          <>
            {data.items.map((x, i) => x.pay ? (
              // v6.34 (Ali): the maid's Saturday, a subscription's or a bill's day — "Paid?": tick = the expense in Money at once
              <div key={i} className="w-full flex items-center gap-3 py-2" data-testid={x.pay.kind === "radar" ? "home-pay-radar" : "home-regular"}>
                <button onClick={() => {
                    const r = x.pay.kind === "radar" ? payRadar(x.pay.id, true) : tickRegular(x.pay.id, x.pay.i, true);
                    if (r.recorded) setNote(tr("Recorded in Money: {a} {cur} — {t}", { a: fmt(r.recorded), cur: x.pay.cur, t: x.title }));
                    else { if (x.pay.kind !== "radar") tickRegular(x.pay.id, x.pay.i, false); navTo("money"); }
                    setTick((n) => n + 1); }}
                  aria-label={tr("Paid")} className="w-[22px] h-[22px] rounded-md shrink-0" style={{ border: "1.8px solid var(--c-acc)" }} data-testid="home-regular-tick" />
                <button onClick={() => navTo(x.pay.kind === "radar" ? "radar" : "life")} className="flex-1 min-w-0 text-start"><b className="block truncate text-[14px]" dir="auto">{x.title}</b>
                  <span className={x.late ? "c-neg" : "c-sub"}>{x.late ? tr("Was due {d} — paid?", { d: new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) }) : tr("Due today — paid? Tick it")}</span></button>
                {x.pay.kind === "radar" ? <button onClick={() => { payRadar(x.pay.id, false); setNote(tr("Marked as not renewed — {t}", { t: x.title })); setTick((n) => n + 1); }} className="c-sub text-[12px] shrink-0 px-1" data-testid="home-pay-no">{tr("No")}</button> : null}
                <span className="c-pill due"><span className="c-num">{fmt(x.amount)}</span></span>
              </div>
            ) : x.from === "scout" || x.from === "learn" || x.low ? (
              <button key={i} onClick={() => navTo(x.from)} className="w-full flex items-center gap-3 py-2 text-start" data-testid={"home-wait-" + (x.low ? "supply" : x.from)}>
                {(() => { const I = x.low ? AlertTriangle : ICON[x.from]; return <I size={17} className={x.low ? "c-warn shrink-0" : "c-acc shrink-0"} />; })()}
                <b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{x.title}</b><ChevronRight size={15} className="c-sub shrink-0 rtl:-scale-x-100" /></button>
            ) : (
              <button key={i} onClick={() => navTo(x.from === "life" ? "life" : x.from === "radar" ? "radar" : x.from === "care" ? "care" : "money")} className="w-full flex items-center gap-3 py-2 text-start" data-testid="home-due">
                <span className="w-[18px] h-[18px] rounded-md shrink-0" style={{ border: "1.6px solid var(--c-mut)" }} />
                <span className="flex-1 min-w-0"><b className="block truncate text-[14px]" dir="auto">{x.title}</b><span className="c-sub">{x.dose ? (x.late ? tr("Late") : tr("Medicine due")) : x.late ? tr("Late") : new Date(x.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></span>
                {x.dose ? null : <span className={"c-pill " + (x.late ? "late" : x.dir === "in" ? "" : "due")}><span className="c-num">{x.dir === "in" ? "+" : ""}{fmt(x.amount)}</span></span>}
              </button>))}
            {note ? <p className="c-pos text-[13px] m-0 py-1" data-testid="home-regular-note" dir="auto">✓ {note}</p> : null}
            {data.reminders ? <button onClick={() => navTo("reminders")} className="w-full flex items-center gap-3 py-2 text-start c-sub"><Zap size={15} />{tr("{n} reminders today", { n: data.reminders })}</button> : null}
          </>) : (
          null)}
      </div> : null}
      {!minimal ? <>
      {/* v6.28 (Ali: "Fit & Food should be on the Home page"): today's food, water and the four meals — tap a meal to add to it */}
        {/* v6.31 minimal: the "set it up" card is an advert — Home shows Fit & Food once it has your numbers */}
        {minimal && !data.fitOn ? null : <FitToday key={"fit" + tick} openFit={() => navTo("fit")} compact />}
        {guardian || null}
        {data.o.monthOut || data.o.budget ? <div>
          <button className="c-card text-start w-full" onClick={() => navTo("money")} data-testid="home-spent">
            <span className="c-lbl">{tr("Spent this month")}</span>
            <div className="c-num text-[20px] font-bold mt-0.5">{fmt(data.o.monthOut)}</div>
            <div className="c-sub">{data.o.budget ? tr("of {b} {c}", { b: fmt(data.o.budget), c: data.o.cur }) : data.o.cur}</div>
            {data.o.budget ? <div className="c-bar mt-2"><i style={{ width: pct(data.o.monthOut, data.o.budget) + "%" }} /></div> : null}
          </button>
        </div> : null}
        {data.recent.length ? <div data-testid="home-recent">
          <p className="c-lbl m-0 mb-2">{tr("Recent")}</p>
          <div className="c-list">
            {data.recent.map(({ t: [id, label, sub, I], line }) => (
              <button key={id} onClick={() => navTo(id)} className="w-full text-start flex items-center gap-3 p-3" data-testid={"home-recent-" + id}>
                <span className="c-ic"><I size={16} /></span>
                <span className="flex-1 min-w-0"><b className="block text-[14px]">{tr(label)}</b>{line || !minimal ? <span className="c-sub block truncate" dir="auto">{line || tr(sub)}</span> : null}</span>
                <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" /></button>))}
          </div>
          <button onClick={openAll} className="c-acc text-[13px] font-medium mt-2" data-testid="home-all">{tr("All tools")} →</button>
        </div> : null}
      </> : <>
      {/* v6.50: no row of app names — type "/" for every app (Ali: "everything in the app available via home chat") */}
      {rep ? <>{guardian || null}
      <MissionsLine go={() => navTo("missions")} /></> : null}
      {/* v6.43: one line for today across the apps — what you ate, spent, and what is still ahead */}
      <div data-testid="home-line">
        <div className="flex items-center justify-between mb-2"><p className="c-lbl m-0">{tr("Your day")}</p>
          {!rep ? <button onClick={() => setRep(true)} className="text-[12.5px] font-extrabold c-acc inline-flex items-center gap-1 bg-transparent border-0 p-0" data-testid="home-see-all">{tr("See all")}<ChevronRight size={14} className="rtl:rotate-180" /></button> : null}</div>
        {data.line.length ? <div className="space-y-2">
          {(rep ? data.line : data.line.slice(0, 3)).map((x, i) => (
            <button key={i} onClick={() => openLine(x.open)} className="w-full flex items-start gap-3 text-start" data-testid={"home-line-" + x.app}>
              <span className="w-12 shrink-0 pt-3 text-[12.5px] font-extrabold c-sub c-num">{x.hm}</span>
              <span className={"flex-1 min-w-0 c-card p-3 " + (x.ahead ? "opacity-80" : "")}>
                <span className="block text-[11px] font-extrabold tracking-wide" style={{ color: LINE_COL[x.app] || "var(--c-acc)" }}>{tr(LINE_APP[x.app] || x.app).toUpperCase()}</span>
                <b className="block text-[14px] truncate" dir="auto">{x.title}</b>{x.sub ? <span className="c-sub block text-[12.5px] truncate" dir="auto">{x.sub}</span> : null}</span>
            </button>))}
        </div> : freshApp() ? <EmptyStart testid="home-empty" title={tr("Your day starts here")} sub={tr("Write anything the way you'd say it — Attune puts it where it belongs.")}
            examples={ar ? ["غدا 150، تاكسي 60", "أحمد عليه 500", "فكرني بكرة الساعة 9"] : ["lunch 150, taxi 60", "Ahmed owes me 500", "remind me tomorrow at 9"]}
            onPick={(x) => { setText(x); try { const el = document.querySelector("[data-testid=home-box] textarea"); if (el) el.focus(); } catch (e) {} }} />
          : <p className="c-sub text-[13px] m-0" data-testid="home-line-empty">{tr("Nothing yet today — tell the box what you ate, spent or need to remember.")}</p>}
      </div>
      {!rep ? <button onClick={() => setRep(true)} className="w-full min-h-[50px] rounded-[20px] px-4 flex items-center justify-between gap-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" }} data-testid="home-see-report">
        <span className="font-extrabold text-[14px]">{tr("See all")}</span>
        <span className="c-sub text-[12.5px] inline-flex items-center gap-1.5">{tr("My report")}<ChevronRight size={16} className="c-acc rtl:rotate-180" /></span></button> : null}
      {/* v6.46 Home A: one thing Attune noticed (home-now.js) — in My report */}
      {seen && rep ? <button onClick={() => (seen.k === "past" && cmd ? cmd.openRecord({ id: seen.id }) : openLine(seen.open))} className="w-full rounded-[20px] p-3.5 flex items-start gap-2.5 text-start" style={{ background: "var(--c-soft)", color: "var(--c-ink)" }} data-testid="home-noticed" data-k={seen.k}>
        <Sparkles size={17} className="c-acc shrink-0 mt-0.5" /><span className="text-[13.5px] leading-snug" dir="auto">{seen.text}</span></button> : null}
      </>}
    </div>);
}

function MonthCard() {
  const n = new Date(), key = "attune:month-review:" + n.getFullYear() + "-" + n.getMonth();
  const [hidden, setHidden] = useState(() => { try { return !!localStorage.getItem(key); } catch (e) { return false; } });
  const lines = useMemo(() => {
    if (n.getDate() > 3) return [];
    let fit = null; try { fit = JSON.parse(localStorage.getItem("attune:fit:v1") || "null"); } catch (e) {}
    let guardian = null; try { guardian = JSON.parse(localStorage.getItem("attune:guardian:v1") || "null"); } catch (e) {}
    const L = loadLedger(); return reviewLines(monthReview({ ledger: L, life: loadLife(), fit, guardian }), getLang() === "ar" ? "ar" : "en", (L && L.currency) || "");
  }, []);
  if (hidden || !lines.length) return null;
  return <div className="c-card space-y-1" data-testid="home-month-review">
    <div className="flex items-center gap-2"><b className="flex-1 text-[14px]">{tr("Last month in one look")}</b>
      <button onClick={() => { try { localStorage.setItem(key, "1"); } catch (e) {} setHidden(true); }} className="c-sub text-[12px] min-h-[36px] px-2" data-testid="home-month-hide">{tr("Hide")}</button></div>
    {lines.map((l, i) => <p key={i} className={"m-0 text-[13.5px] " + (i ? "c-sub" : "font-bold")} dir="auto">{l}</p>)}
  </div>;
}

// v8.7 (Ali picked persona 3's P3-A and point 6): the trial on Home — from day 5 "2 days of Pro left · you used it for …",
// and once when it ends "Money, Follow-ups and unlimited answers stay free" — each with Keep Pro
function TrialLine({ trial }) {
  const [seen, setSeen] = useState(() => { try { return !!localStorage.getItem("attune:trial-end-seen"); } catch (e) { return false; } });
  const ar = getLang() === "ar";
  const note = trialNote({ ...trial, seenEnd: seen }, ar ? "ar" : "en");
  if (!note) return null;
  const close = () => { if (note.kind === "ended") { try { localStorage.setItem("attune:trial-end-seen", "1"); } catch (e) {} setSeen(true); } };
  return <div className="c-card space-y-1.5" data-testid="home-trial" data-kind={note.kind}>
    <p className="m-0 text-[14px] font-extrabold" dir="auto">{note.kind === "ending" ? tr(note.left === 1 ? "1 day of Pro left" : "{n} days of Pro left", { n: note.left }) : tr("Your Pro trial ended")}</p>
    <p className="m-0 text-[13px] c-sub" dir="auto">{note.used ? tr("You used it for {x}.", { x: note.used }) + " " : ""}{note.kind === "ended" ? tr("Money, Follow-ups and unlimited answers stay free.") : ""}</p>
    <div className="flex gap-2"><button onClick={() => { close(); trial.open(); }} className="h-10 px-4 rounded-full text-[13.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="home-trial-keep">{tr("Keep Pro")}</button>
      {note.kind === "ended" ? <button onClick={close} className="h-10 px-3 c-sub text-[13px]" data-testid="home-trial-close">{tr("Not now")}</button> : null}</div>
  </div>;
}
