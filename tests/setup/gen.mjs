// v9.9.35 "Set up your life" (Ali: "the extra 7 days … by ACTUALLY completing the setting up … not just very easy steps without actually
// doing anything"). EXACTLY 10,000 different people's data — each step real, missing, or a NEAR MISS that must not count — checked:
//   every step's done / not done, the count, the next step, Free locked after 3, the +7 days only for 6 of 8 really done during the trial
//   (never twice, never after buying, never after the trial), the day it ends, and the salary answer read in English, Arabic and digits.
//     node tests/setup/gen.mjs [count]
const S = await import("../../web-src/setup.js");
const TOTAL = +(process.argv[2] || 10000);
let seed = 35; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 86400000, NOW = Date.parse("2026-11-14T12:00:00"), iso = (t) => new Date(t).toISOString().slice(0, 10);
const IDS = S.STEPS.map((s) => s.id);
const seen = new Set(); let n = 0, bad = 0; const why = {};
const fail = (k, s) => { bad++; (why[k] = why[k] || []).push(s); };
while (n < TOTAL) {
  const want = {}, d = { ledger: { txns: [], recurring: [] }, life: { items: [] }, radar: { items: [] }, reminders: [], agents: { agents: [] }, backup: {} }, sig = [];
  const L = d.ledger, life = d.life.items;
  // each step: real (r), near miss (m), or nothing (x)
  for (const id of IDS) { const k = pick(["r", "r", "m", "x"]); sig.push(id[0] + k); want[id] = k === "r";
    if (id === "salary") { if (k === "r") (rnd() < 0.7 ? L.recurring.push({ type: "income", amount: int(3000, 90000), freq: "monthly", nextDate: iso(NOW + 9 * DAY), active: true }) : life.push({ kind: "regular", dir: "in", amount: int(3000, 50000), every: "month", title: pick(["Salary", "مرتب", "salary CIB"]) }));
      if (k === "m") pick([() => L.txns.push({ type: "income", amount: 18500, date: iso(NOW), cat: "salary" }), () => L.recurring.push({ type: "income", amount: 18500, freq: "monthly", active: false }), () => L.recurring.push({ type: "income", amount: 0, freq: "monthly" }), () => life.push({ kind: "regular", dir: "in", amount: 900, every: "month", title: "Ahmed" })])(); }
    if (id === "bank") { if (k === "r") for (let i = 0; i < int(1, 4); i++) L.txns.push({ type: "expense", amount: int(10, 900), date: iso(NOW - i * DAY), source: "notification" });
      if (k === "m") pick([() => L.txns.push({ type: "expense", amount: 300, date: iso(NOW) }), () => L.txns.push({ type: "expense", amount: 300, date: iso(NOW), source: "import" }), () => L.txns.push({ type: "expense", amount: 0, source: "notification" })])(); }
    if (id === "bills") { if (k === "r") { const c = int(2, 5); for (let i = 0; i < c; i++) rnd() < 0.6 ? life.push({ kind: pick(["bill", "subscription", "rent", "installment"]), dir: "out", amount: int(50, 9000), every: "month", title: "x" + i }) : L.recurring.push({ type: "expense", amount: int(50, 900), freq: "monthly", active: true }); }
      if (k === "m") pick([() => life.push({ kind: "bill", dir: "out", amount: 600, every: "month" }), () => { life.push({ kind: "bill", dir: "out", amount: 600, every: "week" }); life.push({ kind: "bill", dir: "out", amount: 450, every: "week" }); }, () => { life.push({ kind: "bill", dir: "out", amount: 0, every: "month" }); life.push({ kind: "subscription", dir: "out", amount: 0, every: "month" }); }])(); }
    if (id === "people") { if (k === "r") { const dir = pick(["in", "out"]); life.push({ kind: pick(["debt", "installment", "loan", "circle"]), dir, person: pick(["Sheikh", "Ahmed", "سارة"]), amount: int(100, 40000), every: dir === "in" && rnd() < 0.5 ? "month" : null }); }   // (an instalment you pay monthly is a monthly bill too)
      if (k === "m") pick([() => life.push({ kind: "debt", dir: "in", person: "Ahmed", amount: 0 }), () => life.push({ kind: "debt", dir: "in", amount: 500 })])(); }
    if (id === "papers") { if (k === "r") for (let i = 0; i < int(2, 5); i++) d.radar.items.push({ kind: pick(["passport", "id", "licence", "insurance"]), title: "P" + i, date: iso(NOW + int(-30, 900) * DAY) });
      if (k === "m") pick([() => d.radar.items.push({ kind: "passport", title: "Passport", date: iso(NOW + 400 * DAY) }), () => { d.radar.items.push({ title: "A" }); d.radar.items.push({ title: "B" }); }, () => { d.radar.items.push({ title: "A", date: iso(NOW), status: "deleted" }); d.radar.items.push({ title: "B", date: iso(NOW), status: "deleted" }); }])(); }
    if (id === "week") { if (k === "r") rnd() < 0.7 ? d.reminders.push({ id: "r", at: NOW + DAY, repeat: pick(["daily", "weekly", "weekdays", "monthly"]) }) : life.push({ kind: "regular", dir: "out", amount: 600, every: pick(["week", "day"]), title: "Maid" });
      if (k === "m") pick([() => d.reminders.push({ id: "r", at: NOW + DAY, repeat: "none" }), () => d.reminders.push({ id: "r", at: NOW + DAY }), () => d.reminders.push({ id: "r", repeat: "weekly", deleted: true })])(); }
    if (id === "agent") { if (k === "r") d.agents.agents.push({ id: "a", kind: "watch", on: true }); if (k === "m") d.agents.agents.push({ id: "a", kind: "watch", on: false }); }
    if (id === "backup") { if (k === "r") d.backup = { on: true, pw: "pw", last: NOW - int(1, 40) * 3600000 }; if (k === "m") d.backup = pick([{ on: true, pw: "pw", last: 0 }, { on: false, pw: "pw", last: NOW }, { on: true, pw: "", last: NOW }]); }
  }
  const pro = rnd() < 0.6, key = sig.join("") + pro + int(0, 99999); if (seen.has(key)) continue; seen.add(key); n++;
  const st = S.stepState(d), p = S.progress(d, pro), wantDone = IDS.filter((id) => want[id]).length;
  for (const id of IDS) if (st[id].done !== want[id]) fail("step " + id + (want[id] ? " real but not done" : " counted a near miss / nothing"), JSON.stringify(st[id]));
  if (p.done !== wantDone) fail("count", p.done + " ≠ " + wantDone);
  const nextWant = IDS.find((id, i) => !want[id] && (pro || i < 3)) || null;
  if ((p.next ? p.next.id : null) !== nextWant) fail("next step", (p.next && p.next.id) + " ≠ " + nextWant);
  if (!pro && p.steps.slice(3).some((s) => !s.locked)) fail("Free: steps 4–8 not locked", "");
  // TR-3
  const first = NOW - int(0, 12) * DAY, left = Math.max(0, 7 - Math.floor((NOW - first) / DAY)), bought = rnd() < 0.15, given = rnd() < 0.15;
  const due = S.bonusDue({ done: p.done, trial: { first, left, bought }, given }), dueWant = !given && wantDone >= 6 && !bought && left > 0;
  if (due !== dueWant) fail("TR-3 bonus " + JSON.stringify({ done: wantDone, left, bought, given }) + " → " + due, "");
  if (due) { const end = S.bonusEnd(first, NOW); const exp = Math.max(first + 7 * DAY, NOW) + 7 * DAY; if (end !== exp) fail("bonus end", end + " ≠ " + exp); if (end < NOW + 7 * DAY) fail("bonus less than 7 days from now", ""); }
  // the salary answer
  const amt = pick([4500, 12000, 18500, 25000, 32750, 64000]), dd = int(1, 28);
  const sx = pick([`On the ${dd}th, ${amt.toLocaleString("en-US")}`, `${amt} on the ${dd}th`, `salary ${amt} on the ${dd}`, `مرتبي ${amt} يوم ${dd}`, `يوم ${String(dd).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[c])} المرتب ${String(amt).replace(/\d/g, (c) => "٠١٢٣٤٥٦٧٨٩"[c])}`, `the ${dd}th — ${amt}`]);
  const rs = S.readSalary(sx);
  if (!rs || rs.amount !== amt || rs.day !== dd) fail("salary answer", sx + " → " + JSON.stringify(rs));
  else { const r = S.salaryRecurring(rs, NOW); if (r.type !== "income" || r.freq !== "monthly" || r.nextDate < iso(NOW) || +r.nextDate.slice(8) !== dd) fail("salary repeat", JSON.stringify(r));
    if (!S.stepState({ ledger: { recurring: [r] } }).salary.done) fail("the saved salary doesn't count", ""); }
  if (S.readSalary(pick(["the 25th", "18500", "next week", "I don't have a salary"]))) fail("salary read from nothing", "");
}
console.log(`# Set up your life v9.9.35 — ${n} people, ${n - bad} right (${(100 * (n - bad) / n).toFixed(2)}%)`);
for (const [k, v] of Object.entries(why)) console.log(`- ${k.slice(0, 140)} × ${v.length}: ${v.slice(0, 3).join(" · ")}`);
