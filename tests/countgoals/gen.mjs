// v9.9.38 CG-3 + BK-2 (Ali's picks) — EXACTLY 10,000 different cases, each checked in detail:
//   goal sentences (English, Egyptian Arabic) → a count goal with the right number, unit and deadline
//   "done" sentences (English, Arabic, Franco) → +n of the right unit, with the book's title when said
//   look-alikes that must NOT count (a question, "read the book before the meeting", «خلص اللبن», "save 5000", "lose 5 kg")
//   journeys: a goal, +1 / +1 with a book's details / Undo, then the card's numbers (done, left, %, state, the pace line)
//     node tests/countgoals/gen.mjs [n]          HELDOUT=1 → the phrasings written after the code (heldout.mjs)
import fs from "fs";
const M = await import("../../web-src/missions.js");
const N = +(process.argv[2] || 10000);
let seed = 3838 + 7919 * +(process.env.SEED_SHIFT || 0) + (process.env.HELDOUT ? 104729 : 0);
const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const NOW = Date.parse("2026-11-14T12:00:00"), MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const AR_MON = ["يناير", "فبراير", "مارس", "ابريل", "مايو", "يونيو", "يوليو", "اغسطس", "سبتمبر", "اكتوبر", "نوفمبر", "ديسمبر"];
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const endOf = (y, m) => iso(new Date(y, m + 1, 0, 12));
const TITLES = ["Atomic Habits", "Sapiens", "The Psychology of Money", "Deep Work", "Educated", "Dune", "The Alchemist", "Thinking, Fast and Slow", "Rich Dad Poor Dad", "1984"];
const TITLES_AR = ["العادات الذرية", "الخيميائي", "مئة عام من العزلة", "رجال في الشمس", "ثلاثية غرناطة", "الأيام"];
const H = process.env.HELDOUT ? await import("./heldout.mjs") : null;
const G = H ? H.G : {
  goalEn: [(n, u, d) => `read ${n} ${u} before ${d}`, (n, u, d) => `I want to read ${n} ${u} by ${d}`, (n, u, d) => `goal: read ${n} ${u} before ${d}`, (n, u, d) => `finish ${n} ${u} by ${d}`],
  goalAr: [(n, u, d) => `اقرا ${n} ${u} قبل ${d}`, (n, u, d) => `عايز اقرا ${n} ${u} قبل ${d}`, (n, u, d) => `هدفي اقرا ${n} ${u} لحد ${d}`],
  doneEn: [(t) => `finished another book${t ? ": " + t : ""}`, (t) => (t ? `finished reading ${t}` : `finished the book`), (t) => `I just finished a book${t ? " called " + t : ""}`, () => `read another book`],
  doneAr: [(t) => `خلصت كتاب${t ? " اسمه " + t : ""}`, (t) => `قريت كتاب${t ? " " + t : ""}`, () => `انا لسه خلصت كتاب`],
  doneMany: [(n) => `read ${n} more books`, (n) => `finished ${n} books`, (n) => (n === 2 ? `قريت كتابين` : `خلصت ${n} كتب`)],
  other: [["went to the gym", "gym"], ["I went to the gym today", "gym"], ["did my workout", "workout"], ["went for a run", "run"], ["رحت الجيم", "gym"], ["اتمرنت النهارده", "workout"], ["finished the course", "course"], ["khalast ketab", "book"]],
  notDone: ["did I finish a book?", "read the book before the meeting", "I am reading a book", "finished reading it", "how many books did I read?", "خلص اللبن", "خلصت القهوة", "read a book", "buy a book", "the book is on the table", "finished the report", "I read the news today"],
  notGoal: ["save 20000 before June", "lose 5 kg before March", "how many books did I read this year?", "spend at most 3000 on food this month", "I bought 3 books for 450", "remind me to read at 9"],
};
const seen = new Set(), bad = {}; let pass = 0, made = 0, tries = 0;
const fail = (why, s) => { (bad[why] = bad[why] || []).push(s); };
while (made < N && tries++ < N * 400) {
  const r = rnd(); let s = "", key = "", why = "";
  if (r < 0.3) {   // a goal
    const n = int(2, 60), ar = rnd() < 0.35, y = 2027, mo = int(0, 11), unitW = ar ? pick(["كتاب", "كتب"]) : pick(["books", "novels"]);
    const dWord = ar ? AR_MON[mo] + " " + y : pick([MON[mo] + " " + y, "the end of " + MON[mo] + " " + y, MON[mo].slice(0, 3) + " " + y]);
    s = pick(ar ? G.goalAr : G.goalEn)(n, unitW, dWord); key = "g|" + s; if (seen.has(key)) continue;
    const p = M.parseMission(s, NOW);
    if (!p || p.kind !== "count") why = "goal not read as a count (" + (p && p.kind) + ")";
    else if (p.target !== n) why = "count " + p.target + " ≠ " + n;
    else if (p.unit !== "book") why = "unit " + p.unit;
    else if (p.deadline !== endOf(y, mo)) why = "deadline " + p.deadline + " ≠ " + endOf(y, mo);
  } else if (r < 0.55) {   // one book done, with or without its title
    const ar = rnd() < 0.35, withT = rnd() < 0.6, t = withT ? pick(ar ? TITLES_AR : TITLES) : "";
    const fs0 = pick(ar ? G.doneAr : G.doneEn); s = fs0(t) + pick(["", "", "!", " 🎉", "."]); key = "d|" + s; if (seen.has(key)) continue;
    const d = M.readCountDone(s), wantT = /reading|called|اسمه|: |قريت كتاب /.test(fs0(t)) ? t : "";
    if (!d) why = "done not read"; else if (d.unit !== "book") why = "unit " + d.unit; else if (d.n !== 1) why = "n " + d.n; else if (wantT && d.title !== t) why = "title «" + d.title + "» ≠ «" + t + "»";
  } else if (r < 0.62) {   // several books
    const n = int(2, 9); s = pick(G.doneMany)(n); key = "m|" + s; if (seen.has(key)) continue;
    const d = M.readCountDone(s); if (!d || d.unit !== "book" || d.n !== n) why = "several: " + JSON.stringify(d) + " want " + n;
  } else if (r < 0.7) {   // other units
    const [t, u] = pick(G.other); s = t + pick(["", "!", " 💪", ".", " today"].filter((x) => !(x === " today" && /today|النهارده/.test(t)))); key = "o|" + s; if (seen.has(key)) continue;
    const d = M.readCountDone(s); if (!d || d.unit !== u) why = "unit: " + JSON.stringify(d) + " want " + u;
  } else if (r < 0.8) {   // look-alikes that must not count / must not be a count goal
    const goal = rnd() < 0.4; s = pick(goal ? G.notGoal : G.notDone) + pick(["", " ", "  "]) + (rnd() < 0.5 ? "" : pick(["", "?", "!"]).replace("?", "")); key = (goal ? "ng|" : "nd|") + s.trim() + int(0, 99999); if (seen.has(key)) continue;
    if (goal) { const p = M.parseMission(s, NOW); if (p && p.kind === "count") why = "a count goal from «" + s + "»"; }
    else if (M.readCountDone(s)) why = "counted «" + s + "»";
  } else {   // a journey: goal → +1s with book details → Undo → the card's numbers
    const target = int(3, 40), deadlineDays = int(30, 500), dl = iso(new Date(NOW + deadlineDays * 864e5)); key = "j|" + target + "|" + deadlineDays + "|" + int(0, 1e9); if (seen.has(key)) continue;
    let m = M.startMission({ kind: "count", target, unit: "book", deadline: dl, title: "read " + target + " books" }, {}, NOW - int(10, 200) * 864e5);
    const adds = int(0, target + 3), undos = int(0, Math.min(3, adds)); let t = NOW - 5 * 864e5;
    for (let i = 0; i < adds; i++) m = M.addDone(m, rnd() < 0.5 ? { title: pick(TITLES), stars: int(0, 5), lessons: ["a", "b"].slice(0, int(0, 2)), file: rnd() < 0.3 } : {}, (t += 864e5));
    for (let i = 0; i < undos; i++) m = M.undoDone(m);
    const e = M.evaluate(m, {}, NOW), done = adds - undos, left = Math.max(0, target - done), pct = Math.max(0, Math.min(100, Math.round(done / target * 100)));
    const days = Math.max(0, Math.round((Date.parse(dl + "T12:00:00") - Date.parse("2026-11-14T12:00:00")) / 864e5));
    if (e.value !== done) why = "done " + e.value + " ≠ " + done; else if (e.left !== left) why = "left"; else if (e.pct !== pct) why = "pct " + e.pct + " ≠ " + pct;
    else if (left <= 0 && e.state !== "done") why = "state " + e.state + " (all done)";
    else if (left > 0 && days > 0 && !(e.step && e.step.t && e.step.v)) why = "no pace line";
    else if (left > 0 && days > 0) { const every = Math.max(1, Math.floor(days / left)), w = every >= 7 ? Math.round(every / 7) : null; if (w != null ? e.step.v.w !== w : e.step.v.d !== every) why = "pace " + JSON.stringify(e.step.v) + " ≠ every " + every + " days"; }
    s = "journey " + key;
  }
  seen.add(key); made++; if (why) fail(why.replace(/\d+/g, "N").slice(0, 60), s); else pass++;
}
if (made !== N) throw new Error("made " + made + " different cases, not " + N);
const md = `# Count goals and books — ${N} cases, ${pass} right (${(100 * pass / N).toFixed(2)}%)${H ? " — HELD-OUT phrasings" : ""}\n\n` + Object.entries(bad).map(([k, v]) => `- **${k}** × ${v.length}: ${v.slice(0, 4).map((x) => "«" + x + "»").join(" · ")}`).join("\n") + "\n";
if (N === 10000) fs.writeFileSync(new URL(+process.env.SEED_SHIFT ? "../onemillion/B-countgoals-s" + process.env.SEED_SHIFT + ".md" : H ? "./heldout-report.md" : "./report.md", import.meta.url), md);
console.log(md);
