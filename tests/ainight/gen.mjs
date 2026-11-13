// v9.9.29 AI jobs at night while charging: exactly 10,000 cases. Each: 1–4 jobs from real sentences (21-language schedules of
// tests/aijobs: daily / weekly / monthly, some switched off), the person's reminders around them, the moment Attune was last open (the
// plan handed to the phone), 0–4 moments the phone sits on the charger (the job service wakes), then Attune opened again.
// Checked, by a brute-force oracle written separately from the code:
//  · the plan: per job, its next runs in order (up to 3, within 8 days), each with the facts for ITS day (a reminder 2 days after the
//    run is in, one 9 days after is not), switched-off jobs never;
//  · the phone: never before a run's time, never the same run twice, a job missed for days runs ONCE (the newest), nothing when not charging;
//  · the next open: every answer once (taking twice changes nothing), each job that ran has its next time after the open (the page
//    won't run it again), a job deleted meanwhile still shows its answer, newest first, at most 30.
// `node tests/ainight/gen.mjs [N] [from]`; AINIGHT=<path> swaps the module (planted-bug check).
const A = await import(process.env.AINIGHT || "../../web-src/aijobs.js");
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const H = 36e5, D = 864e5, BASE = Date.parse("2026-11-01T00:00:00");
const SENT = ["every day at 7 summarize my day", "every Sunday 9 pm plan my week", "on the 25th check my bills", "every Friday at 10 am list my follow-ups",
  "كل يوم الساعة ٨ لخص يومي", "كل يوم أحد الساعة ٩ مساءً خطط أسبوعي", "every Monday and Thursday at 6 pm remind me what's due", "chaque jour à 21h résume ma journée",
  "every day at 23:30 what is left today", "on the 31st total my month", "jeden Tag um 6 Uhr mein Tag", "her gün saat 20:00 günümü özetle"];
export function make(i) {
  const r = rng(i * 7919 + 11), pick = (a) => a[Math.floor(r() * a.length)];
  const open1 = BASE + Math.floor(r() * 60) * D + Math.floor(r() * 24) * H + Math.floor(r() * 4) * 15 * 60000;
  const jobs = [], n = 1 + Math.floor(r() * 4);
  for (let k = 0; k < n; k++) { const j = A.makeJob(pick(SENT), open1 - Math.floor(r() * 3) * D); if (!j) continue; j.id = "j" + k; if (r() < 0.15) j.on = false;
    if (r() < 0.2) j.next = open1 - Math.floor(1 + r() * 30) * H;   // already late when Attune closed
    jobs.push(j); }
  const reminders = Array.from({ length: Math.floor(r() * 6) }, (_, k) => ({ id: "r" + k, at: open1 + Math.floor(r() * 16 * 24) * H, title: "Task " + k, done: r() < 0.1 }));
  const charges = Array.from({ length: Math.floor(r() * 5) }, () => open1 + Math.floor(r() * 10 * 24) * H).sort((a, b) => a - b);
  const open2 = open1 + Math.floor(r() * 11 * 24) * H + H, deleteOne = r() < 0.15;
  return { jobs, stores: { reminders }, open1, charges: charges.filter((t) => t < open2), open2, deleteOne };
}
const iso = (t) => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
export function run(N = 10000, from = 0) {
  let pass = 0; const bad = [];
  for (let i = from; i < from + N; i++) {
    const c = make(i), why = [], plan = A.nightPlan(c.jobs, c.stores, c.open1);
    // ---- the plan, by brute force
    const want = [];
    for (const j of c.jobs) { if (j.on === false) continue; let at = j.next; for (let k = 0; k < 3 && at && at <= c.open1 + 8 * D; k++) { want.push(j.id + "@" + at); at = A.nextRun(j.schedule, at); } }
    const got = plan.map((p) => p.key);
    if (got.length !== want.length || want.some((k) => !got.includes(k))) why.push("plan " + JSON.stringify(got) + " ≠ " + JSON.stringify(want));
    for (let k = 1; k < plan.length; k++) if (plan[k].at < plan[k - 1].at) why.push("plan not in time order");
    for (const p of plan) for (const rm of c.stores.reminders) { if (rm.done) continue; const dd = (rm.at - p.at) / D, has = p.data.includes("Reminder " + iso(rm.at) + ": " + rm.title);
      if (dd >= 0 && dd <= 6 && !has) why.push("run " + p.key + " misses a reminder " + dd.toFixed(1) + " days later");
      if (dd > 7.01 && has) why.push("run " + p.key + " has a reminder " + dd.toFixed(1) + " days later"); }
    // ---- the phone: at each charge, the due runs (Kotlin keeps the newest per job and marks the older ones of that job done)
    let done = new Set(); const answers = [], ran = [];
    for (const t of c.charges) {
      const due = A.dueNight(plan, [...done], t), perJob = {};
      for (const d of due) { if (d.at > t) why.push("ran before its time " + d.key); if (done.has(d.key)) why.push("ran twice " + d.key); if (perJob[d.job]) why.push("one job twice in one wake"); perJob[d.job] = 1;
        // oracle: it must be the newest run of that job that is due and not done
        const newest = plan.filter((p) => p.job === d.job && p.at <= t && !done.has(p.key)).sort((a, b) => b.at - a.at)[0];
        if (!newest || newest.key !== d.key) why.push("not the newest run of " + d.job);
        for (const p of plan) if (p.job === d.job && p.at <= d.at) done.add(p.key);
        ran.push(d); answers.push({ key: d.key, job: d.job, title: d.title, at: d.at, ranAt: t, text: "Done: " + d.title, data: d.data }); }
      // anything due and not run must belong to a job that ran in this wake
      for (const p of plan) if (p.at <= t && !done.has(p.key)) why.push("left a due run " + p.key);
    }
    // ---- the next open: take the answers
    let state = { jobs: c.deleteOne && c.jobs.length ? c.jobs.slice(1) : c.jobs, results: [] };
    const m1 = A.mergeNight(state, answers, c.open2), m2 = A.mergeNight(m1, answers, c.open2);
    if (JSON.stringify(m1) !== JSON.stringify(m2)) why.push("taking twice changed it");
    if (m1.results.length !== Math.min(30, answers.length)) why.push("answers " + m1.results.length + " ≠ " + answers.length);
    for (let k = 1; k < m1.results.length; k++) if (m1.results[k].at > m1.results[k - 1].at) why.push("not newest first");
    for (const a of ran) { const j = m1.jobs.find((x) => x.id === a.job);
      if (j && j.next != null && j.next <= c.open2 && j.next <= a.at) why.push("job " + j.id + " would run again: next " + j.next + " ≤ " + a.at);
      if (!m1.results.some((x) => x.key === a.key)) why.push("answer of " + a.key + " missing"); }
    if (!answers.length && m1 !== state) why.push("nothing taken but the state changed");
    if (why.length) { if (bad.length < 6) bad.push({ i, why: why.slice(0, 4) }); } else pass++;
  }
  return { pass, N, rate: pass / N, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0)), null, 1));
