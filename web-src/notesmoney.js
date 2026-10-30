/* ---- v8.8 (Ali, 30 Oct: "make the code also read the notes I write — in the Shelf or in notes — when I am putting an expense or
   an income"): a note you write that says money moved ("paid Ahmed 300 for the sink", «دفعت للسباك ٣٠٠», "got 2,000 from Hany")
   is read by the same code as Home's box (yusr/logtext.js readLocal) and waits in Money as one tap — "Add" or "Not money". Never
   added by itself; never twice (an entry of the same amount within 3 days of the note is already it).
   Pure; tests: tests/unit/v880notesmoney.test.mjs. The card: notes-money-ui.jsx.                                            */
import { readLocal } from "./yusr/logtext.js";

const MONEY_VERB = /\b(spent|spend|paid|pay|bought|buy|cost|costs|received|got paid|got|earned|refund|sold|transferred|sent|lent|gave|da3et|dafa3t|dafa3et|saraft|shtaret|eshtaret|2abadt|abadt)\b|صرفت|دفعت|اديت|إديت|اشتريت|بكام|قبضت|استلمت|حولت|جالي|اخدت|خدت|سلفت|بعت/i;
const iso = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const NOTES_DONE_KEY = "attune:notesmoney:done";
/** → [{ id, recId, when, text (the note's line), item: { type, amount, cat, note, date } }], newest first (≤ 12). */
export function moneyFromNotes(records, ledger, { now = Date.now(), days = 60, done = [] } = {}) {
  const txns = (ledger && ledger.txns) || [], skip = new Set(done), out = [];
  const dayMs = (s) => Date.parse(s + "T12:00:00") || 0;
  for (const r of records || []) {
    if (!r || !r.ts || now - r.ts > days * 864e5 || r.ts > now + 864e5) continue;
    if (!(r.kind === "note" || (r.meta && r.meta.book)) || (r.output && String(r.output).trim()) || (r.meta && (r.meta.trashed || r.meta.todo))) continue;
    // each line of the note on its own ("paid the plumber 300" / "groceries 450")
    const lines = String([r.title !== r.text ? r.title : "", r.text].filter(Boolean).join("\n")).split(/\n+/).map((x) => x.trim()).filter(Boolean);
    lines.forEach((line, li) => {
      if (!MONEY_VERB.test(line) || !/[\d٠-٩]/.test(line)) return;
      let items = []; try { items = readLocal(line, { today: iso(r.ts) }).items.filter((x) => x.amount >= 1); } catch (e) { items = []; }
      items.forEach((it, k) => {
        const id = "note:" + r.id + ":" + li + ":" + k; if (skip.has(id)) return;
        const date = iso(r.ts);
        const there = txns.some((t) => t && Math.abs((+t.amount || 0) - it.amount) < 0.01 && Math.abs(dayMs(t.date) - dayMs(date)) <= 3 * 864e5);
        if (there) return;
        out.push({ id, recId: r.id, when: r.ts, text: line.slice(0, 140), item: { type: it.type || "expense", amount: it.amount, cat: it.cat || "other", note: (it.note || line).slice(0, 80), date } });
      });
    });
  }
  return out.sort((a, b) => b.when - a.when).slice(0, 12);
}
