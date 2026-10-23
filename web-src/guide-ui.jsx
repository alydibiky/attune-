/* ---- v6.28 How to use Attune (mode "guide") — every tool explained in three steps, with a drawing of its screen whose numbered
   marks follow the step you are on (tap a step, or Next / Play). Phone: search + chapters that open in place. Computer (layout A):
   the chapters on the left, the open guide on the right. Content: guide.js. Tests: tests/e2e_v731guide.py.
   v6.37: chapters follow the sidebar (hubs.js), each guide says where the tool lives, and "Get the most of Attune" is a plan for
   the morning, the day, the evening, the week, the month and work — every line opens its tool.                                 */
import React, { useEffect, useMemo, useState } from "react";
import { BookOpen, Search, ChevronRight, Play, Pause, Coffee, Clock, Star, CalendarDays, BarChart3, Briefcase, Sparkles } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as G from "./guide.js";
import { PANES, LEFT, RIGHT } from "./desk.jsx";
import * as GD from "./guide-demo.js";
import * as K from "./ui-kit.jsx";

// ---- the drawings: a phone screen per kind, with where steps 1–3 happen ----------------------------------------------------------
const A = "var(--c-acc)", L = "var(--c-ln)", SOFT = "var(--c-soft)", INK = "var(--c-ink)";
const bar = (x, y, w, o = 0.35) => <rect x={x} y={y} width={w} height="4" rx="2" fill={INK} opacity={o} />;
const card = (x, y, w, h) => <rect x={x} y={y} width={w} height={h} rx="7" fill={SOFT} stroke={L} />;
const btn = (x, y, w) => <rect x={x} y={y} width={w} height="12" rx="6" fill={A} />;
const SKETCH = {
  photo: { at: [[70, 52], [70, 122], [70, 196]], draw: <>
    <circle cx="70" cy="52" r="15" fill={SOFT} stroke={A} strokeWidth="2" /><rect x="62" y="46" width="16" height="12" rx="2" fill="none" stroke={A} strokeWidth="1.6" /><circle cx="70" cy="52" r="3.2" fill="none" stroke={A} strokeWidth="1.6" />
    {card(18, 80, 104, 70)}<path d="M26 140 L52 108 L68 126 L82 112 L114 140 Z" fill={A} opacity="0.35" /><circle cx="100" cy="96" r="6" fill={A} opacity="0.5" />
    <path d="M70 154 v10 m-4 -4 l4 4 4 -4" stroke={INK} opacity="0.5" fill="none" strokeWidth="1.5" />
    {card(18, 170, 104, 52)}{bar(26, 180, 70, 0.6)}{bar(26, 190, 88)}{bar(26, 200, 60)}{btn(26, 207, 40)}</> },
  type: { at: [[60, 62], [104, 92], [70, 170]], draw: <>
    {card(14, 46, 112, 34)}{bar(22, 56, 70, 0.55)}{bar(22, 66, 44)}<circle cx="114" cy="63" r="6" fill="none" stroke={A} strokeWidth="1.6" />
    {btn(84, 86, 40)}
    {card(14, 118, 112, 104)}{bar(22, 130, 50, 0.7)}{bar(22, 142, 96)}{bar(22, 152, 90)}{bar(22, 162, 96)}{bar(22, 172, 70)}{bar(22, 186, 96)}{bar(22, 196, 80)}</> },
  list: { at: [[110, 48], [44, 100], [100, 160]], draw: <>
    {bar(16, 46, 60, 0.7)}<circle cx="110" cy="48" r="8" fill={A} /><path d="M106 48 h8 M110 44 v8" stroke="#fff" strokeWidth="1.6" />
    {[66, 120, 174].map((y, i) => <g key={y}>{card(14, y, 112, 46)}<circle cx="30" cy={y + 16} r="7" fill={A} opacity="0.3" />{bar(42, y + 11, 50, 0.7)}{bar(42, y + 21, 66)}{btn(42, y + 30, i === 2 ? 46 : 34)}<rect x="96" y={y + 8} width="22" height="9" rx="4.5" fill="none" stroke={A} /></g>)}</> },
  chart: { at: [[44, 60], [70, 128], [70, 196]], draw: <>
    {card(14, 42, 112, 44)}{bar(22, 52, 40)}<text x="22" y="76" fontSize="16" fontWeight="700" fill={INK}>12,450</text>
    {card(14, 94, 112, 74)}{[30, 48, 22, 58, 40, 50].map((h, i) => <rect key={i} x={24 + i * 16} y={160 - h} width="10" height={h} rx="2" fill={A} opacity={i === 3 ? 1 : 0.45} />)}
    {[176, 196].map((y) => <g key={y}>{card(14, y, 112, 16)}{bar(22, y + 6, 50, 0.6)}{bar(98, y + 6, 20, 0.6)}</g>)}</> },
  map: { at: [[70, 46], [86, 118], [70, 208]], draw: <>
    <rect x="8" y="30" width="124" height="196" fill={SOFT} />
    <path d="M8 90 C40 80 60 120 132 104 M50 30 C56 90 40 150 64 226 M8 170 C60 160 90 190 132 176" stroke={L} strokeWidth="6" fill="none" />
    <path d="M8 90 C40 80 60 120 132 104 M50 30 C56 90 40 150 64 226" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" fill="none" />
    <rect x="16" y="38" width="108" height="16" rx="8" fill="var(--c-bg, #fff)" stroke={L} />{bar(26, 44, 50, 0.4)}
    <path d="M86 104 c-8 0 -12 6 -12 11 c0 8 12 19 12 19 s12 -11 12 -19 c0 -5 -4 -11 -12 -11z" fill={A} /><circle cx="86" cy="115" r="4" fill="#fff" />
    <rect x="16" y="190" width="108" height="30" rx="8" fill="var(--c-bg, #fff)" stroke={L} />{bar(24, 198, 50, 0.6)}{btn(84, 202, 34)}</> },
  chat: { at: [[60, 214], [22, 214], [56, 120]], draw: <>
    <rect x="62" y="44" width="64" height="22" rx="10" fill={A} opacity="0.85" />{bar(70, 53, 46, 0.0)}
    <rect x="14" y="76" width="96" height="88" rx="10" fill={SOFT} stroke={L} />{bar(22, 88, 70, 0.6)}{bar(22, 100, 80)}{bar(22, 110, 74)}{bar(22, 120, 80)}{bar(22, 134, 60)}{bar(22, 144, 70)}
    <rect x="62" y="172" width="64" height="18" rx="9" fill={A} opacity="0.85" />
    <rect x="12" y="204" width="116" height="20" rx="10" fill="none" stroke={L} /><circle cx="22" cy="214" r="5" fill="none" stroke={A} strokeWidth="1.5" />{bar(32, 212, 50, 0.3)}<circle cx="116" cy="214" r="6" fill={A} /></> },
  file: { at: [[40, 82], [70, 156], [70, 206]], draw: <>
    <path d="M22 50 h26 l10 10 v46 h-36 z" fill={SOFT} stroke={L} /><text x="27" y="96" fontSize="9" fontWeight="700" fill={A}>PDF</text>
    <path d="M62 80 h16 m-5 -5 l5 5 -5 5" stroke={INK} opacity="0.5" fill="none" strokeWidth="1.6" />
    <path d="M86 50 h26 l10 10 v46 h-36 z" fill={SOFT} stroke={A} /><text x="89" y="96" fontSize="8.5" fontWeight="700" fill={A}>Word</text>
    {[["PDF→Word", 14], ["→PDF", 74], ["Excel", 14], ["Photos", 74]].map(([t, x], i) => <g key={i}><rect x={x} y={124 + Math.floor(i / 2) * 22} width="52" height="16" rx="8" fill={i === 0 ? A : "none"} stroke={i === 0 ? A : L} /><text x={x + 26} y={135 + Math.floor(i / 2) * 22} fontSize="7" textAnchor="middle" fill={i === 0 ? "#fff" : INK}>{t}</text></g>)}
    <rect x="30" y="198" width="80" height="18" rx="9" fill={A} /></> },
  lesson: { at: [[70, 84], [112, 138], [70, 196]], draw: <>
    {card(14, 42, 112, 84)}<circle cx="46" cy="84" r="20" fill={A} opacity="0.25" /><path d="M76 70 l30 0 M76 84 l24 0 M76 98 l30 0" stroke={INK} opacity="0.4" strokeWidth="4" strokeLinecap="round" />
    {card(14, 132, 112, 14)}{bar(22, 137, 70, 0.5)}<path d="M108 135 l4 -3 v10 l-4 -3 h-3 v-4z" fill={A} />
    {[156, 176, 196].map((y, i) => <g key={y}><rect x="14" y={y} width="112" height="15" rx="7.5" fill={i === 1 ? A : "none"} stroke={i === 1 ? A : L} opacity={i === 1 ? 0.85 : 1} />{bar(24, y + 5.5, 54, i === 1 ? 0 : 0.4)}</g>)}</> },
  engine: { at: [[70, 70], [70, 140], [100, 196]], draw: <>
    {card(14, 44, 112, 56)}<rect x="24" y="56" width="22" height="22" rx="4" fill="none" stroke={A} strokeWidth="1.8" /><rect x="30" y="62" width="10" height="10" fill={A} />{bar(54, 60, 50, 0.7)}{bar(54, 70, 36)}{btn(54, 82, 46)}
    {card(14, 112, 112, 52)}{bar(22, 124, 60, 0.6)}<rect x="22" y="138" width="96" height="6" rx="3" fill={L} /><rect x="22" y="138" width="64" height="6" rx="3" fill={A} />{bar(22, 152, 40)}
    {card(14, 176, 112, 40)}{bar(22, 192, 50, 0.6)}<rect x="86" y="188" width="32" height="14" rx="7" fill={A} opacity="0.25" /><text x="102" y="198" fontSize="7" textAnchor="middle" fill={A}>Ready</text></> },
};

export function Sketch({ kind, step = -1, small = false }) {
  const k = SKETCH[kind] || SKETCH.type;
  return (
    <svg viewBox="0 0 140 250" direction="ltr" className={small ? "w-9 h-16 shrink-0" : "w-full max-w-[180px] sm:max-w-[220px] h-auto mx-auto"} role="img" aria-label={tr("A drawing of the screen")} data-testid="guide-sketch">
      <rect x="2" y="2" width="136" height="246" rx="18" fill="var(--c-bg, #fff)" stroke={INK} strokeOpacity="0.25" strokeWidth="2" />
      <rect x="54" y="10" width="32" height="5" rx="2.5" fill={INK} opacity="0.2" />
      <rect x="8" y="22" width="124" height="1" fill={L} />
      {k.draw}
      {!small ? k.at.map(([x, y], i) => (
        // the step you are on: a filled, pulsing mark; the others: small outlined numbers that don't hide the drawing
        <g key={i} data-testid={"guide-mark-" + (i + 1)} opacity={step < 0 || step === i ? 1 : 0.8}>
          {step === i ? <circle cx={x} cy={y} r="13" fill="none" stroke={A} strokeWidth="2" className="guide-pulse" /> : null}
          {step < 0 || step === i ? <><circle cx={x} cy={y} r="8.5" fill={A} stroke="#fff" strokeWidth="1.5" /><text x={x} y={y + 3.4} fontSize="10" fontWeight="700" textAnchor="middle" fill="#fff">{i + 1}</text></>
            : <><circle cx={x} cy={y} r="6.5" fill="var(--c-bg, #fff)" stroke={INK} strokeOpacity="0.55" strokeWidth="1.2" /><text x={x} y={y + 2.8} fontSize="8" fontWeight="700" textAnchor="middle" fill={INK} fillOpacity="0.75">{i + 1}</text></>}
        </g>)) : null}
    </svg>);
}

/** v6.45 (Ali's choice A): the guide's screen played with SAMPLE data — 1 what you give it (typed out), 2 what comes back
 *  (a filled card), 3 what you do next (its buttons). The part of the step you are on is lit; the later parts wait. */
export function DemoPhone({ demo, step = 0, app, ar }) {
  const pv = (v) => GD.pickV(v, ar), say = pv(demo.say);
  const [typed, setTyped] = useState(say.length);
  useEffect(() => { if (step !== 0) { setTyped(say.length); return; } setTyped(0); let n = 0;
    const t = setInterval(() => { n = Math.min(say.length, n + Math.max(1, Math.round(say.length / 28))); setTyped(n); if (n >= say.length) clearInterval(t); }, 45); return () => clearInterval(t); }, [step, say]);
  const part = (i, bg) => ({ "data-testid": "guide-mark-" + (i + 1), "data-on": step === i ? "1" : "0",
    style: { outline: step === i ? "2.5px solid var(--c-acc)" : "none", outlineOffset: 3, opacity: i > step ? 0.18 : 1, transition: "opacity .35s", background: bg } });
  const IN = { photo: "📷", file: "📄", chat: "💬", pick: "☝️", type: "⌨️" };
  return (
    <div className="w-full max-w-[250px] mx-auto rounded-[26px] p-2.5 border-2 select-none" style={{ borderColor: "var(--c-ln)", background: "var(--c-bg, #fff)" }} data-testid="guide-demo" data-step={step} aria-label={tr("Sample data — the real screen, playing by itself")}>
      <div className="flex items-center gap-1.5 px-1 pb-2"><b className="flex-1 min-w-0 truncate text-[12.5px]" dir="auto">{app}</b>
        <span className="text-[10px] font-bold rounded-full px-2 py-0.5" style={{ background: "var(--c-warn)", color: "var(--c-on-acc)" }}>{tr("Sample")}</span></div>
      <div className="space-y-2 rounded-2xl p-2" style={{ background: "var(--c-soft)" }}>
        <div {...part(0)} className="rounded-xl p-1 flex items-start gap-1.5 text-[12.5px] leading-snug" dir="auto">
          <span aria-hidden="true">{IN[demo.in] || "⌨️"}</span>
          <span className="g-acc flex-1 min-w-0 rounded-xl px-2 py-1.5" style={{ background: "var(--c-acc)" }} data-testid="guide-demo-say">{say.slice(0, typed)}{typed < say.length ? <span className="opacity-60">▍</span> : null}</span></div>
        <div {...part(1, "var(--c-bg, #fff)")} className="rounded-xl p-2 space-y-1">
          <b className="block text-[13px] leading-tight" dir="auto" data-testid="guide-demo-title">{pv(demo.title)}</b>
          {demo.bar != null ? <div className="h-1.5 rounded-full" style={{ background: "var(--c-ln)" }}><div className="h-1.5 rounded-full" style={{ width: Math.round(demo.bar * 100) + "%", background: "var(--c-acc)" }} /></div> : null}
          {demo.lines.map((l, i) => <div key={i} className="flex gap-2 text-[11.5px] leading-snug" data-testid="guide-demo-line"><span className="c-sub flex-1 min-w-0" dir="auto">{ar ? l[1] : l[0]}</span><span className="font-semibold text-end max-w-[58%]" dir="auto">{pv(l[2])}</span></div>)}</div>
        <div {...part(2)} className="rounded-xl p-1.5 flex gap-1.5 flex-wrap">
          {demo.act.map((a, i) => <span key={i} className={"text-[11.5px] font-bold rounded-lg px-2.5 py-1.5" + (i ? "" : " g-acc")} style={i ? { border: "1px solid var(--c-ln)" } : { background: "var(--c-acc)" }} dir="auto">{pv(a)}</span>)}</div>
      </div>
      <p className="c-sub text-[11px] leading-snug m-0 px-1 pt-2" dir="auto" data-testid="guide-demo-note">{pv(demo.note)}</p>
    </div>);
}

/** v6.45 (Ali's choice C): "What Attune can do" — pick a goal, see what you say and what you get, open its guide. */
function Gallery({ ar, nameOf, see }) {
  const [g, setG] = useState(GD.GOALS[0].id);
  const pk = (x) => (ar ? x[1] : x[0]), goal = GD.GOALS.find((x) => x.id === g) || GD.GOALS[0];
  return (
    <section className="space-y-2.5" data-testid="guide-gallery">
      <b className="block text-[17px] font-extrabold">{tr("What Attune can do")}</b>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid="guide-goals">{GD.GOALS.map((x) =>
        <button key={x.id} onClick={() => setG(x.id)} data-testid={"guide-goal-" + x.id} aria-pressed={g === x.id} className={K.chip(g === x.id)}>{pk(x.title)}</button>)}</div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 snap-x">{goal.tools.map((id) => {
        const d = GD.demoFor(id), key = G.TOOLS[id] ? id : "start:" + id, st = G.START.find((s) => s.id === id), n = G.TOOLS[id] ? nameOf(id) : st ? [pk(st.title)] : null;
        if (!d || !n) return null;
        return <div key={id} className={K.cardPad + " shrink-0 w-[250px] snap-start space-y-2"} data-testid="guide-card" data-id={key}>
          <span className={K.label + " block"}>{tr("You say")}</span>
          <p className="g-acc m-0 ms-6 rounded-2xl px-3 py-2 text-[13px] leading-snug" style={{ background: "var(--c-acc)" }} dir="auto">{GD.pickV(d.say, ar)}</p>
          <span className={K.label + " block"}>{tr("You get")} · {n[0]}</span>
          <div className="rounded-[14px] p-2.5 space-y-1" style={{ background: "var(--c-soft)" }}><b className="block text-[13.5px] leading-tight" dir="auto">{GD.pickV(d.title, ar)}</b>
            {d.lines.slice(0, 2).map((l, i) => <div key={i} className="flex gap-2 text-[12px]"><span className="c-sub shrink-0 max-w-[45%]" dir="auto">{ar ? l[1] : l[0]}</span><span className="font-semibold text-end flex-1 min-w-0" dir="auto">{GD.pickV(l[2], ar)}</span></div>)}</div>
          <button className="min-h-[44px] font-extrabold text-[13.5px] inline-flex items-center gap-1" style={{ color: "var(--c-acc)" }} onClick={() => see(key)} data-testid="guide-card-how">{tr("Show me how")}<ChevronRight size={15} className="rtl:-scale-x-100" /></button>
        </div>; })}</div>
    </section>);
}


/** One walkthrough: the drawing, the three steps (the current one highlighted), Next / Play, and the tip. */
function Walk({ id, title, purpose, where, sketch, steps, tip, open, ar }) {
  const demo = GD.demoFor(id);
  const [step, setStep] = useState(0);
  const [play, setPlay] = useState(!!demo);          // v6.45: a guide with sample data plays by itself; tapping a step stops it
  useEffect(() => { setStep(0); setPlay(!!demo); }, [id]);
  useEffect(() => { if (!play) return; const t = setInterval(() => setStep((s) => (s + 1) % steps.length), 2600); return () => clearInterval(t); }, [play, steps.length]);
  const pick = (p) => (ar ? p[1] : p[0]);
  return (
    <div className={K.cardPad + " space-y-3"} data-testid="guide-walk" data-id={id}>
      <div><b className="block text-[17px] font-extrabold" dir="auto">{title}</b>{purpose ? <span className="c-sub text-[13px]" dir="auto">{purpose}</span> : null}
        {where && where.length ? <span className="block text-[12px] mt-0.5" style={{ color: "var(--c-acc)" }} dir="auto" data-testid="guide-where">{tr("Where")}: {where.join(ar ? " ‹ " : " › ")}</span> : null}</div>
      <div className="grid gap-4 sm:grid-cols-[minmax(150px,220px)_1fr] sm:items-start">
        {demo ? <DemoPhone demo={demo} step={step} app={title} ar={ar} /> : <Sketch kind={sketch} step={step} />}
        <div className="space-y-2">
          <ol className="m-0 p-0 list-none space-y-2">
            {steps.map((s, i) => (
              <li key={i}><button onClick={() => { setStep(i); setPlay(false); }} aria-current={step === i ? "step" : undefined} data-testid="guide-step"
                className="w-full min-h-[44px] text-start flex gap-3 items-start rounded-[16px] p-2.5 border transition-colors duration-150" style={{ borderColor: step === i ? "var(--c-acc-2)" : "var(--c-ln)", background: step === i ? "var(--c-surf-2)" : "transparent", color: "var(--c-ink)" }}>
                <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-[12px] font-bold" style={{ background: step === i ? "var(--c-acc-2)" : "var(--c-ln)", color: step === i ? "var(--c-on-acc-2)" : "var(--c-ink)" }}>{i + 1}</span>
                <span className="text-[14px] leading-snug" dir="auto">{pick(s)}</span></button></li>))}
          </ol>
          <div className="flex gap-2 flex-wrap items-center">
            <button className={K.btnS} onClick={() => setPlay((p) => !p)} data-testid="guide-play">{play ? <Pause size={14} /> : <Play size={14} />}{tr(play ? "Pause" : "Play the steps")}</button>
            <button className={K.btnS} onClick={() => { setStep((s) => (s + 1) % steps.length); setPlay(false); }} data-testid="guide-next">{tr("Next step")}<ChevronRight size={14} className="rtl:-scale-x-100" /></button>
            {open ? <button className={K.btnP + " ms-auto"} onClick={open} data-testid="guide-open">{tr("Open it")}<ChevronRight size={15} className="rtl:-scale-x-100" /></button> : null}
          </div>
          {tip ? <p className="text-[13px] m-0 rounded-[14px] p-3" style={{ background: "var(--c-soft)" }} dir="auto" data-testid="guide-tip"><b>{tr("Tip")}:</b> {pick(tip)}</p> : null}
        </div>
      </div>
    </div>);
}

/** v6.37 One part of "Get the most of Attune": when, then each habit with the tool that does it (tap to open it). */
const PLAN_ICON = { morning: Coffee, day: Clock, evening: Star, week: CalendarDays, month: BarChart3, work: Briefcase };
function PlanCard({ p, ar, nameOf, open, see }) {
  const pick = (x) => (ar ? x[1] : x[0]), Ic = PLAN_ICON[p.icon] || Sparkles;
  return (
    <div className={K.cardPad + " space-y-3"} data-testid="guide-plan" data-id={"plan:" + p.id}>
      <div className="flex items-center gap-3"><span className="c-ic"><Ic size={18} /></span>
        <div><b className="block text-[17px] font-extrabold" dir="auto">{pick(p.title)}</b><span className="c-sub text-[13px]" dir="auto">{pick(p.when)}</span></div></div>
      <ol className="m-0 p-0 list-none space-y-2">
        {p.items.map((it, i) => { const n = it.tool ? nameOf(it.tool) : null, go = it.tool ? (open ? () => open(it.tool) : null) : it.see ? () => see(it.see) : null;
          return (
          <li key={i}><button onClick={go || undefined} disabled={!go} data-testid="guide-plan-item" data-tool={it.tool || it.see || ""}
            className="w-full min-h-[44px] text-start flex gap-3 items-start rounded-[16px] p-2.5 border hover:border-[var(--c-acc)] transition-colors duration-150" style={{ borderColor: "var(--c-ln)", background: "transparent", color: "var(--c-ink)" }}>
            <span className="w-6 h-6 shrink-0 rounded-full grid place-items-center text-[12px] font-bold tabular-nums" style={{ background: "var(--c-acc)", color: "var(--c-on-acc)" }}>{i + 1}</span>
            <span className="flex-1 min-w-0">{n ? <b className="block text-[12.5px]" style={{ color: "var(--c-acc)" }} dir="auto">{n[0]}</b> : null}
              <span className="text-[14px] leading-snug" dir="auto">{pick(it.text)}</span></span>
            {go ? <ChevronRight size={15} className="c-sub shrink-0 mt-1 rtl:-scale-x-100" /> : null}</button></li>); })}
      </ol>
      <p className="text-[13px] m-0 rounded-[14px] p-3" style={{ background: "var(--c-soft)" }} dir="auto" data-testid="guide-tip"><b>{tr("Tip")}:</b> {pick(p.tip)}</p>
    </div>);
}

export function GuidePage({ tools, groups, navTo }) {
  const ar = getLang() === "ar";
  const [q, setQ] = useState("");
  const [sel, setSel] = useState("start:model");      // the open guide (computer: on the right; phone: opened in place)
  const [wide, setWide] = useState(() => { try { return window.matchMedia("(min-width: 1024px)").matches; } catch (e) { return false; } });
  useEffect(() => { try { const m = window.matchMedia("(min-width: 1024px)"); const on = () => setWide(m.matches); m.addEventListener("change", on); return () => m.removeEventListener("change", on); } catch (e) {} }, []);
  const pk = (x) => (ar ? x[1] : x[0]);
  // a tool's [name, purpose] as shown: the app's own tool list, or guide.js NAMES for places that are not in it (Home, Money…)
  const nameOf = (id) => { const n = G.NAMES[id]; if (n) return [pk(n[0]), pk(n[1])]; const t = (tools || []).find((x) => x[0] === id); return t ? [tr(t[1]), tr(t[2])] : null; };
  const chs = useMemo(() => G.chapters(), [groups]);   // the sidebar's order (hubs.js), not the old All menu
  const hits = useMemo(() => G.searchGuide(q, tools), [q, tools]);
  const startHits = q.trim() ? G.START.filter((s) => (s.title.join(" ") + " " + s.steps.flat().join(" ") + " " + s.tip.join(" ")).toLowerCase().includes(q.trim().toLowerCase())) : G.START;
  const planHits = useMemo(() => G.searchPlan(q), [q]);
  const walkFor = (key) => {
    if (key.startsWith("start:")) { const s = G.START.find((x) => "start:" + x.id === key); return s ? <Walk key={key} id={key} title={ar ? s.title[1] : s.title[0]} sketch={s.sketch} steps={s.steps} tip={s.tip} ar={ar} /> : null; }
    if (key.startsWith("plan:")) { const p = G.PLAN.find((x) => "plan:" + x.id === key); return p ? <PlanCard key={key} p={p} ar={ar} nameOf={nameOf} open={navTo} see={setSel} /> : null; }
    const g = G.TOOLS[key], t = nameOf(key); if (!g || !t) return null;
    return <Walk key={key} id={key} title={t[0]} purpose={t[1]} where={G.whereOf(key).map((w) => tr(w))} sketch={g.sketch} steps={g.steps} tip={g.tip} ar={ar} open={navTo ? () => navTo(key) : null} />;
  };
  const Row = ({ k, label, sub, sketch, icon: Ic }) => (
    <div>
      <button onClick={() => setSel(sel === k && !wide ? "" : k)} aria-expanded={sel === k} data-testid={"guide-row-" + k}
        className="w-full min-h-[52px] flex items-center gap-3 text-start py-2 px-2 rounded-[16px] font-bold" style={{ background: wide && sel === k ? "var(--c-soft)" : "transparent", color: "var(--c-ink)" }}>
        {Ic ? <span className="w-10 h-10 shrink-0 rounded-[14px] grid place-items-center" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }}><Ic size={17} /></span> : <Sketch kind={sketch} small />}<span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{label}</b>{sub ? <span className="c-sub text-[12.5px] block truncate" dir="auto">{sub}</span> : null}</span>
        <ChevronRight size={16} className={"c-sub shrink-0 transition-transform rtl:-scale-x-100 " + (!wide && sel === k ? "rotate-90" : "")} /></button>
      {!wide && sel === k ? <div className="mt-2 mb-3">{walkFor(k)}</div> : null}
    </div>);
  const list = (
    <div className="space-y-4" data-testid="guide-list">
      <div className="relative"><Search size={15} className="c-sub absolute top-1/2 -translate-y-1/2 start-3" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search the guide…")} className={K.inp + " !ps-9"} dir="auto" data-testid="guide-search" /></div>
      {!q.trim() ? <Gallery ar={ar} nameOf={nameOf} see={(k) => { setSel(k); setTimeout(() => { try { const e = document.querySelector('[data-testid="guide-walk"]'); if (e) e.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (x) {} }, 60); }} /> : null}
      {startHits.length ? <section data-testid="guide-chapter"><span className={"c-lbl " + K.label}>{tr("Getting started")}</span>
        {startHits.map((s) => <Row key={s.id} k={"start:" + s.id} label={ar ? s.title[1] : s.title[0]} sketch={s.sketch} />)}</section> : null}
      {planHits.length ? <section data-testid="guide-chapter" data-chapter="plan"><span className={"c-lbl " + K.label}>{pk(G.PLAN_TITLE)}</span>
        {G.PLAN.filter((p) => planHits.includes(p.id)).map((p) => <Row key={p.id} k={"plan:" + p.id} label={pk(p.title)} sub={pk(p.when)} icon={PLAN_ICON[p.icon] || Sparkles} />)}</section> : null}
      {chs.map((c) => { const ids = hits ? c.ids.filter((id) => hits.includes(id)) : c.ids, title = Array.isArray(c.title) ? pk(c.title) : tr(c.title); return ids.length ? (
        <section key={title} data-testid="guide-chapter"><span className={"c-lbl " + K.label}>{title}</span>
          {ids.map((id) => { const t = nameOf(id); return t ? <Row key={id} k={id} label={t[0]} sub={t[1]} sketch={G.TOOLS[id].sketch} /> : null; })}</section>) : null; })}
      {hits && !hits.length && !startHits.length && !planHits.length ? <p className="c-sub" data-testid="guide-none">{tr("Nothing in the guide matches — try another word.")}</p> : null}
    </div>);
  return (
    <div className="calm bg-[var(--c-bg)] text-[var(--c-ink)] rounded-[22px] p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="guide-page">
      <style>{`@keyframes guidePulse{0%{opacity:.9;transform:scale(.8)}100%{opacity:0;transform:scale(1.5)}}.guide-pulse{transform-box:fill-box;transform-origin:center;animation:guidePulse 1.3s ease-out infinite}.g-acc{color:var(--c-on-acc)}`}</style>
      <div><h2 className={K.h1 + " flex items-center gap-2"}><BookOpen size={20} className="c-acc" />{tr("How to use Attune")}</h2>
        <p data-intro="" className="c-sub m-0 lg:max-w-[70ch]">{tr("See what Attune can do, then watch each tool work with sample data — and a plan to make Attune part of your day.")}</p></div>
      {wide ? <div className={PANES}><div className={LEFT + " lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto pe-1"}>{list}</div><div className={RIGHT}>{walkFor(sel) || walkFor("start:model")}</div></div> : list}
    </div>);
}
