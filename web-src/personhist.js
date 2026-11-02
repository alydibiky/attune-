/* ---- v9.0 (Ali, 2 Nov: "for the people page, I want to open each person's history by pressing on him"): everything with one
   person, by code — every plan with them (both ways, finished ones too), each loan and each payment as a dated line, the Money
   entries that name them (not the ones a tick already made), and the sums: owes you, you owe, got back, you paid back.
   Pure: stores in, history out. Test: tests/unit/v906personhist.test.mjs. */
import { progressOf, scheduleOf } from "./life.js";

const fold = (s) => String(s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/[ًٌٍَُِّْـ]/g, "").toLowerCase().trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const said = (text, names) => { const t = " " + fold(text).replace(/[^\p{L}\p{N}]+/gu, " ") + " "; return names.some((n) => n && t.includes(" " + n + " ")); };

/** → { name, plans: [{ c, pr }], events: [{ date, kind, amount, cur, text, plan? }], owesYou, youOwe, gotBack, paidBack, cur } */
export function personHistory(name, { life, ledger } = {}, { aliases = [], now = Date.now() } = {}) {
  const names = [...new Set([name, ...aliases].map(fold).filter(Boolean))];
  const plans = ((life && life.items) || []).filter((c) => c.person && names.includes(fold(c.person))).map((c) => ({ c, pr: progressOf(c, now) }));
  const events = []; let owesYou = 0, youOwe = 0, gotBack = 0, paidBack = 0, cur = "";
  for (const { c, pr } of plans) {
    cur = cur || c.currency || "";
    const total = c.total || (c.count > 0 ? c.amount * c.count : c.amount) || 0, inn = c.dir === "in";
    if (inn) { owesYou += pr.left || 0; gotBack += pr.paidAmount || 0; } else { youOwe += pr.left || 0; paidBack += pr.paidAmount || 0; }
    const start = c.start || (c.created ? new Date(c.created).toISOString().slice(0, 10) : "");
    events.push({ date: start, kind: inn ? "lent" : "borrowed", amount: total, cur: c.currency || "", plan: c.id, text: c.title || "" });
    for (const s of scheduleOf(c, now)) if (s.paid) events.push({ date: s.date, kind: inn ? "paid-in" : "paid-out", amount: s.amount, cur: c.currency || "", plan: c.id });
  }
  // Money entries that name them — a tick's own entry ("Ahmed — installment 3 of 12") is already a payment above
  const tickNote = new RegExp("^(" + names.map(esc).join("|") + ")\\s+—\\s+", "u");
  for (const t of ((ledger && ledger.txns) || [])) {
    if (!t || !(t.type === "expense" || t.type === "income") || !said([t.note, t.party, t.title].filter(Boolean).join(" "), names)) continue;
    if (plans.length && tickNote.test(fold(t.note))) continue;
    events.push({ date: t.date || "", kind: t.type === "income" ? "money-in" : "money-out", amount: +t.amount || 0, cur: t.currency || (ledger && ledger.currency) || cur, text: String(t.note || "").slice(0, 90) });
  }
  events.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return { name, plans, events, owesYou: Math.round(owesYou), youOwe: Math.round(youOwe), gotBack: Math.round(gotBack), paidBack: Math.round(paidBack), cur };
}
