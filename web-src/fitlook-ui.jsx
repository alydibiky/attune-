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
export function PhotoLoading({ look, url, stage, L, ar }) {
  const [order] = useState(() => LK.factOrder());
  const [k, setK] = useState(0);
  useEffect(() => { const t = setInterval(() => setK((n) => n + 1), 5000); return () => clearInterval(t); }, []);
  const f = LK.FACTS[order[k % order.length]];
  const h = 240;
  return (
    <div className="space-y-3" data-testid="fit-photo-loading" aria-busy="true">
      {look === "bold" ? (
        <div className="flex flex-col items-center gap-2 pt-1">
          <div className="relative" style={{ width: 176, height: 176 }}>
            <img src={url} alt="" className="absolute rounded-full object-cover" style={{ inset: 14, width: 148, height: 148 }} />
            <svg width="176" height="176" viewBox="0 0 176 176" className="absolute inset-0 fit-spin" aria-hidden="true">
              <circle cx="88" cy="88" r="80" fill="none" stroke="#ECECF2" strokeWidth="10" />
              <circle cx="88" cy="88" r="80" fill="none" stroke="#F25C2A" strokeWidth="10" strokeLinecap="round" strokeDasharray="150 353" />
            </svg>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl" style={{ height: h, "--h": h + "px" }}>
          <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: "rgba(8,20,16,.30)" }} />
          {look === "night" ? (
            <div className="absolute" style={{ left: "50%", top: "50%", width: 30, height: 30, marginLeft: -15, marginTop: -15 }}>
              <div className="absolute inset-0 rounded-full fit-pulse" style={{ border: "3px solid #5EEAD4" }} />
              <div className="absolute rounded-full" style={{ left: 10, top: 10, width: 10, height: 10, background: "#5EEAD4" }} />
            </div>
          ) : <div className="absolute inset-x-0 top-0 fit-scan" style={{ height: 4, background: "#7CF2B4", boxShadow: "0 0 18px 6px rgba(124,242,180,.55)" }} />}
        </div>
      )}
      <p className={"text-[14px] text-slate-200 flex items-center gap-2 " + (look === "bold" ? "justify-center" : "")} data-testid="fit-loading-stage">
        <span className="inline-block w-4 h-4 rounded-full border-2 border-emerald-500 border-r-transparent fit-spin" aria-hidden="true" />{stage || L("Recognising the food…", "جارٍ التعرّف على الطعام…")}</p>
      <div key={k} className="fit-pop rounded-2xl bg-slate-900 border border-slate-800 p-4 space-y-1.5 shadow-sm" data-testid="fit-fact" aria-live="polite">
        <p className="text-[11.5px] font-bold tracking-wider text-emerald-300">{L("DID YOU KNOW?", "هل تعلم؟")}</p>
        <p className="text-[15.5px] leading-relaxed font-medium text-white">{ar ? f.ar : f.en}</p>
        <p className="text-[11.5px] text-slate-500">{ar ? f.src.ar : f.src.en}</p>
      </div>
      <div className="flex justify-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={"h-1.5 rounded-full " + (i === k % 4 ? "w-5 bg-emerald-500" : "w-1.5 bg-slate-700")} />)}</div>
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
          return <g key={l.i}>{look === "fresh" ? <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(0,0,0,.35)" strokeWidth="4.5" strokeLinecap="round" /> : null}
            <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={c} strokeWidth={look === "fresh" ? 2.5 : 3} strokeLinecap="round" />
            {look === "night" ? null : <circle cx={l.x2} cy={l.y2} r="5.5" fill={c} stroke={look === "bold" ? "#FFFFFF" : "rgba(0,0,0,.35)"} strokeWidth="1.5" />}</g>; })}
      </svg>
      {marks.map((m, k) => {
        const x = items[m.i];
        const bg = look === "bold" ? BOLD_COLORS[k % BOLD_COLORS.length] : look === "night" ? "rgba(11,18,32,.88)" : "#FFFFFF", fg = look === "fresh" ? "#12241B" : look === "night" ? "#E8EEF7" : "#FFFFFF";
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
      <p className="text-[13px] text-slate-200 font-medium">{L("Look", "المظهر")}</p>
      <div className="grid grid-cols-3 gap-2">
        {LK.LOOKS.map((l) => (
          <button key={l.id} onClick={() => upd((s) => ({ ...s, look: l.id }))} aria-pressed={cur === l.id} data-testid={"fit-look-" + l.id}
            className={"rounded-xl p-2 text-start border-2 " + (cur === l.id ? "border-emerald-500" : "border-slate-800")}>
            <span className="flex h-9 rounded-lg overflow-hidden mb-1.5" aria-hidden="true">{l.swatch.map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
            <span className="block text-[13px] font-semibold text-white">{ar ? l.ar : l.en}{l.id === LK.DEFAULT_LOOK ? <span className="text-[10.5px] text-slate-500 font-normal"> · {L("default", "الافتراضي")}</span> : null}</span>
            <span className="block text-[11px] text-slate-500 leading-snug">{ar ? l.hint.ar : l.hint.en}</span>
          </button>))}
      </div>
    </div>
  );
}
