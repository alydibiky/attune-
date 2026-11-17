// v10.3 K1 (Ali picked the K1 calendar, 17 Nov 2026; his rules: 10,000 cases per feature, HARD and unique — composed from parts, run
// through tests/lib/hard.mjs, distinct shapes reported). EXACTLY 10,000 different weeks, each COMPOSED at random: which day the week
// starts on (Sat / Sun / Mon), what "now" is, 0–25 things from every source (reminders at a time, payments people owe or you owe,
// bills, renewals, deliveries, errands, promises, money already paid with or without its hour, project dates, a trip that may start
// before the week or end after it), things outside the week, payments in the future (never shown), the same thing twice, many at the
// same hour, very early / very late hours. Reminder titles are written many ways (English, Egyptian Arabic, other languages, word
// order shuffled) and hardened like a person types them. The TRUTH is written here: which day, at its hour or all day, which colour
// (money / people / home & orders / projects / trip), + or −; and the layout rules: nothing in the all-day lane overlaps, two things
// at the same time sit side by side (never on top of each other), every hour shown, nothing lost (a full lane says "+N more").
//     node tests/weekcal/gen.mjs [n]       HARD=0 → without the hardener;  HELDOUT=1 → words written after the code (heldout.mjs)
import fs from "fs";
import { harden, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
const W = await import("../../web-src/weekcal.js");
const H = process.env.HELDOUT ? (await import("./heldout.mjs")).H : null;
const HARD = process.env.HARD !== "0";
const N = +(process.argv[2] || 10000);
let seed = 1030 + (H ? 501 : 0); const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const DAY = 864e5;
// ---- the parts reminder titles are composed from ----
const NAMES = H ? H.names : ["Mama", "Baba", "Ahmed", "Noudy", "Sara", "Dr. Hany", "Uncle Sameh", "ماما", "بابا", "أحمد", "خالتي", "سارة", "Omar", "Mona", "the landlord", "Youssef", "Teta"];
const PEOPLE = H ? H.people : [   // a reminder about a person — {n} = the name
  ["call {n}", "en"], ["call {n} back", "en"], ["Call back {n}", "en"], ["ring {n}", "en"], ["{n} — call", "en"], ["phone {n} about the flat", "en"], ["visit {n}", "en"], ["{n}'s birthday", "en"],
  ["birthday: {n}", "en"], ["dinner with {n}", "en"], ["meet {n} at the club", "en"], ["{n} anniversary", "en"], ["lunch with {n}", "en"],
  ["كلم {n}", "ar"], ["اتصل ب{n}", "ar"], ["كلّم {n} بخصوص الشقة", "ar"], ["عيد ميلاد {n}", "ar"], ["زور {n}", "ar"], ["زيارة {n}", "ar"], ["فرح {n}", "ar"], ["قابل {n} في النادي", "ar"],
  ["llamar a {n}", "es"], ["appeler {n}", "fr"], ["{n} anrufen", "de"], ["ligar para {n}", "pt"], ["chiamare {n}", "it"], ["позвонить {n}", "ru"], ["{n}'i ara", "tr"], ["telepon {n}", "id"],
  ["cumpleaños de {n}", "es"], ["anniversaire de {n}", "fr"], ["Geburtstag {n}", "de"], ["doğum günü {n}", "tr"], ["{n} का जन्मदिन", "hi"], ["تولد {n}", "fa"]];
const HOME = H ? H.home : ["buy bread", "Talabat order", "pick up the laundry", "take out the trash", "water the plants", "car service", "pay the internet", "renew the licence", "اشتري عيش", "طلب طلبات",
  "غسيل العربية", "ادفع النت", "اجيب الدوا", "change the AC filter", "book the dentist", "gym", "back up the laptop", "comprar pan", "acheter du pain", "Brot kaufen", "ekmek al", "iron the shirts", "منظف الشقة"];
const SPICE = ["", "", " tomorrow", " at 5", " please", " !", " ⏰", " — important", " (again)", " مهم", " ضروري"];
function person() { const [t] = pick(PEOPLE), n = pick(NAMES); let s = t.replace("{n}", n); if (rnd() < 0.3) s = s + pick(SPICE); return s; }
function home() { let s = pick(HOME); if (rnd() < 0.4) s = s + pick(SPICE); if (rnd() < 0.15) s = pick(["⚡ ", "✅ ", "🛒 ", ""]) + s; return s; }
const hard = (s) => (HARD ? harden(s, rnd, { human: true, allowCut: false }) : s);
const MONEYK = ["pay", "collect", "bill", "owe", "owed", "promise", "trial", "renewal"], DATEK = ["return", "warranty", "expiry", "other", "errand"];
const PAYEES = ["Sheikh · 3 of 8", "Ahmed · installment 2 of 12", "CIB card bill", "Electricity", "Maid", "Google AI Pro · Baba", "Netflix", "Vodafone", "Gym membership", "إيجار الشقة", "Mona owes you", "Rent"];
const DATES = ["FreeClip 2 arrives", "Return the shoes", "Warranty — washing machine", "Passport expires", "Car licence", "Flat · painter visit", "Visa appointment", "Amazon delivery"];
const TXN = ["FACES", "CIB transfer", "Seoudi", "Uber", "Talabat", "Salary", "Carrefour", "Vodafone Cash", "تحويل لحظي", "Fawry"];
const iso = W.iso;
const bad = {}, kinds = {}, texts = []; let pass = 0, made = 0, checks = 0;
const fail = (k, msg) => { (bad[k] = bad[k] || []).length < 6 && bad[k].push(msg); };
for (; made < N; made++) {
  const startDay = pick([6, 0, 1]);
  const now = Date.UTC(2026, int(0, 11), int(1, 28), int(0, 23), int(0, 59)) + int(-3, 3) * DAY;
  const ws = W.weekStartOf(now, startDay), days = [0, 1, 2, 3, 4, 5, 6].map((k) => W.addDays(ws, k)), today = iso(now);
  // the week shown is this one, or one before / after (‹ ›)
  const shift = pick([0, 0, 0, 1, -1, 2]), s = W.addDays(ws, shift * 7), sd = [0, 1, 2, 3, 4, 5, 6].map((k) => W.addDays(s, k));
  const timeline = [], txns = [], projects = [], want = new Map();   // id → { day, timed, h, kind, sign } | "out"
  const n = int(0, 25), hot = int(6, 21);   // (a busy hour: several things at once)
  let uid = 0;
  for (let i = 0; i < n; i++) {
    const inWeek = rnd() < 0.82, di = int(0, 6), date = inWeek ? sd[di] : W.addDays(s, pick([-int(1, 20), 7 + int(0, 20)]));
    const r = rnd(), id = "x" + made + "_" + uid++;
    if (r < 0.32) {   // a reminder at a time
      const p = rnd() < 0.5, what = hard(p ? person() : home()), hh = rnd() < 0.3 ? hot : rnd() < 0.08 ? pick([0, 1, 5, 6, 22, 23]) : int(7, 21), mm = pick([0, 0, 15, 30, 45, int(0, 59)]);
      const t = new Date(date + "T00:00:00").getTime() + hh * 3600e3 + mm * 60e3;
      timeline.push({ id, date, time: t, kind: "reminder", what, page: "reminders" });
      want.set(id, inWeek ? { day: di, timed: true, h: hh + mm / 60, kind: p ? "people" : "home", sign: "" } : "out");
    } else if (r < 0.62) {   // money planned (a payment, a bill, someone owes you, a renewal…) — all day
      const k = pick(MONEYK), amount = rnd() < 0.85 ? int(50, 30000) : 0;
      timeline.push({ id, date, kind: k, what: hard(pick(PAYEES)), amount, cur: "EGP", page: "life" });
      want.set(id, inWeek ? { day: di, timed: false, kind: "money", sign: amount > 0 ? (["collect", "owed", "promise"].includes(k) ? "+" : "−") : "" } : "out");
    } else if (r < 0.75) {   // a date (a delivery, a return, a paper)
      timeline.push({ id, date, kind: pick(DATEK), what: hard(pick(DATES)), amount: 0, page: "radar" });
      want.set(id, inWeek ? { day: di, timed: false, kind: "home", sign: "" } : "out");
    } else if (r < 0.92) {   // money already paid (Money) — at its hour when it has one; a "payment" in the future is never shown
      const type = rnd() < 0.8 ? "expense" : "income", amount = int(5, 25000), withTs = rnd() < 0.7, hh = rnd() < 0.3 ? hot : int(0, 23), mm = int(0, 59);
      const ts = new Date(date + "T00:00:00").getTime() + hh * 3600e3 + mm * 60e3;
      txns.push({ id, date, type, amount, note: hard(pick(TXN)), ...(withTs ? { ts } : {}) });
      want.set("m:" + id, inWeek && date <= today ? { day: di, timed: withTs, h: hh + mm / 60, kind: "money", sign: type === "income" ? "+" : "−" } : "out");
    } else {   // a project date
      projects.push({ id, name: pick(["Flat", "Thesis", "Wedding", "Office move", "مشروع الشقة"]), date, text: pick(["order tiles", "due", "meet the painter", "send the draft"]) });
      want.set("p:" + id, inWeek ? { day: di, timed: false, kind: "work", sign: "" } : "out");
    }
  }
  // the same thing twice (a store read twice) — shown once
  if (timeline.length && rnd() < 0.2) timeline.push({ ...timeline[0] });
  // a trip: inside the week, from before it, or past its end — one bar, cut to the week
  let trip = null;
  if (rnd() < 0.3) { const a = int(-10, 9), b = a + int(0, 12); trip = { depart: W.addDays(s, a), ret: W.addDays(s, b), to: pick(["Umrah · Makkah", "Dahab", "London", "الساحل"]) };
    want.set("trip", b < 0 || a > 6 ? "out" : { d0: Math.max(0, a), d1: Math.min(6, b), kind: "trip" }); }
  const kindTag = (n > 18 ? "busy" : n > 8 ? "full" : n ? "light" : "empty") + (trip ? "+trip" : "") + (shift ? "+other week" : "");
  kinds[kindTag] = (kinds[kindTag] || 0) + 1;
  texts.push([startDay, ...timeline.map((x) => x.kind + ":" + x.what), ...txns.map((x) => x.type + ":" + x.note + (x.ts ? "@" : "")), ...projects.map((p) => p.name), trip ? "trip" : ""].join(" | "));
  // ---- run Attune ----
  const maxRows = pick([3, 3, 2, 4]);
  const wk = W.weekOf({ timeline, txns, projects, trip, now, start: s, maxRows });
  let ok = true; const why = (m) => { ok = false; fail(m.split(":")[0], `#${made} ${m}`); };
  checks++;
  if (wk.days.join() !== sd.join()) why("days: the week's days are wrong " + wk.days.join());
  if (wk.today !== sd.indexOf(today)) why("today: marked on the wrong day " + wk.today);
  const shown = new Map(); for (const x of wk.timed) shown.set(x.id, { ...x, timed: true }); for (const x of wk.allday) shown.set(x.id, { ...x, timed: false });
  const hidden = wk.more.reduce((a, b) => a + b, 0);
  let missingAll = 0;
  for (const [id, w] of want) {
    const x = shown.get(id);
    if (w === "out") { if (x) why("out: shown although it is not this week (or not paid yet): " + id + " " + x.what); continue; }
    if (!x) { if (w.timed) why("lost: a thing at a time is missing: " + id); else missingAll++; continue; }
    if (w.kind === "trip") { if (x.d0 !== w.d0 || x.d1 !== w.d1) why(`trip: the bar is on the wrong days ${x.d0}-${x.d1}, want ${w.d0}-${w.d1}`); continue; }
    if (x.timed !== w.timed) why(`time: ${w.timed ? "should sit at its hour" : "should be all day"}: ${x.what}`);
    if ((w.timed ? x.day : x.d0) !== w.day) why(`day: on day ${w.timed ? x.day : x.d0}, want ${w.day}: ${x.what}`);
    if (w.timed && Math.abs(x.h - w.h) > 0.01) why(`hour: at ${x.h}, want ${w.h}: ${x.what}`);
    if (x.kind !== w.kind) why(`colour: ${x.kind}, want ${w.kind}: «${x.what}»`);
    if (x.sign !== w.sign) why(`sign: «${x.sign}», want «${w.sign}»: ${x.what}`);
  }
  // nothing lost: what isn't in the lane is counted in "+N more" (a trip counts on each of its days)
  const lane = wk.allday.length, wantAll = [...want.values()].filter((w) => w !== "out" && !w.timed).length;
  if (missingAll && hidden < missingAll) why(`more: ${missingAll} all-day things hidden but "+N more" says ${hidden}`);
  if (lane + missingAll !== wantAll) why(`count: ${lane} in the lane + ${missingAll} hidden ≠ ${wantAll}`);
  // the lane: no two things on the same row overlap; rows within the limit
  for (const a of wk.allday) { if (a.row >= maxRows) why("rows: a row past the limit"); for (const b of wk.allday) if (a !== b && a.row === b.row && !(a.d1 < b.d0 || a.d0 > b.d1)) { why(`overlap: «${a.what}» and «${b.what}» on the same row`); break; } }
  // the hours: every timed thing inside them; same-time things side by side, never on top of each other
  for (const x of wk.timed) {
    if (x.h < wk.h0 || x.end > wk.h1) why(`hours: ${x.h} outside ${wk.h0}–${wk.h1}`);
    if (!(x.cols >= 1) || !(x.col >= 0 && x.col < x.cols)) why(`cols: bad column ${x.col}/${x.cols}`);
  }
  for (const a of wk.timed) for (const b of wk.timed) if (a !== b && a.day === b.day && a.h < b.end && b.h < a.end) {
    const ra = [a.col / a.cols, (a.col + 1) / a.cols], rb = [b.col / b.cols, (b.col + 1) / b.cols];
    if (ra[0] < rb[1] - 1e-9 && rb[0] < ra[1] - 1e-9) { why(`stack: «${a.what}» and «${b.what}» drawn on top of each other`); break; }
  }
  // the now line only on this week's today, within the hours
  const nl = W.nowLine(wk, now); if (nl != null && (wk.today < 0 || nl < wk.h0 || nl > wk.h1)) why("now: the now line is outside today's hours");
  if (ok) pass++;
}
const sh = shapeReport(texts);
const pct = (100 * pass / made).toFixed(2);
const head = `${made} weeks: ${pass} drawn right (${pct}%) — ${sh.shapes} different shapes [${Math.round(sh.share * 100)} of 100]${HARD ? " · HARD" : ""}`;
let md = `# Week calendar (K1) — ${head}\n\nGenerated by tests/weekcal/gen.mjs (${H ? "held-out words" : "the main words"}${HARD ? ", hardened" : ""}).\n\n## Kinds of week\n\n`;
for (const [k, v] of Object.entries(kinds).sort((a, b) => b[1] - a[1])) md += `- ${k}: ${v}\n`;
md += "\n## Mistakes\n\n" + (Object.keys(bad).length ? Object.entries(bad).map(([k, v]) => `### ${k}\n\n` + v.map((x) => "- " + x).join("\n")).join("\n\n") : "None.") + "\n";
if (N === 10000) fs.writeFileSync(new URL(`./report${H ? "-heldout" : ""}${HARD ? "" : "-easy"}.md`, import.meta.url), md);
console.log(head);
for (const [k, v] of Object.entries(bad)) console.log("  " + k + ": " + v.slice(0, 3).join(" ‖ "));
if (sh.share < SHAPE_BAR) console.log(`  (shapes ${Math.round(sh.share * 100)}% — under the ${SHAPE_BAR * 100}% bar)`);
