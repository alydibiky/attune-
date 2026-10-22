/* ---- More → Learn daily, and More → Daily news -------------------------------------------
   The logic is in daily.js; this file is the screens, the daily
   notifications (one repeating notification per course / topic, id
   "daily-learn-…" / "daily-news-…") and the home-screen widget's text.    */
import { neutral } from "./industry.js";   // v6.50 a neutral app
import React, { useState, useEffect, useRef } from "react";
import { GraduationCap, Newspaper, Plus, Trash2, ChevronLeft, ChevronRight, Check, X, Loader2, Bell, RefreshCw, Sparkles, ImageIcon, CheckCircle2, AlertTriangle, Clock, Layers, BookOpen, HelpCircle } from "lucide-react";
import { getLang, tr } from "./i18n.js";
import { useSubBack, useSticky } from "./backstack.js";
import { Md } from "./chat.jsx";
import * as D from "./daily.js";
import { useListen, ListenBar } from "./lesson-ui.jsx";
import { PANES, LEFT, RIGHT, GRID3, DeskEmpty } from "./desk.jsx";
import { useDesktopWide } from "./side-ui.jsx";
import { SpeakPractice, DialogueCard, LessonPicture, PackCourses } from "./speak-ui.jsx";
import * as PC from "./packcourse.js";
import * as SP from "./speak.js";

const CKEY = "attune:daily:courses:v1", NKEY = "attune:daily:news:v1";
const load = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const loadCourses = () => load(CKEY);
export const loadTopics = () => load(NKEY);

const field = "w-full min-w-0 bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-lg px-2.5 py-2 text-sm text-[var(--c-ink)] focus:outline-none focus:border-[var(--c-acc)]";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-[var(--c-acc)] text-[var(--c-on-acc)]";
// (v5.13: a field that must NOT stretch — "w-full" beat "w-28" and squeezed
// the label next to it into one letter per line.)
const fieldFixed = field.replace("w-full ", "");
const ghost = btn + " border border-[var(--c-ln)] text-[var(--c-ink)]";

/* v6.34 (Ali 17 Oct: "I want the lesson to be ready when the user opens the app"): while a model is loaded and nothing else
   runs, the app keeps ONE unread lesson written ahead for every course — the next one is waiting when Learn opens. One at a
   time (WRITING is shared with the Learn page), never over a newer lesson, never when a quiz is due. */
let WRITING = false;
export async function lessonAhead(llm, native) {
  if (WRITING) return null;
  try { if (localStorage.getItem("attune:learn:ahead") === "0") return null; } catch (e) {}
  for (const c of loadCourses()) {
    if (c.pack || !c.plan || !c.plan.length) continue;
    if ((c.lessons || []).some((l) => !l.done)) continue;
    const n = D.nextIndex(c); if (n >= c.plan.length || D.quizDue(c)) continue;
    WRITING = true;
    try {
      const p = await D.writeLesson(llm, c, n);
      if (!p) return null;
      const all = loadCourses(), c0 = all.find((x) => x.id === c.id);
      if (!c0 || c0.lessons.some((l) => l.n >= n)) return null;
      const list = all.map((x) => (x.id === c.id ? D.addLesson(c0, n, p) : x));
      store(CKEY, list); syncDaily(native, list);
      try { window.dispatchEvent(new Event("attune:learn-updated")); } catch (e) {}
      return { id: c.id, n };
    } catch (e) { return null; } finally { WRITING = false; }
  }
  // then: a course near its end plans its next 20 lessons by itself (v6.34: a language doesn't stop at 30)
  for (const c of loadCourses()) {
    if (!c.plan || !c.plan.length) continue;
    if (D.needsMore(c) && !(c.moreTriedAt > Date.now() - 6 * 3600000)) {   // (a failed try waits 6 h — not every 20 s)
      WRITING = true;
      { const all = loadCourses(); store(CKEY, all.map((x) => (x.id === c.id ? { ...x, moreTriedAt: Date.now() } : x))); }
      try {
        const c2 = D.addMore(c, await llm(D.moreMessages(c), { maxTokens: 1400, temperature: 0.3 }));
        if (c2) { const all = loadCourses(); const list = all.map((x) => (x.id === c.id ? { ...x, plan: c2.plan, parts: c2.parts, moreTriedAt: 0 } : x)); store(CKEY, list); syncDaily(native, list); try { window.dispatchEvent(new Event("attune:learn-updated")); } catch (e) {} return { id: c.id, more: c2.plan.length - c.plan.length }; }
      } catch (e) { return null; } finally { WRITING = false; }
      return null;
    }
  }
  return null;
}
/** The live "writing…" preview without markdown signs (it showed «**# Mastering Turkish Sounds ##»). */
export const plainPreview = (t) => String(t || "").replace(/```[\s\S]*?(```|$)/g, " ").replace(/^\s*[{\["]+.*?:\s*"?/, "").replace(/[#*_`>|]+/g, " ").replace(/\\n|\n+/g, " ").replace(/\s+/g, " ").trim();

/** Daily notifications + the widget, from the saved courses and topics. Safe to call often. */
export function syncDaily(native, courses = loadCourses(), topics = loadTopics(), now = Date.now()) {
  if (!native) return;
  const wanted = new Set();
  if (native.schedule) {
    for (const c of courses) if (c.notify !== false && c.plan && c.plan.length) {
      const id = "daily-learn-" + c.id, n = D.lessonNotice(c); wanted.add(id);
      try { native.schedule(JSON.stringify({ id, at: D.nextAt(c.time, now), title: n.title, body: n.body, repeat: "daily" })); } catch (e) {}
    }
    for (const t of topics) if (t.notify !== false) {
      const id = "daily-news-" + t.id, n = D.newsNotice(t); wanted.add(id);
      try { native.schedule(JSON.stringify({ id, at: D.nextAt(t.time, now), title: n.title, body: n.body, repeat: "daily" })); } catch (e) {}
    }
    try { for (const x of JSON.parse(native.scheduled() || "[]")) if (/^daily-(learn|news)-/.test(x.id) && !wanted.has(x.id)) native.unschedule(x.id); } catch (e) {}
  }
  if (native.setWidget) {
    const c = courses[0], t = topics[0];
    const w = {};
    if (c) { const n = D.lessonNotice(c); w.lesson = { label: n.title, title: n.body, open: "daily-learn-" + c.id }; }
    if (t) { const n = D.newsNotice(t); w.news = { label: n.title, title: n.body, open: "daily-news-" + t.id }; }
    try { native.setWidget(JSON.stringify(w)); } catch (e) {}
  }
}

function Back({ onClick, label }) {
  return <button onClick={onClick} className="text-[var(--c-mut)] text-sm flex items-center gap-1"><ChevronLeft size={16} />{label || tr("Back")}</button>;
}
function Working({ what, text }) {
  return (
    <div className="rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] p-3" data-testid="daily-working">
      <p className="text-[13px] text-[var(--c-acc)] flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />{what}</p>
      {text ? <p className="text-[12px] text-[var(--c-mut)] mt-1.5 line-clamp-3 break-words" dir="auto">{text.slice(-300)}</p> : null}
    </div>
  );
}

// ---- the visuals a lesson can carry -----------------------------------------------------------
export function Visual({ v }) {
  const [flipped, setFlipped] = useState({});
  if (!v) return null;
  const head = v.title ? <p className="text-[12px] font-semibold text-[var(--c-ink)] mb-2" dir="auto">{v.title}</p> : null;
  const box = "rounded-xl border border-[var(--c-acc)]/40 bg-gradient-to-b from-[var(--c-soft)] to-transparent p-3";
  if (v.kind === "table") return (
    <div className={box} data-testid="visual-table">{head}
      <div className="overflow-x-auto"><table className="text-[13px] min-w-full"><thead><tr>{v.columns.map((c, i) => <th key={i} className="text-start px-2 py-1.5 text-[var(--c-acc)] font-semibold border-b border-[var(--c-ln)] whitespace-nowrap" dir="auto">{c}</th>)}</tr></thead>
        <tbody>{v.rows.map((r, i) => <tr key={i} className="border-b border-[var(--c-ln)]">{r.map((x, j) => <td key={j} className={`px-2 py-1.5 whitespace-nowrap ${j === 0 ? "text-[var(--c-ink)] font-medium" : "text-[var(--c-ink)]"}`} dir="auto">{x}</td>)}</tr>)}</tbody></table></div>
    </div>);
  if (v.kind === "steps") return (
    <div className={box} data-testid="visual-steps">{head}
      {v.items.map((x, i) => (
        <div key={i}>
          <div className="flex gap-2.5 items-start rounded-lg bg-[var(--c-surf)] border border-[var(--c-ln)] p-2.5">
            <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-[13px] text-[var(--c-ink)] pt-0.5" dir="auto">{x}</span></div>
          {i < v.items.length - 1 ? <div className="text-center text-[var(--c-acc)] leading-none py-0.5">↓</div> : null}
        </div>))}
    </div>);
  if (v.kind === "cards") return (
    <div className={box} data-testid="visual-cards">{head}<p className="text-[11px] text-[var(--c-mut)] mb-2">{tr("Tap a card to turn it over")}</p>
      <div className="grid grid-cols-2 gap-2">
        {v.items.map((x, i) => (
          <button key={i} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} className={`rounded-lg border p-2.5 min-h-[4.5rem] text-start ${flipped[i] ? "border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10" : "border-[var(--c-ln)] bg-[var(--c-surf)]"}`}>
            {flipped[i] ? <><span className="block text-[13px] text-[var(--c-warn)]" dir="auto">{x.back}</span>{x.note ? <span className="block text-[11px] text-[var(--c-mut)] mt-1" dir="auto">{x.note}</span> : null}</>
              : <span className="block text-[15px] font-semibold text-[var(--c-ink)]" dir="auto">{x.front}</span>}
          </button>))}
      </div>
    </div>);
  if (v.kind === "compare") return (
    <div className={box} data-testid="visual-compare">{head}
      <div className="grid grid-cols-2 gap-2">
        {[v.left, v.right].map((s, k) => (
          <div key={k} className={`rounded-lg p-2.5 border ${k ? "border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10" : "border-[var(--c-acc)]/40 bg-[var(--c-soft)]"}`}>
            <p className={`text-[12px] font-semibold mb-1 ${k ? "text-[var(--c-warn)]" : "text-[var(--c-acc)]"}`} dir="auto">{s.title}</p>
            {s.items.map((x, i) => <p key={i} className="text-[12px] text-[var(--c-ink)] mt-1" dir="auto">• {x}</p>)}
          </div>))}
      </div>
    </div>);
  if (v.kind === "bars") {
    const max = Math.max(...v.items.map((x) => Math.abs(x.value)), 1);
    return (
      <div className={box} data-testid="visual-bars">{head}
        {v.items.map((x, i) => (
          <div key={i} className="mb-1.5">
            <div className="flex justify-between text-[12px]"><span className="text-[var(--c-ink)]" dir="auto">{x.label}</span><span className="text-[var(--c-mut)] tabular-nums">{x.value}{v.unit ? " " + v.unit : ""}</span></div>
            <div className="h-2 rounded bg-[var(--c-surf-2)]"><div className="h-2 rounded bg-[var(--c-acc)]" style={{ width: `${Math.max(2, Math.round((Math.abs(x.value) / max) * 100))}%` }} /></div>
          </div>))}
      </div>);
  }
  if (v.kind === "timeline") return (
    <div className={box} data-testid="visual-timeline">{head}
      <div className="border-s-2 border-[var(--c-acc)]/40 ms-1.5 ps-3 space-y-2">
        {v.items.map((x, i) => (
          <div key={i} className="relative"><span className="absolute -start-[1.13rem] top-1 w-2.5 h-2.5 rounded-full bg-[var(--c-acc)]" />
            {x.when ? <p className="text-[11px] text-[var(--c-acc)]" dir="auto">{x.when}</p> : null}<p className="text-[13px] text-[var(--c-ink)]" dir="auto">{x.what}</p></div>))}
      </div>
    </div>);
  return null;
}

// ================================ Learn daily ================================
/* v6.28 rework (Ali: "finish Learn daily and rework its logic and UI"). Calm design. Each course shows ONE plan for today, in order:
   review the cards (made by code from the lessons you read, no model needed) → today's lesson → the quiz. The course plan and the
   settings sit below, small. On a computer the course stays on the left and the lesson, review or quiz opens on the right. */
const cf = { background: "var(--c-bg)", border: "1px solid var(--c-ln)", color: "var(--c-ink)" };
const cField = "w-full min-w-0 rounded-lg px-2.5 py-2 text-sm focus:outline-none";
const cGhost = "rounded-lg px-3 py-2 text-[13px] font-medium border disabled:opacity-40";
const gs = { borderColor: "var(--c-ln)", color: "var(--c-ink)", background: "transparent" };
function CBack({ onClick, label }) {
  return <button onClick={onClick} className="c-sub flex items-center gap-1 text-[13px]"><ChevronLeft size={16} className="rtl:-scale-x-100" />{label || tr("Back")}</button>;
}
function CWorking({ what, text }) {
  return (
    <div className="c-card" data-testid="daily-working">
      <p className="text-[13px] c-acc flex items-center gap-1.5 m-0"><Loader2 size={14} className="animate-spin" />{what}</p>
      {text ? <p className="c-sub mt-1.5 line-clamp-3 break-words" dir="auto">{plainPreview(text).slice(-300)}</p> : null}
    </div>);
}
/** v6.34 (Ali: "I want to add lessons"): your own lesson at the end of a course — written like the others, in its turn. */
function AddLesson({ onAdd }) {
  const [open, setOpen] = useState(false), [t, setT] = useState("");
  if (!open) return <button className="c-acc text-[13px] font-medium flex items-center gap-1" onClick={() => setOpen(true)} data-testid="learn-add-lesson"><Plus size={14} />{tr("Add a lesson")}</button>;
  const add = () => { const v = t.trim(); if (!v) return; onAdd(v.slice(0, 120)); setT(""); setOpen(false); };
  return <div className="flex gap-2"><input autoFocus value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={tr("What should the lesson be about?")} className={cField} style={cf} dir="auto" data-testid="learn-add-title" />
    <button className="c-btn px-3 shrink-0" onClick={add} disabled={!t.trim()} data-testid="learn-add-save">{tr("Add")}</button></div>;
}
/** One step of today: an icon (a tick once done), what it is, and a line under it. */
function Step({ icon: I, title, sub, done, onClick, testid, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} data-testid={testid} className="w-full text-start flex items-center gap-3 p-3 disabled:opacity-60">
      <span className="c-ic" style={done ? { background: "transparent", border: "1px solid var(--c-ln)", color: "var(--c-pos)" } : undefined}>{done ? <Check size={16} /> : <I size={16} />}</span>
      <span className="flex-1 min-w-0"><b className="block text-[14px] font-semibold" dir="auto" style={done ? { color: "var(--c-mut)" } : undefined}>{title}</b>{sub ? <span className="c-sub block" dir="auto">{sub}</span> : null}</span>
      {!done && !disabled ? <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" /> : null}
    </button>);
}
const frame = (el, testid) => <div className="calm rounded-2xl p-4 md:p-6" style={{ minHeight: "70vh" }} data-testid={testid}>{el}</div>;
const fmtDay = (t) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const cardsWord = (n) => (n === 1 ? tr("1 card") : tr("{n} cards", { n }));

export function LearnPage({ llm, modelReady, openEngine, flash, native, call, openId, clearOpen, illustrate, listen }) {
  const [courses, setCoursesRaw] = useState(loadCourses);
  const [cur, setCur] = useSticky("learn:cur", null);                 // course id
  const [view, setView] = useSticky("learn:view", "list");             // list | new | course | lesson | quiz | review
  const [lessonN, setLessonN] = useSticky("learn:lesson", null);
  const [busy, setBusy] = useState(null);               // { what, text }
  const [quiz, setQuiz] = useSticky("learn:quiz", null);               // { lessons, questions, i, picks }
  const [rev, setRev] = useSticky("learn:rev", null);                  // { ids, i, shown, knew, again: [ids] }
  const [form, setForm] = useState({ topic: "", level: "beginner", lang: getLang() === "ar" ? "ar" : "en", time: "08:00", quizEvery: 5, goal: "" });
  const [confirmDel, setConfirmDel] = useState(false);
  const [allPlan, setAllPlan] = useState(false);
  const running = useRef(false);
  const wide = useDesktopWide();
  const course = courses.find((c) => c.id === cur) || null;
  // v6.27: Listen — the open lesson read aloud by the phone's voice, paragraph by paragraph (the one being read is highlighted)
  const openLesson = view === "lesson" && course ? course.lessons.find((x) => x.n === lessonN) : null;
  const paras = openLesson ? String(openLesson.body || "").split(/\n{2,}/).filter((x) => x.trim()) : [];
  const listenParts = openLesson ? [openLesson.title, ...paras, ...((openLesson.keyPoints || []).length ? [tr("Remember") + ": " + openLesson.keyPoints.join(". ")] : [])] : [];
  const L = useListen(listenParts, { lang: course && course.lang && course.lang !== "auto" ? course.lang : getLang(), native: native ? { N: native, call } : null });
  const hl = (k) => (L.at === k ? { background: "rgba(79,194,175,.12)", borderRadius: 8, transition: "background .3s" } : { transition: "background .3s" });
  // Back — lesson / quiz / review → the course → all courses
  useSubBack(view !== "list", () => { if (["lesson", "quiz", "review", "past"].includes(view)) { L.stop(); setQuiz(null); setRev(null); setView("course"); } else { setView("list"); setCur(null); } });
  const setCourses = (list) => { store(CKEY, list); setCoursesRaw(list); syncDaily(native, list); };
  const putCourse = (c) => setCourses([c, ...loadCourses().filter((x) => x.id !== c.id)].sort((a, b) => a.created - b.created));
  const latest = () => loadCourses().find((x) => x.id === cur) || course;

  // v6.27: opened from CV → Job ready with a skill to learn — the new-course form, filled in
  useEffect(() => { let t = ""; try { t = localStorage.getItem("attune:learn:seed") || ""; localStorage.removeItem("attune:learn:seed"); } catch (e) {} if (t) { setForm((f) => ({ ...f, topic: t })); setView("new"); } }, []);
  // opened from the notification or the widget
  useEffect(() => {
    if (!openId) return;
    const c = courses.find((x) => "daily-learn-" + x.id === openId) || courses[0];
    if (c) { setCur(c.id); setView("course"); }
    clearOpen && clearOpen();
  }, [openId]);

  const gen = async (what, messages, maxTokens, temperature = 0.4) => {
    let acc = "";
    setBusy({ what, text: "" });
    try { return await llm(messages, { maxTokens, temperature, onToken: (t) => { acc = t; setBusy({ what, text: acc }); } }); }
    finally { setBusy(null); }
  };

  const makeLesson = async (c, n) => {
    if (running.current || WRITING) return null;
    running.current = true; WRITING = true;
    try {
      // v6.32 a course from a Knowledge pack: the section's own text — shown as it is, or explained from it by the model
      if (c.pack) {
        const title = c.pack.titles[n] || c.plan[n];
        const r = await call("knowSection", { pack: c.pack.id, title });
        const passages = (r && r.passages) || [];
        if (!passages.length) { flash(tr("That section isn't in the pack on this phone — is the pack still installed?")); return null; }
        const base = PC.lessonFromPassages(c, n, passages);
        let p = base;
        if (modelReady) { try { const q = D.parseLesson(await gen(tr("Writing lesson {n}: {t}", { n: n + 1, t: c.plan[n] || "" }), PC.packLessonMessages(c, n, passages), 1600, 0.3)); if (q.body.length >= 200) p = { ...q, keyPoints: q.keyPoints.length ? q.keyPoints : base.keyPoints, source: base.source, original: base.body }; } catch (e) {} }
        const next = D.addLesson(loadCourses().find((x) => x.id === c.id) || c, n, p);
        putCourse(next);
        return next;
      }
      // v6.34: written, cleaned, checked and repaired by code (daily.js writeLesson) — a glitch of the model never reaches the page
      const what0 = tr("Writing lesson {n}: {t}", { n: n + 1, t: c.plan[n] || "" });
      let acc = ""; setBusy({ what: what0, text: "" });
      let p = null;
      try {
        p = await D.writeLesson((m, o) => llm(m, { ...o, onToken: (t) => { acc = t; setBusy((b) => (b ? { ...b, text: acc } : b)); } }), c, n, {
          onStage: (st) => { acc = ""; setBusy({ what: st === "extras" ? tr("Making the diagram and flashcards…") : st === "retry" ? tr("Checking it and writing it again…") : what0, text: "" }); } });
      } finally { setBusy(null); }
      if (!p) { flash(tr("The lesson came out too short — try again.")); return null; }
      const next = D.addLesson(loadCourses().find((x) => x.id === c.id) || c, n, p);
      putCourse(next);
      return next;
    } catch (e) { flash(String(e.message || e)); return null; }
    finally { running.current = false; WRITING = false; }
  };
  // v6.34 (Ali: "a language takes more than 30 lessons"): the next 20 lessons of the course, planned from the ones before
  const planMore = async (c) => {
    if (running.current || WRITING) return null;
    running.current = true; WRITING = true;
    try {
      const out = await gen(tr("Planning the next {n} lessons…", { n: D.MORE_N }), D.moreMessages(latest() || c), 1400, 0.3);
      const c2 = D.addMore(loadCourses().find((x) => x.id === c.id) || c, out);
      if (!c2) { flash(tr("The model didn't produce more lessons — try again.")); return null; }
      putCourse(c2); flash(tr("{n} more lessons added", { n: c2.plan.length - c.plan.length })); return c2;
    } catch (e) { flash(String(e.message || e)); return null; }
    finally { running.current = false; WRITING = false; }
  };
  // a lesson written ahead in the background shows up at once
  useEffect(() => { const on = () => setCoursesRaw(loadCourses()); window.addEventListener("attune:learn-updated", on); return () => window.removeEventListener("attune:learn-updated", on); }, []);

  // a ready course starts at once — its plan is built in
  const startReady = async (id) => {
    const c = D.readyCourse(id, { lang: getLang() === "ar" ? "ar" : "en", time: form.time || "08:00" });
    if (!c) return;
    // the same ready course twice made two "Turkish" courses (Home listed lesson 2 above lesson 1): open the one you have
    const had = loadCourses().find((x) => !x.pack && String(x.topic).toLowerCase() === String(c.topic).toLowerCase() && x.plan.length === c.plan.length);
    if (had) { setCur(had.id); setView("course"); return; }
    putCourse(c); setCur(c.id); setView("course");
    if (modelReady) await makeLesson(c, 0);
  };
  const create = async () => {
    let c = D.newCourse(form);
    try {
      const out = await gen(tr("Planning your course, beginner to expert…"), D.planMessages(c), 1500, 0.3);
      const p = D.parsePlan(out);
      if (!p) { flash(tr("The model didn't produce a course plan — try again.")); return; }
      c = { ...c, plan: p.plan, title: p.title || c.topic };
      putCourse(c); setCur(c.id); setView("course");
      await makeLesson(c, 0);
    } catch (e) { flash(String(e.message || e)); }
  };

  const today = course ? D.todaysLesson(course) : null;
  // opening a course with nothing to read yet: prepare today's lesson
  useEffect(() => {
    if (view === "course" && course && !today && (modelReady || course.pack) && course.plan.length && !running.current && D.nextIndex(course) < course.plan.length) makeLesson(course, D.nextIndex(course));
  }, [view, cur]);

  const openL = (c, n) => { putCourse(D.openLesson(c, n)); setLessonN(n); setView("lesson"); };
  const startReview = () => { const ids = D.cardsDue(course).map((k) => k.id); if (!ids.length) return; L.stop(); setRev({ ids, i: 0, shown: false, knew: 0, again: [] }); setView("review"); };
  async function startQuiz(lessons) {
    try {
      // v6.32 a pack course with no model: the quiz is made by code from the lessons' definitions (or passed when there are too few)
      if (course.pack && !modelReady) {
        const qs = PC.codeQuiz(lessons, { ar: getLang() === "ar" });
        if (qs.length < 3) { putCourse({ ...latest(), quizzes: [...latest().quizzes, { after: Math.max(...lessons.map((l) => l.n)), skipped: true, at: Date.now() }] }); flash(tr("Not enough terms for a quiz yet — on to the next lesson.")); return; }
        setQuiz({ lessons: lessons.map((l) => l.n), questions: qs, i: 0, picks: {} }); setView("quiz"); return;
      }
      let qs = [];
      for (let i = 0; i < 2 && qs.length < 3; i++) qs = D.groundQuiz(D.parseQuiz(await gen(tr("Writing your quiz…"), D.quizMessages(course, lessons), 1600, i ? 0.5 : 0.3), course.id + lessons.length + i), lessons);
      if (qs.length < 3) { flash(tr("Couldn't make a good quiz this time — try again.")); return; }
      setQuiz({ lessons: lessons.map((l) => l.n), questions: qs, i: 0, picks: {} }); setView("quiz");
    } catch (e) { flash(String(e.message || e)); }
  }

  // ---- screens ----
  if (view === "new") return frame(
    <section className="space-y-4" data-testid="learn-new">
      <CBack onClick={() => setView("list")} label={tr("Learn daily")} />
      <div className={PANES}>
      <div className="space-y-2 min-w-0 lg:col-start-2 lg:row-start-1">
        <p className="c-lbl">{tr("Ready courses")}</p>
        <div className="c-list" data-testid="learn-ready">
          {neutral(D.READY_COURSES, "courses").map((r) => (
            <button key={r.id} onClick={() => startReady(r.id)} data-testid={"learn-ready-" + r.id} className="w-full text-start p-3 flex items-center gap-3">
              <span className="text-2xl">{r.emoji}</span>
              <span className="min-w-0 flex-1"><b className="block text-[14px]">{r.title[getLang() === "ar" ? 1 : 0]}</b>
                <span className="c-sub block truncate">{r.plan.slice(0, 3).map((p) => p[getLang() === "ar" ? 1 : 0]).join(" · ")}…</span></span>
              <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" />
            </button>))}
        </div>
        <p className="c-sub">{tr("A ready course starts at once: its lessons are already planned; each is written on your device when its day comes.")}</p>
        <PackCourses native={native} call={call} flash={flash} onStart={async (c) => { putCourse(c); setCur(c.id); setView("course"); await makeLesson(c, 0); }} />
      </div>
      <div className="c-card space-y-3 mt-4 lg:mt-0 lg:col-start-1 lg:row-start-1 lg:sticky lg:top-4">
        <p className="c-lbl">{tr("Or any topic you like")}</p>
        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={cField} style={cf} dir="auto" placeholder={tr("A language, a skill, a subject…")} data-testid="learn-topic" />
        <div className="flex flex-wrap gap-1.5">{["Turkish", "English", "Photography", "Excel & Power Automate", "Java", "Economics", "Tajweed"].map((x) =>
          <button key={x} onClick={() => setForm({ ...form, topic: tr(x) })} className="text-[12px] rounded-full border px-2.5 py-1" style={gs}>{tr(x)}</button>)}</div>
        <textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} rows={2} className={cField} style={cf} dir="auto" placeholder={tr("Your goal (optional) — e.g. speak like a native, pass an exam, understand my car")} />
        <div className="grid grid-cols-2 gap-2">
          <label className="block"><span className="c-sub block mb-1">{tr("Level")}</span>
            <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={cField} style={cf}>{D.LEVELS.map((l) => <option key={l} value={l}>{tr(l[0].toUpperCase() + l.slice(1))}</option>)}</select></label>
          <label className="block"><span className="c-sub block mb-1">{tr("Explained in")}</span>
            <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={cField} style={cf}><option value="en">English</option><option value="ar">العربية</option></select></label>
          <label className="block"><span className="c-sub block mb-1">{tr("Daily lesson at")}</span>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value || "08:00" })} className={cField} style={cf} /></label>
          <label className="block"><span className="c-sub block mb-1">{tr("A quiz every")}</span>
            <select value={form.quizEvery} onChange={(e) => setForm({ ...form, quizEvery: Number(e.target.value) })} className={cField} style={cf}>{[3, 5, 7].map((n) => <option key={n} value={n}>{tr("{n} lessons", { n })}</option>)}</select></label>
        </div>
        {busy ? <CWorking {...busy} /> : modelReady
          ? <button className="c-btn w-full py-2.5 disabled:opacity-40" disabled={form.topic.trim().length < 2} onClick={create} data-testid="learn-create">{tr("Plan my course")}</button>
          : <button className={cGhost + " w-full"} style={gs} onClick={openEngine}>{tr("Load a model first — lessons are written on your phone")}</button>}
      </div>
      </div>
    </section>, "learn-frame");

  if (view === "review" && course && rev) {
    const id = rev.ids[rev.i], card = id && (course.cards || []).find((k) => k.id === id);
    if (!card) {
      const total = rev.ids.length - rev.again.length;
      const t = D.todaysLesson(course);
      return beside(
        <section className="space-y-4" data-testid="review-done">
          <CBack onClick={() => { setRev(null); setView("course"); }} label={course.topic} />
          <p className="c-amt m-0">{rev.knew} / {total}</p>
          <p className="text-[14px] m-0">{rev.knew === total ? tr("You knew them all. They come back further apart now.") : tr("The ones you didn't know come back tomorrow; the rest further apart.")}</p>
          <div className="flex gap-2 flex-wrap">
            {t && !t.done ? <button className="c-btn" onClick={() => { setRev(null); openL(course, t.n); }} data-testid="review-to-lesson">{tr("Now today's lesson")}</button> : null}
            <button className={cGhost} style={gs} onClick={() => { setRev(null); setView("course"); }} data-testid="review-finish">{tr("Done")}</button>
          </div>
        </section>);
    }
    const grade = (knew) => {
      const c2 = D.gradeCard(latest(), id, knew);
      putCourse({ ...c2, reviewDay: D.dayKey() });
      const again = !knew && !rev.again.includes(id) ? [...rev.again, id] : rev.again;   // (missed → once more at the end of today's round)
      setRev({ ...rev, i: rev.i + 1, shown: false, knew: rev.knew + (knew && !rev.again.includes(id) ? 1 : 0), again, ids: again !== rev.again ? [...rev.ids, id] : rev.ids });
    };
    return beside(
      <section className="space-y-4 lg:max-w-[60ch]" data-testid="review">
        <CBack onClick={() => { setRev(null); setView("course"); }} label={course.topic} />
        <div className="flex justify-between c-sub c-num"><span>{tr("Review")}</span><span>{rev.i + 1} / {rev.ids.length}</span></div>
        <div className="c-bar"><i style={{ width: Math.round((rev.i / rev.ids.length) * 100) + "%" }} /></div>
        <button className="c-card w-full text-center min-h-[11rem] flex flex-col items-center justify-center gap-2" onClick={() => !rev.shown && setRev({ ...rev, shown: true })} data-testid="review-card">
          <span className="text-[22px] font-semibold" dir="auto">{card.front}</span>
          {rev.shown ? <>
            <span className="block w-16 border-t" style={{ borderColor: "var(--c-ln)" }} />
            <span className="text-[16px] c-acc" dir="auto" data-testid="review-back">{card.back}</span>
            {card.note ? <span className="c-sub" dir="auto">{card.note}</span> : null}</>
            : <span className="c-sub">{tr("Say it in your head, then tap")}</span>}
        </button>
        {!rev.shown ? <button className="c-btn w-full py-2.5" onClick={() => setRev({ ...rev, shown: true })} data-testid="review-show">{tr("Show the answer")}</button>
          : <div className="grid grid-cols-2 gap-2">
              <button className={cGhost + " py-2.5"} style={{ ...gs, borderColor: "var(--c-neg)", color: "var(--c-neg)" }} onClick={() => grade(false)} data-testid="review-again">{tr("Not yet")}</button>
              <button className="c-btn py-2.5" onClick={() => grade(true)} data-testid="review-knew">{tr("I knew it")}</button></div>}
        <p className="c-sub">{tr("From lesson {n}", { n: (card.n || 0) + 1 })}{card.lapses ? " · " + tr("missed {n}×", { n: card.lapses }) : ""}</p>
      </section>);
  }

  if (view === "quiz" && course && quiz) {
    const q = quiz.questions[quiz.i];
    if (!q) {
      const right = quiz.questions.filter((x, i) => quiz.picks[i] === x.answer).length;
      return beside(
        <section className="space-y-4" data-testid="quiz-result">
          <p className="c-amt m-0">{right} / {quiz.questions.length}</p>
          <p className="text-[14px] m-0">{right === quiz.questions.length ? tr("Perfect — well done!") : tr("What you missed is now a card in your review — it comes back tomorrow, then further apart, until you know it.")}</p>
          <button className="c-btn" onClick={() => { const f = D.finishQuiz(latest(), quiz, quiz.picks); putCourse(f.course); setQuiz(null); setView("course"); }} data-testid="quiz-finish">{tr("Done")}</button>
        </section>);
    }
    const picked = quiz.picks[quiz.i];
    return beside(
      <section className="space-y-4 lg:max-w-[64ch]" data-testid="quiz">
        <div className="flex justify-between c-sub c-num"><span>{tr("Quiz · {t}", { t: course.topic })}</span><span>{quiz.i + 1} / {quiz.questions.length}</span></div>
        <div className="c-bar"><i style={{ width: Math.round((quiz.i / quiz.questions.length) * 100) + "%" }} /></div>
        <p className="text-[16px] font-medium" dir="auto">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((o, k) => {
            const state = picked == null ? "" : k === q.answer ? "right" : k === picked ? "wrong" : "";
            const col = state === "right" ? "var(--c-pos)" : state === "wrong" ? "var(--c-neg)" : "var(--c-ln)";
            return <button key={k} disabled={picked != null} onClick={() => setQuiz({ ...quiz, picks: { ...quiz.picks, [quiz.i]: k } })} data-testid="quiz-option"
              className="w-full text-start rounded-xl border p-3 text-[14px] flex gap-2 items-start" style={{ borderColor: col, background: state ? "var(--c-surf)" : "transparent", color: "var(--c-ink)" }}>
              <span className="c-sub shrink-0">{"ABCDE"[k]}</span><span className="flex-1" dir="auto">{o}</span>
              {state === "right" ? <Check size={16} className="shrink-0 c-pos" /> : state === "wrong" ? <X size={16} className="shrink-0 c-neg" /> : null}</button>;
          })}
        </div>
        {picked != null ? <>
          {q.why ? <p className="c-card text-[13px]" dir="auto">{q.why}</p> : null}
          <button className="c-btn" onClick={() => setQuiz({ ...quiz, i: quiz.i + 1 })} data-testid="quiz-next">{quiz.i + 1 < quiz.questions.length ? tr("Next") : tr("See my score")}</button></> : null}
      </section>);
  }

  if (view === "lesson" && course) {
    const l = course.lessons.find((x) => x.n === lessonN);
    if (!l) return frame(<CBack onClick={() => setView("course")} label={course.topic} />, "learn-frame");
    const due = D.quizDue(course), newCards = D.cardsFromLesson(l).length;
    return beside(
      <section className="space-y-4 lg:max-w-[72ch]" data-testid="lesson">
        <CBack onClick={() => { L.stop(); setView("course"); }} label={course.topic} />
        <div>
          <p className="c-lbl m-0">{tr("Lesson {n} of {m}", { n: l.n + 1, m: course.plan.length })}</p>
          <h2 className="text-[20px] font-semibold mt-1" dir="auto" data-listen="0" style={hl(0)}>{l.title}</h2>
        </div>
        <ListenBar L={L} />
        <div dir="auto">{paras.map((p, k) => <div key={k} data-listen={k + 1} style={hl(k + 1)}><Md text={p} runnable={false} /></div>)}</div>
        {/* v6.34 (Ali: "diagrams and flashcards inside the lesson"): the diagram, then the lesson's flashcards to turn over */}
        <div data-testid="lesson-diagram"><Visual v={D.lessonDiagram(l)} /></div>
        {(() => { const cs = D.lessonCards(l); return cs.length >= 2 ? <div data-testid="lesson-cards"><Visual v={{ kind: "cards", title: tr("Flashcards"), items: cs }} /></div> : null; })()}
        {l.keyPoints && l.keyPoints.length ? (
          <div className="c-card" data-testid="key-points" data-listen={paras.length + 1} style={hl(paras.length + 1)}>
            <p className="c-lbl m-0 mb-1.5">{tr("Remember")}</p>
            {l.keyPoints.map((k, i) => <p key={i} className="text-[13.5px] mt-1 m-0" dir="auto">• {k}</p>)}
          </div>) : null}
        {!l.done ? <button className="c-btn w-full py-2.5" data-testid="lesson-done" onClick={() => {
            const c2 = D.markDone(latest(), l.n); putCourse(c2);
            flash(newCards ? tr("Done — {n} days in a row · {k} new cards for tomorrow's review", { n: c2.streak, k: newCards }) : tr("Done — {n} days in a row", { n: c2.streak }));
            // tomorrow's lesson, prepared now, so the notification can say what it is
            if ((modelReady || c2.pack) && D.nextIndex(c2) < c2.plan.length && !D.quizDue(c2)) setTimeout(() => makeLesson(c2, D.nextIndex(c2)), 400);
          }}>{tr("I've read it")}</button>
          : <p className="text-[13px] c-pos flex items-center gap-1 m-0"><CheckCircle2 size={14} />{tr("Read")}{newCards ? " · " + tr("its {n} cards are in your review", { n: newCards }) : ""}</p>}
        {l.done && due ? <button className="c-btn w-full py-2.5" data-testid="quiz-start" disabled={!!busy} onClick={() => startQuiz(due)}>{tr("Quiz time — a short quiz on lessons {a}–{b}", { a: due[0].n + 1, b: due[due.length - 1].n + 1 })}</button> : null}
        {l.source ? <p className="c-sub text-[12px] m-0" data-testid="lesson-source" dir="auto">{tr("From: {s}", { s: [l.source.name, l.source.title].filter(Boolean).join(" · ") })}{l.source.url ? " · " : ""}{l.source.url ? <a href={l.source.url} target="_blank" rel="noreferrer" className="c-acc">{tr("the book")}</a> : null}</p> : null}
        {D.isLanguageCourse(course.topic) ? <SpeakPractice lesson={l} course={course} native={native} call={call} listen={listen}
          onBest={(p, sc) => { const c0 = latest(); putCourse({ ...c0, lessons: c0.lessons.map((x) => (x.n === l.n ? { ...x, speak: { ...(x.speak || {}), [p]: Math.max(sc, (x.speak || {})[p] || 0) } } : x)) }); }} /> : null}
        {D.isLanguageCourse(course.topic) ? <DialogueCard lesson={l} course={course} native={native} call={call} listen={listen} busy={busy}
          make={modelReady ? async () => { try { let dlg = SP.parseDialogue(await gen(tr("Writing a short conversation…"), SP.dialogueMessages(course, l), 1000, 0.5)); if (!dlg) dlg = SP.parseDialogue(await gen(tr("Writing a short conversation…"), SP.dialogueMessages(course, l, true), 900, 0.2)); if (!dlg) { flash(tr("Couldn't write a good conversation this time — try again.")); return; } const c0 = latest(); putCourse({ ...c0, lessons: c0.lessons.map((x) => (x.n === l.n ? { ...x, dialogue: dlg } : x)) }); } catch (e) { flash(String(e.message || e)); } } : null} /> : null}
        <LessonPicture lesson={l} course={course} native={native} call={call}
          onPicture={(url) => { const c0 = latest(); putCourse({ ...c0, lessons: c0.lessons.map((x) => (x.n === l.n ? { ...x, picture: url } : x)) }); }}
          openStudio={illustrate ? () => illustrate(`${course.topic}: ${l.title} — a clear, friendly illustration for a lesson`) : null} />
        {busy ? <CWorking {...busy} /> : null}
      </section>);
  }

  if ((view === "course" || view === "past") && course) {
    if (!wide) return frame(courseScreen(false), "learn-frame");
    return frame(
      <div className={PANES}><div className={LEFT}>{courseScreen(false)}</div>
        <div className={RIGHT + " lg:p-4"}><DeskEmpty icon={GraduationCap} title={tr("Your lesson opens here")} text={tr("Start with today's plan on the left, or open a past lesson.")} testid="learn-desk-empty" /></div></div>, "learn-frame");
  }

  /** The course screen. On a computer it also stays on the left while a lesson, review or quiz is open (side = true). */
  function courseScreen(side) {
    const doneN = course.lessons.filter((l) => l.done).length;
    const plan = D.todayPlan(course), streak = D.streakNow(course), r = D.reviewStatus(course);
    const deck = (course.cards || []).length, learnedCards = course.learnedCards || 0;
    const nextN = D.nextIndex(course), unread = course.lessons.find((l) => !l.done);
    const at = Math.min(course.plan.length - 1, doneN);
    const shown = allPlan || course.plan.length <= 8 ? course.plan.map((t, i) => i) : course.plan.map((t, i) => i).filter((i) => i >= at - 2 && i <= at + 4);
    return (
      <section className="space-y-4" data-testid="course">
        <CBack onClick={() => { setView("list"); setCur(null); }} label={tr("Learn daily")} />
        <div>
          <h2 className="text-[20px] font-semibold m-0" dir="auto">{course.title || course.topic}</h2>
          <p className="c-sub c-num m-0 mt-1">{tr("{d} of {n} lessons", { d: doneN, n: course.plan.length })} · {streak ? tr("{n} days in a row", { n: streak }) + " 🔥" : tr("read today to start a streak")}</p>
          <div className="c-bar mt-2"><i style={{ width: `${Math.round((doneN / Math.max(1, course.plan.length)) * 100)}%` }} /></div>
        </div>
        {busy && !side ? <CWorking {...busy} /> : null}

        <div className="space-y-2">
          <p className="c-lbl m-0">{plan.finished ? tr("Course finished") : plan.left ? tr("Today") : tr("Today · all done")}</p>
          <div className="c-list" data-testid="learn-today">
            {plan.steps.map((st) => st.kind === "review"
              ? <Step key="r" icon={Layers} done={st.done} testid="review-start" onClick={startReview} disabled={st.done}
                  title={st.done ? tr("Cards reviewed") : tr("Review {c}", { c: cardsWord(st.n) })} sub={st.done ? tr("Next ones come back on their day") : tr("A minute, no model needed")} />
              : st.kind === "lesson" ? (st.lesson
                ? <Step key="l" icon={BookOpen} done={st.done} testid="today-lesson" onClick={() => openL(course, st.lesson.n)}
                    title={`${st.lesson.n + 1}. ${st.lesson.title}`} sub={st.done ? tr("Today's lesson · read") : tr("Today's lesson")} />
                : busy ? <Step key="l" icon={BookOpen} disabled title={`${st.n + 1}. ${st.title}`} sub={tr("Being written on your device…")} />
                : modelReady ? <Step key="l" icon={BookOpen} testid="make-lesson" onClick={() => makeLesson(course, st.n)} title={tr("Prepare lesson {n}", { n: st.n + 1 })} sub={st.title} />
                : <Step key="l" icon={BookOpen} onClick={openEngine} title={`${st.n + 1}. ${st.title}`} sub={tr("Load a model to write today's lesson")} />)
              : <Step key="q" icon={HelpCircle} testid="quiz-card" disabled={!!busy || !modelReady} onClick={() => startQuiz(st.lessons)}
                  title={tr("Quiz time")} sub={modelReady ? tr("A short quiz on lessons {a}–{b}", { a: st.lessons[0].n + 1, b: st.lessons[st.lessons.length - 1].n + 1 }) : tr("Load a model to write the quiz")} />)}
            {(plan.finished || D.needsMore(course)) && !course.pack && course.plan.length < D.MAX_PLAN ? (
              <button className="w-full text-start flex items-center gap-3 p-3 disabled:opacity-60" disabled={!!busy || !modelReady} onClick={() => planMore(course)} data-testid="learn-more">
                <span className="c-ic"><Plus size={16} /></span><span className="flex-1 min-w-0"><b className="block text-[14px] font-semibold">{tr("Plan {n} more lessons", { n: D.MORE_N })}</b>
                <span className="c-sub block">{modelReady ? tr("The course goes on from lesson {n} — the next level", { n: course.plan.length + 1 }) : tr("Load a model to plan them")}</span></span></button>) : null}
            {plan.finished && !D.needsMore(course) ? <p className="p-3 m-0 text-[14px]">{tr("You finished all {n} lessons. Your cards keep coming back until you know them.", { n: course.plan.length })}</p> : null}
          </div>
          {today && today.done && !busy && nextN < course.plan.length && modelReady && !D.quizDue(course) ? (
            <button className="c-acc text-[13px] font-medium" onClick={async () => { const c2 = unread ? course : await makeLesson(course, nextN); const nl = c2 && c2.lessons.find((l) => !l.done); if (nl) openL(c2, nl.n); }} data-testid="next-now">
              {tr("One more today: lesson {n}", { n: (unread || { n: nextN }).n + 1 })} →</button>) : null}
          {deck + learnedCards + r.due + r.waiting ? <p className="c-sub m-0" data-testid="srs-status">{[deck ? tr("{c} in your review deck", { c: cardsWord(deck) }) : "", learnedCards ? tr("{n} learned for good", { n: learnedCards }) : "", course.quizzes.length ? tr("Quizzes") + ": " + course.quizzes.map((q) => `${q.score}/${q.total}`).join(" · ") : ""].filter(Boolean).join(" · ")}</p> : null}
        </div>

        <div className="space-y-2">
          <p className="c-lbl m-0">{tr("The course")}</p>
          <div className="c-list">
            {shown.map((i) => { const t = course.plan[i], l = course.lessons.find((x) => x.n === i);
              return <button key={i} disabled={!l} onClick={() => { if (side) L.stop(); openL(course, i); }} className="w-full text-start flex gap-2.5 px-3 py-2 text-[13px] disabled:opacity-100" style={side && view === "lesson" && lessonN === i ? { background: "var(--c-soft)" } : undefined}>
                <span className={"w-5 shrink-0 text-end c-num " + (l && l.done ? "c-pos" : "c-sub")}>{l && l.done ? "✓" : i + 1}</span>
                <span style={{ color: l ? "var(--c-ink)" : "var(--c-mut)" }} dir="auto">{t}</span></button>; })}
          </div>
          <AddLesson onAdd={(t) => { putCourse({ ...latest(), plan: [...latest().plan, t] }); flash(tr("Lesson {n} added: {t}", { n: latest().plan.length + 1, t })); }} />
          {course.plan.length > 8 ? <button className="c-acc text-[13px] font-medium" onClick={() => setAllPlan(!allPlan)} data-testid="learn-all-plan">{allPlan ? tr("Show less") : tr("Show all {n} lessons", { n: course.plan.length })}</button> : null}
        </div>

        <div className="flex flex-wrap gap-2 items-center c-sub" data-testid="learn-settings">
          <Bell size={14} className="shrink-0" /><span className="whitespace-nowrap">{tr("Daily notification")}</span>
          <input type="time" value={course.time} onChange={(e) => e.target.value && putCourse({ ...course, time: e.target.value })} className="rounded-lg px-2 py-1 text-[13px] w-28 shrink-0 focus:outline-none" style={cf} data-testid="learn-time" />
          <button onClick={() => putCourse({ ...course, notify: course.notify === false })} className={cGhost + " shrink-0"} style={course.notify !== false ? { ...gs, borderColor: "var(--c-acc)", color: "var(--c-acc)" } : gs}>{course.notify !== false ? tr("On") : tr("Off")}</button>
          <button className={cGhost + " shrink-0 flex items-center gap-1"} style={confirmDel ? { ...gs, borderColor: "var(--c-neg)", color: "var(--c-neg)" } : { ...gs, color: "var(--c-mut)" }}
            onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setCourses(loadCourses().filter((x) => x.id !== course.id)); setConfirmDel(false); setView("list"); setCur(null); }}>
            <Trash2 size={14} />{confirmDel ? tr("Tap again to delete this course") : tr("Delete")}</button>
        </div>
      </section>);
  }
  /** A lesson, review or quiz: alone on a phone; beside the course on a computer. */
  function beside(el) {
    if (!wide || !course) return frame(el, "learn-frame");
    return frame(<div className={PANES}><div className={LEFT}>{courseScreen(true)}</div><div className={RIGHT}>{el}</div></div>, "learn-frame");
  }

  // ---- all courses: each with today's plan in one line ----
  const summary = (c) => {
    const p = D.todayPlan(c);
    if (p.finished) return tr("Course finished");
    if (!p.left) return tr("All done for today ✓");
    return p.steps.filter((x) => !x.done).map((x) => x.kind === "review" ? tr("Review {c}", { c: cardsWord(x.n) }) : x.kind === "quiz" ? tr("Quiz time") : tr("Lesson {n}", { n: (x.lesson ? x.lesson.n : x.n) + 1 })).join(" · ");
  };
  return frame(
    <section className="space-y-4" data-testid="learn-page">
      <div className="flex items-start gap-3">
        <span className="c-ic"><GraduationCap size={17} /></span>
        <div className="min-w-0"><h2 className="text-[20px] font-semibold m-0">{tr("Learn daily")}</h2>
          <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("A short lesson a day, cards that come back until you know them, and a quiz every few lessons.")}</p></div>
      </div>
      {courses.length ? <>
        <p className="c-lbl m-0">{tr("Today")}</p>
        <div className="c-list">
          {courses.map((c) => { const doneN = c.lessons.filter((l) => l.done).length, st = D.streakNow(c), left = D.todayPlan(c).left;
            return <button key={c.id} onClick={() => { setCur(c.id); setView("course"); }} className="w-full text-start p-3 flex items-center gap-3" data-testid="learn-course">
              <span className="min-w-0 flex-1">
                <b className="block text-[14px]" dir="auto">{c.title || c.topic}</b>
                <span className="c-sub block truncate" dir="auto">{summary(c)}</span>
                <span className="c-bar block mt-1.5"><i style={{ width: `${Math.round((doneN / Math.max(1, c.plan.length)) * 100)}%` }} /></span>
              </span>
              <span className="text-end shrink-0"><span className="c-sub c-num block">{doneN}/{c.plan.length}</span>{st ? <span className="c-sub c-num block">🔥 {st}</span> : null}</span>
              {left ? <span className="c-pill">{left}</span> : <Check size={16} className="c-pos shrink-0" />}
            </button>; })}
        </div>
        <button className={cGhost + " flex items-center gap-1.5"} style={gs} onClick={() => setView("new")} data-testid="learn-new-btn"><Plus size={15} />{tr("New course")}</button>
      </> : <>
        <p className="c-lbl m-0">{tr("Ready courses")}</p>
        <div className="c-list">
          {neutral(D.READY_COURSES, "courses").map((r) => (
            <button key={r.id} onClick={() => startReady(r.id)} data-testid={"learn-start-" + r.id} className="w-full text-start p-3 flex items-center gap-3">
              <span className="text-2xl">{r.emoji}</span><b className="flex-1 text-[14px]">{r.title[getLang() === "ar" ? 1 : 0]}</b><ChevronRight size={16} className="c-acc rtl:-scale-x-100" /></button>))}
        </div>
        <button className="c-btn flex items-center gap-1.5" onClick={() => setView("new")} data-testid="learn-new-btn"><Plus size={15} />{tr("Any topic you like")}</button>
      </>}
    </section>, "learn-frame");
}

// ================================ Daily news ================================
export function NewsPage({ llm, modelReady, openEngine, flash, native, nativeCall, openId, clearOpen }) {
  const [topics, setTopicsRaw] = useState(loadTopics);
  const [cur, setCur] = useSticky("news:cur", null);
  const [form, setForm] = useState({ query: "", lang: "en", time: "08:30" });
  const [adding, setAdding] = useSticky("news:adding", false);
  const [busy, setBusy] = useState(null);
  const [past, setPast] = useSticky("news:past", null);
  const [confirmDel, setConfirmDel] = useState(false);
  const wide = useDesktopWide();   // v6.27 computer layout: the topics on the left, the day's news on the right
  const topic = topics.find((t) => t.id === cur) || null;
  // v5.34: Back — an old digest → the topic → all topics
  useSubBack(!!cur || adding || !!past, () => { if (past) setPast(null); else if (adding) setAdding(false); else setCur(null); });
  const setTopics = (list) => { store(NKEY, list); setTopicsRaw(list); syncDaily(native, loadCourses(), list); };
  const putTopic = (t) => setTopics([t, ...loadTopics().filter((x) => x.id !== t.id)].sort((a, b) => a.created - b.created));
  const todayKey = D.dayKey();
  const todays = topic && topic.digests[0] && topic.digests[0].day === todayKey ? topic.digests[0] : null;

  const gather = async (t) => {
    if (!nativeCall) { flash(tr("News works in the Android app — it needs the internet.")); return; }
    try {
      setBusy({ what: tr("Gathering the last 24 hours on {q}…", { q: t.query }), text: "" });
      const r = await nativeCall("news", { q: t.query, lang: t.lang, pages: 3 });
      const seen = (t.digests || []).filter((d) => d.day !== todayKey).flatMap((d) => (d.items || []).map((x) => x.url));
      const all = [...(r.items || []), ...(r.hits || []).map((h) => ({ ...h, source: (h.url.match(/^https?:\/\/(?:www\.)?([^/]+)/) || [])[1] || "" }))];
      const items = D.mergeNews(all, seen);
      if (!items.length) { setBusy(null); putTopic(D.addDigest(t, { day: todayKey, at: Date.now(), text: "", items: [], none: true, why: r.why || "" })); return; }
      let acc = "";
      setBusy({ what: tr("Reading {n} articles and writing your digest…", { n: items.length }), text: "" });
      const out = await llm(D.digestMessages(t, items), { maxTokens: 900, temperature: 0.2, onToken: (x) => { acc = x; setBusy((b) => b && { ...b, text: acc }); } });
      setBusy(null);
      if (/^\s*NOTHING NEW/i.test(out)) { putTopic(D.addDigest(t, { day: todayKey, at: Date.now(), text: "", items, none: true })); return; }
      const ck = D.checkCitations(out, items.length);
      putTopic(D.addDigest(t, { day: todayKey, at: Date.now(), text: ck.text.trim(), items, unsourced: ck.unsourced, removed: ck.removed }));
    } catch (e) { setBusy(null); flash(String(e.message || e)); }
  };

  useEffect(() => {
    if (!openId) return;
    const t = topics.find((x) => "daily-news-" + x.id === openId) || topics[0];
    if (t) { setCur(t.id); if (modelReady && !(t.digests[0] && t.digests[0].day === todayKey)) gather(t); }
    clearOpen && clearOpen();
  }, [openId]);

  // v6.41 (D4): the same story over several days — each day's headlines by source, and what changed since the day before
  const [openTh, setOpenTh] = useState(null);
  const [changes, setChanges] = useState({});
  const whatChanged = async (th) => {
    setChanges((c) => ({ ...c, [th.id]: { busy: true } }));
    try {
      const { items, messages } = D.changeMessages(th, topic.lang);
      const out = await llm(messages, { maxTokens: 500, temperature: 0.2 });
      const ck = /^\s*NOTHING NEW/i.test(out) ? { text: "", none: true } : D.checkCitations(out, items.length);
      setChanges((c) => ({ ...c, [th.id]: { text: (ck.text || "").trim(), none: !!ck.none, items } }));
    } catch (e) { setChanges((c) => ({ ...c, [th.id]: null })); flash(String(e.message || e)); }
  };
  const Threads = ({ topic }) => {
    const list = D.newsThreads(topic.digests, topic.query, todayKey);
    if (!list.length) return null;
    return (
      <div className="rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2" data-testid="news-threads">
        <p className="text-[12px] font-semibold text-[var(--c-ink)]">{tr("Story threads")}</p>
        {list.map((th) => { const ch = changes[th.id];
          return (
          <div key={th.id} data-testid="news-thread">
            <button className="text-start w-full" onClick={() => setOpenTh(openTh === th.id ? null : th.id)}>
              <span className="block text-[13px] text-[var(--c-ink)]" dir="auto">{th.title}</span>
              <span className="text-[11px] text-[var(--c-mut)]">{tr("{n} days · {s} sources", { n: th.days.length, s: th.sources.length })}{th.today ? " · " + tr("new today") : ""}</span></button>
            {openTh === th.id ? <div className="mt-1.5 space-y-1.5 ps-2 border-s border-[var(--c-ln)]" data-testid="news-thread-open">
              {th.days.map((d) => <div key={d}><p className="text-[11px] text-[var(--c-mut)]">{d}</p>
                {th.byDay[d].map((it, i) => <a key={i} href={it.url} target="_blank" rel="noreferrer" className="block text-[12px] text-[var(--c-acc)]" dir="auto">{it.title}{it.source ? <span className="text-[var(--c-mut)]"> · {it.source}</span> : null}</a>)}</div>)}
              {ch && ch.busy ? <p className="text-[12px] text-[var(--c-mut)]">{tr("Comparing the days…")}</p>
                : ch && ch.none ? <p className="text-[12px] text-[var(--c-mut)]" data-testid="news-thread-change">{tr("Nothing really new since the day before.")}</p>
                : ch ? <div className="text-[13px]" dir="auto" data-testid="news-thread-change"><Md text={ch.text} runnable={false} /></div>
                : modelReady ? <button className={ghost + " text-[12px]"} onClick={() => whatChanged(th)} data-testid="news-thread-ask">{tr("What changed since {d}?", { d: th.days[1] })}</button> : null}
            </div> : null}
          </div>); })}
      </div>);
  };

  const Digest = ({ d }) => (
    <div className="space-y-2" data-testid="digest">
      {d.none ? <p className="text-[13px] text-[var(--c-mut)]">{tr("Nothing new on this in the last day.")}{d.why ? " (" + d.why + ")" : ""}</p> : <div dir="auto"><Md text={d.text} runnable={false} /></div>}
      {d.unsourced ? <p className="text-[11px] text-[var(--c-warn)] flex items-center gap-1"><AlertTriangle size={12} />{tr("{n} line(s) cite no source — treat them with care.", { n: d.unsourced })}</p> : null}
      {d.items && d.items.length ? <div className="space-y-1 pt-1" data-testid="digest-sources">
        <p className="text-[11px] text-[var(--c-mut)]">{tr("Sources")}</p>
        {d.items.map((it, i) => <a key={i} href={it.url} target="_blank" rel="noreferrer" className="block text-[12px] text-[var(--c-acc)] truncate" dir="auto">
          [{i + 1}] {it.title}{it.source ? <span className="text-[var(--c-mut)]"> · {it.source}</span> : null}{it.date ? <span className="text-[var(--c-mut)]"> · {ago(it.date)}</span> : null}</a>)}
      </div> : null}
    </div>);

  if (topic) {
    const el = (
    <section className="p-4 space-y-3 lg:max-w-[76ch]" data-testid="news-topic">
      <Back onClick={() => { setCur(null); setPast(null); }} label={tr("Daily news")} />
      <div className="flex items-center gap-2"><Newspaper size={20} className="text-[var(--c-warn)] shrink-0" /><h2 className="text-lg font-semibold text-[var(--c-ink)] flex-1" dir="auto">{topic.query}</h2>
        {todays && !busy && modelReady ? <button className="p-1.5 text-[var(--c-mut)]" onClick={() => gather(topic)} title={tr("Refresh")} data-testid="news-refresh"><RefreshCw size={16} /></button> : null}</div>
      {busy ? <Working {...busy} /> : todays ? <Digest d={todays} /> : modelReady
        ? <button className={primary + " w-full py-2.5"} onClick={() => gather(topic)} data-testid="news-gather">{tr("Gather today's news")}</button>
        : <button className={ghost + " w-full"} onClick={openEngine}>{tr("Load a model to write the digest")}</button>}
      <p className="text-[11px] text-[var(--c-mut)]">{tr("The articles come from the web when you open this; the digest is written on your phone and cites every line. Check the sources for anything important.")}</p>
      <Threads topic={topic} />
      {topic.digests.filter((d) => d.day !== todayKey).length ? (
        <div className="rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2">
          <p className="text-[12px] font-semibold text-[var(--c-ink)]">{tr("Earlier days")}</p>
          {topic.digests.filter((d) => d.day !== todayKey).map((d) => (
            <div key={d.day}><button className="text-[13px] text-[var(--c-ink)]" onClick={() => setPast(past === d.day ? null : d.day)}>{d.day}</button>
              {past === d.day ? <div className="mt-1"><Digest d={d} /></div> : null}</div>))}
        </div>) : null}
      <div className="rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] p-3 space-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="flex items-center gap-1.5 text-[13px] text-[var(--c-ink)] basis-full sm:basis-auto sm:flex-1 whitespace-nowrap"><Bell size={14} className="text-[var(--c-mut)] shrink-0" />{tr("Daily notification")}</span>
          <input type="time" value={topic.time} onChange={(e) => e.target.value && putTopic({ ...topic, time: e.target.value })} className={fieldFixed + " w-32 shrink-0"} />
          <button onClick={() => putTopic({ ...topic, notify: topic.notify === false })} className={`${btn} shrink-0 whitespace-nowrap border ${topic.notify !== false ? "border-[var(--c-acc)] text-[var(--c-acc)]" : "border-[var(--c-ln)] text-[var(--c-mut)]"}`}>{topic.notify !== false ? tr("On") : tr("Off")}</button>
        </div>
        <button className={`${btn} border ${confirmDel ? "border-[var(--c-neg)] bg-[var(--c-neg)]/15 text-[var(--c-neg)]" : "border-[var(--c-ln)] text-[var(--c-mut)]"} flex items-center gap-1`}
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setTopics(loadTopics().filter((x) => x.id !== topic.id)); setConfirmDel(false); setCur(null); }}>
          <Trash2 size={14} />{confirmDel ? tr("Tap again to stop following") : tr("Stop following")}</button>
      </div>
    </section>);
    if (!wide) return el;
    return <div className={PANES}><div className={LEFT}>{listScreen(true)}</div><div className={RIGHT}>{el}</div></div>;
  }
  return listScreen(false);

  /** All the topics. On a computer they stay on the left while a topic is open (side = true). */
  function listScreen(side) {
  return (
    <section className="p-4 space-y-3" data-testid="news-page">
      <div className="flex items-start gap-3">
        <Newspaper size={22} className="text-[var(--c-warn)] mt-1 shrink-0" />
        <div className="min-w-0"><h2 className="text-lg font-semibold text-[var(--c-ink)]">{tr("Daily news")}</h2>
          <p data-intro="" className="text-[13px] text-[var(--c-mut)] lg:max-w-[70ch]">{tr("Follow a team, a player, a market, a subject. Each day: what happened in the last 24 hours, with the sources.")}</p></div>
      </div>
      {adding ? (
        <div className={"rounded-xl border border-[var(--c-acc)]/40 bg-[var(--c-surf)] p-3 space-y-2" + (side ? "" : " lg:max-w-xl")} data-testid="news-add">
          <input value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} className={field} dir="auto" placeholder={tr("e.g. Al Ahly, Mohamed Salah, Egypt economy")} data-testid="news-query" autoFocus />
          <div className="flex flex-wrap gap-1.5">{["Al Ahly", "Mohamed Salah", "Premier League", "Egypt economy", "Gold price", "AI", "Real estate"].map((x) =>
            <button key={x} onClick={() => setForm({ ...form, query: tr(x) })} className="text-[12px] rounded-full border border-[var(--c-ln)] text-[var(--c-ink)] px-2.5 py-1">{tr(x)}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={field}><option value="en">English</option><option value="ar">العربية</option></select>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value || "08:30" })} className={field} />
          </div>
          <div className="flex gap-2">
            <button className={primary} disabled={form.query.trim().length < 2} data-testid="news-follow" onClick={() => { const t = D.newTopic(form); putTopic(t); setAdding(false); setForm({ query: "", lang: form.lang, time: form.time }); setCur(t.id); }}>{tr("Follow")}</button>
            <button className={ghost} onClick={() => setAdding(false)}>{tr("Cancel")}</button>
          </div>
        </div>) : <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5" + (side ? "" : " lg:w-auto lg:px-5")} onClick={() => setAdding(true)} data-testid="news-add-btn"><Plus size={16} />{tr("Follow a topic")}</button>}
      <div className={side ? "space-y-3" : GRID3}>
      {topics.map((t) => { const d = t.digests[0]; const fresh = d && d.day === todayKey;
        return <button key={t.id} onClick={() => { if (side) setPast(null); setCur(t.id); }} className={"w-full text-start rounded-xl border p-3 lg:hover:border-[var(--c-acc)] " + (side && t.id === cur ? "border-[var(--c-acc)]/40 bg-[var(--c-soft)]" : "border-[var(--c-ln)] bg-[var(--c-surf)]")} data-testid="news-topic-item">
          <span className="block text-sm text-[var(--c-ink)]" dir="auto">{t.query}</span>
          <span className="block text-[11px] text-[var(--c-mut)] truncate" dir="auto">{fresh ? (d.none ? tr("Nothing new today") : String(d.text).split("\n")[0].replace(/\*+/g, "")) : tr("Not gathered today")} · {t.time}</span></button>; })}
      </div>
    </section>
  );
  }
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return tr("{n} min ago", { n: Math.max(1, m) });
  const h = Math.round(m / 60);
  return h < 48 ? tr("{n} h ago", { n: h }) : new Date(t).toLocaleDateString();
}
