// v10.4 (Ali, 18 Nov 2026: "I can't press allow or tick, it does not do anything" + "fix the SMS notification for good").
// EXACTLY 10,000 different situations of the bank step, COMPOSED from parts in random order: the build (reads notifications or not),
// notification access, the reader's health (live / paused by Android, last notification minutes or days ago), the SMS switch, the
// last SMS notifications' trace (hidden words, money, one-time codes, old ones), the queue (real bank / wallet messages of the 30
// countries, made HARD with tests/lib/hard.mjs, mixed with one-time codes that name an amount, balances, offers, declined cards,
// charges still to come, money talk in WhatsApp), payments already handled, Money (empty, hand-typed, the same payment typed by hand,
// a payment already read). Each says what the check MUST say (state) and, when payments wait, how many and how many "Add" saves.
//     node tests/bankcheck/gen.mjs           (10,000; HARD=0 for the easy run)       SEED_SHIFT=1 → another 10,000 (held-out)
import { bankCheck } from "../../web-src/bankcheck.js";
import { readNotification } from "../../web-src/paylog.js";
import { harden, shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
import { WORLD } from "../corpus/world-bank-messages.mjs";

const HARD = process.env.HARD !== "0";
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261118 + 104729 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const NOW = Date.parse("2026-11-18T16:00:00") + shift * 86400e3, H = 3600e3;
  const OPTS = { home: "EGP", order: "dmy" };
  // the corpus messages Money reads as a payment with the Egyptian home currency (the material; what is tested here is the CHECK)
  const PAY = WORLD.filter((w) => w[5] > 0 && readNotification({ id: "x", app: w[1], title: w[2], text: w[3], ts: NOW }, { ...OPTS, teach: [] }));
  const SMS_PKG = ["com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms", "com.oneplus.mms", "com.coloros.mms"];
  const BANK = ["CIB", "NBE", "BanqueMisr", "QNB", "ALEXBANK", "AAIB", "HSBC", "VF-Cash", "InstaPay", "Faisal Bank", "ADIB", "Banque du Caire"];
  const PEOPLE = ["Mama", "Ahmed", "+201001234567", "Sara", "01112223334", "Karim", "Work", "Hany"];
  const SHOPS = ["CARREFOUR", "SEOUDI", "AMAZON.EG", "TALABAT", "UBER", "IKEA", "NOON", "B.TECH"];
  const amt = () => { const v = int(15, 25000); return pick([v.toLocaleString("en-US") + ".00", String(v), v.toLocaleString("en-US")]); };
  // messages that look like money but are NOT a payment: one-time codes, balance only, offers, declined, charges still to come, chats
  const NOISE = [
    () => ({ app: "Messages", title: pick(BANK), text: pick([`Your OTP for the purchase of EGP ${amt()} at ${pick(SHOPS)} is ${int(100000, 999999)}. Do not share it.`, `رمز التحقق ${int(1000, 9999)} لعملية شراء بمبلغ ${amt()} جنيه`, `Verification code ${int(100000, 999999)} — payment of ${amt()} EGP`]) }),
    () => ({ app: "Messages", title: pick(BANK), text: pick([`Your available balance is EGP ${amt()} as of ${int(1, 28)}/11`, `رصيدك المتاح ${amt()} جنيه`, `Balance: ${amt()} EGP. Thank you for banking with us.`]) }),
    () => ({ app: "Messages", title: pick(BANK), text: pick([`Get 20% cashback offer on purchases above EGP ${amt()}! Limited time.`, `عرض خاص: خصم 30% على مشترياتك فوق ${amt()} جنيه`, `Win EGP ${amt()} — use your card this week. Promo.`]) }),
    () => ({ app: "Messages", title: pick(BANK), text: pick([`Your card ending ${int(1000, 9999)} was declined for EGP ${amt()} at ${pick(SHOPS)} — insufficient funds.`, `Transaction of EGP ${amt()} failed at ${pick(SHOPS)}.`, `تم رفض عملية بمبلغ ${amt()} جنيه`]) }),
    () => ({ app: "Messages", title: pick(BANK), text: pick([`Your instalment of EGP ${amt()} will be debited on ${int(1, 28)}/12.`, `Reminder: payment due on ${int(1, 28)}/12, EGP ${amt()}.`, `سيتم خصم ${amt()} جنيه يوم ${int(1, 28)}`]) }),
    () => ({ app: "WhatsApp", pkg: "com.whatsapp", title: pick(PEOPLE), text: pick([`I paid ${amt()} for the guard yesterday`, `حولتلك ${amt()} جنيه امبارح؟`, `The bill was ${amt()} EGP, send me your half`]) }),
  ];
  let nid = 0;
  const note = (x, ts) => ({ id: "n" + shift + "-" + (++nid), pkg: x.pkg || pick(SMS_PKG), app: x.app, title: x.title, text: x.text, ts });
  const hardText = (t) => (HARD ? harden(t, rnd, { sms: true, keep: /\d[\d,.]*\d|\d/ , allowCut: false }) : t);
  const payNote = (ts) => { const w = pick(PAY); return { n: note({ app: w[1], title: w[2], text: hardText(w[3]), pkg: w[1] === "Messages" ? pick(SMS_PKG) : "com." + w[1].toLowerCase().replace(/\W/g, "") + ".app" }, ts), w }; };
  const smsTrace = (k, ts) => ({ ts, pkg: pick(SMS_PKG), from: pick(k === "bank" ? BANK : PEOPLE), hidden: k === "hidden", money: k === "money", otp: k === "otp", sw: true });

  const STATES = ["unavailable", "off", "done", "waiting", "smsoff", "asleep", "nosms", "hidden", "notpay", "notbank"];
  const W8 = [3, 6, 10, 26, 6, 11, 9, 10, 9, 10];   // waiting gets the most: it is where the payments really are
  const pickState = () => { let r = rnd() * W8.reduce((a, b) => a + b, 0); for (let i = 0; i < STATES.length; i++) { r -= W8[i]; if (r < 0) return STATES[i]; } return "waiting"; };
  const cases = [], shapes = [];
  let right = 0; const wrong = [];
  for (let i = 0; i < total; i++) {
    const want = pickState();
    const c = { reader: true, access: true, diag: { live: true, smsSwitch: true, seen: NOW - int(1, 300) * 60e3, conn: NOW - int(1, 30) * 86400e3, sms: [] }, queue: [], old: [], done: [], ledger: { txns: [] }, now: NOW, opts: OPTS };
    // noise that never changes the answer, in random amounts and order
    for (let k = int(0, 4); k > 0; k--) c.queue.push(note(pick(NOISE)(), NOW - int(1, 600) * 60e3));
    for (let k = int(0, 3); k > 0; k--) c.ledger.txns.push({ id: "t" + k, type: pick(["expense", "income"]), amount: int(10, 9000), date: "2026-11-" + String(int(1, 17)).padStart(2, "0"), note: pick(SHOPS) });
    for (let k = int(0, 3); k > 0; k--) c.done.push("old-" + int(1, 999));
    let expN = 0, expAdd = 0;
    const handledPay = () => { if (rnd() < 0.4) { const p = payNote(NOW - int(2, 900) * 60e3); c.queue.push(p.n); c.done.push(p.n.id); } };   // a payment already added / dismissed: never waiting again
    if (want === "unavailable") { c.reader = false; if (rnd() < 0.5) c.access = rnd() < 0.5; c.queue.push(payNote(NOW - 60e3).n); }
    else if (want === "off") { c.access = false; if (rnd() < 0.6) c.queue.push(payNote(NOW - int(1, 99) * 60e3).n); }
    else if (want === "done") { c.ledger.txns.push({ id: "tn", type: "expense", amount: int(20, 9000), date: "2026-11-15", note: "CIB", source: "notification" }); if (rnd() < 0.5) c.queue.push(payNote(NOW - 60e3).n); if (rnd() < 0.3) c.diag.live = false; }
    else if (want === "waiting") {
      const k = int(1, 4), seenAmt = [];
      for (let j = 0; j < k; j++) {
        let p; let tries = 0; do { p = payNote(NOW - (j * 47 + int(11, 40)) * 60e3); tries++; } while (seenAmt.includes(p.w[5]) && tries < 20);
        if (seenAmt.includes(p.w[5])) continue; seenAmt.push(p.w[5]);
        c.queue.push(p.n); expN++;
        const e = readNotification(p.n, { ...OPTS, teach: [] });
        // sometimes the same payment was typed into Money by hand that day: it waits ("Already in Money?") but "Add" doesn't save it twice
        if (e && rnd() < 0.2) { const d = new Date(e.ts); c.ledger.txns.push({ id: "hand" + j, type: e.direction === "in" ? "income" : "expense", amount: e.amount, date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, note: "typed" }); }
        else expAdd++;
      }
      handledPay();
      if (rnd() < 0.3) c.diag.live = false;   // waiting payments come first, whatever the reader does now
      if (rnd() < 0.2) c.diag.smsSwitch = false;
    } else {
      handledPay();
      if (want === "smsoff") { c.diag.smsSwitch = false; if (rnd() < 0.4) c.diag.live = false; }
      else if (want === "asleep") { if (rnd() < 0.5) c.diag.live = false; else { const q = NOW - int(QH + 1, 240) * H; c.diag.seen = q; c.diag.conn = q - int(0, 99) * H; } }
      else {
        const kinds = want === "nosms" ? [] : want === "hidden" ? ["hidden", "hidden", ...(rnd() < 0.5 ? ["hidden"] : [pick(["bank", "plain", "money"])])]
          : want === "notpay" ? [pick(["money", "plain"]), ...Array.from({ length: int(0, 3) }, () => pick(["money", "plain", "otp"]))]
          : Array.from({ length: int(1, 4) }, () => pick(["plain", "bank", "otp"]));
        if (want === "notpay" && !kinds.includes("money")) kinds[int(0, kinds.length - 1)] = "money";
        if (want === "notbank" && kinds.every((x) => x === "otp")) kinds.push("plain");
        // newest first in time: the order below is the newest → oldest; the trace itself is stored in any order
        let t = NOW - int(1, 120) * 60e3; const tr = [];
        for (const k of kinds) { tr.push(smsTrace(k === "plain" || k === "bank" ? (rnd() < 0.5 ? "plain" : "bank") : k, t)); t -= int(5, 900) * 60e3; }
        if (want === "hidden") tr[0].hidden = true;
        if (want === "notpay") { /* the newest isn't hidden-led */ tr[0].hidden = false; for (let z = 1; z < tr.length; z++) if (tr[z].hidden) tr[z].hidden = false; }
        // traces that never count: one-time codes (any time) and SMS older than a week
        for (let z = int(0, 2); z > 0; z--) tr.push({ ...smsTrace(pick(["hidden", "money", "plain"]), NOW - int(8, 40) * 86400e3) });
        if (want === "nosms") for (let z = int(0, 2); z > 0; z--) tr.push(smsTrace("otp", NOW - int(1, 99) * 60e3));
        c.diag.sms = shuffle(tr);
      }
    }
    shuffle(c.queue);
    const got = bankCheck(c);
    const ok = got.state === want && (want !== "waiting" || (got.n === expN && got.add.length === expAdd));
    if (ok) right++; else if (wrong.length < 40) wrong.push({ want, got: got.state, n: got.n, expN, add: got.add.length, expAdd, q: c.queue.map((x) => x.title + ": " + x.text) });
    cases.push(c);
    shapes.push(want + "|" + c.queue.map((x) => shapeOf(x.title + " " + x.text)).join("|") + "|" + c.diag.sms.map((x) => (x.hidden ? "h" : "") + (x.money ? "m" : "") + (x.otp ? "o" : "")).join(","));
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`bank check: ${right} / ${total} right (${(100 * right / total).toFixed(2)} %) · ${HARD ? "HARD" : "easy"} · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %) · corpus payments ${PAY.length}`);
    for (const w of wrong.slice(0, 12)) console.log("  WRONG want " + w.want + " got " + w.got + (w.want === "waiting" ? ` n ${w.n}/${w.expN} add ${w.add}/${w.expAdd}` : "") + "\n    " + w.q.join("\n    ").slice(0, 600));
  }
  return { right, total, share: sh.share, wrong };
}
const QH = 6;
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
