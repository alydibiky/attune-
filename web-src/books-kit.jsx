/* ---- v6.10: shared pieces of the Business "books" screens -------------------------------------------
   One clean accounting look (light by default, a dark view in Settings), English + Arabic side by side where it
   matters (documents) and following the app language on screen. No logic here: that is books.js / books-ops.js. */
import React, { useState, createContext, useContext } from "react";
import { X, ChevronLeft, Search } from "lucide-react";
import { getLang } from "./i18n.js";
import * as B from "./books.js";
import { tag, chip } from "./ui-kit.jsx";

export const isAr = () => getLang() === "ar";
/** Pick the language of the screen: L("Invoice", "فاتورة"). */
export const L = (en, ar) => (isAr() ? ar : en);

// v7.0 Gemini's Direction 2 "Quiet Atelier" (Ali's pick, 22 Oct 2026): every Books screen is drawn with the theme tokens of
// build/tw.css (.calm), so it follows the app's light AND dark look. Both names keep working (the Settings choice is kept).
const TOKENS = { page: "calm bg-[var(--c-bg)] text-[var(--c-ink)]", card: "bg-[var(--c-surf)] border-[var(--c-ln)] text-[var(--c-ink)]", sub: "text-[var(--c-mut)]", line: "border-[var(--c-ln)]",
  input: "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-ink)] placeholder:text-[var(--c-mut)] focus:border-[var(--c-acc)] focus:bg-[var(--c-surf)]", head: "bg-[var(--c-surf-2)] text-[var(--c-mut)]",
  brand: "text-[var(--c-acc)]", press: "bg-[var(--c-surf-2)]", bar: "bg-[var(--c-bg)] border-[var(--c-ln)]", chip: "bg-[var(--c-surf)] border border-[var(--c-ln)] text-[var(--c-mut)]", sheet: "bg-[var(--c-surf)]" };
const THEMES = { light: TOKENS, dark: TOKENS };
export const BooksCtx = createContext(null);
export const useBooks = () => useContext(BooksCtx);
export const ThemeCtx = createContext(THEMES.light);
export const useTheme = () => useContext(ThemeCtx);
export const themeFor = (name) => THEMES[name] || THEMES.light;

export const BTN = "min-h-[44px] px-3.5 py-2 rounded-[12px] text-[13.5px] font-bold disabled:opacity-40 transition-colors duration-150 cursor-pointer";
export const btnPrimary = BTN + " bg-[var(--c-acc)] text-[var(--c-on-acc)]";
export function btnGhost(t) { return BTN + " border " + t.line + " " + t.sub + " hover:bg-[var(--c-surf-2)]"; }
/** What is selected: Gemini's terracotta pill. */
export const SEL = "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)] shadow-sm";
/** Status colours (one meaning each): good / due soon / overdue. */
/** A quiet table header row (no capitals: tests read the words as written). */
export const HEAD = "text-[11.5px] font-extrabold tracking-[0.04em] text-[var(--c-mut)] bg-[var(--c-surf-2)]";
export const POS = "text-[var(--c-pos)]", WARN = "text-[var(--c-warn)]", NEG = "text-[var(--c-neg)]";

/** Money for the screen: 1,234.56 (piastres in). */
export function Money({ v, cur, bold, className = "" }) {
  const neg = (v || 0) < 0;
  return <span className={`tabular-nums ${neg ? NEG : ""} ${bold ? "font-extrabold" : ""} ${className}`} dir="ltr">{B.fmt(v || 0)}{cur ? <span className="text-[0.7em] opacity-60 ms-1">{cur}</span> : null}</span>;
}

export function Card({ children, className = "", onClick, testid }) {
  const t = useTheme();
  const C = onClick ? "button" : "div";
  return <C onClick={onClick} data-testid={testid} className={`rounded-[20px] border ${t.card} divide-[var(--c-ln)] shadow-[0_2px_10px_rgba(0,0,0,0.06)] ${onClick ? "text-start w-full min-h-[44px] hover:border-[var(--c-acc)] transition-colors duration-150" : ""} ${className}`}>{children}</C>;
}
/** A KPI tile: a quiet label, a big tabular number, one quiet line. */
export function Stat({ label, value, sub, tone, onClick, testid }) {
  const t = useTheme();
  const tones = { good: POS, bad: NEG, warn: WARN };
  return (
    <Card onClick={onClick} className="p-3.5" testid={testid}>
      <p className={`text-[12px] font-bold truncate m-0 ${t.sub}`}>{label}</p>
      <p className={`text-[clamp(17px,4.6vw,21px)] font-black tracking-tight tabular-nums mt-1 mb-0 leading-tight ${tone ? tones[tone] : ""}`}>{value}</p>
      {sub ? <p className={`text-[11.5px] mt-1 mb-0 ${t.sub}`}>{sub}</p> : null}
    </Card>
  );
}
export function Badge({ children, tone = "gray" }) {
  return <span className={tag(tone)}>{children}</span>;
}
export function Empty({ title, hint, action }) {
  const t = useTheme();
  return <div className="text-center py-10 px-6"><p className="text-[14px] font-extrabold">{title}</p>{hint ? <p className={`text-[12.5px] mt-1 ${t.sub}`}>{hint}</p> : null}{action ? <div className="mt-3">{action}</div> : null}</div>;
}
export function Section({ title, right, children }) {
  return <section className="mb-5"><div className="flex items-center justify-between gap-2 mb-2 px-0.5"><h3 className="m-0 text-[12.5px] font-extrabold tracking-[0.04em] text-[var(--c-mut)]">{title}</h3>{right}</div>{children}</section>;
}
export function Field({ label, children, hint }) {
  const t = useTheme();
  return <label className="block min-w-0"><span className={`block text-[12px] font-bold mb-1.5 ${t.sub}`}>{label}</span>{children}{hint ? <span className={`block text-[11.5px] mt-1 ${t.sub}`}>{hint}</span> : null}</label>;
}
const FIELD = "w-full min-w-0 min-h-[44px] rounded-[12px] border px-3.5 py-2 text-[15px] font-semibold focus:outline-none transition-colors duration-150";
export function Input({ value, onChange, ...p }) {
  const t = useTheme();
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${t.input}`} {...p} />;
}
export function Select({ value, onChange, children, ...p }) {
  const t = useTheme();
  return <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`${FIELD} !px-3 ${t.input}`} {...p}>{children}</select>;
}
export function Search_({ value, onChange, placeholder }) {
  const t = useTheme();
  return <div className="relative"><Search size={16} className={`absolute top-1/2 -translate-y-1/2 start-3 ${t.sub}`} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${FIELD} ps-9 ${t.input}`} /></div>;
}
export function Chips({ value, onChange, options }) {
  return <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">{options.map(([k, label]) => (
    <button key={k} onClick={() => onChange(k)} className={`shrink-0 ${chip(value === k)}`}>{label}</button>))}</div>;
}
/** A bottom sheet / full page for forms. */
export function Sheet({ title, onClose, children, footer, testid }) {
  const t = useTheme();
  return (
    <div className={`fixed inset-0 z-[70] ${t.page} flex flex-col`} data-testid={testid}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${t.bar}`}>
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center shrink-0" aria-label={L("Back", "رجوع")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <h2 className="text-[17px] font-extrabold flex-1 truncate m-0">{title}</h2>
        <button onClick={onClose} className="w-11 h-11 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center shrink-0" aria-label={L("Close", "إغلاق")}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-auto px-4 py-4"><div className="max-w-3xl mx-auto">{children}</div></div>
      {footer ? <div className={`border-t ${t.bar} px-4 py-2.5`} style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}><div className="max-w-3xl mx-auto">{footer}</div></div> : null}
    </div>
  );
}
/** Bilingual term with a plain-words tip: <Term en="Ageing" ar="أعمار الديون" tip="…" /> */
export function Term({ en, ar, tip }) {
  return <span title={tip}>{isAr() ? ar : en}</span>;
}
export const today = () => new Date().toISOString().slice(0, 10);
/** Today's date, month start etc. for filters. */
export const monthStart = () => today().slice(0, 8) + "01";
export const fmtDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return isAr() ? `${d}/${m}/${y}` : `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`; };
export const DOC_LABEL = { quote: ["Quotation", "عرض سعر"], invoice: ["Tax invoice", "فاتورة ضريبية"], credit: ["Credit note", "إشعار دائن"], order: ["Sales order", "أمر بيع"], delivery: ["Delivery note", "إذن تسليم"], bill: ["Supplier bill", "فاتورة مورد"] };
export const docLabel = (type) => L(...DOC_LABEL[type]);
export const STATUS = { draft: ["Draft", "مسودة", "gray"], posted: ["Posted", "مرحّلة", "green"], void: ["Void", "ملغاة", "red"] };
