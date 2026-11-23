// v10.9.3 (Ali's OK-BK, 23 Nov 2026 — his note: "make me able to see the message or the notifications that were saved and saved to what").
// EXACTLY 10,000 different situations, COMPOSED from parts in random order, HARD (tests/lib/hard.mjs):
//   A. "Read from your messages" (readlog.js readLog): Money already holding payments read from notifications (with their full message, or
//      an old one without it, or older than 30 days), hand-typed payments, the phone's queue (real bank / wallet messages of the 30
//      countries; the same payment notified twice by the bank AND InstaPay; one the person typed by hand too; the very notification a
//      saved payment came from), noise of every kind (one-time codes naming an amount, balances, offers, declined cards, charges still to
//      come, money talk in WhatsApp), and the SMS trace (codes, hidden words). Each message must be listed ONCE, with the right answer:
//      saved → its full message and where it went; waiting; already in Money; sent twice; or left alone WITH the right reason.
//   B. The "stopped reading" notification (stopAlert, the same rule as ReadWatch.kt): access, the reader's last sign of life, the
//      screen, the hour, the last alert, SMS that came while the SMS switch was off — composed around the answer it must give.
//     node tests/readlog/gen.mjs           (10,000; HARD=0 for the easy run)       SEED_SHIFT=1 → another 10,000 (held-out)
import { readLog, stopAlert, liveLine } from "../../web-src/readlog.js";
import { readNotification } from "../../web-src/paylog.js";
import { harden, shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";
import { WORLD } from "../corpus/world-bank-messages.mjs";

const HARD = process.env.HARD !== "0";
export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261123 + 104729 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const NOW = Date.parse("2026-11-23T16:00:00") + shift * 86400e3, H = 3600e3, D = 24 * H;
  const OPTS = { home: "EGP", order: "dmy", teach: [] };
  const PAY = WORLD.filter((w) => w[5] > 0 && readNotification({ id: "x", app: w[1], title: w[2], text: w[3], ts: NOW }, OPTS));
  const SMS_PKG = ["com.google.android.apps.messaging", "com.samsung.android.messaging", "com.android.mms"];
  const BANK = ["CIB", "NBE", "BanqueMisr", "QNB", "ALEXBANK", "AAIB", "HSBC", "VF-Cash", "InstaPay", "ADIB"];
  const PEOPLE = ["Mama", "Ahmed", "Sara", "Karim", "Hany"];
  const SHOPS = ["CARREFOUR", "SEOUDI", "AMAZON.EG", "TALABAT", "UBER", "IKEA", "NOON", "B.TECH"];
  const amt = () => { const v = int(15, 25000); return pick([v.toLocaleString("en-US") + ".00", String(v), v.toLocaleString("en-US")]); };
  // noise: each family with the reasons the page may give (the reader's first rule that fires)
  const NOISE = [
    [["code"], () => ({ app: "Messages", title: pick(BANK), text: pick([`Your OTP for the purchase of EGP ${amt()} at ${pick(SHOPS)} is ${int(100000, 999999)}. Do not share it.`, `رمز التحقق ${int(1000, 9999)} لعملية شراء بمبلغ ${amt()} جنيه`, `Verification code ${int(100000, 999999)} — payment of ${amt()} EGP`]) })],
    [["balance"], () => ({ app: "Messages", title: pick(BANK), text: pick([`Your available balance is EGP ${amt()} as of ${int(1, 28)}/11`, `رصيدك المتاح ${amt()} جنيه`, `Balance: ${amt()} EGP. Thank you for banking with us.`]) })],
    [["offer"], () => ({ app: "Messages", title: pick(BANK), text: pick([`Get 20% cashback offer on purchases above EGP ${amt()}! Limited time.`, `عرض خاص: خصم 30% على مشترياتك فوق ${amt()} جنيه`, `Win EGP ${amt()} — use your card this week. Promo.`]) })],
    [["failed"], () => ({ app: "Messages", title: pick(BANK), text: pick([`Your card ending ${int(1000, 9999)} was declined for EGP ${amt()} at ${pick(SHOPS)} — insufficient funds.`, `Transaction of EGP ${amt()} failed at ${pick(SHOPS)}.`, `تم رفض عملية بمبلغ ${amt()} جنيه`]) })],
    [["notyet"], () => ({ app: "Messages", title: pick(BANK), text: pick([`Your instalment of EGP ${amt()} will be debited on ${int(1, 28)}/12.`, `Reminder: payment due on ${int(1, 28)}/12, EGP ${amt()}.`, `سيتم خصم ${amt()} جنيه يوم ${int(1, 28)}`]) })],
    [["chat"], () => ({ app: "WhatsApp", pkg: "com.whatsapp", title: pick(PEOPLE), text: pick([`I paid ${amt()} for the guard yesterday`, `حولتلك ${amt()} جنيه امبارح؟`, `The bill was ${amt()} EGP, send me your half`]) })],
  ];
  let nid = 0;
  const note = (x, ts) => ({ id: "n" + shift + "-" + (++nid), pkg: x.pkg || pick(SMS_PKG), app: x.app, title: x.title, text: x.text, ts });
  const hardText = (t) => (HARD ? harden(t, rnd, { sms: true, keep: /\d[\d,.]*\d|\d/, allowCut: false }) : t);
  const payNote = (ts) => { const w = pick(PAY); return note({ app: w[1], title: w[2], text: hardText(w[3]), pkg: w[1] === "Messages" ? pick(SMS_PKG) : "com." + w[1].toLowerCase().replace(/\W/g, "") + ".app" }, ts); };
  const iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const savedOf = (n, e, id, withText) => ({ id, ...(rnd() < 0.7 ? { nid: n.id } : {}), type: e.direction === "in" ? "income" : "expense", amount: e.amount, cat: pick(["food", "transport", "bills", "other", "groceries"]), date: iso(e.ts), note: [e.party, e.app].filter(Boolean).join(" · ").slice(0, 80) || "Payment",
    created: e.ts, source: "notification", ...(withText ? { evidence: { text: e.full, from: e.from, app: e.app, ts: e.ts } } : {}) });

  let right = 0, total2 = 0; const wrong = [], shapes = [];
  for (let i = 0; i < total; i++) {
    const partB = i % 4 === 3;   // a quarter: the "stopped reading" rule
    if (partB) {
      const WANTS = ["off", "smsoff", "silent", "none-fine", "none-night", "none-recent", "none-never", "none-screen"];
      const want = pick(WANTS);
      const c = { was: true, access: true, seen: NOW - int(1, 300) * 60e3, conn: NOW - int(1, 20) * D, now: NOW, hour: int(8, 22), interactive: true, lastAlert: rnd() < 0.5 ? 0 : NOW - int(25, 400) * H, sms: [] };
      // SMS traces that never matter: money with the switch ON, codes, people, older than 6 h
      for (let k = int(0, 4); k > 0; k--) c.sms.push({ ts: NOW - int(1, 600) * 60e3, money: rnd() < 0.5, otp: rnd() < 0.3, sw: true });
      for (let k = int(0, 2); k > 0; k--) c.sms.push({ ts: NOW - int(7, 72) * H, money: true, otp: false, sw: false });
      for (let k = int(0, 2); k > 0; k--) c.sms.push({ ts: NOW - int(1, 300) * 60e3, money: false, otp: rnd() < 0.5, sw: false });
      const smsOffNow = () => c.sms.push({ ts: NOW - int(1, 359) * 60e3, money: true, otp: false, sw: false });
      const quiet = () => { const q = NOW - int(6 * 60, 96 * 60) * 60e3; c.seen = q; c.conn = q - int(0, 99) * H; };
      let exp = null;
      if (want === "off") { c.access = false; if (rnd() < 0.5) quiet(); if (rnd() < 0.4) smsOffNow(); exp = "off"; }
      else if (want === "smsoff") { smsOffNow(); if (rnd() < 0.4) quiet(); exp = "smsoff"; }
      else if (want === "silent") { quiet(); exp = "silent"; }
      else if (want === "none-night") { c.hour = pick([23, 0, 1, 2, 3, 4, 5, 6, 7]); pick([() => (c.access = false), smsOffNow, quiet])(); }
      else if (want === "none-recent") { c.lastAlert = NOW - int(1, 23 * 60) * 60e3; pick([() => (c.access = false), smsOffNow, quiet])(); }
      else if (want === "none-never") { c.was = false; c.access = false; }
      else if (want === "none-screen") { c.interactive = false; pick([() => (c.access = false), smsOffNow, quiet])(); }
      shuffle(c.sms);
      const got = stopAlert(c);
      total2++; const ok = got === exp; if (ok) right++; else if (wrong.length < 40) wrong.push({ part: "B", want, exp, got, c: JSON.stringify(c).slice(0, 400) });
      shapes.push("B|" + want + "|" + c.sms.map((s) => (s.money ? "m" : "") + (s.otp ? "o" : "") + (s.sw ? "" : "x") + Math.min(9, Math.floor((NOW - s.ts) / H))).join(",") + "|" + c.hour + "|" + (c.lastAlert ? 1 : 0));
      continue;
    }
    // ---- part A ----
    const ledger = { currency: "EGP", txns: [] }, queue = [], diag = { sms: [] }, expect = new Map();   // key → { kind, why?, text? }
    let tid = 0;
    const ops = [];
    // saved from a notification, the notification still in the queue (or not) — listed once, with its full message
    ops.push(...Array.from({ length: int(0, 3) }, () => () => {
      for (let tries = 0; tries < 6; tries++) {
        const n = payNote(NOW - int(5, 29 * 24 * 60) * 60e3), e = readNotification(n, OPTS); if (!e) continue;
        const withText = rnd() < 0.85, inQueue = rnd() < 0.5, id = "s" + (++tid);
        if ([...ledger.txns, ...queue].some((t) => Math.abs((t.created || t.ts) - n.ts) < 15 * 60000)) continue;
        ledger.txns.push(savedOf(n, e, id, withText)); if (inQueue) queue.push(n);
        expect.set("t:" + id, { kind: "saved", text: withText || inQueue ? e.full : "" });
        return;
      }
    }));
    // waiting for an OK
    ops.push(...Array.from({ length: int(0, 3) }, () => () => {
      for (let tries = 0; tries < 6; tries++) {
        const n = payNote(NOW - int(5, 29 * 24 * 60) * 60e3), e = readNotification(n, OPTS); if (!e) continue;
        if ([...ledger.txns, ...queue].some((t) => Math.abs((t.created || t.ts) - n.ts) < 15 * 60000)) continue;
        queue.push(n);
        const kind = rnd() < 0.25 ? "already" : "waiting";
        if (kind === "already") ledger.txns.push({ id: "h" + (++tid), type: e.direction === "in" ? "income" : "expense", amount: e.amount, date: iso(e.ts), note: "typed", cat: "other" });
        expect.set("q:" + n.id, { kind, why: kind });
        // the same payment twice (the bank AND InstaPay, minutes apart)
        if (rnd() < 0.25) { const n2 = { ...n, id: n.id + "-b", pkg: "com.instapay.app", app: "InstaPay", ts: n.ts - int(1, 8) * 60000 }; queue.push(n2); expect.set("q:" + n2.id, { kind: "twice", why: "twice" }); }
        return;
      }
    }));
    // noise
    ops.push(...Array.from({ length: int(0, 4) }, () => () => {
      const [whys, mk] = pick(NOISE), x = mk(); const n = note({ ...x, text: x.app === "WhatsApp" ? x.text : hardText(x.text) }, NOW - int(1, 29 * 24 * 60) * 60e3);
      queue.push(n); expect.set("q:" + n.id, { kind: "left", whys });
    }));
    // hand-typed payments and old ones: never listed
    ops.push(...Array.from({ length: int(0, 3) }, () => () => { ledger.txns.push({ id: "m" + (++tid), type: "expense", amount: int(10, 900), date: iso(NOW - int(0, 20) * D), note: pick(SHOPS), cat: "food", created: NOW - int(0, 20) * D }); }));
    ops.push(...Array.from({ length: int(0, 2) }, () => () => { const n = payNote(NOW - int(31, 90) * D), e = readNotification(n, OPTS); if (e) ledger.txns.push(savedOf(n, e, "o" + (++tid), true)); if (rnd() < 0.5) queue.push(n); }));
    // the SMS trace: codes and hidden words (no text) — listed with their reason, unless that message is already listed
    ops.push(...Array.from({ length: int(0, 3) }, () => () => { const k = rnd() < 0.5 ? "otp" : "hidden", ts = NOW - int(1, 29 * 24 * 60) * 60e3, from = pick(BANK) + int(1, 99);
      diag.sms.push({ ts, pkg: pick(SMS_PKG), from, hidden: k === "hidden", money: false, otp: k === "otp", sw: true }); expect.set("s:" + ts + ":" + from, { kind: "left", whys: [k === "otp" ? "code" : "hidden"] }); }));
    for (const op of shuffle(ops)) op();
    shuffle(queue); shuffle(ledger.txns);
    // (v7.9's rule: a payment the person typed by hand with the same amount on the same day IS "already in Money" — a random hand-typed
    // entry that lands on one is expected as that, not as waiting)
    for (const n of queue) { const k = "q:" + n.id, e0 = expect.get(k); if (!e0 || e0.kind !== "waiting") continue; const e = readNotification(n, OPTS);
      if (e && ledger.txns.some((t) => t.source !== "notification" && t.date === iso(e.ts) && Math.abs(t.amount - e.amount) < 0.005 && t.type === (e.direction === "in" ? "income" : "expense"))) expect.set(k, { kind: "already", why: "already" }); }
    const got = readLog({ ledger, queue, diag, now: NOW, opts: OPTS });
    const byKey = new Map(got.map((x) => [x.key, x]));
    const probs = [];
    if (new Set(got.map((x) => x.key)).size !== got.length) probs.push("a message listed twice");
    for (const [k, e] of expect) {
      const g = byKey.get(k); if (!g) { probs.push("missing " + k + " (" + e.kind + ")"); continue; }
      if (g.kind !== e.kind) probs.push(k + ": " + g.kind + " ≠ " + e.kind + (g.why ? " (" + g.why + ")" : "") + " · " + g.text.slice(0, 90));
      else if (e.whys && !e.whys.includes(g.why)) probs.push(k + ": why " + g.why + " ≠ " + e.whys.join("/") + " · " + g.text.slice(0, 90));
      else if (e.kind === "saved" && e.text && g.text !== e.text) probs.push(k + ": the full message is missing");
    }
    for (const g of got) if (!expect.has(g.key)) probs.push("extra " + g.key + " " + g.kind);
    for (let z = 1; z < got.length; z++) if (got[z].ts > got[z - 1].ts) { probs.push("not newest first"); break; }
    total2++; if (!probs.length) right++; else if (wrong.length < 40) wrong.push({ part: "A", probs });
    shapes.push("A|" + [...expect.values()].map((e) => e.kind[0] + (e.whys ? e.whys[0][0] : "")).sort().join("") + "|" + queue.map((x) => shapeOf(x.title + " " + x.text)).join("|"));
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`read log + stop alert: ${right} / ${total2} right (${(100 * right / total2).toFixed(2)} %) · ${HARD ? "HARD" : "easy"} · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %) · corpus payments ${PAY.length}`);
    for (const w of wrong.slice(0, 14)) console.log("  WRONG " + (w.part === "A" ? w.probs.slice(0, 3).join("\n        ") : `want ${w.want} → ${w.exp} got ${w.got}  ${w.c}`));
  }
  // liveLine sanity (a few fixed cases are in the unit test)
  void liveLine;
  return { right, total: total2, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
