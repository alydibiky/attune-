// v9.8 (Ali, 7 Nov): his 15-point list — every mistake he found gets a test so it can't come back
globalThis.localStorage = { _: {}, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
import assert from "node:assert/strict";
const L = await import("../../web-src/life.js");
const D = await import("../../web-src/doit.js");
const now = Date.parse("2026-11-06T10:00:00");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
// 1) a payment that repeats is a box on its day (like the maid), not a one-off expense
for (const s of ["Each first day of month pay to man who washes car 700 EGP", "i pay 700 egp for the man that washed the car first day of each month",
  "I pay the car washer 700 on the 1st of every month", "كل اول الشهر بدفع ٧٠٠ للراجل اللي بيغسل العربية"]) {
  const c = L.parseLife(s, { now });
  ok(c && c.kind === "regular" && c.amount === 700 && c.every === "month" && c.start === "2026-12-01" && c.dir === "out", s + " → monthly box on the 1st");
  ok(D.understandAll(s, { now }).actions.map((a) => a.kind).join() === "life", s + " → People & plans, not an expense");
}
ok(L.parseLife("I pay the tutor 300 every Monday", { now }).every === "week", "every Monday is weekly");
ok(L.parseLife("I pay the car washer 700 on the 1st of every month", { now }).every === "month", "'every month' is not 'every Monday'");
ok(L.parseLife("I pay 1500 for the gym every month", { now }).title === "Gym", "named after what it is for, not 'I pay'");
ok(D.understandAll("lunch 200", { now }).actions[0].kind === "money", "a one-off spend stays an expense");

// 15) on a phone Enter is a new line (only Send sends); on a computer Enter sends, Shift+Enter is a new line
{ const K = await import("../../web-src/keys.js");
  const mm = (coarse) => (q) => ({ matches: q === "(pointer: coarse)" ? coarse : q === "(any-pointer: fine)" ? !coarse : false });
  globalThis.window = { matchMedia: mm(true) };
  assert.equal(K.enterSends({ key: "Enter" }), false, "phone: Enter = new line"); n++;
  window.matchMedia = mm(false);
  assert.equal(K.enterSends({ key: "Enter" }), true, "computer: Enter sends"); n++;
  assert.equal(K.enterSends({ key: "Enter", shiftKey: true }), false, "computer: Shift+Enter = new line"); n++;
  assert.equal(K.enterSends({ key: "Enter", nativeEvent: { isComposing: true } }), false, "never mid-word"); n++;
  delete globalThis.window; }
console.log(`ALL PASSED v980fixes part 2 (${n} checks)`);
// 4) money out is red, money in is green (Ali: "why is Spent grey? it should be red")
{ const src = (await import("node:fs")).readFileSync(new URL("../../web-src/money-calm-ui.jsx", import.meta.url), "utf8");
  for (const m of src.matchAll(/<Tile label=\{(?:tr|T)\("Spent[^\n]*/g)) { assert.ok(/tone="neg"/.test(m[0]), "every Spent tile is red: " + m[0].slice(0, 60)); n++; }
  assert.ok(!/fill="var\(--c-mut\)" opacity=\{now/.test(src), "no grey spending bars"); n++; }
console.log(`ALL PASSED v980fixes part 3 (${n} checks)`);
// 11) no daily-learning notification ever again (the Learn page is archived) — and the old ones are removed from the phone
{ globalThis.window = { addEventListener() {}, dispatchEvent() {} };
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../web-src/daily-ui.jsx", import.meta.url), "utf8");
  assert.ok(/export const LEARN_NOTIFY = false/.test(src) && /if \(LEARN_NOTIFY\) for \(const c of courses\)/.test(src), "lesson notifications are off"); n++;
  assert.ok(/\/\^daily-\(learn\|news\)-\/\.test\(x\.id\) && !wanted\.has\(x\.id\)\) native\.unschedule/.test(src), "old lesson notifications are unscheduled on start"); n++;
  const app = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8");
  assert.ok(/if \(!engineUp \|\| !LEARN_NOTIFY\) return;/.test(app), "no lessons written in the background"); n++;
  assert.ok(/syncDaily\(NATIVE\)/.test(app), "the clean-up runs at every start"); n++;
  delete globalThis.window; }
console.log(`ALL PASSED v980fixes part 4 (${n} checks)`);
// 5) an offer opens its OWN page — never the search: a real listing link opens directly; no link → the results page + find it by name
{ const R = await import("../../web-src/agent-rules.js");
  const a = { site: "Booking.com", url: "https://www.booking.com/searchresults.html?ss=Makkah&checkin=2026-12-01&checkout=2026-12-05&group_adults=2" };
  const own = R.offerOpen(a, { name: "Swissotel Makkah", price: 2450, href: "https://www.booking.com/hotel/sa/swissotel-makkah.html", checkin: "2026-12-01", checkout: "2026-12-05", url: a.url });
  ok(own.direct && /hotel\/sa\/swissotel-makkah\.html\?checkin=2026-12-01&checkout=2026-12-05&group_adults=2/.test(own.url), "a hotel page opens directly, with the dates and guests");
  const none = R.offerOpen(a, { name: "Pullman ZamZam", price: 1980, href: "", url: a.url });
  ok(!none.direct && none.url === a.url && none.goto.name === "Pullman ZamZam" && none.goto.price === 1980, "no link → results page + find 'Pullman ZamZam' there");
  const map = R.offerOpen(a, { name: "Hilton", price: 2100, href: "https://www.booking.com/searchresults.html?ss=Makkah&map=1", url: a.url });
  ok(!map.direct && map.goto.name === "Hilton", "a map / search link is not the listing");
  ok(R.isOwnPage("https://www.agoda.com/en-gb/le-meridien/hotel/makkah-sa.html") && R.isOwnPage("https://www.amazon.eg/dp/B0CHWRXH8B") && !R.isOwnPage("https://www.booking.com/reviews/x"), "listing patterns"); }
console.log(`ALL PASSED v980fixes part 5 (${n} checks)`);
// 6) notifications are UNDERSTOOD: asked in other words, they are still found
{ const NM = await import("../../web-src/notifmeaning.js"), LB = await import("../../web-src/lookback.js");
  const t0 = Date.parse("2026-10-29T21:10:00");
  const notes = [
    { id: 1, pkg: "com.amazon.mShop.android.shopping", app: "Amazon Shopping", title: "Shipped", text: "Arriving Thursday · your Anker charger", ts: t0 },
    { id: 2, pkg: "com.whatsapp", app: "WhatsApp", title: "Ahmed Salah 012 (Dayı)", text: "ابعتلي الورق بكرة", ts: t0 - 3600e3 },
    { id: 3, pkg: "com.google.android.dialer", app: "Phone", title: "Missed call", text: "Mona", ts: t0 - 7200e3 },
    { id: 4, pkg: "com.cib.mobile", app: "CIB", title: "Card transaction", text: "Your card ending 4421 was debited EGP 1,250.00 at CARREFOUR", ts: t0 - 9000e3 },
    { id: 5, pkg: "com.ubercab", app: "Uber", title: "Your driver is arriving", text: "Mahmoud · Toyota Corolla", ts: t0 - 99e5 },
  ];
  ok(NM.understandNote(notes[0]).kind === "delivery" && /arriving thursday/i.test(NM.understandNote(notes[0]).state), "Amazon 'Shipped' = a delivery, arriving Thursday");
  ok(NM.understandNote(notes[1]).kind === "message" && /Ahmed Salah/.test(NM.understandNote(notes[1]).who), "a WhatsApp = a message from Ahmed");
  ok(NM.understandNote(notes[2]).kind === "call" && NM.understandNote(notes[2]).who === "Mona", "missed call from Mona");
  ok(NM.understandNote(notes[3]).kind === "bank" && NM.understandNote(notes[3]).amount === 1250 && NM.understandNote(notes[3]).state === "money out", "bank: 1,250 out");
  ok(NM.understandNote(notes[4]).kind === "ride", "Uber driver = a ride");
  const docs = LB.recallDocs({ notes }), find = (q) => (LB.recallSearch(docs, q, { now: t0 + 3600e3 }).hits[0] || {}).doc;
  ok(find("when does my package come") && find("when does my package come").raw === 1, "'my package' finds Amazon's 'Shipped' (no shared word)");
  ok(find("who called me") && find("who called me").raw === 3, "'who called me' finds the missed call");
  ok(find("how much did I spend on my card") && find("how much did I spend on my card").raw === 4, "'spend on my card' finds the bank debit");
  ok(find("الاوردر هيوصل امتى") && find("الاوردر هيوصل امتى").raw === 1, "«الاوردر هيوصل امتى» finds it too");
  ok(find("my taxi") && find("my taxi").raw === 5, "'my taxi' finds the Uber");
  ok(!/delivery order package/.test(LB.recallSearch(docs, "package", { now: t0 }).hits[0].snip), "the meaning words are never shown"); }
console.log(`ALL PASSED v980fixes part 6 (${n} checks)`);
// 2/8/12) one brain for every chat: "translate this document" is the app's job (never "I can't access files"); the model knows
// what Attune can do and gets the phone's notifications that fit the question
{ const B = await import("../../web-src/brain.js");
  ok(B.routeTask("translate this document to English").tool === "translate-doc" && B.routeTask("translate this document to English").lang === "en", "voice: translate this document → document translation, into English");
  ok(B.routeTask("ترجملي الملف ده للانجليزي").tool === "translate-doc", "«ترجملي الملف ده» too");
  ok(B.routeTask("translate", { hasFile: true }).tool === "translate-doc", "Chat: a file attached + 'translate'");
  ok(B.routeTask("translate 'good morning' to Turkish") === null, "a phrase to translate stays a chat answer");
  ok(B.routeTask("summarise this pdf", { hasFile: true }).tool === "read-doc", "summarise a PDF → Documents");
  const sys = B.brainSystem({ voice: true, ui: "en", known: ["Notification [Delivery · shipped] Amazon — Arriving Thursday"] });
  ok(/Never say you cannot access files/.test(sys) && /Translate → Document/.test(sys) && /Arriving Thursday/.test(sys) && /2 to 5/.test(sys), "the voice prompt: capabilities + known facts + a full spoken answer");
  const notes = [{ id: 1, pkg: "com.amazon.mShop.android.shopping", app: "Amazon Shopping", title: "Shipped", text: "Arriving Thursday", ts: Date.now() - 3600e3 }];
  ok(B.knownFor("when will my package arrive", { notes }).length === 1, "a question about a package gets the Amazon notification");
  ok(B.knownFor("what is the capital of France", { notes }).length === 0, "an unrelated question gets nothing from the phone"); }
{ const R = await import("../../web-src/router.js");
  ok(R.wantsThink("Compare the running costs of a 50 ton Liebherr crane and a 50 ton Zoomlion crane over five years, with fuel, maintenance and resale value in Egypt", "quick" === "x" ? "quick" : "reason") === true, "a long analysis is thought through");
  ok(R.wantsThink("hi", "quick") === false, "a greeting stays instant"); }
console.log(`ALL PASSED v980fixes (${n} checks)`);
