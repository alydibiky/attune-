// v10.9.10 REPAIR P1 (Ali, 28 Nov 2026: "90 percent of the money guardian is wrong"): ONE advert decision (web-src/adverts.js) for every
// reader. 10,000 HARD composed notifications — half ADVERTS (brand · hook · amount off / % / cashback / "plans from" · what · call to
// act, English / Egyptian, in random order) and half REAL MONEY that carries advert-looking words (a receipt with "use code SAVE20 next
// time", a bank debit «خصم 250 جنيه من حسابك», a renewal «تم تجديد باقتك… استمتع بضعف الدقايق», "Invite a friend and get 20% off"
// under a payment). Every text goes through harden(). EVERY reader must agree:
//   advert → paylog.readNotification drops it · notifmeaning kind "promo" (or not money) · Autopilot makes no money card ·
//            overpay.readSource finds no charge
//   money  → paylog keeps it with the RIGHT amount · overpay is never "advert" (isPromo false) · isAdvert false
//   node tests/adverts/gen.mjs [seed]
import { harden, shapeReport } from "../lib/hard.mjs";
globalThis.localStorage = globalThis.localStorage || { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
const A = await import("../../web-src/adverts.js");
const P = await import("../../web-src/paylog.js");
const NM = await import("../../web-src/notifmeaning.js");
const AP = await import("../../web-src/autopilot.js");
const OP = await import("../../web-src/overpay.js");
export const NOW = Date.parse("2026-11-28T12:00:00");
const BRANDS = ["Talabat", "Breadfast", "Noon", "Enzu", "Rabbit", "Instashop", "Elmenus", "Jumia", "Amazon.eg", "B.TECH", "Cook Door", "Carrefour", "Seoudi", "Gourmet", "Vodafone", "Orange", "WE", "CIB", "NBE", "Uber", "Careem", "Netflix", "Spotify", "Shahid", "Supplexon", "Alex Forte"];
const BRANDS_AR = ["طلبات", "نون", "بريدفاست", "فودافون", "اورنج", "كارفور", "سعودي", "جوميا"];
const NAMES = ["AHMED ALI", "MONA SAMIR", "Omar Hassan", "Sara Adel", "أحمد علي", "منى سمير"];
const SHOPS = ["SEOUDI MARKET", "CARREFOUR MAADI", "TALABAT", "UBER", "ZARA CITY STARS", "ELEZABY PHARMACY", "CAREEM", "AMAZON.EG", "NOON"];
export function gen(seed = 17, n = 10000) {
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let z = st; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const amt = () => pick([50, 85, 99, 100, 120, 150, 199, 250, 295, 300, 450, 800, 1200, 3899]);
  const money = (a, ar) => (ar ? pick([`${a} جنيه`, `${a} ج.م`, `${a} جم`]) : pick([`EGP ${a}`, `${a} EGP`, `LE ${a}`, `EGP ${a}.00`, `${a.toLocaleString("en-US")} EGP`]));
  const cases = [];
  for (let i = 0; i < n; i++) {
    const ar = rnd() < 0.35, kind = rnd() < 0.5 ? "ad" : "money";
    let title, text, want = 0, app = "Messages";
    if (kind === "ad") {
      const b = ar ? pick(BRANDS_AR) : pick(BRANDS), a = amt(), pct = pick([10, 20, 25, 30, 40, 50, 70]);
      const off = ar ? pick([`خصم ${a} جنيه`, `وفر ${a} جنيه`, `خصم ${pct}%`, `كاش باك ${pct}%`, `خصم ${pct}٪ على كل حاجة`, `توصيل مجاني`])
        : pick([`${money(a)} off`, `${pct}% off`, `save up to ${money(a)}`, `${pct}% cashback up to ${money(a)}`, `plans from ${money(a)}/month`, `get ${money(a)} off`, `free delivery`, `buy 1 get 1 free`]);
      const hook = ar ? pick(["فرصة أخيرة!", "متفوتش العرض", "عرض لفترة محدودة", "جعان؟", "عروض الويك إند", ""]) : pick(["Last chance!", "Don't miss out", "Craving something sweet?", "Hungry?", "Limited time only", "Treat yourself", "Flash sale", "New on " + b + " this week!", ""]);
      const what = ar ? pick(["على أول طلب", "على طلبك الجاي", "على الحلويات", "لما تدفع ببطاقتك", ""]) : pick(["on your first order", "on your next order", "on orders over " + money(500), "when you pay with your card", "this weekend", ""]);
      const cta = ar ? pick(["اطلب دلوقتي", `استخدم كود ${pick(["NEW", "EID", "SAVE"])}${a}`, "اشحن رصيدك واحصل على هدية", ""]) : pick(["Order now", `Use code ${pick(["NEW", "EID", "SAVE"])}${a}`, "Shop now", "Upgrade now", "Watch now", "Join now", ""]);
      const extra = rnd() < 0.4 ? (ar ? pick(["العرض ساري حتى " + (1 + Math.floor(rnd() * 28)) + " ديسمبر", "على كل الفروع", "🎉🎉", "الشروط والأحكام تنطبق", "حمل التطبيق"]) : pick(["Valid until " + (1 + Math.floor(rnd() * 28)) + " Dec", "T&Cs apply", "🔥🔥", "In all branches", "Download the app", "Only on the app", "Tap to see more"])) : "";
      text = shuffle([hook, (off + " " + what).trim(), cta, extra]).filter(Boolean).join(pick([" ", " — ", ". ", "\n", " | ", "! "]));
      title = pick([b, b + " Deals", b + " offers", "Your " + pick(["dessert", "order", "deal"]) + " is waiting", b]);
      app = pick([b, "Talabat", "noon", "Gmail", "Messages"]);
    } else {
      const a = amt(); want = a;
      const shape = pick(["receipt", "bankdebit", "renewal", "wallet", "card"]);
      const tail = ar ? pick(["استمتع بضعف الدقايق", "اكسب نقاط مع كل عملية", "عروض خاصة على تطبيقنا", ""]) : pick(["Use code SAVE20 next time for 20% off", "Invite a friend and get 20% off", "Discover new offers in the app", "Enjoy free delivery on your next order", ""]);
      if (shape === "receipt") { const b = pick(BRANDS); title = b; app = pick([b, "Gmail"]); text = pick([`Your order total ${money(a)} has been confirmed.`, `Receipt: you paid ${money(a)} to ${b}.`, `Thanks for your purchase — ${money(a)} charged.`, `Payment of ${money(a)} received. Thank you!`]); }
      if (shape === "bankdebit") { title = pick(["CIB", "NBE", "Banque Misr", "QNB"]); text = ar ? pick([`تم خصم ${money(a, true)} من حسابكم رقم ****${1000 + Math.floor(rnd() * 8999)} عملية شراء من ${pick(SHOPS)}`, `خصم ${money(a, true)} من حسابك المنتهي ب ${1000 + Math.floor(rnd() * 8999)} لصالح ${pick(SHOPS)}`])
        : pick([`Purchase ${money(a)} at ${pick(SHOPS)} card ****${1000 + Math.floor(rnd() * 8999)}`, `Your card was charged ${money(a)} at ${pick(SHOPS)}`, `${money(a)} debited from your account for ${pick(SHOPS)}`]); }
      if (shape === "renewal") { title = pick(["Vodafone", "Orange", "WE", "Etisalat"]); text = ar ? `تم تجديد باقتك بنجاح بقيمة ${money(a, true)}` : pick([`Your bundle has been renewed for ${money(a)}`, `Your package renewed successfully: ${money(a)}`]); }
      if (shape === "wallet") { title = pick(["InstaPay", "Vodafone Cash", "Fawry"]); text = ar ? `تم تحويل ${money(a, true)} إلى ${pick(NAMES)} بنجاح` : pick([`You sent ${money(a)} to ${pick(NAMES)}`, `You paid ${money(a)} to ${pick(NAMES)}`]); }
      if (shape === "card") { title = pick(["Visa", "Mastercard", "CIB"]); text = pick([`Transaction approved: ${money(a)} at ${pick(SHOPS)}`, `${money(a)} was charged to your card ending ${1000 + Math.floor(rnd() * 8999)} at ${pick(SHOPS)}`]); }
      // the real-world extras banks and shops add, in random order: a greeting, the date / time, a reference, the balance AFTER it
      // (a balance must never be taken as the amount), a help line
      const d = 1 + Math.floor(rnd() * 28), hh = Math.floor(rnd() * 24), mm = String(Math.floor(rnd() * 60)).padStart(2, "0"), bal = 1000 + Math.floor(rnd() * 90000);
      const extras = shuffle([
        rnd() < 0.35 ? (ar ? pick(["عميلنا العزيز،", "عزيزي العميل", "مرحباً"]) : pick(["Dear customer,", "Dear Client", "Hi,", "Hello Ali,"])) : "",
        rnd() < 0.4 ? (ar ? pick([`يوم ${d}/11 الساعة ${hh}:${mm}`, `بتاريخ ${d}-11-2026`]) : pick([`on ${d}/11 at ${hh}:${mm}`, `on ${d} Nov 2026`, `${d}-11-2026 ${hh}:${mm}`])) : "",
        rnd() < 0.3 ? (ar ? `رقم العملية ${100000 + Math.floor(rnd() * 899999)}` : pick([`Ref ${100000 + Math.floor(rnd() * 899999)}`, `Txn ID: ${Math.floor(rnd() * 1e9)}`])) : "",
        rnd() < 0.3 ? (ar ? `رصيدك المتاح ${bal} جنيه` : pick([`Available balance EGP ${bal.toLocaleString("en-US")}`, `Avl bal: ${bal} EGP`])) : "",
        rnd() < 0.2 ? (ar ? "للاستفسار اتصل 19623" : pick(["For help call 19666", "Not you? Call 16999"])) : "",
      ]).filter(Boolean);
      const parts = shuffle([text, ...extras.filter((x) => !/balance|bal:|رصيدك|call|اتصل/i.test(x))]);
      text = [...parts, ...extras.filter((x) => /balance|bal:|رصيدك|call|اتصل/i.test(x))].join(pick([" ", ". ", "\n", " | "]));
      if (tail) text = text + pick([" ", "\n", ". "]) + tail;
    }
    text = harden(text, rnd, { keep: kind === "money" ? new RegExp(String(want)) : null, allowCut: false, sms: app === "Messages" });
    cases.push({ id: "a" + i, kind, app, title, text, want });
  }
  return cases;
}
export function check(c) {
  const n = { id: c.id, app: c.app, pkg: c.app.toLowerCase(), title: c.title, text: c.text, ts: NOW }, all = c.title + " — " + c.text;
  const pl = P.readNotification(n, { teach: [] }, {});
  const nm = (() => { try { return NM.understandNote(n); } catch (e) { return {}; } })();
  const ap = (() => { try { return AP.suggestFrom(n, { now: NOW }); } catch (e) { return null; } })();
  const op = OP.readSource({ id: c.id, kind: "notification", title: c.title, text: c.text, at: NOW }, { now: NOW });
  const bad = [];
  if (c.kind === "ad") {
    if (!A.isAdvert(all)) bad.push("isAdvert=false");
    if (pl) bad.push("paylog kept " + pl.amount);
    if (ap && (ap.kind === "expense" || ap.kind === "income" || ap.kind === "subscription")) bad.push("autopilot " + ap.kind + " " + ap.amount);
    if (op.some((e) => e.type === "charge")) bad.push("overpay charge");
    if (nm && nm.kind && !/promo|other|notice|info|^$/.test(nm.kind) && /money|paid|bill/.test(nm.kind)) bad.push("meaning " + nm.kind);
  } else {
    if (A.isAdvert(all)) bad.push("isAdvert=true");
    if (OP.isPromo(all)) bad.push("overpay promo");
    if (!pl) bad.push("paylog dropped");
    else if (Math.abs(pl.amount - c.want) > 0.01) bad.push("paylog amount " + pl.amount);
    if (nm && nm.kind === "promo") bad.push("meaning promo");
  }
  return bad;
}
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  const cs = gen(+(process.argv[2] || 17)); let good = 0; const by = {}; const ex = [];
  for (const c of cs) { const b = check(c); if (!b.length) good++; else { for (const x of b) { const k = c.kind + ": " + x.replace(/[\d.]+/g, "N"); by[k] = (by[k] || 0) + 1; } if (ex.length < 14) ex.push(`[${c.kind}] ${JSON.stringify(c.title + " — " + c.text).slice(0, 170)} → ${b.join(", ")}`); } }
  const sh = shapeReport(cs.map((c) => c.text));
  console.log(`adverts 10,000 HARD: ${(good / cs.length * 100).toFixed(2)} % · ${(sh.share * 100).toFixed(0)} % different shapes · misses ${JSON.stringify(by)}`);
  for (const e of ex) console.log("  " + e);
}
