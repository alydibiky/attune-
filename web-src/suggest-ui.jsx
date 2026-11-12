/* ---- v9.9.18 AU2 (Ali picked A — a card on Home when it spots a habit). One idea at a time from suggest.js: "You logged the maid
   600 4 Saturdays in a row — do it by itself every Saturday? I'll only ask “Did she come?”". Yes → a regular payment in People &
   plans (asked on its day, then into Money — the same as typing "the maid comes every Saturday 600"); Not now → later; Never → never. */
import React, { useMemo, useState } from "react";
import { tr } from "./i18n.js";
import { findIdeas, refuse } from "./suggest.js";
import { loadLedger } from "./myledger.js";
import { loadLife, saveLife, addCommitment } from "./life.js";
const KEY = "attune:suggest:v1", LATER = "attune:suggest:later";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
export function SuggestCard({ flash }) {
  const [v, setV] = useState(0);
  const idea = useMemo(() => { try { const L = loadLedger(); if (!L) return null; const later = get(LATER, {}), now = Date.now();
    const ideas = findIdeas((L.txns || []).filter((t) => t.type === "expense").map((t) => ({ date: t.date, amount: t.amount, note: t.note })), get(KEY, {}), now);
    return ideas.find((x) => !(later[x.key] > now)) || null; } catch (e) { return null; } }, [v]);
  if (!idea) return null;
  const amt = (+idea.amount).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const yes = () => { const today = new Date(); const start = new Date(today); if (idea.kind === "weekly") { while (start.getDay() !== idea.weekday) start.setDate(start.getDate() + 1); } else { start.setDate(idea.dom); if (start < today) start.setMonth(start.getMonth() + 1); }
    const iso = start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, "0") + "-" + String(start.getDate()).padStart(2, "0");
    saveLife(addCommitment(loadLife(), idea.kind === "weekly" ? { kind: "regular", dir: "out", title: idea.who, person: "", amount: idea.amount, count: 0, total: 0, every: "week", days: [idea.weekday], start: iso, payer: "me", auto: true }
      : { kind: "bill", dir: "out", title: idea.who, person: "", amount: idea.amount, count: 0, total: 0, every: "month", start: iso, payer: "me" }));
    put(KEY, refuse(get(KEY, {}), idea)); flash && flash(tr("Done — I'll ask you on the day")); setV((x) => x + 1); };
  const later = () => { const l = get(LATER, {}); l[idea.key] = Date.now() + 7 * 864e5; put(LATER, l); setV((x) => x + 1); };
  const never = () => { put(KEY, refuse(get(KEY, {}), idea)); setV((x) => x + 1); };
  const n = idea.seen.length, day = idea.kind === "weekly" ? tr(DAYS[idea.weekday]) : null;
  return (
    <div className="rounded-[20px] p-4 space-y-2" style={{ background: "var(--c-surf)", border: "1px solid var(--c-ln)" }} data-testid="home-suggest">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub">{tr("Attune noticed")}</p>
      <p className="m-0 text-[15px] font-extrabold" dir="auto">{idea.kind === "weekly" ? tr("You logged {w} {a} on {d} — {n} weeks in a row", { w: idea.who, a: amt, n, d: day }) : tr("You logged {w} {a} on day {dd} — {n} months in a row", { w: idea.who, a: amt, n, dd: idea.dom })}</p>
      <p className="m-0 text-[13px] c-sub">{idea.kind === "weekly" ? tr("Do it by itself every {d}? I'll only ask “Did it happen?”", { d: day }) : tr("Do it by itself every month? I'll only ask “Did it happen?”")}</p>
      <div className="flex flex-wrap gap-2">
        <button onClick={yes} className="min-h-[40px] px-3.5 rounded-[12px] font-extrabold text-[13px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc, #fff)" }} data-testid="suggest-yes">{idea.kind === "weekly" ? tr("Yes, every {d}", { d: day }) : tr("Yes, every month")}</button>
        <button onClick={later} className="min-h-[40px] px-3.5 rounded-[12px] font-bold text-[13px] border border-[var(--c-acc)] text-[var(--c-acc)]" data-testid="suggest-later">{tr("Not now")}</button>
        <button onClick={never} className="min-h-[40px] px-3.5 rounded-[12px] font-bold text-[13px] bg-[var(--c-surf-2)]" data-testid="suggest-never">{tr("Never")}</button>
      </div>
    </div>);
}
