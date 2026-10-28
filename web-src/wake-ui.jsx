/* ---- Voice phase 3 (VOICE_PLAN.md): «يا أتيون» / "Hey Attune" heard by the phone itself (WakeService in WakeWord.kt).
   Off by default. When on: a notification says it is listening (Pause 1 hour / Turn off), nothing is recorded or sent. The
   person picks when (always · only while the screen is on · only while charging) and how easily it wakes; "Say it now"
   shows the live score so they can see it hears them. "Open over other apps" lets it open the voice screen by itself from
   another app (otherwise a tap-to-talk notification appears). Android only — the web and desktop apps show nothing.
   Option C (Ali, 26 Oct): "Teach it my voice" (3 recordings, a voice check on every wake) + the quiet wake (QuietWake: a small
   orb that listens 4 s and goes away by itself when nothing is said). */
import React, { useEffect, useState } from "react";
import { tr } from "./i18n.js";

const read = (N) => { try { return JSON.parse(N.wakeState() || "{}"); } catch (e) { return {}; } };
const pill = (on) => "min-h-[36px] px-3 rounded-full border text-[12.5px] font-bold whitespace-nowrap " + (on ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)]");

/** Option C (Ali, 26 Oct): teach it your voice — say «يا أتيون» 3 times; after that only a sound close to yours wakes it. */
function TeachVoice({ N, s }) {
  const [step, setStep] = useState(-1);      // -1 idle, 0..2 recording i, 3 done
  const [msg, setMsg] = useState("");
  const timer = React.useRef(null);
  useEffect(() => () => clearInterval(timer.current), []);
  const rec = (i) => {
    setStep(i); setMsg("");
    try { N.stopListening && N.stopListening(); N.wakeEnrol(i); } catch (e) {}
    const t0 = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const e = (read(N).enrol) || {};
      if (Date.now() - t0 < 600 || e.state === "listening") { if (Date.now() - t0 > 9000) { clearInterval(timer.current); setStep(-1); setMsg(tr("Not listening right now")); } return; }
      clearInterval(timer.current);
      if (e.state === "ok") { if (i < 2) rec(i + 1); else { setStep(3); setMsg(tr("Done — now it wakes for your voice.")); } }
      else { setStep(-1); setMsg(tr("Didn't hear it clearly — try again a bit closer to the phone.")); }
    }, 250);
  };
  const n = +s.voice || 0;
  return <div className="rounded-[12px] border border-[var(--c-ln)] p-2.5" data-testid="wake-voice">
    <span className="block font-extrabold">{tr("Your voice")} · <span data-testid="wake-voice-n">{n}/3</span></span>
    <span className="block c-sub mb-2">{n ? tr("Only a voice like yours wakes it (fewer false wakes).") : tr("Say «يا أتيون» 3 times so it wakes for you, not the TV or people around you.")}</span>
    {step >= 0 && step < 3 ? <p className="m-0 mb-2 font-extrabold text-[var(--c-acc)]" data-testid="wake-voice-say">{tr("Say «يا أتيون» now")} ({step + 1}/3)</p> : null}
    {msg ? <p className="m-0 mb-2 font-bold" data-testid="wake-voice-msg">{msg}</p> : null}
    <div className="flex flex-wrap gap-1.5">
      <button type="button" className={pill(false)} disabled={step >= 0 && step < 3} onClick={() => rec(0)} data-testid="wake-voice-teach">{n ? tr("Teach it again") : tr("Teach it my voice")}</button>
      {n ? <button type="button" className={pill(false)} onClick={() => { try { N.wakeForget(); } catch (e) {} setStep(-1); setMsg(tr("Forgotten — any voice wakes it now.")); }} data-testid="wake-voice-forget">{tr("Forget my voice")}</button> : null}
    </div>
  </div>;
}

/** Option C, the quiet wake inside Attune: a small orb at the top listens for 4 s; nothing said → it goes away. */
export function QuietWake({ native: N, nativeCall, tag = "ar-EG", onDone }) {
  const [heard, setHeard] = useState("");
  useEffect(() => {
    let over = false, got = false;
    const finish = (text) => { if (over) return; over = true; try { if (text == null) { N.stopListening && N.stopListening(); } N.wakeResume && N.wakeResume(); } catch (e) {} onDone(text); };
    const t = setTimeout(() => { if (!got) finish(null); }, 4000);
    (async () => {
      try {
        if (!N || !N.listen || !nativeCall) { setTimeout(() => finish(null), 1500); return; }
        const r = await nativeCall("listen", tag, (pct, stage, d) => { if (stage === "partial" && d) { got = true; setHeard(d); } });
        finish(r && r.text ? r.text : null);
      } catch (e) { finish(null); }
    })();
    return () => { clearTimeout(t); };
  }, []);
  return <div className="fixed top-3 inset-x-0 z-[95] flex flex-col items-center pointer-events-none" data-testid="quiet-wake">
    <button className="pointer-events-auto w-16 h-16 rounded-full shadow-lg animate-pulse" style={{ background: "linear-gradient(135deg,#7FD8BE,#2E9E83)" }}
      aria-label={tr("Talk to Attune")} onClick={() => onDone("")} data-testid="quiet-wake-orb" />
    {heard ? <span className="mt-2 px-3 py-1 rounded-full bg-[var(--c-surf)] text-[13px] font-bold shadow" dir="auto">{heard}</span> : null}
  </div>;
}

export function WakeSwitch({ native: N, compact = false, tag = "" }) {
  const can = !!(N && N.wakeState && N.setWake);
  const [s, setS] = useState(() => (can ? read(N) : {}));
  const [test, setTest] = useState(false);
  const [best, setBest] = useState(0);
  useEffect(() => {
    if (!can) return undefined;
    const t = setInterval(() => { const x = read(N); setS(x); if (test) setBest((b) => Math.max(b, +x.score || 0)); }, test ? 150 : 2000);
    return () => clearInterval(t);
  }, [can, test]);
  useEffect(() => { if (can && tag && N.setWakeOpts) { try { N.setWakeOpts(JSON.stringify({ lang: tag })); } catch (e) {} } }, [can, tag]);   // the quiet orb listens in the same language
  if (!can) return null;
  const flip = () => { try { N.setWake(!s.on); } catch (e) {} setS({ ...s, on: !s.on }); };
  const opt = (k, v) => { try { N.setWakeOpts(JSON.stringify({ [k]: v })); } catch (e) {} setS({ ...s, [k]: v }); };
  const score = Math.round(100 * (+s.score || 0));
  return <div className={compact ? "text-[12.5px]" : "text-[13px]"} data-testid="wake-switch">
    <label className="flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={!!s.on} onChange={flip} className="mt-0.5 w-5 h-5 accent-[var(--c-acc)] shrink-0" data-testid="wake-switch-input" />
      <span><b className="font-extrabold">{tr("Say “Ya Attune” to start")}</b>
        <span className="block text-[var(--c-mut)]">{tr("The phone listens for «يا أتيون» or “Hey Attune” and opens this screen. On this phone only — nothing is recorded or sent. A notification shows while it listens.")}</span></span>
    </label>
    {s.on ? <div className="mt-2.5 ms-8 space-y-2.5" data-testid="wake-opts">
      {!s.mic ? <p className="m-0 font-bold text-[var(--c-warn)]" data-testid="wake-nomic">{tr("Allow the microphone to use it.")}</p> : null}
      <div><span className="block mb-1 font-extrabold c-sub">{tr("When")}</span>
        <div className="flex flex-wrap gap-1.5" data-testid="wake-when">{[["always", tr("Always")], ["screen", tr("Screen on")], ["charging", tr("While charging")]].map(([v, l]) =>
          <button key={v} type="button" className={pill((s.when || "always") === v)} onClick={() => opt("when", v)} data-testid={"wake-when-" + v}>{l}</button>)}</div></div>
      <div><span className="block mb-1 font-extrabold c-sub">{tr("How easily it wakes")}</span>
        <div className="flex flex-wrap gap-1.5" data-testid="wake-sens">{[["low", tr("Only when clear")], ["normal", tr("Normal")], ["high", tr("Easily (noisy car)")]].map(([v, l]) =>
          <button key={v} type="button" className={pill((s.sensitivity || "normal") === v)} onClick={() => opt("sensitivity", v)} data-testid={"wake-sens-" + v}>{l}</button>)}</div></div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={pill(test)} onClick={() => { setBest(0); if (!test) { try { N.stopListening && N.stopListening(); N.wakeResume && N.wakeResume(); } catch (e) {} } setTest(!test); }} data-testid="wake-test">{test ? tr("Stop") : tr("Say it now (test)")}</button>
        {test ? <span className="inline-flex items-center gap-2" data-testid="wake-meter"><i className="block h-2 w-28 rounded-full bg-[var(--c-ln)] overflow-hidden"><i className="block h-full bg-[var(--c-acc)]" style={{ width: Math.min(100, Math.round(best * 100)) + "%" }} /></i>
          <b>{Math.round(best * 100)}%</b><span className="c-sub">{score ? tr("hearing…") : ""}</span></span> : null}
        {s.paused ? <span className="font-bold c-sub">{tr("Paused for an hour")}</span> : null}
      </div>
      {N.wakeEnrol ? <TeachVoice N={N} s={s} /> : null}
      {!s.overlay ? <button type="button" className="underline font-bold text-[var(--c-acc)]" onClick={() => { try { N.wakeOverlay(); } catch (e) {} }} data-testid="wake-overlay">{tr("Let it open by itself over other apps")}</button> : null}
      {s.error ? <p className="m-0 c-sub" data-testid="wake-error">{tr("Not listening right now")} ({String(s.error).slice(0, 40)})</p> : null}
    </div> : null}
  </div>;
}
