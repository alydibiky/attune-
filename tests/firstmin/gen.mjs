// v10.9.7 the first minute (Ali's OK-FM, 24 Nov 2026: "if it's accurate it will be intriguing … I don't want mistakes"). EXACTLY 10,000
// people's last 30 days, each COMPOSED from parts in random order: bank / wallet SMS (English + Egyptian Arabic, the shapes of the
// notification run and of Ali's CIB messages), Gmail money emails in the layouts of Ali's real screenshots (Stripe receipt with a period,
// Google Play, Netflix, PayPal with its exchange line, a WHMCS invoice), a shop's e-mail receipt, and what must NOT count: one-time codes,
// declined payments, balances, offers, money that came in, newsletters with prices. The same payment in an SMS and an email (a twin),
// a payment from LAST month (a subscription, not this month's spending), a dollar subscription with or without the person's own rate
// (a PayPal line), and a PayPal payment + the shop's own invoice for the same amount (→ "Check this one: same plan?").
// HARD: every SMS goes through tests/lib/hard.mjs harden() (sms: true, the amount kept); emails get the phone reader's changes (lines
// split, direction marks, doubled spaces, labels in capitals). Checked: the month's total, money in other currencies, the subscriptions
// (how many, monthly sum), the twins joined, the spending lines, and every question asked.
//   node tests/firstmin/gen.mjs   (10,000)   SEED_SHIFT=1 → another 10,000 (held-out, written after the fixes)
const mem = {}; globalThis.localStorage = globalThis.localStorage || { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: () => null, length: 0 };
const { firstMonth } = await import("../../web-src/firstmin.js");
const { harden, shapeOf, shapeReport, SHAPE_BAR } = await import("../lib/hard.mjs");

export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261124 + 7919 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const NOW = Date.parse("2026-11-24T12:00:00") + shift * 3 * 864e5, D = 864e5;
  const M0 = (() => { const d = new Date(NOW); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const AR = "٠١٢٣٤٥٦٧٨٩", arD = (s) => String(s).replace(/\d/g, (d) => AR[+d]);
  const r2 = (v) => Math.round(v * 100) / 100, E2 = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const t4 = () => String(int(1000, 9999)), ddmm = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const us = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  const longD = (d) => `${MONL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, shortD = (d) => `${MON[d.getMonth()]} ${d.getDate()}`;
  const BANKS = ["CIB", "NBE", "Banque Misr", "QNB", "HSBC", "AAIB", "Banque du Caire", "ADIB", "Emirates NBD"];
  const SHOPS = ["CARREFOUR MAADI", "SPINNEYS", "TALABAT", "UBER", "AMAZON EG", "NOON", "VODAFONE", "B.TECH", "IKEA", "ZARA", "CILANTRO", "MCDONALDS", "SEOUDI", "ON THE RUN", "KAZYON"];
  const SHOPS_AR = ["كارفور المعادي", "طلبات", "سعودي ماركت", "أوبر", "نون", "بي تك", "هايبر وان", "اسواق فتح الله"];
  const PEOPLE = ["Ahmed Ali", "Mona Hassan", "Sheikh", "Omar Khaled", "Nada"];
  const cur = (v, ar) => (ar ? pick([`${arD(E2(v))} جنيه`, `${E2(v)} جم`, `EGP ${E2(v)}`]) : pick([`EGP ${E2(v)}`, `${E2(v)} EGP`, `EGP ${E2(v)}`, `LE ${E2(v)}`]));
  const egp = () => int(20, 9000) + (rnd() < 0.5 ? pick([0.5, 0.25, 0.75, 0.99, 0]) : 0);
  // (last month = inside the 30 days read: the run put some before them — the test's mistake, fixed)
  // (on the 30th the 30 days read hold only one day of last month — the run clamped "last month" INTO this month: the test's mistake, fixed)
  const LO = Math.max(NOW - 30 * D + 36e5, M0 - 6 * D), HI = M0 - 36e5, LAST_OK = LO < HI;
  const when = (last) => (last ? LO + Math.floor(rnd() * (HI - LO)) : M0 + Math.floor(rnd() * (NOW - M0 - 36e5)));
  const SMS = (bank, text, ts) => ({ id: "s" + Math.floor(rnd() * 1e12), pkg: "com.google.android.apps.messaging", app: "Messages", title: bank, text, ts });
  const EMAIL = (from, lines, ts) => {
    lines = lines.flatMap((l) => (rnd() < 0.06 && l.length > 24 && / /.test(l.slice(8)) ? [l.slice(0, l.indexOf(" ", 8)), l.slice(l.indexOf(" ", 8) + 1)] : [l]))
      .map((l) => (rnd() < 0.04 ? "‏" + l : rnd() < 0.04 ? l.replace(/ /, "  ") : rnd() < 0.05 && /^(?:total|subtotal|amount paid|amount due|due date)\b/i.test(l) ? l.toUpperCase() : l));
    return { id: "e" + Math.floor(rnd() * 1e12), from, title: lines[0], text: lines.join("\n"), at: ts };
  };
  const smsSpend = (v, shop, ts, ar, bank) => { const d = new Date(ts), c = cur(v, ar);
    const t = ar ? pick([`تم خصم مبلغ ${c} من حسابكم رقم ****${t4()} عملية شراء من ${shop} بتاريخ ${ddmm(d)}`, `عملية شراء بمبلغ ${c} ببطاقة رقم ${t4()} من ${shop} يوم ${ddmm(d)}`, `تم خصم مبلغ EGP ${E2(v)}  من بطاقة الخصم المباشر المنتهية بـ **${t4()} عند ${shop} في ${ddmm(d)}`])
      : pick([`Your debit card ending ${t4()} was charged ${c} at ${shop} on ${ddmm(d)}. Available balance EGP ${E2(int(1000, 90000))}`, `Your credit card ${t4()} has been charged ${c} at ${shop}. Available limit EGP ${E2(int(5000, 90000))}`,
        `Dear customer, a POS transaction of ${c} at ${shop} was made with your card **${t4()}`, `Online purchase ${c} at ${shop} with card ending ${t4()}. Not you? Call 19666`, `Transaction alert: ${c} spent at ${shop} on your card x${t4()}`]);
    return SMS(bank, harden(t, rnd, { sms: true, keep: /\d[\d,]*\.\d\d/, allowCut: false }), ts); };
  const smsForeign = (v, c, shop, ts, bank) => SMS(bank, harden(pick([`Your credit card ending ${t4()} was charged for ${c} ${E2(v)} at ${shop} on ${ddmm(new Date(ts))}`, `Online purchase ${c} ${E2(v)} at ${shop} with card ending ${t4()}`, `Transaction alert: ${c} ${E2(v)} spent at ${shop} on your card x${t4()}`]), rnd, { sms: true, keep: /\d[\d,]*\.\d\d/, allowCut: false }), ts);

  let ok = 0; const wrong = [], shapes = [], tally = { parts: 0, twins: 0, checks: 0 };
  for (let i = 0; i < total; i++) {
    const sms = [], emails = [], want = { total: 0, foreign: {}, subs: 0, subsMonthly: 0, joined: 0, spend: 0, checks: [] };
    let rate = null, rateTs = null; const usdSubs = [], used = new Set();
    const parts = shuffle(Array.from({ length: int(3, 9) }, () => pick(["spend", "spend", "spend", "in", "noise", "noise", "shopmail", "news", "sub", "sub", "sub", "paypal", "lapsed"])));
    // (a PayPal payment and the shop's own invoice are made together)
    for (const p of parts) {
      tally.parts++;
      const bank = pick(BANKS), last = LAST_OK && rnd() < 0.15;
      if (p === "spend") { const v = egp(), ar = rnd() < 0.5, ts = when(last); sms.push(smsSpend(v, ar ? pick(SHOPS_AR) : pick(SHOPS), ts, ar, bank)); want.spend++; if (!last) want.total += v; }
      else if (p === "in") { const v = egp(), ar = rnd() < 0.5; sms.push(SMS(bank, harden(ar ? `تم إيداع مبلغ ${cur(v, true)} في حسابكم رقم ****${t4()} من ${pick(PEOPLE)}` : pick([`Your account ****${t4()} was credited with ${cur(v)} from ${pick(PEOPLE)}`, `You received ${cur(v)} from ${pick(PEOPLE)} via InstaPay. Ref ${int(100000, 999999)}`]), rnd, { sms: true, allowCut: false }), when(false))); }
      else if (p === "noise") { const v = egp(), ar = rnd() < 0.5, s = pick(SHOPS);
        const t = ar ? pick([`رمز التحقق ${int(100000, 999999)} لعملية شراء بمبلغ ${cur(v, true)} من ${s}. لا تشاركه مع أحد`, `تم رفض عملية شراء بمبلغ ${cur(v, true)} من ${s}`, `رصيدك المتاح ${cur(v * 9, true)}`, `استمتع بخصم ${int(5, 40)}% عند الدفع ببطاقتك لدى ${s} بحد أقصى ${cur(v, true)}`])
          : pick([`${int(100000, 999999)} is your OTP for a purchase of ${cur(v)} at ${s}. Do not share it`, `Your transaction of ${cur(v)} at ${s} was declined`, `Your available balance is ${cur(v * 9)}`, `Get ${int(5, 40)}% cashback at ${s} up to ${cur(v)} when you pay with your card`]);
        sms.push(SMS(bank, harden(t, rnd, { sms: true, allowCut: false }), when(false))); }
      else if (p === "shopmail") { const v = egp(), ts = when(last), shop = pick([["Talabat", "no-reply@talabat.com"], ["Amazon.eg", "auto-confirm@amazon.eg"], ["Noon", "orders@noon.com"], ["Uber", "noreply@uber.com"]]);
        emails.push(EMAIL(`${shop[0]} <${shop[1]}>`, shuffle([`Your ${shop[0]} order receipt`, `Thanks for your order`, `Order #${int(100000, 999999)}`]).slice(0, 2).concat([`Items: ${int(1, 5)}`, `Subtotal EGP ${E2(r2(v * 0.9))}`, `Delivery EGP ${E2(r2(v - r2(v * 0.9)))}`, `Total EGP ${E2(v)}`, `Paid with card •••• ${t4()}`]), ts)); want.spend++; if (!last) want.total += v; }
      else if (p === "news") emails.push(EMAIL(pick(["Noon <deals@noon.com>", "Jumia <news@jumia.com.eg>", "B.TECH <offers@btech.com>"]), [pick(["Black Friday is here", "White Friday deals", "This week only"]), `Up to ${int(20, 70)}% off`, `Prices from EGP ${E2(egp())}`, "Shop now", "Unsubscribe"], when(false)));
      else if (p === "sub" || p === "lapsed") {
        // (one person has each plan once — two "Claude Pro" plans would be one plan with two receipts)
        const kind = pick(["stripe", "gplay", "netflix"]), usd = kind === "stripe" ? rnd() < 0.7 : kind === "gplay" ? rnd() < 0.2 : rnd() < 0.3;
        const c = usd ? "USD" : "EGP", v = usd ? int(5, 60) + pick([0, 0.99, 0.8, 0.5]) : int(49, 1500) + pick([0, 0.99, 0.5]), year = kind !== "netflix" && rnd() < 0.15;
        const M = (x) => (c === "USD" ? pick(["$" + E2(x), E2(x) + " USD", "$" + E2(x) + " USD"]) : pick(["EGP " + E2(x), E2(x) + " EGP", "ج.م " + arD(E2(x).replace(/,/g, "٬").replace(/\.(\d\d)$/, ",$1"))]));
        const SV = kind === "stripe" ? [["Claude Pro", "Anthropic, PBC"], ["ChatGPT Plus", "OpenAI, LLC"], ["Cursor Pro", "Anysphere, Inc."], ["Notion Plus", "Notion Labs, Inc."], ["Midjourney Standard", "Midjourney Inc"]]
          : kind === "gplay" ? [["Google AI Pro (5 TB) (Google One)", "Google LLC"], ["YouTube Premium", "Google LLC"], ["Shahid VIP", "MBC"], ["Anghami Plus", "Anghami"], ["Spotify Premium", "Spotify AB"]] : [["Netflix", "Netflix"]];
        const free = SV.filter((x) => !used.has(x[0])); if (!free.length) continue; const [svc, shop] = pick(free); used.add(svc);   // (one Netflix per person — the run once gave a person a dollar AND a pound Netflix: the test's mistake, fixed)
        const mk = (ts) => { const d = new Date(ts), end = new Date(ts); if (year) end.setFullYear(end.getFullYear() + 1); else end.setMonth(end.getMonth() + 1);
          let from, lines;
          if (kind === "stripe") { from = `${shop} <invoice+statements@mail.${shop.split(/[ ,]/)[0].toLowerCase()}.com>`; const rn = `${int(1000, 9999)}-${int(1000, 9999)}`;
            lines = [`Your receipt from ${shop} #${rn}`, shop, `Receipt from ${shop}`, M(v), `Paid on ${longD(d)} with -`, t4(), `Receipt #${rn}`, `${shortD(d)}–${shortD(end)}, ${end.getFullYear()}`, svc, M(v), "Qty 1", "Subtotal", M(v), "Total", M(v), "Amount paid", M(v), "Powered by stripe"]; }
          else if (kind === "gplay") { from = "Google Play <googleplay-noreply@google.com>"; const pr = M(v) + (year ? "/year" : "/month");
            lines = ["Thank you", "Your subscription from Google Commerce Limited on", "Google Play continues and you've been charged. Manage", "your subscriptions", `Order number: SOP.${int(1000, 9999)}-${int(1000, 9999)}-${int(1000, 9999)}-${int(10000, 99999)}..${int(0, 9)}`,
              `Order date: ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} ${int(10, 23)}:${int(10, 59)}:${int(10, 59)} EET`, "Item", "Price", `${svc} (by`, pr, `${shop})`, "Auto-renewing subscription", `Total: ${pr}`, "Payment method:", `Mastercard-${t4()}`,
              "above) automatically, charged to the payment method provided until cancelled.", "Learn how to cancel. Keep this for your records."]; }
          else { from = "Netflix <info@account.netflix.com>"; lines = ["NETFLIX", pick(["Your membership", "Thanks for your payment"]), pick(["Standard", "Premium", "Basic"]), M(v), `Next billing date: ${end.getDate()} ${MONL[end.getMonth()]} ${end.getFullYear()}`   /* (the run wrote the payment's day with the next month — "31 December" for 1 Dec: the test's mistake, fixed) */, `Visa •••• ${t4()}`, "Manage membership"]; }
          return EMAIL(from, lines, ts); };
        if (p === "lapsed") {   // a plan whose last payment was months ago (stopped): its old receipts are in Gmail's year, but it is not a plan now
          const t0 = NOW - (year ? int(380, 395) : int(45, 200)) * D; emails.push(mk(t0)); if (!year && rnd() < 0.5) emails.push(mk(t0 - 30.4 * D)); continue; }
        // when: this month, last month, or (a yearly plan) months ago; earlier receipts of the same plan (Gmail's first read = a year)
        let lastS = last, ts = when(last); if (year && rnd() < 0.6) { ts = NOW - int(40, 330) * D; lastS = true; }
        emails.push(mk(ts));
        if (!year && rnd() < 0.35) for (let k = 1, n = int(1, 8); k <= n; k++) emails.push(mk(ts - k * 30.4 * D));
        const mv = year ? v / 12 : v; want.subs++;
        // its card SMS too (a twin) — the same currency as the card was charged in
        if (rnd() < 0.4 && NOW - ts < 30 * D) { const sts = ts + int(0, 30) * 6e4; if (c === "USD") sms.push(smsForeign(v, "USD", kind === "stripe" ? shop.split(/[ ,]/)[0].toUpperCase() : "GOOGLE", sts, bank)); else sms.push(smsSpend(v, kind === "netflix" ? "NETFLIX.COM" : "GOOGLE PLAY", sts, false, bank)); want.joined++; tally.twins++; }
        if (c === "USD") usdSubs.push({ v, mv, last: lastS }); else { want.subsMonthly += mv; if (!lastS) want.total += v; }
      }
      else if (p === "paypal") {
        const [payee, desc, host] = pick([["Dash Networks Inc", "ENZU.COM", "Enzu"], ["Hostinger International", "HOSTINGER", "Hostinger"], ["DigitalOcean LLC", "DIGITALOCEAN", "DigitalOcean"], ["Namecheap, Inc.", "NAMECHEAP", "Namecheap"]]);
        const usdV = int(5, 120) + pick([0, 0.99, 0.5]), rt = pick([54.33, 49.85, 50.12, 48.7]), egpV = r2(usdV * rt), ts = when(last), d = new Date(ts);
        if (rateTs == null || ts > rateTs) { rate = egpV / usdV; rateTs = ts; }   // (the NEWEST PayPal line gives the rate — the first run took the first one: the test's mistake, fixed)
        emails.push(EMAIL("PayPal <service@paypal.com>", ["Back", payee, `${d.getDate()} ${MONL[d.getMonth()]} ${d.getFullYear()} . Payment`, `−${E2(usdV)} USD`, "Paid with", "credit", `(MasterCard Credit`, `Card x-${t4()})`, `${E2(egpV)} EGP`,
          `You'll see "PAYPAL`, `*${desc}" on`, "your card", "statement.", "Seller info", payee, "Exchange rate", `${E2(egpV)} EGP = ${E2(usdV)} USD`, "Order summary", "Total", `${E2(usdV)} USD`], ts));
        want.spend++; if (!last) want.total += egpV;
        if (rnd() < 0.45) {   // the shop's own invoice for the next month, the same amount → "Check this one: same plan?"
          const gen = new Date(NOW - int(0, 6) * D), due = new Date(gen.getTime() + int(5, 14) * D), n = String(int(100000, 999999));
          emails.push(EMAIL(`${host} Billing <billing@${host.toLowerCase()}.com>`, [host.toLowerCase(), "Dear Ali Dibiki,", `This is a notice that an invoice has been generated on ${us(gen)}.`, `Invoice #${n}`, `Amount Due: $${usdV.toFixed(2)} USD`, `Due Date: ${us(due)}`,
            "Invoice Items", `VPS KVM 4GB - ${int(100000, 999999)}.sys.io`, `Sub Total: $${usdV.toFixed(2)} USD`, `Total: $${usdV.toFixed(2)} USD`, "Regards,", `${host} Staff`], gen.getTime()));
          want.checks.push("same"); tally.checks++;
        }
      }
    }
    // the dollar subscriptions: in pounds only with the person's own rate, else they stay in dollars (never an invented rate)
    for (const s of usdSubs) { if (rate != null) { want.subsMonthly += s.mv * rate; if (!last0(s)) want.total += r2(s.v * rate); } else if (!s.last) want.foreign.USD = r2((want.foreign.USD || 0) + s.v); }
    function last0(s) { return s.last; }
    const r = firstMonth({ sms: shuffle(sms), emails: shuffle(emails), now: NOW, home: "EGP", order: "dmy", teach: {} });
    const bad = [];
    if (Math.abs(r.total - r2(want.total)) > 0.05) bad.push(`total ${r.total} ≠ ${r2(want.total)}`);
    if (JSON.stringify(r.foreign) !== JSON.stringify(want.foreign)) bad.push(`foreign ${JSON.stringify(r.foreign)} ≠ ${JSON.stringify(want.foreign)}`);
    if (r.subs.length !== want.subs) bad.push(`subs ${r.subs.length} ≠ ${want.subs}`);
    if (Math.abs(r.subsMonthly - r2(want.subsMonthly)) > 0.05) bad.push(`monthly ${r.subsMonthly} ≠ ${r2(want.subsMonthly)}`);
    if (r.counts.joined !== want.joined) bad.push(`joined ${r.counts.joined} ≠ ${want.joined}`);
    if (r.spend.length !== want.spend) bad.push(`spend lines ${r.spend.length} ≠ ${want.spend}`);
    const cq = r.check.map((c) => c.q).sort().join(","), wq = want.checks.sort().join(",");
    if (cq !== wq) bad.push(`asks [${cq}] ≠ [${wq}]`);
    if (!bad.length) ok++; else if (wrong.length < 60) wrong.push({ bad, sms: sms.map((s) => s.text), emails: emails.map((e) => e.text.replace(/\n/g, " | ").slice(0, 200)), spend: r.spend.map((x) => [x.name, x.amount, x.cur, x.kind]), subs: r.subs.map((x) => [x.name, x.amount, x.cur]) });
    shapes.push(parts.join("+") + "|" + [...sms.map((s) => shapeOf(s.text)), ...emails.map((e) => shapeOf(e.title))].join("/"));
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`first minute: ${ok} / ${total} people right (${(100 * ok / total).toFixed(2)} %) · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %) · ${tally.parts} parts, ${tally.twins} twins, ${tally.checks} questions`);
    const seen = new Set(); for (const w of wrong) { const key = w.bad[0].replace(/[\d.]+/g, "#"); if (seen.has(key)) continue; seen.add(key); console.log("  WRONG " + w.bad.join("; ") + "\n    sms: " + w.sms.join(" ‖ ").slice(0, 400) + "\n    emails: " + w.emails.join(" ‖ ").slice(0, 400) + "\n    read: " + JSON.stringify(w.spend).slice(0, 300) + " subs " + JSON.stringify(w.subs)); if (seen.size > 12) break; }
  }
  return { right: ok, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
