/* ---- v6.32 Learn: say it (speaking practice with a score), a spoken dialogue, a picture drawn for the lesson, and a course
   from a Knowledge pack. Logic: speak.js, packcourse.js. Used by daily-ui.jsx (LearnPage). Tests: tests/e2e_v736learn.py.      */
import React, { useState } from "react";
import { Volume2, Mic, Loader2, ImageIcon, BookOpen, ChevronRight, MessageCircle, RefreshCw } from "lucide-react";
import { tr } from "./i18n.js";
import { speakNow } from "./lesson-ui.jsx";
import * as P from "./speak.js";
import * as K from "./packcourse.js";

const MARK = { good: "var(--c-pos, #2f9e73)", close: "#c98a1b", missed: "var(--c-neg, #d0534f)" };
const ghost = "rounded-lg px-3 py-1.5 text-[13px] font-medium border inline-flex items-center gap-1.5 disabled:opacity-40";
const gs = { borderColor: "var(--c-ln)", color: "var(--c-ink)", background: "transparent" };

/** The words, coloured by how each was said; v6.41 (D1): the ones to fix are replayed slowly, one by one, then the sentence. */
function Scored({ r, slow }) {
  const fix = r.words.filter((w) => w.mark !== "good").map((w) => w.w);
  return (
    <div className="text-[13.5px] mt-1" dir="auto" data-testid="speak-result">
      <b className="c-num me-2" data-testid="speak-score">{r.score}/100</b>
      {r.words.map((w, i) => <span key={i} style={{ color: MARK[w.mark], textDecoration: w.mark === "missed" ? "underline dotted" : "none" }} className="me-1">{w.w}</span>)}
      <div className="c-sub text-[12px]">{tr(P.scoreWord(r.score))}{r.heard ? " · " + tr("heard: «{h}»", { h: r.heard }) : ""}</div>
      {fix.length && slow ? <button className={ghost + " mt-1"} style={gs} onClick={() => slow(fix)} data-testid="speak-slow"><Volume2 size={13} />{tr("Hear the ones to fix, slowly")}</button> : null}
    </div>);
}

/** Hear → say → a score per word. lesson.speak = { [phrase]: best score } is kept with the lesson. */
export function SpeakPractice({ lesson, course, native, call, listen, onBest }) {
  const tag = P.langTagOf(course.topic);
  const phrases = P.phrasesFrom(lesson);
  const [res, setRes] = useState({});
  const [busy, setBusy] = useState("");
  if (!tag || !phrases.length) return null;
  const hear = (p) => speakNow(p, { lang: tag, rate: 0.85, native: native ? { N: native, call } : null });
  const say = async (p) => {
    if (!listen) return;
    setBusy(p);
    try {
      const heard = (await listen(tag, () => {})) || "";
      const r = { ...P.pronScore(p, heard, tag), heard };
      setRes((o) => ({ ...o, [p]: r }));
      onBest && onBest(p, r.score);
    } catch (e) { setRes((o) => ({ ...o, [p]: { score: 0, words: P.sayWords(p, tag).map((w) => ({ w, mark: "missed" })), heard: "" } })); }
    finally { setBusy(""); }
  };
  const best = lesson.speak || {};
  return (
    <div className="c-card space-y-2" data-testid="speak-practice">
      <p className="c-lbl m-0 flex items-center gap-1.5"><Mic size={14} />{tr("Say it")}</p>
      {!listen ? <p className="c-sub text-[12.5px] m-0">{tr("Listen here; saying it and the score need the Android app's speech recognition.")}</p> : null}
      {phrases.map((p) => (
        <div key={p} className="py-1" data-testid="speak-phrase">
          <div className="flex items-center gap-2">
            <span className="flex-1 font-medium" dir="auto">{p}</span>
            {best[p] != null ? <span className="c-sub c-num text-[12px]">{tr("best {s}", { s: best[p] })}</span> : null}
            <button className={ghost} style={gs} onClick={() => hear(p)} aria-label={tr("Hear it")} data-testid="speak-hear"><Volume2 size={14} /></button>
            {listen ? <button className={ghost} style={gs} disabled={!!busy} onClick={() => say(p)} data-testid="speak-say">{busy === p ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}{tr("Say")}</button> : null}
          </div>
          {res[p] ? <Scored r={res[p]} slow={async (fix) => { for (const w of fix) await speakNow(w, { lang: tag, rate: 0.55, native: native ? { N: native, call } : null }); await speakNow(p, { lang: tag, rate: 0.7, native: native ? { N: native, call } : null }); }} /> : null}
        </div>))}
    </div>);
}

/** A short conversation from the lesson: the phone says one part, you say the other (then swap). */
export function DialogueCard({ lesson, course, native, call, listen, make, busy }) {
  const tag = P.langTagOf(course.topic);
  const [me, setMe] = useState("B");
  const [at, setAt] = useState(-1);
  const [scores, setScores] = useState({});
  if (!tag) return null;
  const d = lesson.dialogue;
  if (!d) return make ? (
    <button className={ghost} style={gs} disabled={!!busy} onClick={make} data-testid="dialogue-make"><MessageCircle size={14} />{tr("Practise a short conversation")}</button>) : null;
  const voice = native ? { N: native, call } : null;
  const play = async () => {
    setScores({});
    for (let i = 0; i < d.lines.length; i++) {
      setAt(i);
      const ln = d.lines[i];
      if (ln.who !== me || !listen) { await speakNow(ln.text, { lang: tag, rate: 0.9, native: voice }); continue; }
      try { const heard = (await listen(tag, () => {})) || ""; setScores((o) => ({ ...o, [i]: { ...P.pronScore(ln.text, heard, tag), heard } })); }
      catch (e) { setScores((o) => ({ ...o, [i]: { score: 0, words: [], heard: "" } })); }
    }
    setAt(-1);
  };
  const mine = Object.values(scores);
  const avg = mine.length ? Math.round(mine.reduce((s, x) => s + x.score, 0) / mine.length) : null;
  return (
    <div className="c-card space-y-2" data-testid="dialogue">
      <p className="c-lbl m-0 flex items-center gap-1.5"><MessageCircle size={14} />{d.title || tr("A short conversation")}</p>
      {d.lines.map((ln, i) => (
        <div key={i} className={"rounded-lg px-2.5 py-1.5 " + (ln.who === me ? "ms-6" : "me-6")} style={{ background: at === i ? "rgba(79,194,175,.14)" : "var(--c-bg)", border: "1px solid var(--c-ln)" }} data-testid="dialogue-line">
          <div className="text-[12px] c-sub">{ln.who === me ? tr("You") : tr("The phone")}</div>
          <div dir="auto" className="font-medium">{ln.text}</div>
          {ln.say ? <div dir="auto" className="c-sub text-[12.5px]">{ln.say}</div> : null}
          {scores[i] ? <Scored r={scores[i]} /> : null}
        </div>))}
      <div className="flex flex-wrap gap-2 items-center">
        <button className="c-btn inline-flex items-center gap-1.5" disabled={at >= 0} onClick={play} data-testid="dialogue-play">{at >= 0 ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}{listen ? tr("Start — you say the {p} lines", { p: me }) : tr("Listen to it")}</button>
        <button className={ghost} style={gs} disabled={at >= 0} onClick={() => { setMe(me === "A" ? "B" : "A"); setScores({}); }} data-testid="dialogue-swap"><RefreshCw size={13} />{tr("Swap parts")}</button>
        {avg != null && at < 0 ? <span className="c-num" data-testid="dialogue-score">{tr("Your lines: {s}/100", { s: avg })}</span> : null}
      </div>
    </div>);
}

/** A picture for the lesson, drawn on the phone (Studio's engine) and kept with the lesson. */
export function LessonPicture({ lesson, course, native, call, onPicture, openStudio }) {
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  let pack = null;
  try { const i = native && native.imageInfo ? JSON.parse(native.imageInfo()) : null; const ps = (i && i.packs) || []; pack = ps.find((p) => p.installed !== false) || null; } catch (e) {}
  if (lesson.picture) return <img src={lesson.picture} alt="" className="w-full rounded-xl" style={{ maxHeight: 340, objectFit: "cover" }} data-testid="lesson-picture" />;
  if (!pack) return openStudio ? <button className={ghost} style={gs} onClick={openStudio}><ImageIcon size={14} />{tr("Draw a picture for this lesson (Studio)")}</button> : null;
  const draw = async () => {
    setBusy(0); setErr("");
    try {
      const prompt = `${course.topic}: ${lesson.title}. A clear, friendly educational illustration, simple shapes, soft colours, no text, no letters`;
      const d = pack.defaults || {};
      const r = await call("imagine", { pack: pack.id, prompt, width: 512, height: 384, steps: d.steps || 4, cfg: d.cfg || 1 }, (pct) => setBusy(Math.round(pct || 0)));
      if (r && r.url) onPicture(r.url);
    } catch (e) { setErr(String((e && e.message) || e)); }
    finally { setBusy(null); }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button className={ghost} style={gs} disabled={busy != null} onClick={draw} data-testid="lesson-draw">{busy != null ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}{busy != null ? tr("Drawing… {p}%", { p: busy }) : tr("Draw a picture for this lesson")}</button>
      {err ? <span className="c-neg text-[12px]">{err}</span> : null}
    </div>);
}

/** New course from a Knowledge pack on the phone: pick the pack, then the book. */
export function PackCourses({ native, call, onStart, flash }) {
  const [books, setBooks] = useState(null);       // { pack, list } | null
  const [loading, setLoading] = useState("");
  let packs = [];
  try { packs = native && native.knowPacks ? (JSON.parse(native.knowPacks()).packs || []).filter((p) => p.installed) : []; } catch (e) {}
  if (!native || !native.knowToc || !packs.length) return null;
  const open = async (p) => {
    setLoading(p.id);
    try { const r = await call("knowToc", { pack: p.id }); setBooks({ pack: p, list: K.booksOf((r && r.sections) || []) }); }
    catch (e) { flash && flash(String((e && e.message) || e)); }
    finally { setLoading(""); }
  };
  return (
    <div className="space-y-2" data-testid="learn-packs">
      <p className="c-lbl">{tr("From your knowledge packs")}</p>
      {!books ? <div className="c-list">{packs.map((p) => (
        <button key={p.id} className="w-full text-start p-3 flex items-center gap-3" onClick={() => open(p)} data-testid={"learn-pack-" + p.id}>
          <BookOpen size={18} className="c-acc shrink-0" />
          <span className="flex-1 min-w-0"><b className="block text-[14px]">{p.name || p.id}</b><span className="c-sub">{tr("Turn a book into a daily course")}</span></span>
          {loading === p.id ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" />}
        </button>))}</div>
        : <div className="space-y-2">
          <button className="c-sub text-[12.5px]" onClick={() => setBooks(null)}>← {books.pack.name || books.pack.id}</button>
          <div className="c-list">{books.list.map((b) => (
            <button key={b.book} className="w-full text-start p-3 flex items-center gap-3" onClick={() => onStart(K.courseFromBook({ id: books.pack.id, name: books.pack.name }, b))} data-testid="learn-book">
              <span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{b.book}</b>
                <span className="c-sub block truncate" dir="auto">{tr("{n} lessons", { n: Math.min(K.MAX_LESSONS, b.sections.length) })} · {b.sections.slice(0, 3).map((s) => s.section).join(" · ")}…</span></span>
              <ChevronRight size={16} className="c-acc shrink-0 rtl:-scale-x-100" />
            </button>))}</div>
          {!books.list.length ? <p className="c-sub">{tr("This pack has no books to turn into a course.")}</p> : null}
        </div>}
      <p className="c-sub text-[12.5px]">{tr("Each lesson is a section of the book in its own words (with its source), so it works without a model; with a model loaded, it is explained more simply from that text only.")}</p>
    </div>);
}
