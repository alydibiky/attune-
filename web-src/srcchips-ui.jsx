/* ---- v10.9.9 B1 (Ali OK'd 27 Nov: "tap where an answer came from"). An answer worked out from your own data ends with up to 3 chips —
   one per thing it used (a Money entry, the note that linked it, a date, a reminder, a People & plans item) — and "+N more". A tap opens
   THAT thing (the payment's own sheet in Money, the note in Mind, the date in Dates…) through personpage.openOriginal, the same tested
   way the person page opens its lines. Tests: tests/e2e_v1099b1.py (390 + 1366), tests/unit/v1099askmind.test.mjs (refsOf). */
import React, { useState } from "react";
import { Wallet, FileText, CalendarDays, Bell, User, ChevronRight } from "lucide-react";
import { tr, dateLocale } from "./i18n.js";
import { targetOf, openOriginal } from "./personpage.js";

const KIND = { money: ["money", Wallet], memory: ["mind", FileText], radar: ["dates", CalendarDays], reminders: ["reminders", Bell], life: ["followups", User] };
const day = (d) => { const t = Date.parse(String(d || "") + "T12:00:00"); if (!isFinite(t)) return ""; try { return new Date(t).toLocaleDateString(dateLocale() || "en-GB", { day: "numeric", month: "short" }); } catch (e) { return d; } };
/** → what a chip says: "−150 · hany rabee3 · 20 Nov", "Your note · that in the barber I go to…" */
export function chipText(r) {
  const what = String(r.what || "").replace(/\s+/g, " ").trim(), short = what.length > 34 ? what.slice(0, 33) + "…" : what;
  if (r.via || r.src === "memory") return tr("Your note") + (short ? " · " + short : "");
  return [short, day(r.date)].filter(Boolean).join(" · ");
}
export function openRef(r, navTo) {
  const k = KIND[r.src]; if (!k) return false;
  return openOriginal(targetOf({ src: k[0], id: k[0] + ":" + r.id, rec: r.src === "memory" ? r.id : undefined }), navTo);
}
export function SourceChips({ refs, navTo, max = 3 }) {
  const [all, setAll] = useState(false);
  const list = (refs || []).filter((r) => r && KIND[r.src]);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, max), more = list.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2" data-testid="src-chips">
      {shown.map((r) => { const Icon = KIND[r.src][1];
        return <button key={r.src + ":" + r.id} onClick={() => openRef(r, navTo)} dir="auto" data-testid="src-chip" data-src={r.src} data-id={r.id}
          className="inline-flex items-center gap-1 min-h-[34px] max-w-full ps-2.5 pe-1.5 rounded-full border border-[var(--c-acc)] bg-[var(--c-surf)] text-[var(--c-acc)] text-[12.5px] font-bold">
          <Icon size={13} className="shrink-0" /><span className="truncate">{chipText(r)}</span><ChevronRight size={13} className="shrink-0 rtl:rotate-180" /></button>; })}
      {more > 0 ? <button onClick={() => setAll(true)} className="inline-flex items-center min-h-[34px] px-2.5 rounded-full border border-[var(--c-ln)] text-[var(--c-ink)] text-[12.5px] font-bold" data-testid="src-more">{tr("+{n} more", { n: more })}</button> : null}
    </div>);
}
