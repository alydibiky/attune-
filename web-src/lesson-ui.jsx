/* ---- v6.27 the lesson player — teaching that plays like a short video (Ali: "teaching with visuals or videos … interactive
   audio also"): each step DRAWS itself (balance, fraction bars, dot arrays, number-line jumps, percent bars) while the phone's
   own voice explains it (offline voices); ▶ / ⏸, ↺ replay, speed, captions; "Your turn" questions between steps, checked by
   code. Used by the Homework Coach (coach-ui.jsx) and Learn daily. No video files, no network: the "video" is drawn live.
   lesson = { title, lang, steps: [{ text, rule, visual?, say?, ask?: { q, answer (string|number), hint? } }] }        */
import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, RefreshCw, Check, X, ChevronRight, ChevronLeft } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { cardPad, btnP, btnS, inp, chip } from "./ui-kit.jsx";

// ---- speaking: the phone's voice (waits for the end), else the browser's, else a quiet timer ---------------------------------------
export function speakNow(text, { lang, rate = 1, native } = {}) {
  return new Promise((done) => {
    const t = String(text || "").trim(); if (!t) return done();
    const timer = () => setTimeout(done, Math.min(9000, 700 + t.length * 55 / rate));
    try {
      if (native && native.call && native.N && native.N.speakWait) { native.call("speakWait", { text: t, lang: lang || "", rate }).then(done, done); return; }
      if (typeof window !== "undefined" && window.speechSynthesis && window.SpeechSynthesisUtterance) {
        const u = new SpeechSynthesisUtterance(t); u.lang = lang || ""; u.rate = rate; let fin = false; const end = () => { if (!fin) { fin = true; done(); } };
        u.onend = end; u.onerror = end; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setTimeout(end, 1500 + t.length * 120 / rate); return;
      }
    } catch (e) {}
    timer();
  });
}
export function stopSpeaking(native) { try { if (native && native.N && native.N.stopSpeaking) native.N.stopSpeaking(); if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {} }
/** Maths read aloud: "3 × (−2) = −6" → "3 times negative 2 equals negative 6" (English) / Arabic words. */
export function spokenMath(s, lang) {
  const ar = lang === "ar";
  const W = ar ? { "×": " ضرب ", "÷": " قسمة ", "+": " زائد ", "−": " ناقص ", "=": " يساوي ", "✓": " صحيح ", "%": " في المئة ", "^2": " تربيع ", "^3": " تكعيب ", "/": " على " }
    : { "×": " times ", "÷": " divided by ", "+": " plus ", "−": " minus ", "=": " equals ", "✓": " correct. ", "%": " percent ", "^2": " squared ", "^3": " cubed ", "/": " over " };
  return String(s || "").replace(/\(−/g, ar ? "(سالب " : "(negative ").replace(/^−/, ar ? "سالب " : "negative ")
    .replace(/\^2|\^3/g, (m) => W[m]).replace(/[×÷+−=✓%]/g, (m) => W[m]).replace(/(\d)\/(\d)/g, (m, a, b) => a + W["/"] + b).replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
}

// ---- the pictures (SVG, drawn with a short animation) ---------------------------------------------------------------------------
const ACC = "var(--c-acc, #0F7B6C)", INK = "var(--c-ink, #16201D)", MUT = "var(--c-mut, #6B7672)", SOFT = "var(--c-soft, #E2F1ED)";
function Balance({ left, right }) {
  return (
    <svg viewBox="0 0 300 150" className="w-full max-w-[340px]" role="img" aria-label={`${left} = ${right}`}>
      <line x1="150" y1="30" x2="150" y2="130" stroke={MUT} strokeWidth="4" /><polygon points="130,140 170,140 150,124" fill={MUT} />
      <g className="att-tilt"><line x1="40" y1="40" x2="260" y2="40" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M40 40 L15 90 H85 Z" fill={SOFT} stroke={ACC} strokeWidth="2" /><path d="M260 40 L235 90 H305 Z" fill={SOFT} stroke={ACC} strokeWidth="2" transform="translate(-20 0)" />
        <text x="50" y="82" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK}>{left}</text><text x="250" y="82" textAnchor="middle" fontSize="16" fontWeight="700" fill={INK}>{right}</text></g>
      <text x="150" y="22" textAnchor="middle" fontSize="12" fill={MUT}>{tr("both sides stay equal")}</text>
    </svg>);
}
function Fractions({ parts = [], op, result }) {
  const bar = (q, y, label) => { const d = Math.max(1, Math.min(24, q.d)), n = Math.max(0, Math.min(d, Math.abs(q.n) % (d + 1))); const w = 240 / d;
    return <g key={y}>{Array.from({ length: d }, (_, i) => <rect key={i} x={30 + i * w} y={y} width={w - 2} height="22" rx="3" fill={i < n ? ACC : SOFT} className="att-pop" style={{ animationDelay: i * 60 + "ms" }} />)}<text x="22" y={y + 16} textAnchor="end" fontSize="13" fill={INK}>{label}</text></g>; };
  const [a, b] = parts;
  return (
    <svg viewBox="0 0 290 110" className="w-full max-w-[340px]" role="img" aria-label="fractions">
      {a ? bar(a, 8, a.toString()) : null}{b ? bar(b, 42, (op === "-" ? "−" : "+") + b.toString()) : null}{result && result.d <= 24 && result.n >= 0 && result.n <= result.d ? bar(result, 78, "=") : null}
    </svg>);
}
function Dots({ rows, cols }) {
  return (
    <svg viewBox={`0 0 ${cols * 22 + 20} ${rows * 22 + 20}`} className="w-full max-w-[300px]" role="img" aria-label={`${rows} × ${cols}`}>
      {Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => <circle key={r + "-" + c} cx={20 + c * 22} cy={20 + r * 22} r="7" fill={ACC} className="att-pop" style={{ animationDelay: r * 140 + c * 25 + "ms" }} />))}
    </svg>);
}
function NumberLine({ from, to }) {
  const lo = Math.min(from, to, 0) - 1, hi = Math.max(from, to, 0) + 1, span = hi - lo, X = (v) => 20 + ((v - lo) / span) * 260;
  return (
    <svg viewBox="0 0 300 90" className="w-full max-w-[340px]" role="img" aria-label={`${from} to ${to}`}>
      <line x1="15" y1="60" x2="285" y2="60" stroke={INK} strokeWidth="2" />
      {Array.from({ length: span + 1 }, (_, i) => lo + i).map((v) => <g key={v}><line x1={X(v)} y1="55" x2={X(v)} y2="65" stroke={MUT} /><text x={X(v)} y="82" textAnchor="middle" fontSize="11" fill={v === 0 ? INK : MUT}>{v < 0 ? "−" + -v : v}</text></g>)}
      <path d={`M${X(from)} 55 Q ${(X(from) + X(to)) / 2} 5 ${X(to)} 55`} fill="none" stroke={ACC} strokeWidth="3" className="att-draw" />
      <circle cx={X(to)} cy="60" r="6" fill={ACC} />
    </svg>);
}
function PercentBar({ part, whole = 100 }) {
  const w = Math.max(0, Math.min(1, part / whole)) * 260;
  return (<svg viewBox="0 0 300 50" className="w-full max-w-[340px]" role="img" aria-label={part + "%"}><rect x="20" y="12" width="260" height="22" rx="6" fill={SOFT} /><rect x="20" y="12" width={w} height="22" rx="6" fill={ACC} className="att-grow" /><text x="150" y="28" textAnchor="middle" fontSize="12" fill={INK}>{Math.round(part * 100) / 100}%</text></svg>);
}
export function Visual({ v }) {
  if (!v) return null;
  if (v.kind === "balance") return <Balance left={v.left} right={v.right} />;
  if (v.kind === "fractions") return <Fractions parts={v.parts} op={v.op} result={v.result} />;
  if (v.kind === "array") return <Dots rows={v.rows} cols={v.cols} />;
  if (v.kind === "numberline") return <NumberLine from={v.from} to={v.to} />;
  if (v.kind === "bar") return <PercentBar part={v.part} whole={v.whole} />;
  return null;
}

// ---- "Your turn": the answer checked by code (numbers compared exactly, words loosely) ---------------------------------------------
const norm = (s) => String(s == null ? "" : s).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[−–]/g, "-").replace(/\s+/g, "").replace(/^x=/i, "").toLowerCase();
const asNum = (s) => { const t = norm(s); const f = /^(-?\d+)\/(\d+)$/.exec(t); if (f) return +f[1] / +f[2]; const m = /^(\d+)(\d+)\/(\d+)$/.exec(t); return t !== "" && isFinite(+t) ? +t : NaN; };
export const answerMatches = (given, want) => { const a = asNum(given), b = asNum(want); return isFinite(a) && isFinite(b) ? Math.abs(a - b) < 1e-9 : norm(given) === norm(want) && norm(want) !== ""; };

/** The player. native = { N, call } (the phone's bridge) for its voice. */
export function LessonPlayer({ lesson, native, onDone, autoplay = false }) {
  const steps = (lesson && lesson.steps) || [];
  const lang = (lesson && lesson.lang) || getLang();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const [rate, setRate] = useState(1);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);   // null | "right" | "wrong"
  const [tries, setTries] = useState(0);
  const alive = useRef(true), playRef = useRef(playing), runId = useRef(0);
  playRef.current = playing;
  useEffect(() => () => { alive.current = false; stopSpeaking(native); }, []);
  const s = steps[i] || {};
  const asking = !!(s.ask && result !== "right" && tries < 3);
  const say = (st) => [st.say || st.rule, st.say ? "" : spokenMath(st.text, lang)].filter(Boolean).join(". ");
  // play: speak this step, then go on (stops at a question, which waits for the child)
  useEffect(() => {
    if (!playing || !steps.length) return;
    const my = ++runId.current;
    (async () => {
      await speakNow(say(s), { lang, rate, native });
      if (!alive.current || my !== runId.current || !playRef.current) return;
      if (asking) { setPlaying(false); return; }
      if (i < steps.length - 1) setI(i + 1); else { setPlaying(false); onDone && onDone(); }
    })();
  }, [playing, i]);
  const go = (k) => { stopSpeaking(native); runId.current++; setI(Math.max(0, Math.min(steps.length - 1, k))); setResult(null); setAnswer(""); setTries(0); };
  const check = () => {
    const ok = answerMatches(answer, s.ask.answer);
    setResult(ok ? "right" : "wrong"); setTries((t) => t + 1);
    speakNow(ok ? (lang === "ar" ? "أحسنت!" : "Well done!") : (lang === "ar" ? "ليس بعد. حاول مرة أخرى." : "Not yet. Try again."), { lang, rate, native });
  };
  if (!steps.length) return null;
  return (
    <div className={"calm " + cardPad} data-testid="lesson-player">
      {lesson.title ? <b className="block mb-2 text-[16px] font-extrabold" dir="auto">{lesson.title}</b> : null}
      <div className="flex gap-1 mb-3" aria-hidden="true">{steps.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k <= i ? "var(--c-acc)" : "var(--c-ln)" }} />)}</div>
      <div key={i} className="att-fadein space-y-2 min-h-[140px]" data-testid="lesson-step">
        <p className="c-lbl m-0">{tr("Step {i} of {n}", { i: i + 1, n: steps.length })}</p>
        <div className="text-[22px] font-black tracking-tight c-num tabular-nums" dir="ltr" data-testid="lesson-text">{asking ? s.ask.q || "?" : s.text}</div>
        {!asking ? <p className="c-sub m-0" dir="auto" data-testid="lesson-rule">{s.rule}</p> : null}
        {!asking && s.visual ? <div className="pt-1"><Visual v={s.visual} /></div> : null}
        {asking && s.visual && s.visual.kind === "fractions" ? <div className="pt-1"><Visual v={{ ...s.visual, result: null }} /></div> : null}
        {s.ask && result !== "right" && tries < 3 ? (
          <div className="flex gap-2 items-center pt-1" data-testid="lesson-ask">
            <input value={answer} onChange={(e) => { setAnswer(e.target.value); setResult(null); }} onKeyDown={(e) => e.key === "Enter" && answer && check()} inputMode="decimal" dir="ltr"
              className={inp + " flex-1 !text-[16px]"} style={{ borderColor: result === "wrong" ? "var(--c-neg)" : "var(--c-ln)", color: "var(--c-ink)" }} placeholder={tr("Your answer")} data-testid="lesson-answer" />
            <button className={btnP + " shrink-0"} disabled={!answer} onClick={check} data-testid="lesson-check">{tr("Check")}</button>
          </div>) : null}
        {result === "wrong" ? <p className="c-neg text-[13px] m-0" data-testid="lesson-wrong"><X size={13} className="inline -mt-0.5" /> {tr("Not yet")}{s.ask.hint ? " — " + s.ask.hint : ""}{tries >= 3 ? " · " + tr("Here is how:") : ""}</p> : null}
        {result === "right" ? <p className="c-pos text-[13px] m-0" data-testid="lesson-right"><Check size={13} className="inline -mt-0.5" /> {tr("Right!")}</p> : null}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <button className="w-11 h-11 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0 disabled:opacity-40" aria-label={tr("Back")} onClick={() => go(i - 1)} disabled={i === 0}><ChevronLeft size={18} className="rtl:rotate-180" /></button>
        <button className={btnP + " !h-11 !min-h-[44px]"} onClick={() => { if (playing) { stopSpeaking(native); setPlaying(false); } else setPlaying(true); }} data-testid="lesson-play">
          {playing ? <Pause size={14} /> : <Play size={14} />}{playing ? tr("Pause") : i === 0 ? tr("Play the lesson") : tr("Play")}</button>
        <button className="w-11 h-11 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0 disabled:opacity-40" aria-label={tr("Hear it again")} onClick={() => { stopSpeaking(native); speakNow(say(s), { lang, rate, native }); }}><RefreshCw size={15} /></button>
        <button className={chip(false) + " tabular-nums !min-h-[44px] !h-11"} onClick={() => setRate((r) => (r >= 1.25 ? 0.75 : r + 0.25))} aria-label={tr("Speed")}>{rate}×</button>
        <button className={"w-11 h-11 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0 disabled:opacity-40 ms-auto"} aria-label={tr("Next")} onClick={() => go(i + 1)} disabled={i >= steps.length - 1 || asking} data-testid="lesson-next"><ChevronRight size={18} className="rtl:rotate-180" /></button>
      </div>
    </div>);
}

// ---- Listen: any text lesson read aloud part by part, the part being read highlighted (Learn daily) ---------------------------------
const plain = (md) => String(md || "").replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[#*_`>|]/g, " ").replace(/\s+/g, " ").trim();
export function useListen(parts, { lang, native } = {}) {
  const [at, setAt] = useState(-1), [rate, setRate] = useState(1);
  const run = useRef(0);
  useEffect(() => () => { run.current++; stopSpeaking(native); }, []);
  const play = async (from = 0) => {
    const my = ++run.current;
    for (let k = from; k < parts.length; k++) {
      if (my !== run.current) return;
      setAt(k);
      try { const el = document.querySelector(`[data-listen="${k}"]`); el && el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) {}
      await speakNow(plain(parts[k]), { lang, rate, native });
    }
    if (my === run.current) setAt(-1);
  };
  const stop = () => { run.current++; stopSpeaking(native); setAt(-1); };
  return { at, playing: at >= 0, play, stop, rate, setRate };
}
export function ListenBar({ L }) {
  return (
    <div className="flex items-center gap-2" data-testid="listen-bar">
      <button className={btnP + " !h-11 !min-h-[44px] !text-[14px] !px-4"} onClick={() => (L.playing ? L.stop() : L.play(0))} data-testid="listen">
        {L.playing ? <Pause size={14} /> : <Play size={14} />}{L.playing ? tr("Stop") : tr("Listen to the lesson")}</button>
      <button className={btnS + " tabular-nums"} onClick={() => L.setRate((r) => (r >= 1.25 ? 0.75 : r + 0.25))} aria-label={tr("Speed")}>{L.rate}×</button>
    </div>);
}
