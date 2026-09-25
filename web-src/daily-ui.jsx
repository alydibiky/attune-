/* ---- More → Learn daily, and More → Daily news -------------------------------------------
   The logic is in daily.js; this file is the screens, the daily
   notifications (one repeating notification per course / topic, id
   "daily-learn-…" / "daily-news-…") and the home-screen widget's text.    */
import React, { useState, useEffect, useRef } from "react";
import { GraduationCap, Newspaper, Plus, Trash2, ChevronLeft, Check, X, Loader2, Bell, RefreshCw, Sparkles, ImageIcon, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { tr } from "./i18n.js";
import { Md } from "./chat.jsx";
import * as D from "./daily.js";

const CKEY = "attune:daily:courses:v1", NKEY = "attune:daily:news:v1";
const load = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export const loadCourses = () => load(CKEY);
export const loadTopics = () => load(NKEY);

const field = "w-full min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500";
const btn = "px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40";
const primary = btn + " bg-teal-500 text-slate-950";
const ghost = btn + " border border-slate-700 text-slate-200";

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
    try { for (const x of JSON.parse(native.scheduled() || "[]")) if (/^daily-/.test(x.id) && !wanted.has(x.id)) native.unschedule(x.id); } catch (e) {}
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
  return <button onClick={onClick} className="text-slate-400 text-sm flex items-center gap-1"><ChevronLeft size={16} />{label || tr("Back")}</button>;
}
function Working({ what, text }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3" data-testid="daily-working">
      <p className="text-[13px] text-teal-200 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />{what}</p>
      {text ? <p className="text-[12px] text-slate-500 mt-1.5 line-clamp-3 break-words" dir="auto">{text.slice(-300)}</p> : null}
    </div>
  );
}

// ---- the visuals a lesson can carry -----------------------------------------------------------
export function Visual({ v }) {
  const [flipped, setFlipped] = useState({});
  if (!v) return null;
  const head = v.title ? <p className="text-[12px] font-semibold text-slate-300 mb-2" dir="auto">{v.title}</p> : null;
  const box = "rounded-xl border border-teal-900/70 bg-gradient-to-b from-teal-500/5 to-transparent p-3";
  if (v.kind === "table") return (
    <div className={box} data-testid="visual-table">{head}
      <div className="overflow-x-auto"><table className="text-[13px] min-w-full"><thead><tr>{v.columns.map((c, i) => <th key={i} className="text-start px-2 py-1.5 text-teal-200 font-semibold border-b border-slate-700 whitespace-nowrap" dir="auto">{c}</th>)}</tr></thead>
        <tbody>{v.rows.map((r, i) => <tr key={i} className="border-b border-slate-800/70">{r.map((x, j) => <td key={j} className={`px-2 py-1.5 whitespace-nowrap ${j === 0 ? "text-slate-100 font-medium" : "text-slate-300"}`} dir="auto">{x}</td>)}</tr>)}</tbody></table></div>
    </div>);
  if (v.kind === "steps") return (
    <div className={box} data-testid="visual-steps">{head}
      {v.items.map((x, i) => (
        <div key={i}>
          <div className="flex gap-2.5 items-start rounded-lg bg-slate-900 border border-slate-800 p-2.5">
            <span className="w-6 h-6 shrink-0 rounded-full bg-teal-500 text-slate-950 text-[12px] font-bold flex items-center justify-center">{i + 1}</span>
            <span className="text-[13px] text-slate-200 pt-0.5" dir="auto">{x}</span></div>
          {i < v.items.length - 1 ? <div className="text-center text-teal-500 leading-none py-0.5">↓</div> : null}
        </div>))}
    </div>);
  if (v.kind === "cards") return (
    <div className={box} data-testid="visual-cards">{head}<p className="text-[11px] text-slate-500 mb-2">{tr("Tap a card to turn it over")}</p>
      <div className="grid grid-cols-2 gap-2">
        {v.items.map((x, i) => (
          <button key={i} onClick={() => setFlipped((f) => ({ ...f, [i]: !f[i] }))} className={`rounded-lg border p-2.5 min-h-[4.5rem] text-start ${flipped[i] ? "border-amber-700 bg-amber-500/10" : "border-slate-700 bg-slate-900"}`}>
            {flipped[i] ? <><span className="block text-[13px] text-amber-100" dir="auto">{x.back}</span>{x.note ? <span className="block text-[11px] text-slate-400 mt-1" dir="auto">{x.note}</span> : null}</>
              : <span className="block text-[15px] font-semibold text-slate-100" dir="auto">{x.front}</span>}
          </button>))}
      </div>
    </div>);
  if (v.kind === "compare") return (
    <div className={box} data-testid="visual-compare">{head}
      <div className="grid grid-cols-2 gap-2">
        {[v.left, v.right].map((s, k) => (
          <div key={k} className={`rounded-lg p-2.5 border ${k ? "border-amber-800 bg-amber-500/5" : "border-teal-800 bg-teal-500/5"}`}>
            <p className={`text-[12px] font-semibold mb-1 ${k ? "text-amber-200" : "text-teal-200"}`} dir="auto">{s.title}</p>
            {s.items.map((x, i) => <p key={i} className="text-[12px] text-slate-300 mt-1" dir="auto">• {x}</p>)}
          </div>))}
      </div>
    </div>);
  if (v.kind === "bars") {
    const max = Math.max(...v.items.map((x) => Math.abs(x.value)), 1);
    return (
      <div className={box} data-testid="visual-bars">{head}
        {v.items.map((x, i) => (
          <div key={i} className="mb-1.5">
            <div className="flex justify-between text-[12px]"><span className="text-slate-300" dir="auto">{x.label}</span><span className="text-slate-400 tabular-nums">{x.value}{v.unit ? " " + v.unit : ""}</span></div>
            <div className="h-2 rounded bg-slate-800"><div className="h-2 rounded bg-teal-500" style={{ width: `${Math.max(2, Math.round((Math.abs(x.value) / max) * 100))}%` }} /></div>
          </div>))}
      </div>);
  }
  if (v.kind === "timeline") return (
    <div className={box} data-testid="visual-timeline">{head}
      <div className="border-s-2 border-teal-700 ms-1.5 ps-3 space-y-2">
        {v.items.map((x, i) => (
          <div key={i} className="relative"><span className="absolute -start-[1.13rem] top-1 w-2.5 h-2.5 rounded-full bg-teal-400" />
            {x.when ? <p className="text-[11px] text-teal-300" dir="auto">{x.when}</p> : null}<p className="text-[13px] text-slate-200" dir="auto">{x.what}</p></div>))}
      </div>
    </div>);
  return null;
}

// ================================ Learn daily ================================
export function LearnPage({ llm, modelReady, openEngine, flash, native, openId, clearOpen, illustrate }) {
  const [courses, setCoursesRaw] = useState(loadCourses);
  const [cur, setCur] = useState(null);                 // course id
  const [view, setView] = useState("list");             // list | new | course | lesson | quiz | past
  const [lessonN, setLessonN] = useState(null);
  const [busy, setBusy] = useState(null);               // { what, text }
  const [quiz, setQuiz] = useState(null);               // { lessons, questions, i, picks, shown }
  const [form, setForm] = useState({ topic: "", level: "beginner", lang: "en", time: "08:00", quizEvery: 5, goal: "" });
  const [confirmDel, setConfirmDel] = useState(false);
  const running = useRef(false);
  const course = courses.find((c) => c.id === cur) || null;
  const setCourses = (list) => { store(CKEY, list); setCoursesRaw(list); syncDaily(native, list); };
  const putCourse = (c) => setCourses([c, ...loadCourses().filter((x) => x.id !== c.id)].sort((a, b) => a.created - b.created));

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
    try { return await llm(messages, { maxTokens, temperature, onToken: (t) => { acc += t; setBusy({ what, text: acc }); } }); }
    finally { setBusy(null); }
  };

  const makeLesson = async (c, n) => {
    if (running.current) return null;
    running.current = true;
    try {
      const out = await gen(tr("Writing lesson {n}: {t}", { n: n + 1, t: c.plan[n] || "" }), D.lessonMessages(c, n), 1600);
      const p = D.parseLesson(out);
      if (p.body.length < 80) { flash(tr("The lesson came out too short — try again.")); return null; }
      const next = D.addLesson(loadCourses().find((x) => x.id === c.id) || c, n, p);
      putCourse(next);
      return next;
    } catch (e) { flash(String(e.message || e)); return null; }
    finally { running.current = false; }
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
    if (view === "course" && course && !today && modelReady && course.plan.length && !running.current && D.nextIndex(course) < course.plan.length) makeLesson(course, D.nextIndex(course));
  }, [view, cur]);

  // ---- screens ----
  if (view === "new") return (
    <section className="p-4 space-y-3" data-testid="learn-new">
      <Back onClick={() => setView("list")} />
      <h2 className="text-base font-semibold text-slate-100">{tr("What do you want to learn?")}</h2>
      <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} className={field} dir="auto" placeholder={tr("A language, a skill, a subject…")} data-testid="learn-topic" />
      <div className="flex flex-wrap gap-1.5">{["Turkish", "English", "Crane hydraulics", "Excel & Power Automate", "Java", "Economics", "Tajweed"].map((x) =>
        <button key={x} onClick={() => setForm({ ...form, topic: tr(x) })} className="text-[12px] rounded-full border border-slate-700 text-slate-300 px-2.5 py-1">{tr(x)}</button>)}</div>
      <textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} rows={2} className={field} dir="auto" placeholder={tr("Your goal (optional) — e.g. speak like a native, pass an exam, understand my cranes")} />
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("Level")}</span>
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={field}>{D.LEVELS.map((l) => <option key={l} value={l}>{tr(l[0].toUpperCase() + l.slice(1))}</option>)}</select></label>
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("Explained in")}</span>
          <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={field}><option value="en">English</option><option value="ar">العربية</option></select></label>
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("Daily lesson at")}</span>
          <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value || "08:00" })} className={field} /></label>
        <label className="block"><span className="block text-[11px] text-slate-400 mb-1">{tr("A quiz every")}</span>
          <select value={form.quizEvery} onChange={(e) => setForm({ ...form, quizEvery: Number(e.target.value) })} className={field}>{[3, 5, 7].map((n) => <option key={n} value={n}>{tr("{n} lessons", { n })}</option>)}</select></label>
      </div>
      {busy ? <Working {...busy} /> : modelReady
        ? <button className={primary + " w-full py-2.5"} disabled={form.topic.trim().length < 2} onClick={create} data-testid="learn-create">{tr("Plan my course")}</button>
        : <button className={ghost + " w-full"} onClick={openEngine}>{tr("Load a model first — lessons are written on your phone")}</button>}
    </section>
  );

  if (view === "quiz" && course && quiz) {
    const q = quiz.questions[quiz.i];
    if (!q) {
      const right = quiz.questions.filter((x, i) => quiz.picks[i] === x.answer).length;
      return (
        <section className="p-4 space-y-3" data-testid="quiz-result">
          <p className="text-2xl font-bold text-slate-100">{right} / {quiz.questions.length}</p>
          <p className="text-[13px] text-slate-300">{right === quiz.questions.length ? tr("Perfect — well done!") : tr("What you missed comes back as a quick review in your next lessons.")}</p>
          <button className={primary} onClick={() => { const f = D.finishQuiz(course, quiz, quiz.picks); putCourse(f.course); setQuiz(null); setView("course"); }} data-testid="quiz-finish">{tr("Done")}</button>
        </section>);
    }
    const picked = quiz.picks[quiz.i];
    return (
      <section className="p-4 space-y-3" data-testid="quiz">
        <div className="flex justify-between text-[12px] text-slate-400"><span>{tr("Quiz · {t}", { t: course.topic })}</span><span>{quiz.i + 1} / {quiz.questions.length}</span></div>
        <p className="text-[15px] text-slate-100 font-medium" dir="auto">{q.q}</p>
        <div className="space-y-2">
          {q.options.map((o, k) => {
            const state = picked == null ? "" : k === q.answer ? "right" : k === picked ? "wrong" : "";
            return <button key={k} disabled={picked != null} onClick={() => setQuiz({ ...quiz, picks: { ...quiz.picks, [quiz.i]: k } })} data-testid="quiz-option"
              className={`w-full text-start rounded-xl border p-3 text-[14px] flex gap-2 items-start ${state === "right" ? "border-emerald-600 bg-emerald-500/10 text-emerald-100" : state === "wrong" ? "border-rose-600 bg-rose-500/10 text-rose-100" : "border-slate-700 bg-slate-900 text-slate-200"}`}>
              <span className="text-slate-500 shrink-0">{"ABCDE"[k]}</span><span className="flex-1" dir="auto">{o}</span>
              {state === "right" ? <Check size={16} className="shrink-0" /> : state === "wrong" ? <X size={16} className="shrink-0" /> : null}</button>;
          })}
        </div>
        {picked != null ? <>
          {q.why ? <p className="text-[13px] text-slate-300 rounded-lg bg-slate-900 p-2.5" dir="auto">{q.why}</p> : null}
          <button className={primary} onClick={() => setQuiz({ ...quiz, i: quiz.i + 1 })} data-testid="quiz-next">{quiz.i + 1 < quiz.questions.length ? tr("Next") : tr("See my score")}</button></> : null}
      </section>);
  }

  if (view === "lesson" && course) {
    const l = course.lessons.find((x) => x.n === lessonN);
    if (!l) return <section className="p-4"><Back onClick={() => setView("course")} label={course.topic} /></section>;
    const due = D.quizDue(course);
    return (
      <section className="p-4 space-y-3" data-testid="lesson">
        <Back onClick={() => setView("course")} label={course.topic} />
        <p className="text-[12px] text-teal-300">{tr("Lesson {n} of {m}", { n: l.n + 1, m: course.plan.length })}</p>
        <h2 className="text-lg font-semibold text-slate-100" dir="auto">{l.title}</h2>
        <div dir="auto"><Md text={l.body} runnable={false} /></div>
        <Visual v={l.visual} />
        {l.keyPoints && l.keyPoints.length ? (
          <div className="rounded-xl border border-amber-800/70 bg-amber-500/5 p-3" data-testid="key-points">
            <p className="text-[12px] font-semibold text-amber-200 mb-1">{tr("Remember")}</p>
            {l.keyPoints.map((k, i) => <p key={i} className="text-[13px] text-slate-200 mt-1" dir="auto">• {k}</p>)}
          </div>) : null}
        {illustrate ? <button className={ghost + " flex items-center gap-1"} onClick={() => illustrate(`${course.topic}: ${l.title} — a clear, friendly illustration for a lesson`)}><ImageIcon size={14} />{tr("Draw a picture for this lesson (Studio)")}</button> : null}
        {!l.done ? <button className={primary + " w-full py-2.5"} data-testid="lesson-done" onClick={() => {
            const c2 = D.markDone(course, l.n); putCourse(c2);
            flash(tr("Done — {n} days in a row", { n: c2.streak }));
            // tomorrow's lesson, prepared now, so the notification can say what it is
            if (modelReady && D.nextIndex(c2) < c2.plan.length && !D.quizDue(c2)) setTimeout(() => makeLesson(c2, D.nextIndex(c2)), 400);
          }}>{tr("I've read it")}</button>
          : <p className="text-[13px] text-emerald-300 flex items-center gap-1"><CheckCircle2 size={14} />{tr("Read")}</p>}
        {l.done && due ? <button className={primary + " w-full py-2.5"} data-testid="quiz-start" onClick={() => startQuiz(due)}>{tr("Quiz time — {n} questions on the last lessons", { n: 5 })}</button> : null}
        {busy ? <Working {...busy} /> : null}
      </section>);
  }

  async function startQuiz(lessons) {
    try {
      let qs = [];
      for (let i = 0; i < 2 && qs.length < 3; i++) qs = D.parseQuiz(await gen(tr("Writing your quiz…"), D.quizMessages(course, lessons), 1600, i ? 0.5 : 0.3), course.id + lessons.length + i);
      if (qs.length < 3) { flash(tr("Couldn't make a good quiz this time — try again.")); return; }
      setQuiz({ lessons: lessons.map((l) => l.n), questions: qs, i: 0, picks: {} }); setView("quiz");
    } catch (e) { flash(String(e.message || e)); }
  }

  if ((view === "course" || view === "past") && course) {
    const doneN = course.lessons.filter((l) => l.done).length;
    const due = D.quizDue(course);
    const nextN = D.nextIndex(course);
    return (
      <section className="p-4 space-y-3" data-testid="course">
        <Back onClick={() => { setView("list"); setCur(null); }} label={tr("Learn daily")} />
        <div className="flex items-start gap-3">
          <GraduationCap size={22} className="text-teal-300 mt-1 shrink-0" />
          <div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-100" dir="auto">{course.title || course.topic}</h2>
            <p className="text-[12px] text-slate-400">{tr("{d} of {n} lessons", { d: doneN, n: course.plan.length })} · {tr("streak {n}", { n: course.streak || 0 })} 🔥 · <Clock size={11} className="inline" /> {course.time}</p></div>
        </div>
        <div className="h-1.5 rounded bg-slate-800"><div className="h-1.5 rounded bg-teal-500" style={{ width: `${Math.round((doneN / Math.max(1, course.plan.length)) * 100)}%` }} /></div>
        {busy ? <Working {...busy} /> : null}
        {due && !busy ? <button className="w-full text-start rounded-xl border border-amber-700 bg-amber-500/10 p-3" onClick={() => startQuiz(due)} data-testid="quiz-card">
          <p className="text-sm font-semibold text-amber-100">{tr("Quiz time")}</p><p className="text-[12px] text-amber-200/80">{tr("{n} questions on lessons {a}–{b}", { n: 5, a: due[0].n + 1, b: due[due.length - 1].n + 1 })}</p></button> : null}
        {today ? <button className="w-full text-start rounded-xl border border-teal-700 bg-teal-500/10 p-3" onClick={() => { putCourse(D.openLesson(course, today.n)); setLessonN(today.n); setView("lesson"); }} data-testid="today-lesson">
          <p className="text-[11px] text-teal-300">{today.done ? tr("Today's lesson · read") : tr("Today's lesson")}</p>
          <p className="text-[15px] font-semibold text-slate-100" dir="auto">{today.n + 1}. {today.title}</p></button>
          : !busy && nextN < course.plan.length ? (modelReady ? <button className={primary + " w-full py-2.5"} onClick={() => makeLesson(course, nextN)} data-testid="make-lesson">{tr("Prepare lesson {n}", { n: nextN + 1 })}</button>
            : <button className={ghost + " w-full"} onClick={openEngine}>{tr("Load a model to write today's lesson")}</button>) : null}
        {today && today.done && !busy && nextN < course.plan.length && modelReady ? (
          <button className={ghost + " w-full"} onClick={async () => { const c2 = course.lessons.some((l) => !l.done) ? course : await makeLesson(course, nextN); const nl = c2 && c2.lessons.find((l) => !l.done); if (nl) { putCourse(D.openLesson(c2, nl.n)); setLessonN(nl.n); setView("lesson"); } }} data-testid="next-now">
            {tr("One more today: lesson {n}", { n: (course.lessons.find((l) => !l.done) || { n: nextN }).n + 1 })}</button>) : null}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[12px] font-semibold text-slate-300 mb-1.5">{tr("The course")}</p>
          {course.plan.map((t, i) => { const l = course.lessons.find((x) => x.n === i);
            return <button key={i} disabled={!l} onClick={() => { setLessonN(i); setView("lesson"); }} className="w-full text-start flex gap-2 py-1 text-[13px] disabled:opacity-100">
              <span className={`w-5 shrink-0 text-end ${l && l.done ? "text-emerald-400" : "text-slate-600"}`}>{l && l.done ? "✓" : i + 1}</span>
              <span className={l ? "text-slate-200" : "text-slate-500"} dir="auto">{t}</span></button>; })}
        </div>
        {course.quizzes.length ? <p className="text-[12px] text-slate-400">{tr("Quizzes")}: {course.quizzes.map((q) => `${q.score}/${q.total}`).join(" · ")}</p> : null}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <div className="flex gap-2 items-center">
            <Bell size={14} className="text-slate-400" /><span className="text-[13px] text-slate-300 flex-1 min-w-0">{tr("Daily notification")}</span>
            <input type="time" value={course.time} onChange={(e) => e.target.value && putCourse({ ...course, time: e.target.value })} className={field + " w-28 shrink-0"} data-testid="learn-time" />
            <button onClick={() => putCourse({ ...course, notify: course.notify === false })} className={`${btn} shrink-0 whitespace-nowrap border ${course.notify !== false ? "border-teal-600 text-teal-200" : "border-slate-700 text-slate-500"}`}>{course.notify !== false ? tr("On") : tr("Off")}</button>
          </div>
          <button className={`${btn} border ${confirmDel ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-400"} flex items-center gap-1`}
            onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setCourses(loadCourses().filter((x) => x.id !== course.id)); setConfirmDel(false); setView("list"); setCur(null); }}>
            <Trash2 size={14} />{confirmDel ? tr("Tap again to delete this course") : tr("Delete this course")}</button>
        </div>
      </section>);
  }

  return (
    <section className="p-4 space-y-3" data-testid="learn-page">
      <div className="flex items-start gap-3">
        <GraduationCap size={22} className="text-teal-300 mt-1 shrink-0" />
        <div className="min-w-0"><h2 className="text-lg font-semibold text-slate-100">{tr("Learn daily")}</h2>
          <p className="text-[13px] text-slate-400">{tr("Pick a topic or a language. Every day a short lesson with a visual, a quiz every few lessons, and what you miss comes back until it sticks.")}</p></div>
      </div>
      <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setView("new")} data-testid="learn-new-btn"><Plus size={16} />{tr("New course")}</button>
      {courses.map((c) => { const t = D.todaysLesson(c); const doneN = c.lessons.filter((l) => l.done).length;
        return <button key={c.id} onClick={() => { setCur(c.id); setView("course"); }} className="w-full text-start rounded-xl border border-slate-800 bg-slate-900/60 p-3" data-testid="learn-course">
          <span className="block text-sm text-slate-100" dir="auto">{c.title || c.topic}</span>
          <span className="block text-[11px] text-slate-500">{tr("{d} of {n} lessons", { d: doneN, n: c.plan.length })} · {tr("streak {n}", { n: c.streak || 0 })}{t && !t.done ? " · " + tr("today: {t}", { t: t.title }) : ""}{D.quizDue(c) ? " · " + tr("quiz due") : ""}</span></button>; })}
    </section>
  );
}

// ================================ Daily news ================================
export function NewsPage({ llm, modelReady, openEngine, flash, native, nativeCall, openId, clearOpen }) {
  const [topics, setTopicsRaw] = useState(loadTopics);
  const [cur, setCur] = useState(null);
  const [form, setForm] = useState({ query: "", lang: "en", time: "08:30" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(null);
  const [past, setPast] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const topic = topics.find((t) => t.id === cur) || null;
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
      const out = await llm(D.digestMessages(t, items), { maxTokens: 900, temperature: 0.2, onToken: (x) => { acc += x; setBusy((b) => b && { ...b, text: acc }); } });
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

  const Digest = ({ d }) => (
    <div className="space-y-2" data-testid="digest">
      {d.none ? <p className="text-[13px] text-slate-400">{tr("Nothing new on this in the last day.")}{d.why ? " (" + d.why + ")" : ""}</p> : <div dir="auto"><Md text={d.text} runnable={false} /></div>}
      {d.unsourced ? <p className="text-[11px] text-amber-300 flex items-center gap-1"><AlertTriangle size={12} />{tr("{n} line(s) cite no source — treat them with care.", { n: d.unsourced })}</p> : null}
      {d.items && d.items.length ? <div className="space-y-1 pt-1" data-testid="digest-sources">
        <p className="text-[11px] text-slate-500">{tr("Sources")}</p>
        {d.items.map((it, i) => <a key={i} href={it.url} target="_blank" rel="noreferrer" className="block text-[12px] text-teal-300/90 truncate" dir="auto">
          [{i + 1}] {it.title}{it.source ? <span className="text-slate-500"> · {it.source}</span> : null}{it.date ? <span className="text-slate-600"> · {ago(it.date)}</span> : null}</a>)}
      </div> : null}
    </div>);

  if (topic) return (
    <section className="p-4 space-y-3" data-testid="news-topic">
      <Back onClick={() => { setCur(null); setPast(null); }} label={tr("Daily news")} />
      <div className="flex items-center gap-2"><Newspaper size={20} className="text-amber-300 shrink-0" /><h2 className="text-lg font-semibold text-slate-100 flex-1" dir="auto">{topic.query}</h2>
        {todays && !busy && modelReady ? <button className="p-1.5 text-slate-400" onClick={() => gather(topic)} title={tr("Refresh")} data-testid="news-refresh"><RefreshCw size={16} /></button> : null}</div>
      {busy ? <Working {...busy} /> : todays ? <Digest d={todays} /> : modelReady
        ? <button className={primary + " w-full py-2.5"} onClick={() => gather(topic)} data-testid="news-gather">{tr("Gather today's news")}</button>
        : <button className={ghost + " w-full"} onClick={openEngine}>{tr("Load a model to write the digest")}</button>}
      <p className="text-[11px] text-slate-500">{tr("The articles come from the web when you open this; the digest is written on your phone and cites every line. Check the sources for anything important.")}</p>
      {topic.digests.filter((d) => d.day !== todayKey).length ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
          <p className="text-[12px] font-semibold text-slate-300">{tr("Earlier days")}</p>
          {topic.digests.filter((d) => d.day !== todayKey).map((d) => (
            <div key={d.day}><button className="text-[13px] text-slate-300" onClick={() => setPast(past === d.day ? null : d.day)}>{d.day}</button>
              {past === d.day ? <div className="mt-1"><Digest d={d} /></div> : null}</div>))}
        </div>) : null}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <div className="flex gap-2 items-center">
          <Bell size={14} className="text-slate-400" /><span className="text-[13px] text-slate-300 flex-1 min-w-0">{tr("Daily notification")}</span>
          <input type="time" value={topic.time} onChange={(e) => e.target.value && putTopic({ ...topic, time: e.target.value })} className={field + " w-28 shrink-0"} />
          <button onClick={() => putTopic({ ...topic, notify: topic.notify === false })} className={`${btn} shrink-0 whitespace-nowrap border ${topic.notify !== false ? "border-teal-600 text-teal-200" : "border-slate-700 text-slate-500"}`}>{topic.notify !== false ? tr("On") : tr("Off")}</button>
        </div>
        <button className={`${btn} border ${confirmDel ? "border-rose-600 bg-rose-500/15 text-rose-200" : "border-slate-700 text-slate-400"} flex items-center gap-1`}
          onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setTopics(loadTopics().filter((x) => x.id !== topic.id)); setConfirmDel(false); setCur(null); }}>
          <Trash2 size={14} />{confirmDel ? tr("Tap again to stop following") : tr("Stop following")}</button>
      </div>
    </section>);

  return (
    <section className="p-4 space-y-3" data-testid="news-page">
      <div className="flex items-start gap-3">
        <Newspaper size={22} className="text-amber-300 mt-1 shrink-0" />
        <div className="min-w-0"><h2 className="text-lg font-semibold text-slate-100">{tr("Daily news")}</h2>
          <p className="text-[13px] text-slate-400">{tr("Follow a team, a player, a market, a subject. Each day: what happened in the last 24 hours, with the sources.")}</p></div>
      </div>
      {adding ? (
        <div className="rounded-xl border border-teal-800 bg-slate-900 p-3 space-y-2" data-testid="news-add">
          <input value={form.query} onChange={(e) => setForm({ ...form, query: e.target.value })} className={field} dir="auto" placeholder={tr("e.g. Al Ahly, Mohamed Salah, Egypt economy")} data-testid="news-query" autoFocus />
          <div className="flex flex-wrap gap-1.5">{["Al Ahly", "Mohamed Salah", "Premier League", "Egypt economy", "Gold price", "AI", "Crane industry"].map((x) =>
            <button key={x} onClick={() => setForm({ ...form, query: tr(x) })} className="text-[12px] rounded-full border border-slate-700 text-slate-300 px-2.5 py-1">{tr(x)}</button>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} className={field}><option value="en">English</option><option value="ar">العربية</option></select>
            <input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value || "08:30" })} className={field} />
          </div>
          <div className="flex gap-2">
            <button className={primary} disabled={form.query.trim().length < 2} data-testid="news-follow" onClick={() => { const t = D.newTopic(form); putTopic(t); setAdding(false); setForm({ query: "", lang: form.lang, time: form.time }); setCur(t.id); }}>{tr("Follow")}</button>
            <button className={ghost} onClick={() => setAdding(false)}>{tr("Cancel")}</button>
          </div>
        </div>) : <button className={primary + " w-full flex items-center justify-center gap-1.5 py-2.5"} onClick={() => setAdding(true)} data-testid="news-add-btn"><Plus size={16} />{tr("Follow a topic")}</button>}
      {topics.map((t) => { const d = t.digests[0]; const fresh = d && d.day === todayKey;
        return <button key={t.id} onClick={() => setCur(t.id)} className="w-full text-start rounded-xl border border-slate-800 bg-slate-900/60 p-3" data-testid="news-topic-item">
          <span className="block text-sm text-slate-100" dir="auto">{t.query}</span>
          <span className="block text-[11px] text-slate-500 truncate" dir="auto">{fresh ? (d.none ? tr("Nothing new today") : String(d.text).split("\n")[0].replace(/\*+/g, "")) : tr("Not gathered today")} · {t.time}</span></button>; })}
    </section>
  );
}

function ago(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 60) return tr("{n} min ago", { n: Math.max(1, m) });
  const h = Math.round(m / 60);
  return h < 48 ? tr("{n} h ago", { n: h }) : new Date(t).toLocaleDateString();
}
