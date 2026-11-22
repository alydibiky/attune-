// v10.8 (Ali, 22 Nov 2026: "U never fix it for good, I want something final … and then what's the use of AI if it didn't do anything").
// Home's box read money sentences with code only — the model on his phone was never asked. Now:
//   1. code reads the sentence and saves at once (as before — fast, works with no model);
//   2. when the code was NOT SURE (the category is Others, or the note is nearly the whole sentence, or he has his own categories and
//      none was picked), the model reads the same sentence with HIS category list, in the background;
//   3. code checks the model's answer before using it: the category must be one of his, the amount must be the one he wrote, the note's
//      words must come from his sentence — so the model can't invent a category, a number or a word. A change says so, with Undo.
import { CAT_NAMES } from "./money-report.js";
import { normText, skeleton } from "./moneycat.js";

const BUILT = ["food", "groceries", "transport", "bills", "rent", "shopping", "health", "fun", "coffee", "gifts", "home", "salary", "other"];
/** The categories the model may pick: his own first, then the built-in ones → [{ id, name }]. */
export function catList(ledger) {
  const own = ((ledger && ledger.customCats) || []).map((c) => ({ id: c.id, name: [c.en, c.ar, c.name].filter(Boolean).join(" / ") || c.id, own: true }));
  const base = BUILT.map((id) => ({ id, name: (CAT_NAMES[id] || [id]).filter(Boolean).join(" / ") }));
  return [...own, ...base.filter((b) => !own.some((o) => o.id === b.id))];
}
const words = (s) => normText(s).toLowerCase().split(/[\s,،.;:!?؟()"'«»“”—–-]+/).filter(Boolean);
/** Was the code not sure about this item? */
export function needsCheck(item, text, ledger) {
  if (!item || item.type === "transfer") return false;
  const W = words(text), N = words(item.note);
  const ownCats = ((ledger && ledger.customCats) || []).map((c) => c.id);
  if (!item.cat || item.cat === "other") return true;                                     // Others = the code didn't know
  if (W.length >= 5 && N.length >= W.length - 1) return true;                            // the note is (nearly) the whole sentence
  if (/\b(?:expense|spent|paid|under|category)\b|مصروف|صرفت|دفعت|تحت|بند/i.test(String(item.note || ""))) return true;   // money / category words left in the note
  if (ownCats.length && !ownCats.includes(item.cat) && /\b(?:under|category|in|for)\b|تحت|بند|في|على|ل/i.test(text)) return true;   // he has his own categories and one may be named
  return false;
}
/** The question to the model: one JSON line, nothing else. */
export function prompt(text, ledger, items) {
  const cats = catList(ledger);
  return `A person wrote this to log money:
"${String(text).slice(0, 400)}"
It was saved as: ${items.map((x) => `${x.type} ${x.amount}`).join("; ")}.
Pick each item's category from THIS LIST ONLY (use the id; the person's own categories come first — if the sentence names one of them, in any spelling or language, pick it):
${cats.map((c) => `- ${c.id}: ${c.name}`).join("\n")}
and a short note (2–6 words copied from the sentence) saying WHAT it was — not the amount, not the currency, not the category, not words like "expense" or "under".
Reply with only JSON: {"items":[{"amount":${items[0] ? items[0].amount : 0},"cat":"<id>","note":"<words from the sentence>"}]}`;
}
/** Check the model's reply against the sentence → [{ i, cat, note }] for the items it may change (empty when nothing safe). */
export function verify(raw, text, ledger, items) {
  let j = null; try { const m = String(raw || "").match(/\{[\s\S]*\}/); j = m ? JSON.parse(m[0]) : null; } catch (e) { j = null; }
  if (!j || !Array.isArray(j.items)) return [];
  const ids = new Set(catList(ledger).map((c) => c.id));
  const said = new Set(words(text).map((w) => skeleton(w) || w)), saidRaw = new Set(words(text));
  const out = [], used = new Set();
  for (const x of j.items.slice(0, 10)) {
    const amount = Number(x && x.amount);
    const i = items.findIndex((it, k) => !used.has(k) && it.amount === amount);
    if (i < 0) continue;                                                                   // an amount he didn't write: ignored
    const cat = String((x && x.cat) || ""), noteW = words(x && x.note);
    if (!ids.has(cat)) continue;                                                           // a category that isn't his or built-in: ignored
    // the note: only words from his sentence (any spelling of them), no digits, 1–8 words
    const noteOk = noteW.length >= 1 && noteW.length <= 8 && noteW.every((w) => !/\d/.test(w) && (saidRaw.has(w) || said.has(skeleton(w) || w)));
    const note = noteOk ? String(x.note).trim().replace(/\s+/g, " ").slice(0, 80) : items[i].note;
    used.add(i);
    if (cat !== items[i].cat || note !== items[i].note) out.push({ i, cat, note });
  }
  return out;
}
