/* v10.9.8 (Ali's OK-W2): the "This month" card on Home — phone (under the to-dos) and computer (the same place) — opens Money. */
import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { tr } from "./i18n.js";
import { loadLedger } from "./myledger.js";
import { fmt } from "./money-calm.js";
import { monthSummary, CAT_LABEL } from "./monthcard.js";

// (Home is kept built between visits — the card notices Money's data changing: when Home shows, when the app comes back, every few
// seconds while visible, and on "attune-ledger" (the first minute's All right ✓); it recomputes only when the saved data really changed)
const raw = () => { try { return localStorage.getItem("ledger.v3") || ""; } catch (e) { return ""; } };
export function MonthCard({ navTo, tick = 0 }) {
  const [stamp, setStamp] = useState(raw);
  useEffect(() => {
    const check = () => { const r = raw(); setStamp((old) => (old === r ? old : r)); };
    const vis = () => { if (!document.hidden) check(); };
    const iv = setInterval(() => { if (!document.hidden) check(); }, 4000);
    window.addEventListener("attune-ledger", check); window.addEventListener("attune-open", check); document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(iv); window.removeEventListener("attune-ledger", check); window.removeEventListener("attune-open", check); document.removeEventListener("visibilitychange", vis); };
  }, []);
  const s = useMemo(() => { try { return monthSummary(loadLedger(), Date.now()); } catch (e) { return null; } }, [tick, stamp]);
  if (!s) return null;
  const [main, ...others] = s.spent;
  return <button onClick={() => navTo && navTo("money")} className="calm w-full text-start rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-surf)] p-4 space-y-1.5" data-testid="home-month">
    <span className="flex items-center justify-between gap-2"><span className="text-[11px] font-extrabold uppercase tracking-[.08em] text-[var(--c-mut)]">{tr("This month")}</span>
      <span className="inline-flex items-center gap-0.5 text-[12.5px] font-extrabold text-[var(--c-acc)]">{tr("Money")}<ChevronRight size={14} className="rtl:-scale-x-100" /></span></span>
    <span className="flex flex-wrap items-baseline gap-x-2"><b className="text-[22px] font-black tabular-nums" dir="ltr" data-testid="home-month-total">{fmt(main[1])} {main[0]}</b>
      {others.map(([c, a]) => <span key={c} className="text-[12.5px] font-bold text-[var(--c-mut)] tabular-nums" dir="ltr">+ {fmt(a)} {c}</span>)}</span>
    {s.top.length ? <span className="block text-[12.5px] text-[var(--c-mut)]" data-testid="home-month-top">{s.top.map(([c, a]) => `${tr(CAT_LABEL[c] || c)} ${fmt(a)}`).join(" · ")}</span> : null}
    {s.back > 0 ? <span className="flex items-center justify-between gap-2 text-[12.5px]" data-testid="home-month-back"><span className="text-[var(--c-mut)]">{tr("Back to you")}</span>
      <b className="tabular-nums text-[var(--c-pos,#2F6B4F)]" dir="ltr">+{fmt(s.back)} {s.cur}</b></span> : null}
  </button>;
}
