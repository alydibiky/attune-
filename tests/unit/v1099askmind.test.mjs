// v10.9.9 (Ali's screenshots, 26 Nov 2026): Chat answered "Your barber is…" under "From your Mind: Tell me about my barber · Who won the
// last champions league final" (his own past QUESTIONS, read back as notes), then "When is the last time I went" → "The last time:
// 2026-11-26 (today) — Last time I went to the barber." (his question of a minute before, read as a visit), under "From: the model's
// own knowledge" although the answer came from his notes.
//   1. lifeask.recordsAbout never counts Attune's saved chat turns / questions as your records
//   2. a note's date is a "last time" only when it tells of something done
//   3. the "From:" line says "your data" when the answer used your Mind / Shelf
//   4. 10,000 composed HARD cases: questions are questions, facts are facts
const L = await import("../../web-src/lifeask.js");
const { answerSources } = await import("../../web-src/sourcelabel.js");
const { harden, shapeReport } = await import("../lib/hard.mjs");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c || process.env.V) console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const now = Date.parse("2026-11-26T14:47:00"), D = 864e5;

// ---- Ali's exact case
const barber = { id: 1, kind: "note", title: "that in the barber I go to hany rabee3 I cut with 1.ahmed me8awry , 2", text: "that in the barber I go to hany rabee3 I cut with 1.ahmed me8awry , 2.ahmed sheraton 3.ibrahim hassan", ts: now - 3 * D };
const mem = [barber,
  { id: 2, kind: "chat", title: "Last time I went to the barber", text: "Last time I went to the barber", output: "…", ts: now - 60e3 },
  { id: 3, kind: "chat", title: "Tell me about my barber", text: "Tell me about my barber", output: "Your barber is Hany Rabee3.", ts: now - 120e3 },
  { id: 4, kind: "note", title: "Who won the last champions league final", text: "Who won the last champions league final", ts: now - 5 * D },
  { id: 5, kind: "ask", title: "when did I last go to the barber?", text: "when did I last go to the barber?", output: "x", ts: now - D }];
const recs = L.recordsAbout("barber", { memory: mem });
ok(recs.length === 1 && /hany rabee3/.test(recs[0].what), "only the real note is a record about the barber (" + recs.map((r) => r.what).join(" | ") + ")");
for (const q of ["When is the last time I went to the barber?", "when did I last go to the barber", "last time I went to the barber?", "اخر مرة روحت الحلاق امتى؟"]) {
  const a = L.chatAsk(q, { memory: mem }, { now });
  ok(!a || !/today|Last time I went|اليوم/.test(a.en || ""), "no visit invented from a question: " + q + " → " + (a && a.en));
}
const mem2 = [...mem, { id: 6, kind: "note", title: "went to the barber, 150", text: "went to the barber, 150", ts: now - 5 * D }];
const a2 = L.chatAsk("When is the last time I went to the barber?", { memory: mem2 }, { now });
ok(a2 && /5 days ago/.test(a2.en) && /went to the barber/.test(a2.en), "a note that tells of a visit still answers: " + (a2 && a2.en));
ok(answerSources({ role: "assistant", text: "Your barber is Hany Rabee3.", fromMine: [{ title: "x", where: "Mind" }] })[0] === "data", "answered from Mind → From: your data");
ok(answerSources({ role: "assistant", text: "Paris." })[0] === "model", "nothing behind it → the model's own knowledge");

// ---- 10,000 composed HARD cases
const SEED = +(process.env.SEED || 7); let seed = SEED >>> 0;   // mulberry32 (SEED=1, 2 … = held-out sets)
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let z = seed; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const THINGS = ["the barber", "the dentist", "the gym", "my mom's", "the car wash", "Carrefour", "the doctor", "the mechanic", "Zayed", "the club", "Sheikh Zayed mall", "the bank", "Ahmed's place", "the pharmacy", "my oil change", "the electricity bill", "the tailor"];
const Q_EN = [(x) => `when is the last time I went to ${x}`, (x) => `last time I went to ${x}`, (x) => `tell me about ${x}`, (x) => `who is ${x}`, (x) => `what did I pay at ${x}`,
  (x) => `when did I last go to ${x}`, (x) => `how much was ${x}`, (x) => `where is ${x}`, (x) => `is ${x} open`, (x) => `did I go to ${x} this week`, (x) => `show me ${x}`, (x) => `any idea about ${x}`,
  (x) => `${x} — when?`, (x) => `${x} last time?`, (x) => `can you find ${x}`, (x) => `which day did I go to ${x}`, (x) => `the last time ${x}`];
const Q_AR = [(x) => `امتى اخر مرة روحت ${x}`, (x) => `اخر مره روحت ${x}`, (x) => `مين ${x}`, (x) => `فين ${x}`, (x) => `كام دفعت في ${x}`, (x) => `هل روحت ${x}`, (x) => `قولي عن ${x}`, (x) => `${x} امتى؟`];
const F_EN = [(x) => `went to ${x} today`, (x) => `${x} — paid 150`, (x) => `I go to ${x} every month`, (x) => `${x} is on 9th street`, (x) => `my usual at ${x} is Ahmed`, (x) => `${x} closes at 10`,
  (x) => `that at ${x} I see doctor Hany`, (x) => `${x}: 1. Ahmed 2. Ibrahim`, (x) => `renewed ${x} for a year`, (x) => `${x} number 0100 123 4567`];
const F_AR = [(x) => `روحت ${x} النهارده`, (x) => `${x} في شارع 9`, (x) => `بروح ${x} كل شهر`, (x) => `${x} بيقفل الساعة 10`];
const AR_T = ["الحلاق", "الدكتور", "الجيم", "البنك", "الصيدلية", "النادي"];
// composed: [opener] core [when / amount / detail] [closer], in random order where a person would; then harden()
const OPEN_Q = ["", "", "hey Attune, ", "quick q: ", "btw ", "ok so ", "1) ", "Question - ", "yo "], OPEN_QA = ["", "", "يا أتيون، ", "بقولك ", "طب ", "سؤال: "];
const OPEN_F = ["", "", "note: ", "FYI ", "- ", "• ", "2) "], OPEN_FA = ["", "", "ملحوظة: ", "- "];
const NUMS = () => pick([" " + (1 + Math.floor(rnd() * 28)) + "/" + (1 + Math.floor(rnd() * 12)), " at " + (1 + Math.floor(rnd() * 12)) + pick(["pm", "am", ":30", ":15", ""]), " #" + Math.floor(rnd() * 99), " x" + (2 + Math.floor(rnd() * 4)), ", " + (50 + Math.floor(rnd() * 950)) + pick([" EGP", " LE", " ج", "", ".50"]), " (" + pick(["Ahmed", "mom", "Sara", "work", "Dr. Hany"]) + ")", "", "", ""]);
const WHEN = ["", "", " this month", " in 2026", " since 3/10", " before the 15th", " on Friday", " last week", " at 7:30", " (2nd time)"], WHEN_A = ["", "", " الشهر ده", " يوم الجمعة", " الساعة ٧", " من ٣/١٠"];
const DET = ["", "", ", paid 150 EGP", " — 200 LE", ", took 45 min", ", with Ahmed", " near Zamalek", ", room 12", " #3"], DET_A = ["", "", " ب ١٥٠ جنيه", " مع أحمد", " جنب الزمالك"];
const CLOSE_Q = ["", "", " pls", " :)", " thx", " please"], CLOSE_F = ["", "", ".", " 👍", " — done", " ✔"];
const NOTE_LIST = [(x) => `What I need for ${x}: ID, 2 photos`, (x) => `How to get to ${x}: metro line 2, exit 3`, (x) => `Who to call at ${x}:\n1. Ahmed\n2. Ibrahim`, (x) => `${x}\n- open 9-5\n- closed Friday`];
const cases = [];
for (let i = 0; i < 10000; i++) {
  const ar = rnd() < 0.3, q = rnd() < 0.5;
  const x = ar ? pick(AR_T) : pick(THINGS);
  let core = q ? pick(ar ? Q_AR : Q_EN)(x) : (!ar && rnd() < 0.12 ? pick(NOTE_LIST)(x) : pick(ar ? F_AR : F_EN)(x));
  const extra = (ar ? pick(WHEN_A) : pick(WHEN)) + NUMS() + (q ? "" : ar ? pick(DET_A) : pick(DET)) + (rnd() < 0.3 ? NUMS() : "");
  if (/[?؟]$/.test(core)) core = core.replace(/([?؟])$/, extra + "$1"); else if (!/\n/.test(core)) core += extra;
  let t = (q ? pick(ar ? OPEN_QA : OPEN_Q) : pick(ar ? OPEN_FA : OPEN_F)) + core;
  if (q && rnd() < 0.4 && !/[?؟]$/.test(t)) t += ar ? "؟" : pick(["?", "??", "?!"]);
  t += q ? pick(CLOSE_Q) : pick(CLOSE_F);
  if (rnd() < 0.4) t = t.replace(/^(\W*)(\p{L})/u, (m, a, c) => a + c.toUpperCase());
  t = harden(t, rnd, { human: true, allowCut: false, lang: ar ? "ar" : "en" });
  cases.push({ t, q });
}
let good = 0; const bad = [];
for (const c of cases) { const g = L.isAskedText(c.t) === c.q; if (g) good++; else if (bad.length < 8) bad.push((c.q ? "Q " : "F ") + JSON.stringify(c.t)); }
const rate = good / cases.length, sh = shapeReport(cases.map((c) => c.t));
ok(sh.share >= 0.6, "≥ 60 % different shapes");
console.log(`askmind 10,000 HARD: ${(rate * 100).toFixed(2)} % right · ${(sh.share * 100).toFixed(0)} % different shapes`);
if (bad.length) console.log("  e.g. " + bad.join("\n       "));
ok(rate >= 0.99, "questions vs facts ≥ 99 % on 10,000 HARD");
// …and none of the question notes ever becomes "the last time"
let leaks = 0;
for (const c of cases.slice(0, 2500)) if (c.q) { const m = [{ id: 1, kind: "note", title: c.t, text: c.t, ts: now - D }]; const a = L.chatAsk("when is the last time I went to the barber?", { memory: m }, { now }); if (a && a.kind === "last") leaks++; }
ok(leaks === 0, "no question kept as a note is read as a visit (" + leaks + ")");

// ---- the Mind index (memindex.js): a new / edited / removed record updates the index alone — same results as a full rebuild, fast
{
  const { makeMemIndex } = await import("../../web-src/memindex.js");
  const toks = (t) => String(t).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
  const X = makeMemIndex(toks);
  const W = "barber dentist gym money paid ahmed hany rabee3 meeting crane liebherr invoice answer long text words life plans".split(" ");
  const mk = (i) => { let t = ""; for (let j = 0; j < 250; j++) t += W[(i * 7 + j * 13) % W.length] + ((i + j) % 50) + " "; return { id: "r" + i, title: "t" + i, text: t, output: "", tags: [], ts: now - i * 1e6 }; };
  let recs = []; for (let i = 0; i < 1500; i++) recs.push(mk(i));
  let ix = X.memBuildIndex(recs), worst = 0;
  for (let k = 0; k < 40; k++) {
    const prev = recs; recs = [mk(5000 + k), ...prev];
    if (k % 5 === 0) recs = recs.map((r, i) => (i === 7 ? { ...r, title: r.title + " edited" } : r));
    if (k % 7 === 0) recs = recs.slice(0, -1);
    if (k % 11 === 0) recs = recs.filter((r, i) => i !== 30);
    const a = performance.now(); ix = X.memIndexUpdate(ix, prev, recs); worst = Math.max(worst, performance.now() - a);
  }
  const full = makeMemIndex(toks).memBuildIndex(recs);
  const same = ["barber12 hany", "crane12 invoice", "edited", "rabee3 money paid", "plans49", "t7"].every((q) => {
    const a = X.memSearch(recs, ix, q, { now, limit: 10 }).map((x) => x.rec.id + ":" + x.score.toFixed(9)).join(","), b = X.memSearch(recs, full, q, { now, limit: 10 }).map((x) => x.rec.id + ":" + x.score.toFixed(9)).join(",");
    return a === b; });
  ok(same && ix.n === recs.length, "the index updated record by record finds exactly what a full rebuild finds (" + ix.n + " records)");
  ok(worst < 40, "a new record updates the index in " + worst.toFixed(1) + " ms (a full build of 1,500 was ~100 ms)");
  ok(X.memSearch(recs, ix, "edited", { now }).some((x) => /edited/.test(x.rec.title)) && !X.memSearch(recs, ix, "t30", { now }).some((x) => x.rec.title === "t30" && !recs.includes(x.rec)), "edited records are found; removed ones are gone");
}

console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED v1099askmind (${n} checks, 10,000 HARD)`);
if (fail) process.exit(1);
