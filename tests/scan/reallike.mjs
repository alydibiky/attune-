// v10.9.4 (Ali, 23 Nov 2026: "do random subscription screenshots like the ones I sent — train it on more generated screenshots, they won't be
// different than those a lot"). EXACTLY 10,000 screenshots' text in the LAYOUTS of his real ones (tests/scan/real/ali-2026-11-23.mjs), every
// value random: the company / app, the plan, the amount, 30 currencies (Arabic digits where the phone shows them), VAT rates, dates in the
// layout's own style (US invoices month/day), the card's last 4, order / invoice / receipt numbers, extra lines in any order.
//   stripe   "Your receipt from X #…" · "$22.80" · "Paid on … with - 2969" · "Nov 12–Dec 12, 2026" · Subtotal / Total excluding tax / VAT / Total /
//            Amount paid                                                   → subscription, the amount paid, monthly / yearly, the period's end
//   gplay    "Your subscription from … on Google Play continues and you've been charged" · "App (by Dev)" · "ج.م ٩٣٩,٩٩/month" · Includes VAT ·
//            Mastercard-2969                                               → subscription, that price, monthly / yearly
//   apple    Apple's receipt: BILLED TO Visa •••• 1234 · "iCloud+ with 200 GB Storage" · Monthly · Renews … · TOTAL
//   netflix  "Your membership" · plan · price · "Next billing date"
//   paypal   "Merchant" · "29 September 2026 . Payment" · "−65.00 USD" · Paid with … x-2969 · "3,531.67 EGP = 65.00 USD" · Total
//                                                                          → a receipt: the pounds that left the card, the dollars as the price
//   invoice  WHMCS "an invoice has been generated on 11/17/2026" · Amount Due · Due Date · items with their period · Total · Pay Now
//                                                                          → a bill (not paid): amount due, due date (the paper's date order)
//   summary  Gmail's card "Claude Pro / Anthropic, PBC / Ordered from / Items" with NO price → never saved as a subscription (it asks)
//     node tests/scan/reallike.mjs   (10,000)   SEED_SHIFT=1 → another 10,000 (held-out, written after the fixes)
import { readScan } from "../../web-src/scanread.js";
import { shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";

export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261126 + 9973 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const NOW = Date.parse("2026-11-23T12:00:00") + shift * 86400e3, D = 864e5;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const AR = "٠١٢٣٤٥٦٧٨٩", ar = (s) => String(s).replace(/,/g, "٬").replace(/\./g, ",").replace(/\d/g, (d) => AR[+d]);   // (as the phones show it: ٬ thousands, , decimals — Ali's «٩٣٩,٩٩»)
  const last4 = () => String(int(1000, 9999));
  // the companies / apps — known ones (Attune's list) and ones it never heard of (the service comes from the receipt itself)
  const STRIPE = [["Anthropic, PBC", "Claude Pro", "Claude"], ["Anthropic, PBC", "Claude Max", "Claude"], ["OpenAI, LLC", "ChatGPT Plus", "ChatGPT"], ["Midjourney Inc", "Standard Plan", "Midjourney"],
    ["Anysphere, Inc.", "Cursor Pro", "Cursor"], ["Perplexity AI, Inc.", "Perplexity Pro", "Perplexity"], ["Figma, Inc.", "Figma Professional", "Figma"], ["Notion Labs, Inc.", "Notion Plus", "Notion"],
    ["Replit, Inc.", "Replit Core", "Replit"], ["Linear Orbit, Inc.", "Linear Standard", "Linear"], ["ElevenLabs Inc", "Creator", "ElevenLabs"], ["Grammarly, Inc.", "Grammarly Pro", "Grammarly"]];
  const GPLAY = [["Google AI Pro (5 TB) (Google One)", "Google LLC", "Google One"], ["YouTube Premium", "Google LLC", "YouTube Premium"], ["Duolingo Super", "Duolingo", "Duolingo"],
    ["Spotify Premium", "Spotify AB", "Spotify"], ["Remini - AI Photo Enhancer", "Bending Spoons", "Remini"], ["Calm Premium", "Calm.com", "Calm"], ["Tinder Gold", "Tinder LLC", "Tinder"],
    ["CapCut Pro", "Bytedance", "CapCut"], ["Shahid VIP", "MBC", "Shahid VIP"], ["Anghami Plus", "Anghami", "Anghami"], ["Truecaller Premium", "Truecaller", "Truecaller"], ["PicsArt Gold", "PicsArt", "PicsArt"]];
  const APPLE = [["iCloud+ with 200 GB Storage", "Apple"], ["iCloud+ with 2 TB Storage", "Apple"], ["Apple Music (Individual)", "Apple"], ["Apple One (Individual)", "Apple"], ["Apple TV+", "Apple"]];
  const PAYEES = [["Dash Networks Inc", "ENZU.COM"], ["Hostinger International", "HOSTINGER"], ["Namecheap, Inc.", "NAMECHEAP"], ["DigitalOcean LLC", "DIGITALOCEAN"], ["eBay Inc.", "EBAY"], ["Steam", "STEAM"]];
  const CUR = [["USD", (v) => pick(["$" + v, v + " USD", "$" + v + " USD", "US$" + v])], ["EUR", (v) => pick(["€" + v, v + " EUR"])], ["GBP", (v) => pick(["£" + v, v + " GBP"])],
    ["EGP", (v) => pick(["EGP " + v, v + " EGP", "ج.م " + ar(v), "LE " + v])], ["SAR", (v) => pick(["SAR " + v, v + " SAR", "ر.س " + ar(v)])],
    ["AED", (v) => pick(["AED " + v, v + " AED", "د.إ " + ar(v)])], ["INR", (v) => pick(["₹" + v, "INR " + v])], ["TRY", (v) => pick(["₺" + v, v + " TL"])], ["KWD", (v) => "KWD " + v], ["QAR", (v) => "QAR " + v]];
  const money = (v, [, f]) => f(v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const longD = (d) => `${MONL[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, shortD = (d) => `${MON[d.getMonth()]} ${d.getDate()}`, dmy = (d) => `${d.getDate()} ${pick([MON, MONL])[d.getMonth()]} ${d.getFullYear()}`;
  const us = (d) => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  let ok = 0; const wrong = [], shapes = [], byKind = {};
  for (let i = 0; i < total; i++) {
    const kind = pick(["stripe", "stripe", "gplay", "gplay", "apple", "netflix", "paypal", "paypal", "invoice", "invoice", "summary"]);
    let lines = [], exp;
    const cur = pick(CUR), year = rnd() < 0.85, net = int(3, year ? 2400 : 300) + pick([0, 0.99, 0.5, 0]), vatP = pick([0, 0, 14, 15, 5, 20, 18]), vat = +(net * vatP / 100).toFixed(2), tot = +(net + vat).toFixed(2);
    const paidD = new Date(NOW - int(0, 20) * D), endD = new Date(paidD); if (year) endD.setMonth(endD.getMonth() + 1); else endD.setFullYear(endD.getFullYear() + 1);
    const l4 = last4();
    if (kind === "stripe") {
      const [co, plan, svc] = pick(STRIPE), rn = `${int(1000, 9999)}-${int(1000, 9999)}-${int(1000, 9999)}`;
      lines = [`Your receipt from ${co} #${rn}`, ...(rnd() < 0.5 ? ["Inbox", plan, co, "Ordered from", co, "Items", plan] : []), co, `Receipt from ${co}`, money(tot, cur), `Paid on ${longD(paidD)} with -`, l4,
        `Receipt #${rn}`, `${shortD(paidD)}–${shortD(endD)}, ${endD.getFullYear()}`, plan, money(net, cur), "Qty 1", "Subtotal", money(net, cur), ...(vatP ? ["Total excluding tax", money(net, cur), `VAT - ${pick(["Egypt", "Saudi Arabia", "UAE", "Germany", "India"])} (${vatP}%)`, money(vat, cur)] : []),
        "Total", money(tot, cur), "Amount paid", money(tot, cur), "Download receipt", "Download invoice", "Questions? Visit our support site.", "Powered by stripe"];
      exp = { kind: "subscription", service: svc, amount: tot, currency: cur[0], cycle: year ? "month" : "year", next: iso(endD), last4: l4 };
    } else if (kind === "gplay") {
      const [app, dev, svc] = pick(GPLAY), per = year ? "/month" : "/year", c = pick(CUR.filter((x) => ["EGP", "SAR", "AED", "USD", "EUR", "INR", "TRY"].includes(x[0])));
      const p = money(tot, c) + per, card = pick(["Mastercard", "Visa", "Meeza"]) + "-" + l4;
      lines = ["Thank you", `Your subscription from ${pick(["Google Commerce Limited", dev])} on`, "Google Play continues and you've been charged. Manage", "your subscriptions",
        `Order number: ${pick(["SOP", "GPA"])}.${int(1000, 9999)}-${int(1000, 9999)}-${int(1000, 9999)}-${int(10000, 99999)}..${int(0, 9)}`, `Order date: ${dmy(paidD)} ${int(10, 23)}:${int(10, 59)}:${int(10, 59)} EET`,
        "Your account: someone@gmail.com", "Item", "Price", `${app} (by`, p, `${dev})`, "Auto-renewing subscription", `Total: ${p}`, ...(vatP ? [`(Includes VAT of ${money(vat, c)})`] : []),
        "Payment method:", card, "By subscribing, you authorise us to charge you the subscription cost (as described", "above) automatically, charged to the payment method provided until cancelled.", "Learn how to cancel. Keep this for your records."];
      exp = { kind: "subscription", service: svc, amount: tot, currency: c[0], cycle: year ? "month" : "year", last4: l4 };
    } else if (kind === "apple") {
      const [item] = pick(APPLE), c = pick(CUR.filter((x) => ["EGP", "SAR", "AED", "USD", "GBP", "EUR"].includes(x[0])));
      lines = ["Receipt", "APPLE ACCOUNT", "someone@icloud.com", "BILLED TO", `Visa •••• ${l4}`, "DATE", dmy(paidD), "ORDER ID", `M${int(100000000, 999999999)}`, "DOCUMENT NO.", String(int(100000000000, 999999999999)),
        "App Store", item, year ? "Monthly" : "Yearly", `Renews ${dmy(endD)}`, money(net, c), ...(vatP ? ["Subtotal", money(net, c), `VAT charged at ${vatP}%`, money(vat, c)] : []), "TOTAL", money(tot, c)];
      exp = { kind: "subscription", service: "Apple", amount: tot, currency: c[0], cycle: year ? "month" : "year", next: iso(endD), last4: l4 };
    } else if (kind === "netflix") {
      endD.setTime(paidD.getTime()); endD.setMonth(endD.getMonth() + 1);   // (Netflix bills every month)
      const c = pick(CUR.filter((x) => ["EGP", "SAR", "AED", "USD", "EUR", "GBP"].includes(x[0])));
      lines = ["NETFLIX", pick(["Your membership", "Your account", "Thanks for your payment"]), pick(["Standard", "Premium", "Basic", "Standard with ads"]), money(tot, c), `Next billing date: ${dmy(endD)}`, pick(["Visa", "Mastercard"]) + ` •••• ${l4}`, "Manage membership"];
      exp = { kind: "subscription", service: "Netflix", amount: tot, currency: c[0], cycle: "month", next: iso(endD), last4: l4 };
    } else if (kind === "paypal") {
      const [payee, desc] = pick(PAYEES), c = pick(CUR.filter((x) => ["USD", "EUR", "GBP"].includes(x[0]))), rate = { USD: 54.33, EUR: 58.9, GBP: 68.2 }[c[0]], egp = +(tot * rate).toFixed(2);
      const E = (v) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      lines = ["Back", payee, `${paidD.getDate()} ${MONL[paidD.getMonth()]} ${paidD.getFullYear()} . Payment`, `−${E(tot)} ${c[0]}`, "Paid with", "credit", `(${pick(["MasterCard", "Visa"])} Credit`, `Card x-${l4})`, `${E(egp)} EGP`,
        `You'll see "PAYPAL`, `*${desc}" on`, "your card", "statement.", "Seller info", payee, `${int(200, 999)}-${int(100, 999)}-${int(1000, 9999)}`, "Exchange rate", `${E(egp)} EGP = ${E(tot)} ${c[0]}`, `1 EGP = ${c[0] === "USD" ? "$" : ""}${(1 / rate).toFixed(4)} ${c[0]}`,
        "Invoice ID", String(int(100000, 999999)), "Order summary", "Total", `${E(tot)} ${c[0]}`];
      exp = { kind: "receipt", amount: egp, currency: "EGP", original: { amount: tot, currency: c[0] } };
    } else if (kind === "invoice") {
      const gen = new Date(NOW - int(0, 10) * D), due = new Date(gen.getTime() + int(5, 20) * D), pe = new Date(due.getTime() + 30 * D), n = String(int(100000, 999999));
      const host = pick(["Enzu", "BudgetVM", "HostHatch", "RackNerd", "Contabo", "Hetzner Online"]);
      lines = [host.toLowerCase(), `Dear ${pick(["Ali Dibiki", "Mohamed Hassan", "Sara Ibrahim"])},`, `This is a notice that an invoice has been generated on ${us(gen)}.`, `Invoice #${n}`, `Amount Due: $${tot.toFixed(2)} USD`, `Due Date: ${us(due)}`,
        "Invoice Items", `${pick(["Cloud | G.16 | 8 vCPU, 16GB, 250GB NVMe", "VPS KVM 4GB", "Dedicated Server E3-1230"])} - ${int(100000, 999999)}.sys.ipv4.io`, `(${us(due)} - ${us(pe)}) $${tot.toFixed(2)} USD`,
        ...shuffle([`Cores: (${int(2, 16)}) Intel Xeon`, `RAM: ${pick([4, 8, 16, 32])} GB MEMORY`, `Drive 1: ${pick([100, 250, 500])} GB NVMe`, "IPv4 Space: 1 IP Addresses", `Location: US - ${pick(["Central - Detroit", "East - New York", "West - LA"])}`]),
        "Promotional Code: SPECIALPRICING - $0.00 USD Recurring Discount", "$0.00 USD", "------------------------------", `Sub Total: $${tot.toFixed(2)} USD`, "Credit: $0.00 USD", `Total: $${tot.toFixed(2)} USD`,
        "------------------------------", `Please login at https://portal.${host.toLowerCase().replace(/\s.*/, "")}.com/MyBilling/Invoice/${n}`, "and click Pay Now then following the instructions on screen.", "Regards,", `${host} Staff`];
      exp = { kind: "bill", amount: tot, currency: "USD", due: iso(due) };
    } else {
      const [co, plan] = pick(STRIPE);
      lines = [`Your receipt from ${co} #${int(1000, 9999)}-${int(1000, 9999)}-${int(1000, 9999)}`, "Inbox", plan, co, "Ordered from", co, "Items", plan, "Is this correct?"];
      exp = { kind: "ask" };
    }
    // what is around the receipt on a real screen: Gmail's header, a footer; labels in capitals in some apps
    if (rnd() < 0.6) lines.unshift(...shuffle(["Inbox", "From: " + pick(["billing", "receipts", "noreply", "no-reply"]) + "@" + pick(["stripe.com", "google.com", "apple.com", "paypal.com", "mail.example.com"]), "to me", pick(["Nov 13", "Yesterday", "10:42", "Sat, Nov 7"]), "Reply", "⋮"]).slice(0, int(1, 4)));
    if (rnd() < 0.6) lines.push(...shuffle(["Reply", "Forward", "Is this correct?", "Questions? Contact us", "Unsubscribe", "Privacy Policy", "© 2026 All rights reserved", "Manage your account", "Help Centre"]).slice(0, int(1, 4)));
    if (rnd() < 0.25) lines = lines.map((l) => (/^(?:total|subtotal|amount paid|amount due|due date|price|item|paid with|order summary)\b/i.test(l) ? l.toUpperCase() : l));
    // the phone's reader: sometimes a line is split in two, a direction mark, spaces doubled
    lines = lines.flatMap((l) => (rnd() < 0.08 && l.length > 24 && / /.test(l.slice(8)) ? [l.slice(0, l.indexOf(" ", 8)), l.slice(l.indexOf(" ", 8) + 1)] : [l])).map((l) => (rnd() < 0.04 ? "‏" + l : rnd() < 0.04 ? l.replace(/ /, "  ") : l));
    const text = lines.join("\n");
    const r = readScan(text, { now: NOW, home: "EGP", order: "dmy" }), d = r.data || {};
    const bad = [];
    if (exp.kind === "ask") { if (r.sure && r.kind === "subscription") bad.push("saved a subscription with no price"); }
    else {
      if (r.kind !== exp.kind) bad.push("kind " + r.kind);
      else {
        if (!r.sure) bad.push("not sure (" + r.why + ")");
        if (exp.service && !(String(d.service || "").toLowerCase().includes(exp.service.toLowerCase()))) bad.push("service " + d.service);
        if (Math.abs((d.amount || 0) - exp.amount) > 0.005) bad.push("amount " + d.amount);
        if (d.currency !== exp.currency) bad.push("currency " + d.currency);
        if (exp.cycle && d.cycle !== exp.cycle) bad.push("cycle " + d.cycle);
        if (exp.next && d.next !== exp.next) bad.push("next " + d.next + " ≠ " + exp.next);
        if (exp.last4 && d.last4 !== exp.last4) bad.push("card " + d.last4);
        if (exp.due && d.due !== exp.due) bad.push("due " + d.due + " ≠ " + exp.due);
        if (exp.original && !(d.original && Math.abs(d.original.amount - exp.original.amount) < 0.005 && d.original.currency === exp.original.currency)) bad.push("original price");
      }
    }
    byKind[kind] = byKind[kind] || [0, 0]; byKind[kind][1]++;
    if (!bad.length) { ok++; byKind[kind][0]++; } else if (wrong.length < 80) wrong.push({ kind, bad, text });
    shapes.push(kind + "|" + shapeOf(text));
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`real-like screenshots: ${ok} / ${total} right (${(100 * ok / total).toFixed(2)} %) · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
    console.log("  " + Object.entries(byKind).map(([k, [a, b]]) => `${k} ${a}/${b}`).join(" · "));
    const seen = new Set(); for (const w of wrong) { const key = w.kind + w.bad[0].replace(/[\d.]+/g, "#"); if (seen.has(key)) continue; seen.add(key); console.log("  WRONG " + w.kind + ": " + w.bad.join(", ") + "\n    " + w.text.replace(/\n/g, " | ").slice(0, 330)); if (seen.size > 14) break; }
  }
  return { right: ok, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
