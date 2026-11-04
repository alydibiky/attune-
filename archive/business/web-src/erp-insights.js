/* ---- v6.44 Business builder: Insights for ANY system (templates and AI-designed alike) — read from what the Pro layer
   finds (erp-pro.js rules), never from the table names alone:
   - the trend: what was charged (sales, visits, rent, subscriptions…) each of the last 6 months, and the change;
   - the top customers / patients / tenants of the year by what they were charged;
   - every Status column: how many records are in each state;
   - bookings: how many days of this month each asset (unit, truck, room…) is booked → its utilisation;
   - stock: the value on hand at cost, and how many items are low.
   Pure. Tests: tests/unit/v744templates.test.mjs.                                                                      */
import * as E from "./erp.js";
import * as P from "./erp-pro.js";

const DAY = 86400000;
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => (typeof v === "number" && isFinite(v) ? v : v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null);
const tOf = (sys, tid) => sys.tables.find((t) => t.id === tid);
const rowsOf = (sys, tid) => (sys.rows[tid] || []).filter((r) => !r._del).map((r) => E.computeRow(tOf(sys, tid), r));
const ymShift = (ym, n) => { const d = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
const dayN = (iso) => Math.floor(Date.parse(String(iso).slice(0, 10) + "T00:00:00Z") / DAY);

export function insights(sys, today = new Date().toISOString().slice(0, 10)) {
  const R = P.rules(sys), ym = today.slice(0, 7), year = today.slice(0, 4);
  const months = Array.from({ length: 6 }, (_, i) => ymShift(ym, i - 5));
  // ---- the trend and the top parties (charges of customer-side parties, linked directly)
  const trend = Object.fromEntries(months.map((m) => [m, 0])), top = new Map();
  for (const p of R.parties.filter((x) => !x.supplier)) {
    const pt = tOf(sys, p.tid);
    for (const c of p.charges) {
      if (!c.date) continue;
      for (const r of rowsOf(sys, c.tid)) {
        const a = num(r[c.amount]), d = String(r[c.date] || ""); if (a == null || !d) continue;
        if (trend[d.slice(0, 7)] != null) trend[d.slice(0, 7)] = r2(trend[d.slice(0, 7)] + a);
        if (d.slice(0, 4) === year && !c.via && r[c.link]) {
          const pr = (sys.rows[p.tid] || []).find((x) => x._id === r[c.link]); if (!pr) continue;
          const k = p.tid + ":" + pr._id, cur = top.get(k) || { name: E.displayOf(pt, pr), table: pt.name, total: 0, count: 0 };
          cur.total = r2(cur.total + a); cur.count++; top.set(k, cur);
        }
      }
    }
  }
  const series = months.map((m) => ({ ym: m, total: trend[m] }));
  const last = series[5].total, prev = series[4].total;
  // ---- statuses
  const statuses = [];
  for (const t of sys.tables) {
    const f = t.fields.find((x) => x.type === "choice" && /^(status|state|الحالة|حالة)$/i.test(x.name)); if (!f) continue;
    const rows = rowsOf(sys, t.id); if (!rows.length) continue;
    const counts = {}; for (const r of rows) { const v = r[f.id] || "—"; counts[v] = (counts[v] || 0) + 1; }
    statuses.push({ table: t.name, tid: t.id, counts: (f.options || []).filter((o) => counts[o]).map((o) => ({ value: o, n: counts[o] })).concat(counts["—"] ? [{ value: "—", n: counts["—"] }] : []), total: rows.length });
  }
  // ---- bookings: days of this month each asset is booked
  const mStart = dayN(ym + "-01"), mEnd = dayN(ymShift(ym, 1) + "-01") - 1, mDays = mEnd - mStart + 1;
  const usage = [];
  for (const b of R.bookings) {
    const t = tOf(sys, b.tid), linkF = t.fields.find((x) => x.id === b.link), at = linkF && tOf(sys, linkF.link); if (!at) continue;
    const byAsset = new Map();
    for (const r of rowsOf(sys, b.tid)) {
      if (b.status && /cancel|ملغ/i.test(String(r[b.status] || ""))) continue;
      const a = r[b.link], s = r[b.start], e = r[b.end] || r[b.start]; if (!a || !s) continue;
      const x = Math.max(mStart, dayN(s)), y = Math.min(mEnd, dayN(e)); if (x > y) continue;
      const set = byAsset.get(a) || new Set(); for (let d = x; d <= y; d++) set.add(d); byAsset.set(a, set);
    }
    const rows = (sys.rows[at.id] || []).filter((r) => !r._del).map((r) => { const n = (byAsset.get(r._id) || new Set()).size; return { name: E.displayOf(at, r), days: n, pct: Math.round((n / mDays) * 100) }; });
    if (rows.length) usage.push({ table: t.name, assets: at.name, rows: rows.sort((a, b) => b.pct - a.pct), avg: Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) });
  }
  // ---- stock value at cost
  const stock = [];
  for (const s of R.stock) {
    const items = tOf(sys, s.items), cost = items.fields.find((x) => (x.type === "money" || x.type === "number") && /cost|تكلفة|سعر الشراء/i.test(x.name));
    const lv = P.stockLevels(sys, s);
    const value = cost ? r2(lv.reduce((n, x) => n + Math.max(0, x.onHand) * (num(x.row[cost.id]) || 0), 0)) : null;
    stock.push({ table: items.name, items: lv.length, low: lv.filter((x) => x.low && x.tracked).length, value });
  }
  return { series, change: prev ? Math.round(((last - prev) / prev) * 100) : null, thisMonth: last,
    top: [...top.values()].sort((a, b) => b.total - a.total).slice(0, 5), statuses, usage, stock };
}
