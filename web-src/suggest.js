/* ---- v9.9.18 AU2 "Attune suggests automations from what you repeat" (Ali picked A — a card on Home). It looks at what the person
   records and finds what REALLY repeats: the same payee on the same weekday for 3+ weeks in a row (the maid 600 every Saturday), the
   same payee on the same day of the month for 3+ months (rent on the 1st), the same app at the same time of the week (talabat on
   Thursday nights, about 450). An amount counts as the same within ±15% of its usual (median) amount. One idea at a time, best first; "No" / "Never" keeps it
   away for good. Pure; tests: tests/suggest (10,000 histories) + tests/unit/v9918suggest.test.mjs.                                */
const DAY = 864e5, WEEK = 7 * DAY;
const norm = (s) => String(s || "").toLowerCase().normalize("NFKC").replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[^\p{L}\p{M}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
const near = (a, usual) => Math.abs(a - usual) <= 0.15 * usual;   // within 15% of the usual amount ("about 450"; a jump of 40% is not the same)
const day0 = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const median = (a) => { const s = [...a].sort((x, y) => x - y), h = Math.floor(s.length / 2); return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };

/** txns: [{ at (ms) | date "YYYY-MM-DD", amount, note | payee, type }]. state: { no: { key: 1 } }. → ideas, best first. */
export function findIdeas(txns = [], state = {}, now = Date.now()) {
  const no = (state && state.no) || {};
  const rows = (txns || []).map((t) => ({ at: t.at || (t.date ? Date.parse(t.date + "T12:00:00") : 0), amount: +t.amount || 0, who: norm(t.payee || t.note || t.what), type: t.type || "expense", time: t.time || null }))
    .filter((r) => r.at > 0 && r.amount > 0 && r.who && r.at <= now && r.at >= now - 400 * DAY).sort((a, b) => a.at - b.at);
  const byWho = {}; for (const r of rows) (byWho[r.who] = byWho[r.who] || []).push(r);
  const ideas = [];
  for (const [who, list] of Object.entries(byWho)) {
    if (list.length < 3) continue;
    // weekly: the same weekday, consecutive weeks, ≥ 3 in a row ending recently, amounts within ±10%
    for (let wd = 0; wd < 7; wd++) {
      const on = list.filter((r) => new Date(r.at).getDay() === wd);
      let run = [], best = [];
      for (const r of on) {
        if (run.length && Math.round((day0(r.at) - day0(run[run.length - 1].at)) / WEEK) === 1 && near(r.amount, median(run.map((x) => x.amount)))) run.push(r);   // ±10% of its usual amount
        else if (run.length && day0(r.at) === day0(run[run.length - 1].at)) continue;
        else run = [r];
        if (run.length >= best.length) best = [...run];
      }
      if (best.length >= 3 && now - best[best.length - 1].at <= 15 * DAY) {
        const key = "weekly:" + who + ":" + wd; if (!no[key]) ideas.push({ key, kind: "weekly", who: list[0].who, label: who, weekday: wd, amount: median(best.map((r) => r.amount)), seen: best.map((r) => r.at), type: best[0].type, score: best.length * 10 + 3 });
      }
    }
    // monthly: the same day of the month (±2), consecutive months, ≥ 3
    const months = []; for (const r of list) { const d = new Date(r.at), m = d.getFullYear() * 12 + d.getMonth(); if (!months.length || months[months.length - 1].m !== m) months.push({ m, r }); }
    let run = [], best = [];
    for (const x of months) {
      if (run.length && x.m - run[run.length - 1].m === 1 && Math.abs(new Date(x.r.at).getDate() - new Date(run[0].r.at).getDate()) <= 2 && near(x.r.amount, median(run.map((y) => y.r.amount)))) run.push(x); else run = [x];
      if (run.length >= best.length) best = [...run];
    }
    if (best.length >= 3 && now - best[best.length - 1].r.at <= 40 * DAY) {
      const key = "monthly:" + who; if (!no[key]) ideas.push({ key, kind: "monthly", who: list[0].who, label: who, dom: new Date(best[0].r.at).getDate(), amount: median(best.map((x) => x.r.amount)), seen: best.map((x) => x.r.at), type: best[0].r.type, score: best.length * 9 });
    }
  }
  // one idea per payee: weekly beats monthly when both
  const seenWho = new Set();
  return ideas.sort((a, b) => b.score - a.score || b.seen.length - a.seen.length).filter((i) => (seenWho.has(i.who) ? false : seenWho.add(i.who)));
}
/** "No" / "Never": that idea never comes back. */
export const refuse = (state, idea) => ({ ...(state || {}), no: { ...((state && state.no) || {}), [idea.key]: 1 } });
/** The rule an accepted idea becomes (rules.js shape): weekly → every <weekday> ask "did it happen?" and log it. */
export function ruleOf(idea) {
  if (idea.kind === "weekly") return { when: { type: "time", at: { h: 9, m: 0 }, days: [idea.weekday] }, if: [], do: [{ type: "ask_log", who: idea.label, amount: idea.amount }], ask: [] };
  if (idea.kind === "monthly") return { when: { type: "time", at: { h: 9, m: 0 }, monthly: true, dom: idea.dom }, if: [], do: [{ type: "ask_log", who: idea.label, amount: idea.amount }], ask: [] };
  return null;
}
