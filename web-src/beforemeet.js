/* ---- v9.9.23 B5 P2 "before you meet" (Ali picked B: three lines in the notification). One hour before a reminder that names ONE
   person ("Meeting Sheikh 16:00", "Call Mona", «اقابل أحمد كمال») the phone shows what is still open with that exact person — in the
   notification itself, readable in five seconds: what they owe / you owe (and how many payments are in), an open promise, then the
   latest note or message. Never a paid debt or a kept promise; never another person's thing; when the name could be two people
   ("Ahmed" with two Ahmeds) nothing is sent rather than the wrong person's. Nothing open → no notification.
   Pure (stores in; the words through tr). Tests: tests/p2/gen.mjs (10,000 meetings) + tests/unit/v9923p2.test.mjs. */
import { mentions } from "./entities.js";
import { personSections } from "./personpage.js";
import { nextOccurrence } from "./actions.js";
import { tr } from "./i18n.js";
const HOUR = 36e5, WEEK = 7 * 864e5;
const n0 = (v) => Math.round(v).toLocaleString("en-US");
const short = (s, n = 60) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
/** The one person a reminder names for sure (null when none, or when the name could be two people). */
export function personOf(title, dir) {
  const ids = new Set(); for (const m of mentions(title, dir)) { if (m.ids.length !== 1) return null; ids.add(m.ids[0]); }
  if (ids.size !== 1) return null; return (dir.items || []).find((p) => p.id === [...ids][0]) || null;
}
/** The three lines for that person (only sure, still-open things). */
export function linesFor(p, stores, dir) {
  const S = personSections(p, stores, dir), sure = (k) => ((S.sections.find((s) => s.key === k) || { items: [] }).items).filter((x) => !x.maybe), out = [];
  for (const x of sure("money")) if (x.src === "followups" && x.left > 0) {
    const part = x.count > 1 ? " " + tr("({p} of {n} paid)", { p: x.paidCount, n: x.count }) : "";
    out.push((x.sign > 0 ? tr("Owes you {a}", { a: n0(x.left) }) : tr("You owe {a}", { a: n0(x.left) })) + part); }
  for (const x of sure("promises")) if (x.src === "followups" || x.src === "todo") out.push(tr("Open: {t}", { t: short(x.src === "followups" ? x.title.replace(/^[^·]+ · /, "") : x.title) }));   // (without "Sheikh · ")
  const last = [...sure("notes"), ...sure("messages")].sort((a, b) => b.ts - a.ts)[0];
  if (last) out.push(last.src === "messages" ? tr("Last message: {t}", { t: short(last.text || last.title) }) : tr("Note: {t}", { t: short(last.title) }));
  return out.slice(0, 3);
}
const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
/** reminders → the "before you meet" notifications for the next week: [{ id: "meet-<id>", at, title, body, who, lines }]. */
export function beforeMeet(reminders = [], stores = {}, dir = { items: [] }, now = Date.now()) {
  const out = [];
  for (const r of reminders || []) {
    if (!r || r.done || !r.id || String(r.id).startsWith("meet-")) continue;
    const at = nextOccurrence(r, now); if (!at || at - HOUR <= now || at > now + WEEK) continue;
    const title = String(r.title || r.text || ""), p = personOf(title, dir); if (!p) continue;
    const lines = linesFor(p, stores, dir); if (!lines.length) continue;
    out.push({ id: "meet-" + r.id, at: at - HOUR, title: tr("In 1 hour: {t} · {h}", { t: short(title, 50), h: hm(at) }), body: lines.map((l) => "• " + l).join("\n"), who: p.id, lines });
  }
  return out;
}
