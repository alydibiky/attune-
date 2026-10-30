// v8.8 "Attune noticed" — very smart (Ali, 30 Oct)
import * as E from "../../web-src/entities.js";
import { insights, dismiss } from "../../web-src/insights.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-10-30T12:00:00"), DAY = 864e5;
const iso = (k) => new Date(now - k * DAY).toISOString().slice(0, 10);
let d = E.emptyDir(), osama;
({ dir: d, id: osama } = E.addCard(d, { name: "Osama", role: "barber" }, now));
const tx = (id, k, amount, note, type = "expense") => ({ id, date: iso(k), type, amount, note, cat: "other" });
const txns = [
  // the barber every ~21 days, last one 19 days ago → next in ~2 days
  tx("b1", 82, 250, "Osama"), tx("b2", 61, 250, "Osama"), tx("b3", 40, 250, "Osama"), tx("b4", 19, 250, "Osama"),
  // internet monthly, went up
  tx("i1", 95, 450, "Internet bill"), tx("i2", 65, 450, "Internet bill"), tx("i3", 35, 450, "Internet bill"), tx("i4", 5, 520, "Internet bill"),
  // eating out: ~600 a month before, 1,900 this month
  ...[40, 45, 70, 75, 100, 105].map((k, i) => tx("r" + i, k, 300, "restaurant dinner")),
  tx("rn1", 3, 950, "restaurant dinner"), tx("rn2", 8, 950, "Talabat dinner delivery"),
  // charged twice today
  tx("t1", 0, 1200, "Carrefour"), tx("t2", 0, 1200, "Carrefour"),
  // a name with no card, twice
  tx("k1", 12, 400, "paid Karim for tiles"), tx("k2", 6, 300, "paid Karim for grout"),
];
const stores = { ledger: { currency: "EGP", txns }, life: { items: [{ id: "L1", kind: "debt", person: "Hany", dir: "in", amount: 2000, total: 2000, count: 1, start: iso(50), title: "lent" }] },
  pots: { pots: [{ id: "u", name: "Umrah", target: 60000, saved: 10000, by: "2027-09", log: [] }] },
  agents: { agents: [{ id: "a1", title: "Hotels · Makkah · 4 nights", site: "Booking.com", best3: [{ name: "Swissotel Makkah", price: 41800, text: "near Masjid al-Haram" }] }] } };
const L = insights(stores, d, { now, notesPending: 2 });
const k = (kind) => L.filter((x) => x.k === kind);
ok(k("rhythm").some((x) => /Osama every ~21 days/.test(x.en) && x.person === osama && x.act), "the barber's beat: every ~21 days, the next in 2 days, with a reminder ready");
ok(k("rise").some((x) => /Internet bill went up: 520/.test(x.en) && /\+16%/.test(x.en)), "the internet bill went up 450 → 520 (+16%)");
ok(k("surge").some((x) => /^Eating out is 3\.2× your usual/.test(x.en)), "eating out 3.2× the usual this month: " + (k("surge")[0] || {}).en);
ok(k("twice").length === 1 && /1,200 EGP to Carrefour twice/.test(k("twice")[0].en) && L[0].k === "twice", "charged twice — ranked first");
ok(k("owed").some((x) => /Hany has owed you 2,000 EGP for 7 weeks/.test(x.en)), "Hany has owed 2,000 for 7 weeks");
ok(k("newName").some((x) => /“Karim” 2 times/.test(x.en)), "Karim written twice with no card → add him");
ok(k("notes").length === 1, "2 payments in notes not in Money");
ok(k("goalPace").some((x) => /Umrah: 50,000 EGP still to go/.test(x.en)), "the Umrah goal behind its pace");
ok(k("goalFind").some((x) => /Swissotel Makkah at 41,800 — your Umrah goal has 10,000 of 60,000/.test(x.en)), "the Makkah hotel the agent found, against the Umrah money");
ok(L.every((x) => x.ar && x.en && x.id && x.score > 0), "every finding in English and Egyptian Arabic, with an id and a score");
const seen = dismiss({}, k("twice")[0], now), L2 = insights(stores, d, { now, seen, notesPending: 2 });
ok(!L2.some((x) => x.k === "twice"), "dismissed → gone (for 30 days)");
const quiet = insights({ ledger: { txns: [tx("x", 1, 50, "coffee")] } }, d, { now });
ok(quiet.length === 0, "little data → says nothing (no noise)");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
