/* ---- Books → Reports: profit & loss, sales by customer / item, VAT return, stock valuation, trial balance ---------- */
import React, { useState, useMemo } from "react";
import { Download } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { L, useBooks, useTheme, Card, Section, Money, Empty, Field, Input, Chips, BTN, btnPrimary, today, fmtDate } from "./books-kit.jsx";

const iso = (d) => d.toISOString().slice(0, 10);
function periods(td) {
  const y = +td.slice(0, 4), m = +td.slice(5, 7);
  const first = (yy, mm) => iso(new Date(Date.UTC(yy, mm - 1, 1))), last = (yy, mm) => iso(new Date(Date.UTC(yy, mm, 0)));
  return {
    month: [first(y, m), td], last: [first(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), last(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1)],
    quarter: [first(y, Math.floor((m - 1) / 3) * 3 + 1), td], year: [`${y}-01-01`, td], all: ["", td],
  };
}
const csv = (rows) => rows.map((r) => r.map((c) => { const t = String(c ?? ""); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(",")).join("\n");

export function ReportsModule() {
  const { s, today: td, saveFile, flash } = useBooks();
  const th = useTheme();
  const [rep, setRep] = useState("pl");
  const [per, setPer] = useState("month");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const P = periods(td);
  const [f, t] = per === "custom" ? [from, to || td] : P[per];
  const posted = s.docs.filter((d) => d.status === "posted" && (d.type === "invoice" || d.type === "credit"));
  const bills = s.bills.filter((b) => b.status === "posted");
  const cname = (id) => (s.customers.find((c) => c.id === id) || {}).name || id;
  const iname = (id) => (s.items.find((c) => c.id === id) || {}).name || id;

  const data = useMemo(() => {
    if (rep === "pl") {
      const r = B.profitAndLoss(s.journal, f, t);
      return { rows: [[L("Sales", "المبيعات"), r.sales], [L("Sales returns", "مردودات المبيعات"), -r.salesReturns], [L("Net revenue", "صافي الإيراد"), r.revenue, 1], [L("Cost of goods sold", "تكلفة البضاعة المباعة"), -r.cogs], [L("Gross profit", "مجمل الربح"), r.grossProfit, 1], [L("Expenses", "المصروفات"), -r.expenses], [L("Net profit", "صافي الربح"), r.netProfit, 2]] };
    }
    if (rep === "cust" || rep === "item") {
      const r = B.salesBy(posted.map((d) => ({ ...d, customer: d.customer, lines: d.lines.map((l) => ({ ...l, item: l.item ? iname(l.item) : l.desc })) })), rep === "cust" ? "customer" : "item", f, t, s.tax);
      return { rows: r.map((x) => [rep === "cust" ? cname(x.name) : x.name, x.net]), total: r.reduce((a, x) => a + x.net, 0) };
    }
    if (rep === "vat") {
      const v = B.vatReturn(posted, bills, f, t, s.tax);
      return { rows: [[L("Sales (net)", "المبيعات (صافي)"), v.salesBase], [L("Output VAT", "ضريبة المبيعات"), v.output], [L("Purchases (net)", "المشتريات (صافي)"), v.purchasesBase], [L("Input VAT", "ضريبة المشتريات"), v.input], [v.payable >= 0 ? L("VAT to pay", "ضريبة مستحقة السداد") : L("VAT to recover", "ضريبة مستحقة الاسترداد"), Math.abs(v.payable), 2]], note: L("A summary to help you fill in your return — check it with your accountant.", "ملخص يساعدك في تعبئة الإقرار — راجعه مع محاسبك.") };
    }
    if (rep === "stock") {
      const lv = O.levels(s);
      const r = s.items.filter((i) => i.track !== false).map((i) => [i.name, (lv[i.id] || { qty: 0 }).qty, (lv[i.id] || { avgCost: 0 }).avgCost, (lv[i.id] || { value: 0 }).value]);
      return { cols: [L("Item", "الصنف"), L("Qty", "الكمية"), L("Avg cost", "متوسط التكلفة"), L("Value", "القيمة")], rows: r, total: r.reduce((a, x) => a + x[3], 0), stock: true };
    }
    const tb = B.trialBalance(s.journal);
    return { cols: [L("Account", "الحساب"), L("Debit", "مدين"), L("Credit", "دائن")], rows: tb.rows.map((r) => [(() => { const a = B.ACCOUNTS.find((x) => x.id === r.account); return a ? `${r.account} ${L(a.en, a.ar)}` : r.account; })(), r.debit, r.credit]), total2: [tb.debit, tb.credit], balanced: tb.balanced, tb: true };
  }, [rep, f, t, s]);

  const exportCsv = () => {
    const rows = data.cols ? [data.cols, ...data.rows.map((r) => r.map((c, i) => (typeof c === "number" && !(data.stock && i === 1) ? (c / 100).toFixed(2) : c)))] : data.rows.map((r) => [r[0], (r[1] / 100).toFixed(2)]);
    saveFile ? saveFile(`${rep}-${td}.csv`, "﻿" + csv(rows), "text/csv") : flash(L("Saving files works in the Android app", "حفظ الملفات شغال في تطبيق أندرويد"));
  };
  const list = [["pl", L("Profit & loss", "الأرباح والخسائر")], ["cust", L("Sales by customer", "مبيعات بالعميل")], ["item", L("Sales by item", "مبيعات بالصنف")], ["vat", L("VAT", "الضريبة")], ["stock", L("Stock value", "قيمة المخزون")], ["tb", L("Trial balance", "ميزان المراجعة")]];
  const noPeriod = rep === "stock" || rep === "tb";
  return (
    <div data-testid="books-reports">
      <div className="mb-2"><Chips value={rep} onChange={setRep} options={list} /></div>
      {!noPeriod ? <div className="mb-2"><Chips value={per} onChange={setPer} options={[["month", L("This month", "الشهر ده")], ["last", L("Last month", "الشهر اللي فات")], ["quarter", L("This quarter", "الربع ده")], ["year", L("This year", "السنة دي")], ["all", L("All time", "الكل")], ["custom", L("Dates…", "تواريخ…")]]} /></div> : null}
      {per === "custom" && !noPeriod ? <div className="grid grid-cols-2 gap-2 mb-2"><Field label={L("From", "من")}><Input type="date" value={from} onChange={setFrom} /></Field><Field label={L("To", "إلى")}><Input type="date" value={to} onChange={setTo} /></Field></div> : null}
      {!noPeriod && f ? <p className={`text-[11.5px] mb-2 ${th.sub}`}>{fmtDate(f)} → {fmtDate(t)}</p> : null}
      <Card className="divide-y" testid="report-body">
        {data.cols ? <div className={`grid ${data.cols.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-2 px-3 py-2 text-[11px] font-semibold ${th.head}`}>{data.cols.map((c) => <span key={c}>{c}</span>)}</div> : null}
        {!data.rows.length ? <Empty title={L("Nothing to report for this period", "مفيش بيانات للفترة دي")} /> : data.rows.map((r, i) => data.cols ? (
          <div key={i} className={`grid ${data.cols.length === 4 ? "grid-cols-4" : "grid-cols-3"} gap-2 px-3 py-2 text-[13px]`}><span className="truncate">{r[0]}</span>{r.slice(1).map((c, j) => <span key={j} className="tabular-nums" dir="ltr">{data.stock && j === 0 ? c : B.fmt(c)}</span>)}</div>
        ) : (
          <div key={i} className={`flex justify-between px-3 py-2.5 text-[13.5px] ${r[2] ? "font-semibold" : ""} ${r[2] === 2 ? "bg-teal-50 text-teal-900" : ""}`}><span>{r[0]}</span><Money v={r[1]} /></div>))}
        {data.total != null ? <div className="flex justify-between px-3 py-2.5 font-bold text-[13.5px]"><span>{L("Total", "الإجمالي")}</span><Money v={data.total} /></div> : null}
        {data.total2 ? <div className="grid grid-cols-3 gap-2 px-3 py-2.5 font-bold text-[13px]"><span>{L("Total", "الإجمالي")}</span><Money v={data.total2[0]} /><Money v={data.total2[1]} /></div> : null}
      </Card>
      {data.balanced != null ? <p className={`text-[12px] mt-2 ${data.balanced ? "text-emerald-600" : "text-red-600"}`}>{data.balanced ? L("The books balance.", "الدفاتر متوازنة.") : L("The books do not balance — contact support.", "الدفاتر مش متوازنة — كلّم الدعم.")}</p> : null}
      {data.note ? <p className={`text-[11.5px] mt-2 ${th.sub}`}>{data.note}</p> : null}
      <button onClick={exportCsv} className={`${BTN} border ${th.line} mt-3 flex items-center gap-1.5`} data-testid="report-export"><Download size={14} />{L("Export to Excel (CSV)", "تصدير لإكسل (CSV)")}</button>
    </div>
  );
}
