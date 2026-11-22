// v10.8 (the persona 6 re-run, 22 Nov 2026): "remind me every Friday to pay rent" went to Chat (7 words, no number = "a story"),
// «فكرني كل جمعة ادفع الإيجار» had no date, "on the 5th of every month to pay rent" was titled «of to pay rent» ("mon" matched "month"),
// "remind me every Monday to call mum" asked «Who do you mean? … Nada is my wife». 10,000 repeating reminders COMPOSED from parts in
// random order — the asking words, the schedule (weekdays, several days, the n-th of the month, the last weekday of the month, daily,
// with or without a time), the task — English and Egyptian Arabic, hardened (tests/lib/hard.mjs). Truth written HERE. Checked: it is
// a reminder (never Chat, never a question), the repeat is right, the first time falls on the right weekday / day, and the title is
// the task — no schedule words left in it.
//   node tests/reminders/repeat.mjs        (N=2500 for the unit test; HELD=1 for the held-out set written after the fixes)
import { understand } from "../../web-src/doit.js";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const N = +(process.env.N || 10000), HELD = !!process.env.HELD;
let seed = 7331 + (HELD ? 9001 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const NOW = Date.parse("2026-11-22T10:00:00");   // a Sunday
const EN_DAYS = [["Sunday", 0], ["Monday", 1], ["Tuesday", 2], ["Wednesday", 3], ["Thursday", 4], ["Friday", 5], ["Saturday", 6]];
const AR_DAYS = [["الحد", 0], ["الاتنين", 1], ["التلات", 2], ["الاربع", 3], ["الخميس", 4], ["الجمعة", 5], ["السبت", 6]];
const AR_BARE = { 0: "حد", 1: "اتنين", 2: "تلات", 3: "اربع", 4: "خميس", 5: "جمعة", 6: "سبت" };
const TASKS = { en: HELD ? ["renew the parking permit", "water the plants", "send the weekly report", "check the car tyres", "call grandma", "back up the laptop"]
  : ["pay rent", "call mum", "take my pills", "pay the internet bill", "go to the gym", "call the bank", "buy bread", "clean the AC filter"],
  ar: HELD ? ["اسقي الزرع", "ابعت التقرير", "اكلم جدتي", "اغير زيت العربية"] : ["ادفع الإيجار", "اكلم ماما", "اخد الدوا", "ادفع النت", "اروح الجيم", "اشتري عيش"] };
const ASK = { en: ["remind me", "please remind me", "Remind me", "hey remind me", "can you remind me"], ar: ["فكرني", "فكّرني", "ذكرني", "يا أتيون فكرني"] };
function one() {
  const L = rnd() < 0.62 ? "en" : "ar", task = pick(TASKS[L]), ask = pick(ASK[L]);
  // v10.8 (Ali: "fix both"): + the n-th weekday of the month (forms 6 / 4) and "every month" with no day — that one must ASK which day (7 / 5)
  const form = Math.floor(rnd() * (L === "en" ? 8 : 6)); let sched, repeat, day = null, dom = null, hour = null, nth = null, askDay = false;
  const ORD = [["first", "1st"], ["second", "2nd"], ["third", "3rd"], ["fourth", "4th"]], AR_ORD = ["أول", "تاني", "تالت", "رابع"];
  if (L === "en") {
    if (form === 0) { const [d, n] = pick(EN_DAYS); sched = pick(["every " + d, "every " + d, "on " + d + "s", "each " + d]); repeat = "weekly"; day = n; }
    else if (form === 1) { const a = pick(EN_DAYS); let b = pick(EN_DAYS); while (b[1] === a[1]) b = pick(EN_DAYS); sched = "every " + a[0] + " and " + b[0]; repeat = "days:" + [a[1], b[1]].sort().join(","); day = [a[1], b[1]]; }
    else if (form === 2) { dom = 1 + Math.floor(rnd() * 27); const o = dom === 1 || dom === 21 ? "st" : dom === 2 || dom === 22 ? "nd" : dom === 3 || dom === 23 ? "rd" : "th"; sched = pick(["on the " + dom + o + " of every month", "every month on the " + dom + o, "on the " + dom + o + " of each month"]); repeat = "monthly"; }
    else if (form === 3) { const [d, n] = pick(EN_DAYS); sched = pick(["every last " + d + " of the month", "on the last " + d + " of every month"]); repeat = "last:" + n; day = n; }
    else if (form === 4) { hour = 7 + Math.floor(rnd() * 4); sched = pick(["every day at " + hour + " am", "daily at " + hour + "am", "every day at " + hour + ":00 am", "every morning at " + hour, "daily at " + hour + " a.m.", "every day at " + String(hour).padStart(2, "0") + ":00"]); repeat = "daily"; }
    else if (form === 6) { const [d, n] = pick(EN_DAYS), k = Math.floor(rnd() * 4); sched = pick(["every " + pick(ORD[k]) + " " + d + " of the month", "on the " + pick(ORD[k]) + " " + d + " of every month", "the " + pick(ORD[k]) + " " + d + " of each month"]); repeat = "nth:" + (k + 1) + ":" + n; day = n; nth = k + 1; }
    else if (form === 7) { sched = pick(["every month", "each month", "monthly"]); repeat = "ask"; askDay = true; }
    else { const [d, n] = pick(EN_DAYS); hour = 7 + Math.floor(rnd() * 4); sched = pick(["every " + d + " at " + hour + " am", "every " + d + " at " + hour + "am", "every " + d + " at " + String(hour).padStart(2, "0") + ":00", "each " + d + " " + hour + " am", "every " + d.slice(0, 3) + " at " + hour + " am"]); repeat = "weekly"; day = n; }
  } else {
    if (form === 0) { const n = Math.floor(rnd() * 7); sched = pick(["كل " + AR_BARE[n], "كل " + AR_DAYS[n][0], "كل يوم " + AR_BARE[n]]); repeat = "weekly"; day = n; }
    else if (form === 1) { const a = Math.floor(rnd() * 7); let b = Math.floor(rnd() * 7); while (b === a) b = Math.floor(rnd() * 7); sched = "كل " + AR_DAYS[a][0] + " و" + AR_DAYS[b][0]; repeat = "days:" + [a, b].sort().join(","); day = [a, b]; }
    else if (form === 2) { const n = Math.floor(rnd() * 7); sched = AR_DAYS[n][0]; repeat = "none"; day = n; }
    else if (form === 4) { const n = Math.floor(rnd() * 7), k = Math.floor(rnd() * 4); sched = pick([AR_ORD[k] + " " + AR_BARE[n] + " في الشهر", "كل " + AR_ORD[k] + " " + AR_DAYS[n][0] + " في الشهر", AR_ORD[k] + " " + AR_DAYS[n][0] + " من كل شهر"]); repeat = "nth:" + (k + 1) + ":" + n; day = n; nth = k + 1; }
    else if (form === 5) { sched = pick(["كل شهر", "شهريا"]); repeat = "ask"; askDay = true; }
    else { hour = 7 + Math.floor(rnd() * 4); const n = Math.floor(rnd() * 7); sched = pick(["كل " + AR_DAYS[n][0] + " الساعة " + hour + " الصبح", "كل " + AR_DAYS[n][0] + " " + hour + " الصبح", "كل " + AR_DAYS[n][0] + " الساعة " + hour + " صباحا"]); repeat = "weekly"; day = n; }
  }
  // the parts in a random order, joined the way people type: commas, dashes, colons, emoji, a capital, "pls" / «لو سمحت», a closing word
  const order = rnd();
  const parts = L === "en"
    ? (order < 0.45 ? [ask, sched, "to " + task] : order < 0.75 ? [ask, "to " + task, sched] : order < 0.9 ? [sched, ask.toLowerCase(), "to " + task] : [ask, "to " + task + ",", sched])
    : (order < 0.5 ? [ask, sched, task] : order < 0.8 ? [ask, task, sched] : [sched, ask, task]);
  const SEP = L === "en" ? [" ", " ", " ", ", ", " - ", " — ", ": ", "... "] : [" ", " ", " ", "، ", " - ", " — ", ": "];
  const DECO = L === "en" ? ["", "", "", " 🙏", " 🔔", " ⏰", " 📌", " ✅", " pls", " please", " thanks", " ok", "!", "!!", " :)", " (important)", " asap", " plz"]
    : ["", "", "", " 🙏", " 🔔", " ⏰", " لو سمحت", " ضروري", "!", " ماشي", " (مهم)", " يا باشا", " شكرا"];
  // (no "Note:" in front — "Note: remind me…" may really mean "save a note"; the generator's first run had it)
  const LEAD = L === "en" ? ["", "", "", "Hey, ", "OK so ", "Hi! ", "📌 ", "Quick one: ", "Hey\n"] : ["", "", "", "بص ", "طيب ", "📌 ", "معلش "];
  let text = pick(LEAD) + parts.map((x, i) => (i === 0 ? x : pick(SEP) + x)).join("") + pick(DECO) + (rnd() < 0.3 ? pick(DECO) : "");
  if (L === "en" && rnd() < 0.25) text = text.replace(/\b(remind|every|each|month|on)\b/i, (w) => (rnd() < 0.5 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)));
  text = harden(text, rnd, { lang: L, human: true, allowCut: false, keep: task });
  return { L, text, task, repeat, day, dom, hour, nth, askDay };
}
const cases = Array.from({ length: N }, one);
let ok = 0; const fails = [];
const JUNK = /\b(every|each|month|of|on the|daily|day|last)\b|كل|الشهر|الساعة|الصبح/i;
for (const c of cases) {
  const r = understand(c.text, { now: NOW }); const a = r && r.actions && r.actions.length === 1 && r.actions[0].kind === "reminder" ? r.actions[0].action : null;
  let why = "";
  if (c.askDay) { if (!(r && r.ask && r.ask.kind === "remind-day")) why = a ? "made a reminder with no day" : r && r.chat ? "went to Chat" : "did not ask which day"; }
  else if (!a) why = r && r.chat ? "went to Chat" : r && r.ask ? "asked " + (r.ask.kind || "") : "nothing";
  else {
    const d = new Date(a.at);
    if (a.repeat !== c.repeat) why = `repeat ${a.repeat} (want ${c.repeat})`;
    else if (Array.isArray(c.day) ? !c.day.includes(d.getDay()) : c.day != null && d.getDay() !== c.day) why = `day ${d.getDay()} (want ${c.day})`;
    else if (c.nth && Math.ceil(d.getDate() / 7) !== c.nth) why = `the ${Math.ceil(d.getDate() / 7)}th week (want ${c.nth})`;
    else if (c.dom && d.getDate() !== c.dom) why = `date ${d.getDate()} (want ${c.dom})`;
    else if (c.hour != null && d.getHours() !== c.hour) why = `hour ${d.getHours()} (want ${c.hour})`;
    else if (a.at <= NOW) why = "in the past";
    else { const title = String(a.title || "").toLowerCase(); const want = c.task.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
      if (!want.every((w) => title.includes(w))) why = `title «${a.title}»`; else if (JUNK.test(title.replace(c.task.toLowerCase(), ""))) why = `schedule words in the title «${a.title}»`; }
  }
  if (!why) ok++; else if (fails.length < 60) fails.push(`[${c.L}] ${JSON.stringify(c.text)} — ${why}`);
}
const sh = shapeReport(cases.map((c) => c.text));
console.log(`${HELD ? "held-out" : "generated"} ${N}: ${ok}/${N} = ${(100 * ok / N).toFixed(2)} % · shapes ${(100 * sh.share).toFixed(1)} % (bar ${SHAPE_BAR * 100} %)`);
if (fails.length) console.log(fails.slice(0, +(process.env.SHOW || 25)).join("\n"));
export const RESULT = { ok, n: N, share: sh.share };
