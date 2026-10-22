/* v6.18 — Fit & Food's looks (fitlook.js): the style tag, the loading screen with nutrition facts, the photo with a
   label and an arrow on each food, and the look picker in Fit's settings. */
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as LK from "./fitlook.js";

/** The looks' colours — rendered once inside Fit; the look itself is the class on Fit's root (`fit-look-<id>`). */
export function LookStyle({ look }) {
  // the page behind Fit's boxes takes the look too (a light look fills the whole screen)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const b = document.body, h = document.documentElement, was = [b.style.background, h.style.background];
    b.style.background = h.style.background = LK.PAGE_BG[look] || "";
    return () => { b.style.background = was[0]; h.style.background = was[1]; };
  }, [look]);
  return <style>{LK.LOOK_CSS}</style>;
}

/** While a photo is read: the photo, what is happening, and a nutrition fact that changes every few seconds. */
/** v6.27 (Ali: "a pulse loading screen when it's reading a food"): rings pulse out from the food — the photo when there is
    one, else a plate — with what is happening now and a fact to read meanwhile. */
export function PulseLoader({ url, stage, L, ar, label }) {
  const [order] = useState(() => LK.factOrder());
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const f = LK.FACTS[order[k % order.length]];
  return (
    <div className="flex flex-col items-center gap-4 py-3" data-testid="fit-pulse-loading" aria-busy="true" aria-label={label}>
      <div className="relative grid place-items-center" style={{ width: 200, height: 200 }}>
        {[0, 0.55, 1.1].map((d) => <span key={d} className="absolute rounded-full fit-pulse" style={{ width: 92, height: 92, background: "var(--c-acc)", opacity: 0.35, animationDelay: d + "s", animationDuration: "1.8s" }} />)}
        <span className="absolute rounded-full fit-breathe" style={{ width: 104, height: 104, background: "var(--c-acc)", opacity: 0.18 }} />
        {url ? <img src={url} alt="" className="relative rounded-full object-cover fit-breathe" style={{ width: 92, height: 92, boxShadow: "0 0 0 4px var(--c-acc)" }} />
          : <span className="relative grid place-items-center rounded-full fit-breathe text-[40px]" style={{ width: 92, height: 92, background: "var(--c-soft)" }} aria-hidden="true">🍽️</span>}
      </div>
      <p className="text-[15px] font-bold text-[var(--c-ink)] text-center m-0" data-testid="fit-loading-stage">{stage || L("Reading your meal…", "جارٍ قراءة وجبتك…")}</p>
      <div key={k} className="fit-pop w-full rounded-[22px] bg-[var(--c-surf)] border border-[var(--c-ln)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] p-4 space-y-1.5" data-testid="fit-fact" aria-live="polite">
        <p className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-acc)] m-0">{L("DID YOU KNOW?", "هل تعلم؟")}</p>
        <p className="text-[15px] leading-relaxed font-semibold text-[var(--c-ink)] m-0">{ar ? f.ar : f.en}</p>
        <p className="text-[11.5px] text-[var(--c-mut)] m-0">{ar ? f.src.ar : f.src.en}</p>
      </div>
    </div>
  );
}

const BOLD_COLORS = ["#F25C2A", "#2563EB", "#16A34A", "#9333EA", "#DB2777", "#0891B2"];
const kc = (x) => (x.kcal == null ? "?" : Math.round(x.kcal));
const short = (n) => String(n || "").replace(/\s*\([^)]*\)\s*/g, " ").trim();   // "Green salad (no oil)" → "Green salad"

/** The photo with each food's name and calories on it — an arrow to the food when the photo reader said where it is. */
export function PhotoMarks({ look, url, items, L, ar }) {
  const { marks, loose } = LK.placeMarks(items);
  const box = useRef(null), chips = useRef({});
  const [lines, setLines] = useState([]);
  const sig = marks.map((m) => m.i + ":" + (items[m.i] && items[m.i].kcal)).join(",");
  useLayoutEffect(() => {   // the arrows run from each label's inner edge to its food, measured once laid out
    const el = box.current; if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      setLines(marks.map((m) => { const c = chips.current[m.i]; if (!c) return null; const cr = c.getBoundingClientRect();
        return { i: m.i, x1: (m.side === "l" ? cr.right : cr.left) - r.left, y1: cr.top + cr.height / 2 - r.top, x2: m.x * r.width, y2: m.y * r.height }; }).filter(Boolean));
    };
    measure();
    const img = el.querySelector("img"); if (img && !img.complete) img.addEventListener("load", measure, { once: true });
    window.addEventListener("resize", measure); return () => window.removeEventListener("resize", measure);
  }, [sig, look, url]);
  const name = (x) => short(ar && x.ar ? x.ar : x.name);
  if (!marks.length && !loose.length) return null;
  return (
    <div ref={box} className="relative overflow-hidden rounded-2xl" data-testid="fit-photo-marks" dir="ltr">
      <img src={url} alt={L("Your meal", "وجبتك")} className="block w-full h-auto max-h-[380px] object-cover" />
      {look === "bold" ? marks.map((m, k) => { const x = items[m.i]; if (!Array.isArray(x.box)) return null; const [bx, by, bw, bh] = x.box;
        return <div key={"b" + m.i} className="absolute rounded-xl pointer-events-none" style={{ left: bx * 100 + "%", top: by * 100 + "%", width: bw * 100 + "%", height: bh * 100 + "%", border: `3px dashed ${BOLD_COLORS[k % BOLD_COLORS.length]}` }} />; }) : null}
      {/* the lines: white (Fresh), the food's colour (Bold), teal from a numbered pin (Night) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        {lines.map((l) => { const k = marks.findIndex((m) => m.i === l.i), c = look === "bold" ? BOLD_COLORS[k % BOLD_COLORS.length] : look === "night" ? "#2DD4BF" : "#FFFFFF";
          return <g key={l.i}>{look !== "bold" && look !== "night" ? <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(0,0,0,.35)" strokeWidth="4.5" strokeLinecap="round" /> : null}
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={c} strokeWidth={look === "fresh" ? 2.5 : 3} strokeLinecap="round" />
            {look === "night" ? null : <circle cx={l.x2} cy={l.y2} r="5.5" fill={c} stroke={look === "bold" ? "#FFFFFF" : "rgba(0,0,0,.35)"} strokeWidth="1.5" />}</g>; })}
      </svg>
      {marks.map((m, k) => {
        const x = items[m.i];
        const bg = look === "bold" ? BOLD_COLORS[k % BOLD_COLORS.length] : look === "night" ? "rgba(11,18,32,.88)" : "#FFFFFF", fg = look === "bold" ? "#FFFFFF" : look === "night" ? "#E8EEF7" : "#12241B";   // a white label always gets dark text (every light look, not only Fresh)
        return (
          <div key={m.i} ref={(el) => { chips.current[m.i] = el; }} className="absolute px-2.5 py-1 rounded-xl shadow-md max-w-[44%] leading-tight" data-testid="fit-mark"
            style={{ top: m.ly * 100 + "%", transform: "translateY(-50%)", [m.side === "l" ? "left" : "right"]: "2.5%", background: bg, color: fg, border: look === "night" ? "1px solid #2DD4BF" : "none" }}>
            <span className="block truncate text-[12px] font-semibold">{look === "night" ? (k + 1) + " · " : ""}{name(x)}</span><span className="block text-[13.5px] font-extrabold">{kc(x)} <span className="text-[10.5px] font-semibold opacity-80">kcal</span></span></div>);
      })}
      {look === "night" ? marks.map((m, k) => (   // Night: a numbered pin on each food — the list below carries the same numbers
        <span key={"p" + m.i} className="absolute z-10 w-[28px] h-[28px] rounded-full flex items-center justify-center text-[13px] font-extrabold shadow pointer-events-none"
          style={{ left: m.x * 100 + "%", top: m.y * 100 + "%", transform: "translate(-50%,-50%)", background: "#2DD4BF", color: "#04211D", border: "2px solid #0B1220" }}>{k + 1}</span>)) : null}
      {loose.length ? (
        <div className="absolute inset-x-0 bottom-0 p-2 flex flex-wrap gap-1.5" style={{ background: "linear-gradient(transparent, rgba(0,0,0,.55))" }} data-testid="fit-marks-loose">
          {loose.map((i) => <span key={i} className="px-2 py-1 rounded-lg text-[12px] font-bold" style={{ background: "rgba(255,255,255,.92)", color: "#12241B" }}>{name(items[i])} · {kc(items[i])}</span>)}
        </div>) : null}
    </div>
  );
}

/** Fit's settings: which look. */
export function LookPicker({ st, upd, L, ar }) {
  const cur = LK.lookOf(st);
  return (
    <div className="space-y-1.5" data-testid="fit-look-picker">
      <p className="text-[11px] font-extrabold tracking-[0.08em] uppercase text-[var(--c-mut)]">{L("Look", "المظهر")}</p>
      <div className="grid grid-cols-3 gap-2">
        {LK.LOOKS.map((l) => (
          <button key={l.id} onClick={() => upd((s) => ({ ...s, look: l.id }))} aria-pressed={cur === l.id} data-testid={"fit-look-" + l.id}
            className={"rounded-[16px] p-2 text-start border-2 bg-[var(--c-surf)] transition-colors duration-150 " + (cur === l.id ? "border-[var(--c-acc-2)]" : "border-[var(--c-ln)]")}>
            <span className="flex h-9 rounded-lg overflow-hidden mb-1.5" aria-hidden="true">{l.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
            <span className="block text-[13px] font-extrabold text-[var(--c-ink)]">{ar ? l.ar : l.en}{l.id === LK.DEFAULT_LOOK ? <span className="text-[10.5px] text-[var(--c-mut)] font-normal"> · {L("default", "الافتراضي")}</span> : null}</span>
            <span className="block text-[11px] text-[var(--c-mut)] leading-snug">{ar ? l.hint.ar : l.hint.en}</span>
          </button>))}
      </div>
    </div>
  );
}
