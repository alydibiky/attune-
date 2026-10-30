/* v7.5 — Business in two levels (Gemini's Area 4 mock-up): the Books Report overview (this month, six months of sales vs purchases
   with the profit line, receivables ageing 0–30 / 31–60 / 60+, top customers and items, the month in short, CSV) and the Shop Report
   (today and this week, how it was paid, best sellers, staff and the day closes). Every number comes from biz-dash.js. */
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Download, ChevronLeft, Share2, ArrowRight, Check } from "lucide-react";
import * as B from "./books.js";
import { booksOverview, overviewCsv, shopReport, donut } from "./biz-dash.js";
import { tr, getLang } from "./i18n.js";
import * as K from "./ui-kit.jsx";

const isAr = () => getLang() === "ar";
const LL = (en, ar) => (isAr() ? ar : tr(en));
const T = (s) => "⁦" + s + "⁩";
const M = (v, cur) => B.fmt(v || 0) + (cur ? " " + cur : "");
const card = K.card;
const C1 = "var(--c-chart-1)", C2 = "var(--c-chart-2)", C3 = "var(--c-chart-3)", C4 = "var(--c-chart-4)";

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
/** Grouped bars (one or two series) with an optional line on top; the current column's label is bold. */
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
        return <rect key={i + "-" + j} x={x + 1} y={y0} width={Math.max(2, bw - 3)} height={h} rx="4" fill={r.hi && hiColor && j === 0 ? hiColor : b.color} opacity={b.dim ? 0.75 : 1}><title>{label(r) + " · " + B.fmt(v)}</title></rect>; }))}
      {line ? <><polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />
        {pts.length ? <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill={line.color} /> : null}</> : null}
      {rows.map((r, i) => <text key={i} x={step * i + step / 2} y={height - 4} textAnchor="middle" fontSize="11" fontWeight={r.hi ? 800 : 600} fill={r.hi ? "var(--c-ink)" : "var(--c-mut)"}>{label(r)}</text>)}
    </svg></div>;
}
const Legend = ({ items }) => <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] font-bold text-[var(--c-mut)]">{items.map(([l, c, ln]) => <span key={l} className="inline-flex items-center gap-1.5"><i className={ln ? "w-3 h-[3px] rounded" : "w-2.5 h-2.5 rounded-[3px]"} style={{ background: c }} />{l}</span>)}</span>;
function Tile({ label, value, pill, tone, sub, testid }) {
  return <div className={card + " p-3.5 lg:p-4 min-w-0 space-y-1"} data-testid={testid}>
    <div className="flex items-start justify-between gap-2"><span className="text-[12px] font-bold text-[var(--c-mut)] leading-tight">{label}</span>{pill ? <span className={K.tag(tone === "warn" ? "amber" : tone === "neg" ? "red" : "green") + " shrink-0"}>{pill}</span> : null}</div>
    <b className={"block tabular-nums text-[clamp(18px,5vw,22px)] font-black tracking-tight leading-tight " + (tone === "pos" ? "text-[var(--c-pos)]" : tone === "warn" ? "text-[var(--c-warn)]" : tone === "neg" ? "text-[var(--c-neg)]" : "")} dir="ltr">{value}</b>
    {sub ? <span className="block text-[11.5px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}
  </div>;
}
const monthLabel = (ym) => new Date(ym + "-15T12:00:00").toLocaleDateString(isAr() ? "ar-EG-u-nu-latn" : "en-US", { month: "short" });
const dayLabel = (iso) => new Date(iso + "T12:00:00").toLocaleDateString(isAr() ? "ar-EG-u-nu-latn" : "en-GB", { weekday: "short" });
const pctPill = (p) => (p == null ? null : T((p >= 0 ? "+" : "") + p + "%"));

// ---- Books Report: the overview ----------------------------------------------------------------------------------------------------
export function BooksOverview({ s, td, saveFile, flash, canExport = true }) {
  const o = useMemo(() => booksOverview(s, td), [s, td]);
  const cur = s.currency || "";
  const m = o.month, maxAge = Math.max(1, ...o.ageing.buckets.map((b) => b.amount));
  const exportCsv = () => {
    if (!canExport) return flash(LL("Your role cannot export", "دورك مش بيسمح بالتصدير"));
    const csv = overviewCsv(o).map((r) => r.map((c) => { const t = String(c ?? ""); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(",")).join("\n");
    saveFile ? saveFile(`books-overview-${td}.csv`, "﻿" + csv, "text/csv") : flash(LL("Saving files works in the Android app", "حفظ الملفات شغال في تطبيق أندرويد"));
  };
  const BL = { notDue: LL("Not due yet", "لسه ميعادها مجاش"), late1_30: LL("1–30 days late", "متأخرة ١–٣٠ يوم"), late31: LL("Over 30 days late", "متأخرة أكتر من ٣٠ يوم") };
  return <div className="space-y-3" data-testid="books-overview">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
      <Tile testid="ov-sales" label={LL("Net sales (this month)", "صافي المبيعات (الشهر ده)")} value={M(m.revenue, cur)} pill={pctPill(m.salesChange)} tone={m.salesChange != null && m.salesChange < 0 ? "neg" : undefined}
        sub={LL("Cost of goods", "تكلفة البضاعة") + " " + T(B.fmt(m.cogs)) + " · " + LL("Gross", "مجمل") + " " + T(B.fmt(m.grossProfit))} />
      <Tile testid="ov-profit" label={LL("Net profit (this month)", "صافي الربح (الشهر ده)")} value={M(m.netProfit, cur)} tone={m.netProfit < 0 ? "neg" : "pos"}
        pill={m.margin != null ? LL(T(m.margin + "%") + " margin", "هامش " + T(m.margin + "%")) : null} sub={LL("6 months", "٦ شهور") + ": " + T(B.fmt(o.sixProfit))} />
      <Tile testid="ov-stock" label={LL("Stock value (at cost)", "قيمة المخزون (بالتكلفة)")} value={M(o.stock.value, cur)} pill={o.stock.low ? LL(o.stock.low + " low", o.stock.low + " ناقص") : null} tone={o.stock.low ? "warn" : undefined}
        sub={LL(o.stock.items + " items in stock · weighted average cost", o.stock.items + " صنف في المخزن · متوسط مرجّح")} />
      <Tile testid="ov-vat" label={o.vat.payable >= 0 ? LL("VAT to pay", "ضريبة مستحقة") : LL("VAT to recover", "ضريبة مستردة")} value={M(Math.abs(o.vat.payable), cur)}
        sub={LL("Output", "على المبيعات") + " " + T(B.fmt(o.vat.output)) + " − " + LL("Input", "على المشتريات") + " " + T(B.fmt(o.vat.input))} />
    </div>
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[1.25fr_1fr] lg:gap-3">
      <div className={card + " p-4 space-y-2.5 min-w-0"}>
        <div className="flex items-start justify-between gap-2 flex-wrap"><p className="text-[15px] font-extrabold m-0">{LL("Sales vs purchases & profit (6 months)", "المبيعات والمشتريات والربح (٦ شهور)")}</p>
          <Legend items={[[LL("Sales", "مبيعات"), C1], [LL("Purchases", "مشتريات"), C4], [LL("Net profit", "صافي الربح"), C2, 1]]} /></div>
        <Bars testid="ov-chart" rows={o.months.map((x) => ({ ...x, hi: x.current }))} bars={[{ key: "sales", color: C1 }, { key: "purchases", color: C4, dim: 1 }]} line={{ key: "profit", color: C2 }} label={(r) => monthLabel(r.month)} />
      </div>
      <div className={card + " p-4 space-y-3 min-w-0"} data-testid="ov-ageing">
        <div className="flex items-start justify-between gap-2"><p className="text-[15px] font-extrabold m-0">{LL("Receivables ageing", "أعمار الديون")} <span className="text-[var(--c-mut)] font-bold tabular-nums" dir="ltr">({B.fmt(o.ageing.total)})</span></p>
          {o.ageing.overdueCount ? <span className={K.tag("amber") + " shrink-0"}>{LL(o.ageing.overdueCount + " overdue", o.ageing.overdueCount + " متأخرة")}</span> : null}</div>
        <div className="grid grid-cols-3 gap-2">{o.ageing.buckets.map((b, i) => <div key={b.id} className="rounded-[20px] bg-[var(--c-bg)] border border-[var(--c-ln)] p-2.5 min-w-0" data-testid={"ov-age-" + b.id}>
          <p className="text-[11px] font-extrabold m-0" style={{ color: [C1, C3, C2][i] }}>{BL[b.id]}</p>
          <p className="text-[clamp(12.5px,3.5vw,15px)] font-black tabular-nums m-0 mt-0.5 whitespace-nowrap" dir="ltr">{B.fmt(b.amount)}</p>
          <p className="text-[11px] text-[var(--c-mut)] m-0 truncate" dir="auto">{b.top || "—"}</p>
          <div className="c-bar mt-1.5" aria-hidden="true"><i style={{ width: Math.max(3, (100 * b.amount) / maxAge) + "%", background: [C1, C3, C2][i] }} /></div></div>)}</div>
        <p className="text-[12px] text-[var(--c-mut)] m-0">{LL("Customers who owe you more than 30 days get a polite WhatsApp statement from Money → Remind.", "العملاء اللي عليهم فلوس من أكتر من ٣٠ يوم ابعتلهم كشف حساب بأدب على واتساب من الفلوس ← فكّرهم.")}</p>
      </div>
    </div>
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
      <div className={card + " p-4 min-w-0"} data-testid="ov-top">
        <p className="text-[15px] font-extrabold m-0 mb-2">{LL("Top customers & items (this month)", "أكبر العملاء والأصناف (الشهر ده)")}</p>
        {[...o.topCustomers.map((x) => ({ ...x, k: "c" })), ...o.topItems.map((x) => ({ ...x, k: "i" }))].map((x, i) => <p key={i} className="flex justify-between gap-3 text-[13.5px] m-0 py-2 border-t border-[var(--c-ln)]">
          <span className="min-w-0 truncate font-semibold" dir="auto">{x.name} <span className="text-[11.5px] text-[var(--c-mut)] font-bold">{x.k === "c" ? LL("customer", "عميل") : LL("item", "صنف")}</span></span><b className="tabular-nums shrink-0" dir="ltr">{B.fmt(x.net)}</b></p>)}
        {!o.topCustomers.length ? <p className="text-[13px] text-[var(--c-mut)] m-0">{LL("No sales this month yet.", "مفيش مبيعات الشهر ده لسه.")}</p> : null}
      </div>
      <div className={card + " overflow-hidden min-w-0"} data-testid="ov-month">
        {[[LL("Net sales", "صافي المبيعات"), m.revenue], [LL("Cost of goods sold", "تكلفة البضاعة المباعة"), -m.cogs], [LL("Expenses", "المصروفات"), -m.expenses], [LL("VAT to pay", "ضريبة مستحقة"), o.vat.payable]].map(([l, v]) =>
          <p key={l} className="flex justify-between gap-3 text-[13.5px] m-0 px-4 py-2.5 border-b border-[var(--c-ln)]"><span className="font-semibold">{l}</span><span className="tabular-nums" dir="ltr">{B.fmt(v)}</span></p>)}
        <p className="flex justify-between gap-3 text-[14.5px] font-black m-0 px-4 py-3 bg-[var(--c-soft)]"><span>{LL("Net profit", "صافي الربح")}{m.margin != null ? <span className="text-[var(--c-mut)] font-bold"> · {T(m.margin + "%")}</span> : null}</span><span className="tabular-nums" dir="ltr">{B.fmt(m.netProfit)}</span></p>
      </div>
    </div>
    <button onClick={exportCsv} className={K.btnS + " gap-1.5"} data-testid="ov-export"><Download size={14} />{LL("Export to Excel (CSV)", "صدّر لإكسل (CSV)")}</button>
  </div>;
}

// ---- Shop Report ---------------------------------------------------------------------------------------------------------------------
const METHOD = { cash: ["Cash", C1], wallet: ["Wallet", C2], card: ["Card", C4], bank: ["Bank", C3], credit: ["On credit", "var(--c-warn)"] };
export function ShopReportView({ books, shop, today, onBack, onClose, share, extra }) {
  const r = useMemo(() => shopReport(books, shop, today), [books, shop, today]);
  const cur = books.currency || "", co = books.company && books.company.name;
  const arcs = donut(r.methods.map((m) => ({ id: m.id, amount: m.amount })));
  const short = (v) => (v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, "") + "k" : B.fmt(v));
  const text = `${co || tr("Your shop")} — ${today}\n${tr("Today's sales")}: ${M(r.today.sales, cur)} (${tr("{n} sales", { n: r.today.count })})\n${tr("This week")}: ${M(r.weekTotal, cur)}\n` + r.methods.map((m) => `${tr(METHOD[m.id][0])}: ${M(m.amount, cur)} (${m.pct}%)`).join("\n") + (r.best.length ? `\n${tr("Best sellers today")}: ` + r.best.slice(0, 3).map((b) => `${b.name} ×${b.qty}`).join(", ") : "");
  return <div className="space-y-3" data-testid="shop-report">
    <div className="flex items-center gap-2.5">
      <button onClick={onBack} aria-label={tr("Back")} className="lg:hidden w-11 h-11 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center shrink-0" data-testid="shop-report-back"><ChevronLeft size={20} className="rtl:rotate-180" /></button>
      <div className="min-w-0 flex-1"><p className="text-[17px] lg:text-[20px] font-black m-0 truncate"><span dir="auto">{co || tr("Your shop")}</span> · {tr("Report")}</p>
        <p className="text-[12px] text-[var(--c-mut)] m-0">{tr("Today and this week")}{cur ? " · " + cur : ""}</p></div>
      {share ? <button onClick={() => share(text)} className={K.btnS + " rounded-full shrink-0"} data-testid="shop-report-share"><Share2 size={15} /><span className="hidden sm:inline">{tr("Share")}</span></button> : null}
      {onClose ? <span className="hidden lg:block shrink-0"><button onClick={onClose} className={K.btnP + " rounded-full"} data-testid="shop-report-close"><Check size={16} />{tr("Close the day")}</button></span> : null}
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-3">
      <Tile testid="sr-today" label={tr("Today's sales")} value={M(r.today.sales, cur)} tone="pos" pill={pctPill(r.today.change)} sub={tr("{n} sales", { n: r.today.count }) + " · " + tr("Avg {a}", { a: T(B.fmt(r.today.avg)) })} />
      <Tile testid="sr-week" label={tr("This week (7 days)")} value={M(r.weekTotal, cur)} pill={pctPill(r.weekChange)} sub={tr("{n} receipts", { n: r.weekCount }) + (r.peak ? " · " + tr("Peak: {d}", { d: dayLabel(r.peak.date) }) : "")} />
      <Tile testid="sr-drawer" label={tr("Cash drawer")} value={M(r.drawer.expected, cur)} sub={tr("Float {a}", { a: T(B.fmt(r.drawer.float)) }) + " + " + tr("Cash {a}", { a: T(B.fmt(r.drawer.cash)) }) + (r.drawer.expenses ? " − " + T(B.fmt(r.drawer.expenses)) : "")} />
      <Tile testid="sr-staff" label={tr("Staff on shift")} value={r.staff.length ? tr("{n} staff · {h} h", { n: r.staff.length, h: r.staffHours }) : "—"} sub={r.staff.slice(0, 3).map((s) => s.name + " (" + T(s.hours + "h") + ")").join(" · ") || tr("Clock in from Staff")} />
    </div>
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-[1.3fr_1fr] lg:gap-3">
      <div className={card + " p-4 space-y-2 min-w-0"}>
        <div className="flex items-center justify-between gap-2"><p className="text-[15px] font-extrabold m-0">{tr("This week's sales")}</p>{r.weekTotal ? <span className={K.tag("green")} dir="ltr">{B.fmt(r.weekTotal)}</span> : null}</div>
        <Bars testid="sr-week-chart" rows={r.week.map((x) => ({ ...x, hi: x.today }))} bars={[{ key: "total", color: C1 }]} hiColor={C2} label={(x) => (x.today ? tr("Today") : dayLabel(x.date))} height={150} />
      </div>
      <div className={card + " p-4 min-w-0"} data-testid="sr-methods">
        <p className="text-[15px] font-extrabold m-0 mb-2">{tr("Payment methods today")}</p>
        {r.methods.length ? <div className="flex items-center gap-4">
          <svg width="96" height="96" viewBox="0 0 78 78" className="shrink-0" aria-hidden="true" data-testid="sr-donut">{arcs.map((a) => <path key={a.id} d={a.d} fill="none" stroke={METHOD[a.id][1]} strokeWidth="10" />)}
            <text x="39" y="43.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="var(--c-ink)">{short(r.today.sales)}</text></svg>
          <div className="flex-1 min-w-0">{r.methods.map((m) => <p key={m.id} className="flex items-center justify-between gap-2 text-[13.5px] m-0 py-1.5" data-testid={"sr-method-" + m.id}>
            <span className="inline-flex items-center gap-2 min-w-0"><i className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: METHOD[m.id][1] }} /><span className="truncate">{tr(METHOD[m.id][0])} <span className="text-[var(--c-mut)] tabular-nums">({T(m.pct + "%")})</span></span></span>
            <b className={"tabular-nums shrink-0 " + (m.id === "credit" ? "text-[var(--c-warn)]" : "")} dir="ltr">{B.fmt(m.amount)}</b></p>)}</div></div>
          : <p className="text-[13px] text-[var(--c-mut)] m-0">{tr("No sales yet today.")}</p>}
      </div>
    </div>
    <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3">
      <div className={card + " p-4 min-w-0"} data-testid="sr-best">
        <p className="text-[15px] font-extrabold m-0 mb-1">{tr("Best sellers today")}</p>
        {r.best.length ? r.best.map((b, i) => <p key={i} className="flex justify-between gap-2 text-[13.5px] m-0 py-2 border-t border-[var(--c-ln)]"><span className="min-w-0 truncate font-semibold"><span className="tabular-nums">{i + 1}.</span> <span dir="auto">{b.name}</span> <span className="text-[var(--c-mut)] font-bold tabular-nums">×{b.qty}</span></span><b className="tabular-nums shrink-0" dir="ltr">{B.fmt(b.total)}</b></p>)
          : <p className="text-[13px] text-[var(--c-mut)] m-0">{tr("No sales yet today.")}</p>}
      </div>
      <div className={card + " overflow-hidden min-w-0"} data-testid="sr-staff-closes">
        <p className="text-[15px] font-extrabold m-0 px-4 pt-4 pb-2">{tr("Staff & day closes")}</p>
        {r.staff.map((s) => <p key={s.name} className="flex items-center justify-between gap-2 text-[13px] m-0 px-4 py-2.5 border-t border-[var(--c-ln)]" data-testid="sr-staff-row">
          <span className="min-w-0 truncate font-semibold" dir="auto">{s.name}</span><span className="text-[var(--c-mut)] tabular-nums shrink-0">{T(s.hours + " h")} · {tr("{n} sales", { n: s.count })}</span>
          <span className={K.tag(s.on ? "green" : "gray") + " shrink-0"}>{s.on ? tr("On shift") : tr("Clocked out")}</span><b className="tabular-nums shrink-0 w-24 text-end" dir="ltr">{B.fmt(s.total)}</b></p>)}
        {r.closes.map((c, i) => <p key={i} className="flex items-center justify-between gap-2 text-[13px] m-0 px-4 py-2.5 border-t border-[var(--c-ln)]" data-testid="sr-close-row">
          <span className="font-semibold tabular-nums">{tr("Close")} · {dayLabel(c.day)} <span dir="ltr">{c.day.slice(5)}</span></span><span className="text-[var(--c-mut)] shrink-0">{tr("{n} sales", { n: c.count })}</span>
          <span className={K.tag(c.difference == null ? "gray" : c.difference === 0 ? "green" : "red") + " shrink-0"}>{c.difference == null ? tr("Not counted") : c.difference === 0 ? tr("Drawer right") : T((c.difference > 0 ? "+" : "") + B.fmt(c.difference))}</span>
          <b className="tabular-nums shrink-0 w-24 text-end" dir="ltr">{B.fmt(c.sales)}</b></p>)}
        {!r.staff.length && !r.closes.length ? <p className="text-[13px] text-[var(--c-mut)] m-0 px-4 pb-4">{tr("Clock staff in and close the day — they show here.")}</p> : null}
      </div>
    </div>
    {extra}
  </div>;
}
/** "See all → …Report" — the quiet card at the end of a calm view. */
export function SeeAll({ title, sub, cta, onClick, testid }) {
  return <button onClick={onClick} data-testid={testid} className={card + " w-full text-start p-4 min-h-[56px] flex items-center gap-3 hover:border-[var(--c-acc)] transition-colors duration-150"}>
    <span className="min-w-0 flex-1"><span className="block text-[14px] font-extrabold">{title}</span>{sub ? <span className="block text-[12px] text-[var(--c-mut)] leading-snug">{sub}</span> : null}</span>
    <span className="text-[13px] font-extrabold text-[var(--c-acc)] inline-flex items-center gap-1 shrink-0">{cta}<ArrowRight size={15} className="rtl:rotate-180" /></span>
  </button>;
}
