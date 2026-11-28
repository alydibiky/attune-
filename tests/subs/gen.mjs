// v10.9.10 (Ali, 28 Nov 2026, Money Guardian screenshots: "90 percent of the money guardian is wrong" — "Egp Off", "Last Chance",
// "First Order", "Don T", "Order Your", "Talabat Deals", "Your Dessert", "Meta For" listed as monthly subscriptions; "Charged twice at
// Anthropic" — "I have 2 Claude accounts … it should understand the notification comes from 2 different emails").
// 10,000 HARD composed people. Each one has: real subscriptions (receipts by email and / or notification, 1–3 months, EN / Arabic,
// sometimes with an advert line inside the receipt), sometimes the SAME service on two email accounts, sometimes the bank's SMS for the
// same charge in Money, steady monthly payments to a local name in Money (3–4 months), one-off orders, and 3–14 ADVERTS composed from
// parts in random order (brand · hook · amount off · call to action, English / Arabic) — every text through harden().
// Attune must list exactly the real subscriptions (one per account), never an advert, never a one-off, and never say "charged twice"
// for two accounts — while a real double charge on one account is still caught.
//   node tests/subs/gen.mjs [seed]
import { harden, shapeReport } from "../lib/hard.mjs";
const O = await import("../../web-src/overpay.js");
const G = await import("../../web-src/guardian.js");
export const NOW = Date.parse("2026-11-28T10:00:00");
const D = 864e5, iso = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const SERVICES = [["Netflix", "Netflix", 240, "EGP"], ["Spotify", "Spotify", 70, "EGP"], ["Claude", "Anthropic", 20, "USD"], ["ChatGPT", "OpenAI", 20, "USD"], ["Shahid", "Shahid", 99, "EGP"],
  ["YouTube Premium", "YouTube Premium", 85, "EGP"], ["Anghami", "Anghami", 50, "EGP"], ["iCloud+", "iCloud", 30, "EGP"], ["Canva", "Canva", 12.99, "USD"], ["Duolingo", "Duolingo", 7.99, "USD"],
  ["Watch It", "WATCH IT", 75, "EGP"], ["Google One", "Google One", 50, "EGP"], ["Microsoft 365", "Microsoft 365", 6.99, "USD"], ["NordVPN", "NordVPN", 4.99, "USD"]];
const BRANDS = ["Talabat", "Breadfast", "Noon", "Enzu", "Rabbit", "Instashop", "Elmenus", "Meta", "Alex Forte", "Supplexon", "Your Dessert", "Mrsool", "Jumia", "Amazon.eg", "B.TECH", "Koshary El Tahrir", "Cook Door", "Carrefour", "Seoudi", "Gourmet", "طلبات", "نون", "بريدفاست"];
const LOCAL = ["Kids Academy", "Nour Water Delivery", "Sporting Club Fees", "Hany Tutor", "Fiber Home Net", "Sameh Driving School"];
const MAILS = ["ali.work@gmail.com", "ali.home@gmail.com", "a.dibiky@outlook.com", "me@attune.app", "ali2@gmail.com"];
const fmtAmt = (a, c, pick) => { const n = Number.isInteger(a) ? pick([String(a), a + ".00", a.toLocaleString("en-US")]) : a.toFixed(2);
  if (c === "USD") return pick(["$" + n, "USD " + n, n + " USD", "US$" + n]);
  return pick(["EGP " + n, n + " EGP", "LE " + n, n + " جنيه", "E£" + n].filter((x) => !/E£/.test(x))); };
export function gen(seed = 11, n = 10000) {
  let st = seed >>> 0; const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let z = st; z = Math.imul(z ^ (z >>> 15), z | 1); z ^= z + Math.imul(z ^ (z >>> 7), z | 61); return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cases = [];
  for (let i = 0; i < n; i++) {
    const notes = [], emails = [], txns = [], want = [];
    let nid = 0; const id = () => "x" + i + "-" + nid++;
    // real subscriptions
    const subs = shuffle([...SERVICES]).slice(0, 1 + Math.floor(rnd() * 4));
    const twoAcct = rnd() < 0.35 ? subs[0] : null; let twoAccts = [];
    for (const S of subs) {
      const [name, brand, amt0, cur] = S, accts = S === twoAcct ? shuffle([...MAILS]).slice(0, 2) : [rnd() < 0.6 ? pick(MAILS) : ""];
      for (const acct of accts) {
        const months = 1 + Math.floor(rnd() * 3), lastAgo = 1 + Math.floor(rnd() * 24), amt = amt0;
        // same day for both accounts sometimes (Ali's case: both Claude accounts on 13 Nov)
        const ago0 = S === twoAcct && acct === accts[1] && rnd() < 0.6 ? null : lastAgo;
        for (let m = 0; m < months; m++) {
          const at = NOW - ((ago0 == null ? subs.lastAgoTwin : ago0) + m * 30) * D + Math.floor(rnd() * 5) * 60000;
          if (m === 0 && S === twoAcct && acct === accts[0]) subs.lastAgoTwin = lastAgo;
          const a = fmtAmt(amt, cur, pick);
          const subj = pick([`Your receipt from ${brand}`, `${brand}: payment received`, `Receipt for your ${brand} subscription`, `Your ${brand} subscription has been renewed`, `${brand} — invoice for ${pick(["November", "this month", "your plan"])}`, `تم تجديد اشتراكك في ${brand}`, `إيصال اشتراك ${brand}`]);
          const parts = shuffle([pick([`You paid ${a}`, `Amount charged: ${a}`, `Total: ${a}`, `تم خصم ${a}`, `${a} was charged to your card ending ${1000 + Math.floor(rnd() * 8999)}`]),
            pick(["", `Plan: ${pick(["Pro", "Premium", "Individual", "Family"])}`, "Thanks for your payment.", "شكراً لاشتراكك"]),
            rnd() < 0.2 ? pick(["Discover new offers in the app.", "Don't miss our new deals!", "Invite a friend and get 20% off."]) : ""]).filter(Boolean);
          const text = harden(parts.join(pick([" ", ". ", "\n"])), rnd, { keep: /\d[\d.,]*/, allowCut: false });
          if (rnd() < 0.55) emails.push({ id: id(), kind: "email", from: `${brand} <billing@${brand.toLowerCase().replace(/\W/g, "")}.com>`, to: acct, title: subj, text, at });
          else notes.push({ id: id(), app: pick(["Gmail", "Outlook"]), title: subj, text, ts: at, acct });
          // the bank's SMS for the same charge, in Money (no account address)
          if (rnd() < 0.4) txns.push({ id: id(), type: "expense", amount: amt, currency: cur, note: brand.toUpperCase() + pick([" · CIB", " · NBE", " · Banque Misr", ""]), date: iso(at), created: at + 120000, source: "notification", evidence: { text: `Purchase ${a} at ${brand.toUpperCase()}`, app: "Messages", ts: at + 120000 } });
        }
        want.push(accts.length > 1 ? name.toLowerCase() + " (" + acct + ")" : name.toLowerCase());
      }
    }
    // steady monthly payments to a local name (Money): 3–4 months → a subscription
    if (rnd() < 0.5) { const L = pick(LOCAL), amt = 200 + Math.floor(rnd() * 1800), months = 3 + Math.floor(rnd() * 2), day0 = 1 + Math.floor(rnd() * 20);
      for (let m = 0; m < months; m++) txns.push({ id: id(), type: "expense", amount: amt, currency: "EGP", note: L + pick([" · CIB", "", " · InstaPay"]), date: iso(NOW - (day0 + m * 30) * D) });
      want.push(L.toLowerCase().split(" ").slice(0, 2).join(" ")); }   // (a local name is shown by its first two words, as Money names it)
    // one-off orders (Money) — not subscriptions
    for (let k = 0, m = Math.floor(rnd() * 3); k < m; k++) txns.push({ id: id(), type: "expense", amount: 80 + Math.floor(rnd() * 900), currency: "EGP", note: pick(BRANDS) + " order", date: iso(NOW - Math.floor(rnd() * 40) * D) });
    // adverts, composed
    for (let k = 0, m = 3 + Math.floor(rnd() * 12); k < m; k++) {
      const b = pick(BRANDS), amt = pick([50, 100, 150, 199, 295, 300, 800, 101, 3899]), ar = /[؀-ۿ]/.test(b) || rnd() < 0.3;
      const off = ar ? pick([`خصم ${amt} جنيه`, `وفر ${amt} جنيه`, `خصم ${pick([20, 30, 50])}%`]) : pick([`EGP ${amt} off`, `${amt} EGP off`, `${pick([20, 30, 50])}% off`, `save up to ${amt} EGP`, `LE ${amt} off`]);
      const hook = ar ? pick(["فرصة أخيرة!", "متفوتش العرض", "عرض لفترة محدودة", "جعان؟", ""]) : pick(["Last chance!", "Don't miss out", "Craving something sweet?", "Hungry?", "Limited time only", "Treat yourself", "Flash sale", ""]);
      const what = ar ? pick([`على أول طلب`, `على طلبك الجاي`, `على الحلويات`]) : pick(["your first order", "your next order", "orders over EGP 500", "desserts tonight", "this weekend"]);
      const cta = ar ? pick(["اطلب دلوقتي", `استخدم كود ${b.slice(0, 3).toUpperCase()}${amt}`, ""]) : pick(["Order now", `Use code ${String(b).replace(/\W/g, "").toUpperCase().slice(0, 5)}${amt}`, "Shop now", "Order your favourites", ""]);
      const parts = shuffle([hook, off + " " + (ar ? what : "on " + what), cta]).filter(Boolean);
      const t = harden(parts.join(pick([" ", " — ", ". ", "\n"])), rnd, { allowCut: true });
      notes.push({ id: id(), app: pick([b, "Talabat", "noon", "Instagram ads", "Gmail"]), title: pick([b, `${b} Deals`, ar ? b : "Your " + pick(["dessert", "order", "deal"]) + " is waiting"]), text: t, ts: NOW - Math.floor(rnd() * 30) * D });
    }
    // a real double charge on one account (control): two bank SMS minutes apart, same shop, same amount
    let dbl = null;
    if (rnd() < 0.25) { const at = NOW - 3 * D, amt = 450; dbl = "carrefour";
      txns.push({ id: id(), type: "expense", amount: amt, currency: "EGP", note: "CARREFOUR MAADI · CIB", date: iso(at), created: at, source: "notification", evidence: { text: "Purchase EGP 450 at CARREFOUR", app: "Messages", ts: at } });
      txns.push({ id: id(), type: "expense", amount: amt, currency: "EGP", note: "CARREFOUR MAADI · CIB", date: iso(at), created: at + 90000, source: "notification", evidence: { text: "Purchase EGP 450 at CARREFOUR", app: "Messages", ts: at + 90000 } }); }
    // the two accounts' charges also in Money (Ali's case: the Guardian said "Charged twice at Anthropic")
    let twin = null;
    if (twoAcct) { const [name, brand, amt, cur] = twoAcct, at = NOW - 15 * D; twin = brand.toLowerCase();
      const ac = twoAccts;
      for (const [k, a] of ac.entries()) txns.push({ id: id(), type: "expense", amount: amt, currency: cur, note: brand, date: iso(at), created: at + k * 60000, source: "notification", evidence: { text: `Your receipt from ${brand} ${amt}`, app: "Gmail", ts: at + k * 60000, acct: a } }); }
    cases.push({ notes, emails, ledger: { currency: "EGP", accounts: [{ id: "a1", currency: "EGP" }], txns: txns.map((t) => ({ account: "a1", ...t })) }, want: [...new Set(want)].sort(), dbl, twin });
  }
  return cases;
}
const norm = (s) => String(s).toLowerCase();
export function run(c) {
  const R = O.overpayCheck({ ledger: c.ledger, notes: c.notes, emails: c.emails, now: NOW, home: "EGP" });
  const got = [...new Set(R.subs.map((s) => norm(s.name)))].sort();
  const F = G.findings({ ledger: c.ledger, life: { items: [] }, now: NOW });
  const doubles = F.filter((f) => f.kind === "double" && f.sure).map((f) => norm(f.title));
  const okSubs = JSON.stringify(got) === JSON.stringify(c.want);
  const okTwin = !c.twin || !doubles.some((t) => t.includes(c.twin.split(" ")[0]));
  const okDbl = !c.dbl || doubles.some((t) => t.includes(c.dbl));
  return { ok: okSubs && okTwin && okDbl, got, okSubs, okTwin, okDbl };
}
if (process.argv[1] && process.argv[1].endsWith("gen.mjs")) {
  const cs = gen(+(process.argv[2] || 11)); let good = 0; const why = { subs: 0, twin: 0, dbl: 0 }; const ex = [];
  for (const c of cs) { const r = run(c); if (r.ok) good++; else { if (!r.okSubs) why.subs++; if (!r.okTwin) why.twin++; if (!r.okDbl) why.dbl++; if (ex.length < 10) ex.push(`want ${JSON.stringify(c.want)} got ${JSON.stringify(r.got)} twin ${r.okTwin} dbl ${r.okDbl}`); } }
  const sh = shapeReport(cs.map((c) => c.notes.map((n) => n.text).join(" | ")));
  console.log(`subs 10,000 HARD: ${(good / cs.length * 100).toFixed(2)} % · ${(sh.share * 100).toFixed(0)} % different shapes · misses ${JSON.stringify(why)}`);
  for (const e of ex) console.log("  " + e);
}
