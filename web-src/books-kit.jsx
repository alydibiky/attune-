/* ---- v6.10: shared pieces of the Business "books" screens -------------------------------------------
   One clean accounting look (light by default, a dark view in Settings), English + Arabic side by side where it
   matters (documents) and following the app language on screen. No logic here: that is books.js / books-ops.js. */
import React, { useState, createContext, useContext } from "react";
import { X, ChevronLeft, Search } from "lucide-react";
import { getLang } from "./i18n.js";
import * as B from "./books.js";

export const isAr = () => getLang() === "ar";
/** Pick the language of the screen: L("Invoice", "فاتورة"). */
export const L = (en, ar) => (isAr() ? ar : en);

const THEMES = {
  light: { page: "bg-slate-50 text-slate-900", card: "bg-white border-slate-200", sub: "text-slate-500", line: "border-slate-200", input: "bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-600", head: "bg-slate-100 text-slate-600", brand: "text-teal-700", press: "bg-slate-100", bar: "bg-white border-slate-200", chip: "bg-slate-100 text-slate-700", sheet: "bg-white" },
  dark: { page: "bg-slate-950 text-slate-100", card: "bg-slate-900 border-slate-800", sub: "text-slate-400", line: "border-slate-800", input: "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-600 focus:border-teal-500", head: "bg-slate-800 text-slate-300", brand: "text-teal-300", press: "bg-slate-800", bar: "bg-slate-900 border-slate-800", chip: "bg-slate-800 text-slate-200", sheet: "bg-slate-900" },
};
export const BooksCtx = createContext(null);
export const useBooks = () => useContext(BooksCtx);
export const ThemeCtx = createContext(THEMES.light);
export const useTheme = () => useContext(ThemeCtx);
export const themeFor = (name) => THEMES[name] || THEMES.light;

export const BTN = "px-3.5 py-2.5 rounded-lg text-[13px] font-semibold disabled:opacity-40 active:scale-[0.98] transition";
export const btnPrimary = BTN + " bg-teal-700 text-white";
export function btnGhost(t) { return BTN + " border " + t.line + " " + t.sub.replace("text-", "text-") + " hover:" + t.press.split(" ")[0]; }

/** Money for the screen: 1,234.56 (piastres in). */
export function Money({ v, cur, bold, className = "" }) {
  const neg = (v || 0) < 0;
  return <span className={`tabular-nums ${neg ? "text-red-600" : ""} ${bold ? "font-semibold" : ""} ${className}`} dir="ltr">{B.fmt(v || 0)}{cur ? <span className="text-[0.7em] opacity-60 ms-1">{cur}</span> : null}</span>;
}

export function Card({ children, className = "", onClick, testid }) {
  const t = useTheme();
  const C = onClick ? "button" : "div";
  return <C onClick={onClick} data-testid={testid} className={`rounded-xl border ${t.card} ${onClick ? "text-start w-full active:scale-[0.99] transition" : ""} ${className}`}>{children}</C>;
}
export function Stat({ label, value, sub, tone, onClick, testid }) {
  const t = useTheme();
  const tones = { good: "text-emerald-600", bad: "text-red-600", warn: "text-amber-600" };
  return (
    <Card onClick={onClick} className="p-3" testid={testid}>
      <p className={`text-[11px] ${t.sub}`}>{label}</p>
      <p className={`text-[19px] font-bold mt-0.5 leading-tight ${tone ? tones[tone] : ""}`}>{value}</p>
      {sub ? <p className={`text-[11px] mt-0.5 ${t.sub}`}>{sub}</p> : null}
    </Card>
  );
}
export function Badge({ children, tone = "gray" }) {
  const tones = { gray: "bg-slate-200 text-slate-700", green: "bg-emerald-100 text-emerald-800", red: "bg-red-100 text-red-800", amber: "bg-amber-100 text-amber-800", blue: "bg-sky-100 text-sky-800" };
  return <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tones[tone]}`}>{children}</span>;
}
export function Empty({ title, hint, action }) {
  const t = useTheme();
  return <div className="text-center py-10 px-6"><p className="text-[14px] font-medium">{title}</p>{hint ? <p className={`text-[12px] mt-1 ${t.sub}`}>{hint}</p> : null}{action ? <div className="mt-3">{action}</div> : null}</div>;
}
export function Section({ title, right, children }) {
  const t = useTheme();
  return <section className="mb-4"><div className="flex items-center justify-between mb-1.5 px-0.5"><h3 className={`text-[12px] font-semibold uppercase tracking-wide ${t.sub}`}>{title}</h3>{right}</div>{children}</section>;
}
export function Field({ label, children, hint }) {
  const t = useTheme();
  return <label className="block"><span className={`block text-[11.5px] mb-1 ${t.sub}`}>{label}</span>{children}{hint ? <span className={`block text-[11px] mt-0.5 ${t.sub}`}>{hint}</span> : null}</label>;
}
export function Input({ value, onChange, ...p }) {
  const t = useTheme();
  return <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`w-full min-w-0 rounded-lg border px-2.5 py-2 text-[14px] focus:outline-none ${t.input}`} {...p} />;
}
export function Select({ value, onChange, children, ...p }) {
  const t = useTheme();
  return <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`w-full min-w-0 rounded-lg border px-2 py-2 text-[14px] focus:outline-none ${t.input}`} {...p}>{children}</select>;
}
export function Search_({ value, onChange, placeholder }) {
  const t = useTheme();
  return <div className="relative"><Search size={15} className={`absolute top-1/2 -translate-y-1/2 start-2.5 ${t.sub}`} /><input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-lg border ps-8 pe-2.5 py-2 text-[14px] focus:outline-none ${t.input}`} /></div>;
}
export function Chips({ value, onChange, options }) {
  const t = useTheme();
  return <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">{options.map(([k, label]) => (
    <button key={k} onClick={() => onChange(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium ${value === k ? "bg-teal-700 text-white" : t.chip}`}>{label}</button>))}</div>;
}
/** A bottom sheet / full page for forms. */
export function Sheet({ title, onClose, children, footer, testid }) {
  const t = useTheme();
  return (
    <div className={`fixed inset-0 z-[70] ${t.page} flex flex-col`} data-testid={testid}>
      <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${t.bar}`}>
        <button onClick={onClose} className="p-1.5 -ms-1 rounded-lg" aria-label={L("Back", "رجوع")}><ChevronLeft size={20} className="rtl:rotate-180" /></button>
        <h2 className="text-[15px] font-semibold flex-1 truncate">{title}</h2>
        <button onClick={onClose} className="p-1.5 rounded-lg" aria-label={L("Close", "إغلاق")}><X size={18} /></button>
      </div>
      <div className="flex-1 overflow-auto px-3 py-3">{children}</div>
      {footer ? <div className={`border-t ${t.bar} px-3 py-2.5`} style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}>{footer}</div> : null}
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
export const DOC_LABEL = { quote: ["Quotation", "عرض سعر"], invoice: ["Tax invoice", "فاتورة ضريبية"], credit: ["Credit note", "إشعار دائن"], bill: ["Supplier bill", "فاتورة مورد"] };
export const docLabel = (type) => L(...DOC_LABEL[type]);
export const STATUS = { draft: ["Draft", "مسودة", "gray"], posted: ["Posted", "مرحّلة", "green"], void: ["Void", "ملغاة", "red"] };
