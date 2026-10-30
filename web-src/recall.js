/* ---- v6.38 (upgrade D3) — Mind brings things back by itself. When a person you have records about comes up — a message from
   Ahmed shared to Instant, his chat in Chat X-Ray, his name typed on Home — Attune shows what it already knows: what he
   promised (Chat X-Ray), what he owes you or you owe him (People & plans, Money's debts) and your notes that mention him (Mind).
   Code only, nothing leaves the phone. Pure; tests/unit/v740recall.test.mjs.                                              */
import { tr } from "./i18n.js";
import { progressOf } from "./life.js";

const fold = (s) => String(s || "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة(?=\s|$)/g, "ه").replace(/[ً-ْ]/g, "").toLowerCase().trim();
const num = (v) => (Math.round(v * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });
const isAr = (s) => /[؀-ۿ]/.test(s);
const word = (name) => { const n = fold(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); return new RegExp("(?:^|[^\\p{L}\\p{N}])" + n + "(?=$|[^\\p{L}\\p{N}])", "u"); };

/** Everyone Attune has records about: [{ name, srcs }] (names of 3+ letters). */
export function knownPeople(s = {}) {
  const by = new Map();
  const add = (n, src) => { const k = fold(n); if (k.length < 3) return; const e = by.get(k) || { name: String(n).trim(), srcs: new Set() }; e.srcs.add(src); by.set(k, e); };
  for (const c of (s.life && s.life.items) || []) if (c.person) add(c.person, "life");
  for (const d of (s.ledger && s.ledger.debts) || []) if (d.person) add(d.person, "money");
  for (const a of s.xray || []) { for (const x of a.items || []) { const w = x.from || x.author; if (w && w !== a.me && x.type === "promise") add(w, "xray"); } }
  return [...by.values()].map((e) => ({ name: e.name, srcs: [...e.srcs] }));
}

/**
 * → [{ person, items: [{ what, src, date }] }] for the known people named in `text` (at most 2 people, 4 things each).
 *   src = the page that owns it: xray | life | money | memory.
 */
export function recallFor(text, s = {}, now = Date.now()) {
  const t = fold(text); if (t.length < 3) return [];
  const people = knownPeople(s).filter((p) => word(p.name).test(t)).slice(0, 2);
  const ar = isAr(text);
  return people.map((p) => {
    const k = fold(p.name), same = (n) => fold(n) === k, items = [];
    for (const a of s.xray || []) {
      const pays = (a.items || []).filter((x) => x.type === "paid");
      for (const pr of (a.items || []).filter((x) => x.type === "promise" && same(x.from || x.author))) {
        if (pays.some((x) => same(x.from || x.author) && x.t >= pr.t && (pr.amount == null || x.amount == null || Math.abs(x.amount - pr.amount) < 0.01))) continue;
        const late = pr.due && pr.due < new Date(now).toISOString().slice(0, 10);
        items.push({ src: "xray", date: pr.due || "", what: (ar ? (late ? "وعد ومعملش: " : "وعد: ") : (late ? "Promised, not kept: " : "Promised: ")) + (pr.what || (pr.amount ? num(pr.amount) : "")) + (pr.due ? (ar ? " — يوم " : tr(" — by ")) + pr.due : "") });
      }
    }
    for (const c of ((s.life && s.life.items) || []).filter((c) => same(c.person))) {
      const g = progressOf(c, now); if (g.left != null && g.left <= 0) continue;
      const left = g.left != null ? num(g.left) + " " + (c.currency || "") : num(c.amount) + " " + (c.currency || "");
      const today = new Date(now).toISOString().slice(0, 10), late = g.next && g.next.date < today;
      const when = !g.next ? "" : late ? (ar ? ` — دفعة متأخرة من ${g.next.date}` : ` — a payment late since ${g.next.date}`) : (ar ? ` — الدفعة الجاية ${g.next.date}` : ` — next payment ${g.next.date}`);
      items.push({ src: "life", date: g.next ? g.next.date : "", what: (c.dir === "in" ? (ar ? `عليه ليك ${left}` : `Owes you ${left}`) : (ar ? `عليك له ${left}` : `You owe ${left}`)) + when });
    }
    for (const d of ((s.ledger && s.ledger.debts) || []).filter((d) => !d.settled && same(d.person))) {
      const left = (+d.amount || 0) - (d.payments || []).reduce((a, x) => a + (+x.amount || 0), 0); if (left <= 0.004) continue;
      items.push({ src: "money", date: d.dueDate || "", what: (d.type === "owed_to_me" ? (ar ? "عليه ليك " : tr("Owes you ")) : (ar ? "عليك له " : tr("You owe "))) + num(left) + (d.currency ? " " + d.currency : "") + (d.dueDate ? (ar ? ` — ميعاده ${d.dueDate}` : ` — due ${d.dueDate}`) : "") });
    }
    const notes = (s.memory || []).filter((r) => word(p.name).test(fold([r.title, r.text].join(" ")))).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
    for (const r of notes) items.push({ src: "memory", date: r.ts ? new Date(r.ts).toISOString().slice(0, 10) : "", what: (ar ? "ملاحظة: " : tr("Note: ")) + String(r.title || r.text || "").replace(/\s+/g, " ").slice(0, 90) });
    return { person: p.name, items: items.slice(0, 4) };
  }).filter((x) => x.items.length);
}
