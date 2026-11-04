/* ---- v9.1 (Ali, 4 Nov: Business moves to its own product, Attune Business): the small chart pieces Money, Learn and the Tools
   hub borrowed from Business's dashboard (biz-dash-ui.jsx, now in archive/business/) — the same code, kept here. ---- */
import React, { useState, useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";
import * as K from "./ui-kit.jsx";
const card = K.card;
/** minor units (piastres / cents) → "1,234.50" (books.js fmt) */
function fmt(m, { cur = "", plain = false } = {}) {
  const n = Math.abs(m || 0), neg = (m || 0) < 0;
  const whole = Math.floor(n / 100), frac = String(n % 100).padStart(2, "0");
  const t = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "." + frac;
  return (neg ? "-" : "") + t + (cur && !plain ? " " + cur : "");
}
function useWidth(def = 340) {
  const ref = useRef(null); const [w, setW] = useState(def);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const f = () => setW(Math.max(220, Math.round(el.clientWidth || def)));
    f(); const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(f) : null; ro && ro.observe(el);
    return () => ro && ro.disconnect();
  }, []);
  return [ref, w];
}
export function Bars({ rows, bars, line, label, height = 168, testid, hiColor }) {
  const [ref, W] = useWidth();
  const vals = rows.flatMap((r) => [...bars.map((b) => r[b.key] || 0), line ? r[line.key] || 0 : 0]);
  const top = Math.max(1, ...vals), bot = Math.min(0, ...vals), H = height - 22, y = (v) => 6 + ((top - v) / (top - bot)) * (H - 6);
  const step = W / rows.length, gw = Math.min(46, step * 0.66), bw = gw / bars.length;
  const pts = line ? rows.map((r, i) => [step * i + step / 2, y(r[line.key] || 0)]) : [];
  return <div ref={ref} className="w-full" data-testid={testid}>
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} role="img" className="block overflow-visible">
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={6 + f * (H - 6)} y2={6 + f * (H - 6)} stroke="var(--c-ln)" strokeDasharray="3 4" />)}
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--c-ln)" />
      {rows.map((r, i) => bars.map((b, j) => { const v = r[b.key] || 0, x = step * i + (step - gw) / 2 + j * bw; const y0 = y(Math.max(0, v)), h = Math.max(v ? 2 : 0, Math.abs(y(v) - y(0)));
        return <rect key={i + "-" + j} x={x + 1} y={y0} width={Math.max(2, bw - 3)} height={h} rx="4" fill={r.hi && hiColor && j === 0 ? hiColor : b.color} opacity={b.dim ? 0.75 : 1}><title>{label(r) + " · " + fmt(v)}</title></rect>; }))}
      {line ? <><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.length ? <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={line.color} /> : null}</> : null}
      {rows.map((r, i) => <text key={i} x={step * i + step / 2} y={height - 4} textAnchor="middle" fontSize="11" fontWeight={r.hi ? 800 : 600} fill={r.hi ? "var(--c-ink)" : "var(--c-mut)"}>{label(r)}</text>)}
    </svg></div>;
}
export function SeeAll({ title, sub, cta, onClick, testid }) {
  return <button onClick={onClick} data-testid={testid} className={card + " w-full text-start p-4 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)] transition-colors duration-150"}>
    <span className="min-w-0 flex-1"><span className="block text-[14px] font-extrabold">{title}</span>{sub ? <span className="block text-[12px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}</span>
    <span className="text-[13px] font-extrabold text-[var(--c-acc)] inline-flex items-center gap-1 shrink-0">{cta}<ArrowRight size={15} className="rtl:rotate-180" /></span>
  </button>;
}
