/* ---- v6.27 Homework Coach (mode "coach", All → Mind & learning; Chat hands homework photos to it) — design A "Calm" ----------
   Snap or type the homework → its problems (each one editable, so a misread photo is fixed before teaching) → "Teach me":
   the lesson player (pictures + the phone's voice + "your turn"), a badge that says how the answer was checked, and
   "Practise 3 like this" (made and marked by code). Teach-first (default) or show-the-answers. Tests: tests/e2e_v727coach.py. */
import React, { useEffect, useRef, useState } from "react";
import { GraduationCap, Camera, Pencil, Check, X, ShieldCheck, AlertTriangle } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as C from "./coach.js";
import { LessonPlayer, answerMatches, speakNow } from "./lesson-ui.jsx";
import { PANES, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

const LANG_NAME = () => (getLang() === "ar" ? "Arabic (simple, formal)" : "English");
function shrink(file) {
  return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => ok(fr.result); img.src = fr.result; }; fr.onerror = () => ok(""); fr.readAsDataURL(file); });
}

function Practice({ src, onResult, native }) {
  const [qs] = useState(() => C.practiceLike(src, 3));
  const [a, setA] = useState({}), [res, setRes] = useState({});
  if (!qs.length) return <p className="c-sub text-[13px]">{tr("No practice for this kind of problem yet.")}</p>;
  return (
    <div className="space-y-2" data-testid="coach-practice">
      <span className="c-lbl">{tr("Your turn — 3 like this")}</span>
      {qs.map((q, i) => (
        <div key={i} className="flex items-center gap-2" data-testid="coach-practice-item">
          <span className="flex-1 c-num font-semibold" dir="ltr">{q.text}</span>
          <input value={a[i] || ""} onChange={(e) => setA((x) => ({ ...x, [i]: e.target.value }))} inputMode="decimal" dir="ltr" className="w-24 rounded-lg px-2 py-1.5 border bg-transparent" style={{ borderColor: res[i] === false ? "var(--c-neg)" : "var(--c-ln)", color: "var(--c-ink)" }} data-testid="coach-practice-answer" />
          {res[i] === true ? <Check size={18} className="c-pos" /> : (
            <button className="c-btn px-3 py-1.5" disabled={!a[i]} data-testid="coach-practice-check" onClick={() => {
              const okk = answerMatches(a[i], q.answer.replace(/^[a-z] = /, "")); setRes((x) => ({ ...x, [i]: okk })); onResult(okk, q.text);
              speakNow(okk ? (getLang() === "ar" ? "صحيح" : "Correct") : (getLang() === "ar" ? "حاول مرة أخرى" : "Try again"), { lang: getLang(), native });
            }}>{tr("Check")}</button>)}
          {res[i] === false ? <span className="c-neg text-[12px]">{tr("answer: {a}", { a: q.answer })}</span> : null}
        </div>))}
    </div>);
}

export function CoachPage({ native, readText, ask, verify, incoming, clearIncoming, flash }) {
  const [state, setState] = useState(() => C.loadCoach());
  const put = (c) => setState(C.saveCoach(c));
  const teach = state.settings ? state.settings.teach !== false : true;
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [items, setItems] = useState([]);       // [{ n, text }]
  const [active, setActive] = useState(null);   // { i, lesson, checked, by, answer, topic, src }
  const [busy, setBusy] = useState("");
  const [typing, setTyping] = useState(false);
  const [marked, setMarked] = useState(null);   // v6.41 (S1) the marked worksheet
  const fileRef = useRef(null);
  const weak = C.weakTopics(state);

  const readPage = (t) => { const ps = C.splitProblems(t); setItems(ps); setActive(null); setMarked(null); if (!ps.length) flash && flash(tr("No problems found — type it instead")); };
  const fromPhoto = async (url) => {
    setPhoto(url); setBusy(tr("Reading the homework…"));
    let t = ""; try { const r = readText ? await readText(url.split(",")[1]) : null; t = (r && r.text) || ""; } catch (e) {}
    setBusy("");
    if (!t.trim()) { setTyping(true); flash && flash(tr("Couldn't read the photo — type the problem")); return; }
    setText(t); readPage(t);
  };
  useEffect(() => {
    if (!incoming) return;
    if (incoming.image) fromPhoto(incoming.image); else if (incoming.text) { setText(incoming.text); readPage(incoming.text); }
    clearIncoming && clearIncoming();
  }, [incoming]);

  const open = async (i, only) => {
    const p = only ? { ...items[i], text: only } : items[i]; if (!p) return;   // v6.41: from a marked row, the problem without the child's answer
    const L = C.lessonFor(p.text, { teach, lang: getLang() });
    if (L) { setActive({ i, lesson: L.lesson, checked: true, by: "code", answer: L.answer, topic: L.topic, src: p.text, kind: L.kind }); return; }
    if (!ask) { setActive({ i, none: true, src: p.text }); return; }
    setBusy(tr("Preparing the lesson…"));
    let m = null; try { m = C.readCoachModel(await ask(C.coachModelPrompt(p.text, { lang: LANG_NAME(), level: (state.settings && state.settings.level) || "" }))); } catch (e) {}
    let checked = false, by = "", answer = m ? m.answer : "";
    // maths the engine can't prove (word problems, powers, roots…): Python checks the final answer
    if (m && verify && /\d/.test(p.text)) {
      try { const v = await verify(p.text); if (v && v.ok && v.answer != null) { checked = true; by = "python"; if (!answerMatches(v.answer, m.answer) && String(v.answer).trim()) { answer = String(v.answer); m.steps.push({ text: answer, rule: tr("Corrected by running the maths: the answer is {a}", { a: answer }) }); } } } catch (e) {}
    }
    setBusy("");
    if (!m) { setActive({ i, none: true, src: p.text }); return; }
    setActive({ i, lesson: { title: p.text, lang: getLang(), steps: [...m.steps, ...(m.steps[m.steps.length - 1].text === answer ? [] : [{ text: answer, rule: tr("The answer") }])] }, checked, by, answer, topic: "other", src: p.text });
  };

  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="coach-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><GraduationCap size={21} className="c-acc" />{tr("Homework Coach")}</h2>
        <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("Snap the homework — Attune teaches it step by step, with pictures and a voice. Maths is checked by code before you see it.")}</p></div>
      {/* v6.27 computer layout A: the homework and its problems on the left, the lesson on the right (stacked on a phone) */}
      <div className={PANES}><div className={LEFT}>
      <div className="flex gap-2 flex-wrap">
        {[[true, "Teach me first"], [false, "Show the answers"]].map(([v, l]) => <button key={l} className="c-pill" aria-pressed={teach === v} style={teach === v ? { background: "var(--c-acc)", color: "#fff" } : {}} onClick={() => put({ ...state, settings: { ...(state.settings || {}), teach: v } })} data-testid={v ? "coach-teach" : "coach-answers"}>{tr(l)}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="c-card text-center py-3" onClick={() => fileRef.current && fileRef.current.click()} data-testid="coach-photo"><Camera size={18} className="c-acc mx-auto" /><span className="block text-[13px] mt-1">{tr("Photo of the homework")}</span></button>
        <button className="c-card text-center py-3" onClick={() => setTyping((v) => !v)} data-testid="coach-type"><Pencil size={18} className="c-acc mx-auto" /><span className="block text-[13px] mt-1">{tr("Type a problem")}</span></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" data-testid="coach-file" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) fromPhoto(await shrink(f)); }} />
      {typing ? (
        <div className="c-card space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} dir="auto" placeholder={tr("e.g. 3(x − 2) = x + 4   or   1/2 + 1/3   or a question from any subject")} className="w-full rounded-lg px-3 py-2 border bg-transparent text-[15px]" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} data-testid="coach-text" />
          <button className="c-btn" disabled={!text.trim()} onClick={() => readPage(text)} data-testid="coach-go">{tr("Start")}</button>
        </div>) : null}
      {weak.length && !items.length ? <div className="c-card" data-testid="coach-weak"><span className="c-lbl">{tr("Needs practice")}</span><p className="m-0 mt-1">{weak.map((w) => tr(C.TOPIC_NAMES[w] || w)).join(" · ")}</p></div> : null}
      {busy ? <p className="c-sub" data-testid="coach-busy">{busy}</p> : null}
      {photo && items.length ? <img src={photo} alt="" className="max-h-40 rounded-xl" /> : null}
      {items.length ? (
        <div className="space-y-2" data-testid="coach-items"><span className="c-lbl">{tr("Check it was read right, then tap Teach me")}</span>
          {/* v6.41 (S1): the child's written answers, marked by the maths engine */}
          <button className="c-btn w-full" onClick={() => { const r = C.markWorksheet(items, { lang: getLang() }); setMarked(r); let st = state; for (const x of r.items) if (x.status === "right" || x.status === "wrong") st = C.record(st, x.topic || "other", x.status === "right", x.text); put(st); }} data-testid="coach-mark">{tr("Mark the worksheet")}</button>
          {marked ? <div className="c-card space-y-1.5" data-testid="coach-marked">
            <b className="block" data-testid="coach-mark-score">{marked.score != null ? tr("{r} of {n} right", { r: marked.right, n: marked.right + marked.wrong }) : tr("Nothing the maths engine can mark")}{marked.blank ? " · " + tr("{b} not answered", { b: marked.blank }) : ""}</b>
            {marked.items.map((x, k) => <div key={k} className="flex items-start gap-2 text-[13.5px]" data-testid="coach-mark-row" data-status={x.status}>
              <span className={x.status === "right" ? "c-pos" : x.status === "wrong" ? "c-neg" : "c-sub"}>{x.status === "right" ? "✓" : x.status === "wrong" ? "✗" : "—"}</span>
              <span className="flex-1 c-num" dir="ltr">{x.text}{x.given ? " → " + x.given : ""}{x.status === "wrong" ? <b className="c-pos"> · {x.correct}</b> : x.status === "blank" && x.correct ? <span className="c-sub"> · {tr("not answered")}</span> : x.status === "unsure" ? <span className="c-sub"> · {tr("check by hand")}</span> : null}</span>
              {x.status === "wrong" || x.status === "blank" ? <button className="c-sub underline text-[12px]" onClick={() => { const i = items.findIndex((y) => y.n === x.n); if (i >= 0) open(i, x.text); }} data-testid="coach-mark-steps">{tr("The steps")}</button> : null}
            </div>)}
          </div> : null}
          {items.map((p, i) => (
            <div key={i} className="c-card flex items-center gap-2 py-2" data-testid="coach-item" style={active && active.i === i ? { borderColor: "var(--c-acc)" } : {}}>
              <span className="c-sub w-6">{p.n}</span>
              <input value={p.text} onChange={(e) => setItems((x) => x.map((y, k) => (k === i ? { ...y, text: e.target.value } : y)))} dir="auto" className="flex-1 bg-transparent outline-none c-num text-[15px]" style={{ color: "var(--c-ink)" }} data-testid="coach-item-text" />
              <button className="c-btn px-3 py-1.5" onClick={() => open(i)} data-testid="coach-teachme">{tr("Teach me")}</button>
            </div>))}
        </div>) : null}
      </div><div className={active ? RIGHT : "min-w-0"}>
      {active && active.none ? <p className="c-sub" data-testid="coach-none">{tr("This needs the phone's AI model — install one in Engine, or type the problem more simply.")}</p> : null}
      {active && active.lesson ? (
        <div className="space-y-3">
          <LessonPlayer key={active.i + ":" + active.src} lesson={active.lesson} native={native} autoplay={false}
            onDone={() => { put(C.record(state, active.topic, true, active.src)); }} />
          <p className={"text-[12.5px] m-0 flex items-center gap-1.5 " + (active.checked ? "c-pos" : "c-warn")} data-testid="coach-checked">
            {active.checked ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
            {active.by === "code" ? tr("Every step checked by exact arithmetic") : active.by === "python" ? tr("The answer was checked by running the maths") : tr("Explained by the phone's AI — not checked; ask your teacher if unsure")}</p>
          {active.by === "code" && active.kind !== "error" ? <Practice key={active.src} src={active.src} native={native} onResult={(okk, t) => put(C.record(C.loadCoach(), active.topic, okk, t))} /> : null}
        </div>) : null}
      {!active ? <DeskEmpty icon={GraduationCap} title={tr("The lesson appears here")} text={tr("Type or snap the homework, then tap Teach me on a problem.")} testid="coach-desk-empty" /> : null}
      </div></div>
    </div>);
}
