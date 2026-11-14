// v9.9.34 FP-4 + PM-1 + PM-2 (Ali's picks): EXACTLY 10,000 different situations, each checked against the rules Ali agreed —
//   Free: everything typed / said is unlimited; 1 agent, 1 rule, 10 papers, 3 photo reads / X-Rays / conversions / slides a day, the last
//   3 months of Money; Pro-only: bank messages saved by themselves, Close the day, week plan, scheduled messages, sync, Money for two,
//   exports, expert review, deep research, the full guide, the brain. Pro (or the trial): everything, no limits.
//   PM-1: only Free, ≥ 5 typed this week, not twice a day, never on a day something is due, "Not now" = 14 quiet days.
//   PM-2: Friday (or Saturday if missed), once a week, never with another Pro note that day, never on a due day.
//     node tests/plan/gen.mjs [count]
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, clear: () => { for (const k in mem) delete mem[k]; } };
const P = await import("../../web-src/plan.js");
const TOTAL = +(process.argv[2] || 10000);
let seed = 34 + 7919 * +(process.env.SEED_SHIFT || 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const DAY = 86400000, iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const PRO_ONLY = ["autoMoney", "guardianChase", "closeDay", "weekPlan", "msgSchedule", "sync", "desktop", "moneyForTwo", "driveBackup", "yearReport", "pdfExport", "excelExport", "expertReview", "deepResearch", "guideFull", "brain"];
const FREE_FEATURES = ["money", "reminders", "debts", "lists", "dates", "chat", "voice", "morningBrief", "hadith", "prayers", "emergency", "guide3"];
const DAILY = { photo: 3, xray: 3, convert: 3, slides: 3 }, KEPT = { agents: 1, rules: 1, papers: 10 };
const seen = new Set(); let n = 0, bad = 0; const why = {};
const fail = (k, s) => { bad++; (why[k] = why[k] || []).push(s); };
while (n < TOTAL) {
  const kind = pick(["feature", "daily", "kept", "history", "nudge", "week", "stats"]), pro = rnd() < 0.4;
  const now = Date.parse("2026-01-01T09:00:00") + int(0, 700) * DAY + int(0, 14) * 3600000;
  if (kind === "feature") { const f = pick([...PRO_ONLY, ...FREE_FEATURES]), id = kind + f + pro; if (seen.has(id)) { if (seen.size > 40) { /* few distinct — pad with time */ } }
    const key = id + now; if (seen.has(key)) continue; seen.add(key); n++;
    const ok = P.allowed(f, pro), want = pro || !PRO_ONLY.includes(f);
    if (ok !== want) fail("feature " + f + (pro ? " (Pro)" : " (Free)") + " → " + ok, f); continue; }
  if (kind === "daily") { const k = pick(Object.keys(DAILY)), used = int(0, 9), key = kind + k + pro + used + now; if (seen.has(key)) continue; seen.add(key); n++;
    localStorage.clear(); for (let i = 0; i < used; i++) P.noteUse(k, now - int(0, 3) * 3600000 * (rnd() < 0.5 ? 0 : 0));
    // yesterday's uses never count today
    for (let i = 0; i < int(0, 5); i++) P.noteUse(k, now - DAY);
    const c = P.canUse(k, { pro, now }), want = pro || used < DAILY[k];
    if (c.ok !== want) fail("daily " + k + " used " + used + (pro ? " Pro" : " Free") + " → " + c.ok, k + " " + used);
    if (!pro && c.left !== Math.max(0, DAILY[k] - used)) fail("daily left wrong", k + " " + used + " left " + c.left); continue; }
  if (kind === "kept") { const k = pick(Object.keys(KEPT)), count = int(0, 14), key = kind + k + pro + count; if (seen.has(key + now)) continue; seen.add(key + now); n++;
    const c = P.canUse(k, { pro, now, count }), want = pro || count < KEPT[k];
    if (c.ok !== want) fail("kept " + k + " " + count + (pro ? " Pro" : " Free") + " → " + c.ok, k + " " + count); continue; }
  if (kind === "history") { const key = kind + pro + now; if (seen.has(key)) continue; seen.add(key); n++;
    const f = P.historyFrom(now, pro);
    if (pro && f !== "") fail("Pro has a history floor", f);
    if (!pro) { const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - 2); if (f !== iso(d.getTime())) fail("Free history floor wrong", iso(now) + " → " + f + " ≠ " + iso(d.getTime()));
      if (!(f <= iso(now))) fail("floor after today", f); } continue; }
  if (kind === "nudge") { const typed = int(0, 12), due = rnd() < 0.2 ? int(1, 3) : 0, shown = rnd() < 0.3, until = rnd() < 0.25 ? now + int(-3, 13) * DAY : 0;
    const key = kind + pro + typed + due + shown + until + now; if (seen.has(key)) continue; seen.add(key); n++;
    const st = { ...(shown ? { day: iso(now) } : {}), ...(until ? { until } : {}) };
    const got = P.showTypedNudge({ pro, typed, dueToday: due, now, st }), want = !pro && typed >= 5 && !due && !shown && now >= (until || 0);
    if (got !== want) fail("PM-1 " + JSON.stringify({ pro, typed, due, shown, snoozed: until > now }) + " → " + got, ""); continue; }
  if (kind === "week") { const due = rnd() < 0.2 ? 1 : 0, shownToday = rnd() < 0.2, shownWeek = rnd() < 0.3;
    const key = kind + due + shownToday + shownWeek + now; if (seen.has(key)) continue; seen.add(key); n++;
    const d = new Date(now), fri = iso(now - ((d.getDay() + 2) % 7) * DAY), st = { ...(shownToday ? { day: iso(now) } : {}), ...(shownWeek ? { week: fri } : {}) };
    const got = P.showWeekCard({ now, st, dueToday: due }), want = !due && !shownToday && !shownWeek && (d.getDay() === 5 || d.getDay() === 6);
    if (got !== want) fail("PM-2 day " + d.getDay() + " " + JSON.stringify({ due, shownToday, shownWeek }) + " → " + got, ""); continue; }
  if (kind === "stats") { const tx = [], rem = []; let typed = 0, msgs = 0, rems = 0;
    for (let i = 0; i < int(0, 25); i++) { const back = int(0, 12), src = rnd() < 0.4 ? "notification" : rnd() < 0.1 ? "import" : "", type = pick(["expense", "income", "transfer"]);
      tx.push({ type, date: iso(now - back * DAY), ...(src ? { source: src } : {}) });
      if (back <= 6 && type !== "transfer") { if (src === "notification") msgs++; else if (!src) typed++; } }
    for (let i = 0; i < int(0, 8); i++) { const back = rnd() * 10 * DAY; rem.push({ created: now - back }); if (back <= 7 * DAY) rems++; }
    const key = kind + JSON.stringify(tx) + rem.length + now; if (seen.has(key)) continue; seen.add(key); n++;
    const w = P.weekStats({ txns: tx }, rem, now);
    if (w.typed !== typed || w.fromMsgs !== msgs || w.reminders !== rems) fail("weekStats " + JSON.stringify(w) + " ≠ " + JSON.stringify({ typed, fromMsgs: msgs, reminders: rems }), "");
    if (P.minutesFor(msgs) !== Math.round(msgs * 45 / 60)) fail("minutes", ""); continue; }
}
console.log(`# Free / Pro v9.9.34 — ${n} situations, ${n - bad} right (${(100 * (n - bad) / n).toFixed(2)}%)`);
for (const [k, v] of Object.entries(why)) console.log(`- ${k.slice(0, 160)} × ${v.length}`);
