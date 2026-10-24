// v7.9 (Ali: "Charged twice at كل الزوايا — I don't know where that came from"): the Guardian shows the two payments it matched,
// says "charged twice" only when the times prove it, asks when they don't, and a notification already in Money is not added again.
import * as G from "../../web-src/guardian.js";
import { alreadyIn, toTxns, appendToLedger } from "../../web-src/paylog.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const now = new Date("2026-10-24T12:00:00").getTime(), at = (h, m) => new Date(`2026-10-23T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`).getTime();
const tx = (id, amount, note, extra = {}) => ({ id, type: "expense", amount, cat: "food", account: "c", date: "2026-10-23", note, ...extra });
const led = (txns) => ({ currency: "EGP", accounts: [{ id: "c", name: "CIB", currency: "EGP" }], txns });
const dbl = (L) => G.findings({ ledger: L, life: null, now }).filter((f) => f.kind === "double");

// Ali's case: two 599s at كل الزوايا on the same day, no times (notification entries before v7.9 kept only the day)
let F = dbl(led([tx("a", 599, "كل الزوايا · CIB"), tx("b", 599, "كل الزوايا · CIB")]));
ok(F.length === 1 && F[0].sure === false && /Same payment twice/.test(F[0].title) && /logged twice, or charged twice/.test(F[0].detail), "no times → it ASKS (\"Same payment twice?\"), never claims a double charge");
ok(F[0].txns.length === 2 && F[0].txns.map((t) => t.id).join() === "a,b" && F[0].txns[0].amount === 599, "the card carries the two payments it matched");
// minutes apart, both from notifications → a real double charge
F = dbl(led([tx("a", 350, "CARREFOUR · CIB", { created: at(20, 41), source: "notification" }), tx("b", 350, "CARREFOUR · CIB", { created: at(20, 43), source: "notification" })]));
ok(F.length === 1 && F[0].sure === true && /Charged twice at Carrefour/.test(F[0].title) && F[0].txns[1].at === at(20, 43), "two notifications 2 minutes apart → \"Charged twice\", with the time");
// one typed by hand, one from a notification, minutes apart → logged twice, it asks
F = dbl(led([tx("a", 350, "Carrefour", { created: at(20, 41) }), tx("b", 350, "CARREFOUR · CIB", { created: at(20, 45), source: "notification" })]));
ok(F.length === 1 && F[0].sure === false, "typed + notification → asks, it is most likely the same payment logged twice");
// hours apart → two real purchases, nothing to say
ok(dbl(led([tx("a", 60, "Cilantro", { created: at(9, 0) }), tx("b", 60, "Cilantro", { created: at(17, 30) })])).length === 0, "the same coffee in the morning and the evening is not a double charge");
// remove one
const L2 = G.removeTxn(led([tx("a", 599, "x"), tx("b", 599, "x")]), "b");
ok(L2 && L2.txns.length === 1 && L2.txns[0].id === "a" && G.removeTxn(L2, "zzz") === null, "\"Logged twice — remove one\" removes only that payment");

// at save time: a notification already in Money is spotted
const e = { id: "n1", amount: 599, direction: "out", party: "كل الزوايا", app: "CIB", ts: at(14, 5), confidence: "high" };
ok(!!alreadyIn(e, led([tx("a", 599, "lunch")])), "the same amount the same day, typed by hand → already in Money");
ok(!!alreadyIn(e, led([tx("a", 599, "كل الزوايا · CIB", { source: "notification" })])), "the same shop from a notification (no time) → already in Money");
ok(!alreadyIn(e, led([tx("a", 599, "Other shop · CIB", { source: "notification", created: at(9, 0) })])), "another notification hours earlier at another shop → a new payment");
ok(!alreadyIn(e, led([tx("a", 250, "lunch")])), "a different amount → a new payment");
// notification payments now keep their time and where they came from
const T = toTxns([e])[0];
ok(T.ts === at(14, 5) && T.source === "notification", "a notification payment keeps its time and its source");
const A = appendToLedger(led([]), [T], now).ledger.txns[0];
ok(A.created === at(14, 5) && A.source === "notification", "…and the ledger saves them (created, source)");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
