/* ---- Voice phase 3 (VOICE_PLAN.md): «يا أتيون» / "Hey Attune" heard by the phone itself (WakeService in WakeWord.kt).
   Off by default. When on: a notification says it is listening (Pause 1 hour / Turn off), nothing is recorded or sent. The
   person picks when (always · only while the screen is on · only while charging) and how easily it wakes; "Say it now"
   shows the live score so they can see it hears them. "Open over other apps" lets it open the voice screen by itself from
   another app (otherwise a tap-to-talk notification appears). Android only — the web and desktop apps show nothing. */
import React, { useEffect, useState } from "react";
import { tr } from "./i18n.js";

const read = (N) => { try { return JSON.parse(N.wakeState() || "{}"); } catch (e) { return {}; } };
const pill = (on) => "min-h-[36px] px-3 rounded-full border text-[12.5px] font-bold whitespace-nowrap " + (on ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] border-transparent" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)]");

export function WakeSwitch({ native: N, compact = false }) {
  const can = !!(N && N.wakeState && N.setWake);
  const [s, setS] = useState(() => (can ? read(N) : {}));
  const [test, setTest] = useState(false);
  const [best, setBest] = useState(0);
  useEffect(() => {
    if (!can) return undefined;
    const t = setInterval(() => { const x = read(N); setS(x); if (test) setBest((b) => Math.max(b, +x.score || 0)); }, test ? 150 : 2000);
    return () => clearInterval(t);
  }, [can, test]);
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
      {!s.overlay ? <button type="button" className="underline font-bold text-[var(--c-acc)]" onClick={() => { try { N.wakeOverlay(); } catch (e) {} }} data-testid="wake-overlay">{tr("Let it open by itself over other apps")}</button> : null}
      {s.error ? <p className="m-0 c-sub" data-testid="wake-error">{tr("Not listening right now")} ({String(s.error).slice(0, 40)})</p> : null}
    </div> : null}
  </div>;
}
