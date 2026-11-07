// v9.8 N1 The Haggler (Ali: "do N1 … without any mistakes"): it reads what you want, talks to sellers, never promises, brings a good
// price to YOU, walks away from dealers / scams / your deal-breakers
import assert from "node:assert/strict";
const H = await import("../../web-src/haggle.js");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
// money said any way
eq(H.pricesIn("980k"), [980000], "980k"); eq(H.pricesIn("1.05m"), [1050000], "1.05m"); eq(H.pricesIn("آخر كلام ٩٨٠ ألف"), [980000], "٩٨٠ ألف");
eq(H.pricesIn("مليون و٥٠"), [1050000], "مليون و٥٠"); eq(H.pricesIn("1,120,000 EGP"), [1120000], "1,120,000"); eq(H.pricesIn("1.1 مليون"), [1100000], "1.1 مليون");
// the plan
const p = H.parseHaggle("negotiate a Tucson 2022 under 1,050,000, no accidents, agency service, in Cairo or Giza");
ok(p && /Tucson 2022/.test(p.what) && p.max === 1050000 && p.musts.includes("no-accident") && p.musts.includes("service") && /Cairo/.test(p.area) && p.lang === "en", "the English plan: " + JSON.stringify(p));
const pa = H.parseHaggle("فاصلي على توسان ٢٠٢٢ لحد مليون و٥٠ بشرط مفيهاش رش وصيانة توكيل");
ok(pa && pa.max === 1050000 && /توسان/.test(pa.what) && pa.musts.includes("no-accident") && pa.musts.includes("service") && pa.lang === "ar", "the Arabic plan: " + JSON.stringify(pa));
ok(H.parseHaggle("what is the price of a Tucson") === null, "a question is not a haggle");
// sellers, market, target
let h = H.makeHaggle(p, 1);
for (const [ask, ph, ads] of [[1120000, "01001234567", 1], [1080000, "+201112223334", 1], [990000, "01200000000", 6], [1150000, "01001234567", 1]]) h = H.addSeller(h, { name: "S", phone: ph, ask, ads });
ok(h.sellers.length === 3, "the same phone is one seller");
ok(H.marketOf(h) === 1080000 && H.targetOf(h) === 1000000, "market 1,080,000 → aim 1,000,000 (93 %, under your limit)");
ok(H.openingOffer(h, h.sellers[0]) === 915000, "first number ≈ 85 % of the market: " + H.openingOffer(h, h.sellers[0]));
// the conversation with seller 1
let s = h.sellers[0], m = H.nextMove(h, s);
ok(m.status === "ask" && /still available/.test(m.say) && /accidents/.test(m.say) && /agency/.test(m.say), "first message asks: available, your musts, best price");
m = H.nextMove(h, m.seller, "No accidents, serviced at the agency. 1,100,000 last price");
ok(m.status === "offer" && /915,000 cash/.test(m.say), "then a low but serious offer: " + m.say);
m = H.nextMove(h, m.seller, "مفيش اقل من مليون و٥٠");
ok(m.status !== "good" && m.seller.offers.length === 2, "1,050,000 is inside the limit but above the aim → keep pushing: " + m.status + " " + m.say);
const fin = m.seller;
ok(m.status === "final" && /1,000,000/.test(m.say), "…our last number: the aim, 1,000,000: " + m.say);
ok(H.nextMove(h, fin, "لا مليون و٥٠ آخر كلام").status === "good", "they insist on 1,050,000 (inside your limit) → YOUR turn, not a lost deal");
{ let hx = H.addSeller(h, { phone: "01555555555", ask: 1250000 }), sx = hx.sellers[hx.sellers.length - 1];
  sx = H.nextMove(hx, sx).seller; sx = H.nextMove(hx, sx, "1,200,000").seller; sx = H.nextMove(hx, sx, "1,180,000").seller;
  const last = H.nextMove(hx, sx, "1,150,000 final"); ok(last.status === "final", "before walking away it always says its last number once");
  const over = H.nextMove(hx, last.seller, "لا، 1,150,000 آخر كلام");
  ok(over.status === "walk" && /pass/.test(over.say), "a seller who stays above your limit after our last number → a polite no: " + over.status); }
ok(H.nextMove(h, fin, "1,100,000 final").status === "good", "…but a seller who already said 1,050,000 is held to it");
m = H.nextMove(h, fin, "OK 1,000,000 final");
ok(m.status === "good" && m.say === "", "1,000,000 → YOUR turn, Attune says nothing to the seller");
// never a promise
ok(!H.safeText("اتفقنا، هحوّل العربون") && !H.safeText("Deal, I'll take it") && H.safeText("Would you take 915,000 cash?"), "a yes / payment is never sent");
// dealer, scam, deal-breaker, sold
const d = H.nextMove(h, h.sellers[2]); ok(d.status === "dealer" && !d.say, "the same phone in 6 ads → a dealer, not contacted");
let s2 = H.nextMove(h, h.sellers[1]).seller;
ok(H.nextMove(h, s2, "ابعت عربون ٢٠ ألف فودافون كاش الأول").status === "scam", "a deposit before a viewing → scam, stop");
ok(H.nextMove(h, s2, "فيها رش خفيف في الباب").status === "walk", "an accident when you said no accidents → walk away politely");
ok(H.nextMove(h, s2, "sorry it's sold").status === "walk", "sold → done");
ok(H.nextMove(h, s2, "I'm abroad, shipping only").status === "scam", "no viewing → treated as a scam");
// replies matched from notifications
const notes = [{ id: 1, pkg: "com.whatsapp", app: "WhatsApp", title: "+20 100 123 4567", text: "1,100,000 last price", ts: 50 }, { id: 2, pkg: "com.whatsapp", title: "Mona", text: "hi", ts: 60 }];
ok(H.repliesFor(notes, { ...h.sellers[0], saidAt: 10 }).length === 1, "a WhatsApp from the seller's number is their reply");
// Arabic texts
const ha = H.makeHaggle(pa, 2); const ma = H.nextMove(ha, H.addSeller(ha, { phone: "01000000000", ask: 1100000 }).sellers[0]);
ok(/لسه متاحة/.test(ma.say) && /رش/.test(ma.say) && /التوكيل/.test(ma.say), "the first message in Egyptian Arabic: " + ma.say);
console.log(`ALL PASSED v980haggle (${n} checks)`);
// the background step
{ let h2 = H.makeHaggle(H.parseHaggle("negotiate a Tucson 2022 under 1,050,000, no accidents"), 3);
  h2 = H.addSeller(h2, H.sellerFromAd("Hyundai Tucson 2022 للبيع 1,120,000 جنيه — كلمني 0100 123 4567 https://www.hatla2ee.com/ar/car/used/hyundai/tucson/123456"));
  ok(h2.sellers[0].phone === "01001234567" && h2.sellers[0].ask === 1120000 && /hatla2ee/.test(h2.sellers[0].site), "a pasted ad gives the phone, the price and the site");
  let t = H.tick(h2, [], 100); ok(t.sends.length === 1 && t.h.sellers[0].pending, "the first message waits to be sent");
  ok(H.tick(t.h, [], 110).sends.length === 0, "never sent twice while it waits");
  let h3 = H.sent(t.h, "s1", 120); ok(!h3.sellers[0].pending && h3.sellers[0].said.length === 1, "sent → in the thread");
  t = H.tick(h3, [{ id: 9, pkg: "com.whatsapp", app: "WhatsApp", title: "+20 100 123 4567", text: "مفيهاش رش، آخر سعر مليون و١٠٠", ts: 200 }], 210);
  ok(t.sends.length === 1 && /cash/.test(t.sends[0].text) && t.h.sellers[0].heard.length === 1, "their reply → the next message (an offer), their words kept: " + t.sends[0].text);
  ok(H.tick(t.h, [{ id: 9, pkg: "com.whatsapp", app: "WhatsApp", title: "+20 100 123 4567", text: "مفيهاش رش، آخر سعر مليون و١٠٠", ts: 200 }], 220).sends.length === 0, "the same reply is never read twice"); }
console.log(`ALL PASSED v980haggle (${n} checks)`);
