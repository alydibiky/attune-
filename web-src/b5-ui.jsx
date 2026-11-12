/* ---- v9.9.22 B5 screens. N3 (Ali picked A): a small "A year ago today" card on Home, once a day when there is something — the
   person's own note or payment from this calendar day in an earlier year (b5people.js onThisDay, 10,000 cases). Tap → the original
   (the note in Mind / the payment in Money). "Nice" hides it for today; "Hide these" turns the card off (kept in this phone). */
import React, { useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { onThisDay } from "./b5people.js";
import { loadLedger } from "./myledger.js";
const OFF = "attune:onthisday:off", SEEN = "attune:onthisday:seen";
const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const today = () => new Date().toDateString();
export function OnThisDayCard({ records = [], open }) {
  const [, setV] = useState(0);
  if (get(OFF) === "1" || get(SEEN) === today()) return null;
  let x = null; try { const L = loadLedger(); x = onThisDay({ records, txns: (L && L.txns) || [] }); } catch (e) { x = null; }
  if (!x) return null;
  const when = (() => { try { return new Date(x.date + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return x.date; } })();
  return <div className="rounded-[20px] p-4 space-y-2" style={{ background: "var(--c-soft)" }} data-testid="home-onthisday">
    <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub">{x.years === 1 ? tr("A year ago today") : tr("{n} years ago today", { n: x.years })}</p>
    <button onClick={() => open && open(x)} className="w-full flex items-center gap-3 text-start" data-testid="onthisday-open">
      <span className="flex-1 min-w-0"><b className="block text-[14.5px] truncate" dir="auto">{x.src === "money" ? (x.type === "income" ? tr("You received") : tr("You paid")) + " · " + (x.title || "") : x.title}</b>
        <span className="c-sub text-[12.5px]">{when}</span></span>
      {x.amount ? <b className="tabular-nums text-[15px]" dir="ltr">{Math.round(x.amount).toLocaleString()}</b> : null}</button>
    <div className="flex gap-2">
      <button onClick={() => { put(SEEN, today()); setV((n) => n + 1); }} className="min-h-[36px] px-3 rounded-full text-[12.5px] font-bold border border-[var(--c-ln)] bg-[var(--c-surf)]" data-testid="onthisday-nice">{tr("Nice")}</button>
      <button onClick={() => { put(OFF, "1"); setV((n) => n + 1); }} className="min-h-[36px] px-3 rounded-full text-[12.5px] font-bold c-sub" data-testid="onthisday-hide">{tr("Hide these")}</button></div>
  </div>;
}
