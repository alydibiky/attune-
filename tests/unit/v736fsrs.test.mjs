// v6.32 FSRS (the stronger review method for Learn's cards): new cards, good/again/easy, real elapsed time, old box cards carried over.
import * as F from "../../web-src/fsrs.js";
import * as D from "../../web-src/daily.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const DAY = 86400000, T0 = Date.UTC(2026, 9, 17, 9);
const days = (c, now) => Math.round((c.due - now) / DAY);

ok(Math.abs(F.recall(10, 10) - 0.9) < 1e-9 && F.interval(10) === 10, "recall is 90 % after 'stability' days, so the interval equals the stability");
const g = F.review({}, 3, T0), e = F.review({}, 4, T0), a = F.review({}, 1, T0);
ok(days(g, T0) === 3 && days(e, T0) === 16 && days(a, T0) === 1, "a new card: Good → 3 days, Easy → 16, Again → tomorrow (" + [days(g, T0), days(e, T0), days(a, T0)] + ")");
ok(a.d > g.d && g.d > e.d, "a card you missed is harder than one you knew, an easy one easier");
const g2 = F.review(g, 3, g.due);
ok(days(g2, g.due) > days(g, T0) * 2, "known again on its day → much further away (" + days(g2, g.due) + " days)");
const late = F.review(g, 3, g.due + 20 * DAY);
ok(late.s > g2.s, "known after a much longer gap → the memory counts as stronger");
const lapse = F.review(g2, 1, g2.due);
ok(lapse.s < g2.s && days(lapse, g2.due) === 1 && lapse.lapses === 1, "forgotten → stability falls, back tomorrow, one lapse");
const hard = F.review(g, 2, g.due), good = F.review(g, 3, g.due);
ok(hard.s < good.s, "Hard grows the memory less than Good");
const old = F.review({ box: 3, due: T0 }, true, T0);
ok(days(old, T0) > 7 && old.s > 7, "a card from the old 1-3-7-16-35 schedule keeps its progress (" + days(old, T0) + " days)");
ok(F.gradeOf(true) === 3 && F.gradeOf(false) === 1 && F.gradeOf(4) === 4 && F.gradeOf(9) === 4, "grades from the review buttons");
let k = { }; let t = T0, n = 0; while (!F.isLearned(k) && n < 20) { k = F.review(k, 3, t); t = k.due; n++; }
ok(F.isLearned(k) && n <= 8, "a card known every time is learned for good after " + n + " reviews (the old schedule needed 6)");
// the deck in Learn daily
let c = { cards: [{ id: "x", front: "ç", back: "ch", box: 0, due: T0 }] };
c = D.gradeCard(c, "x", true, T0);
ok(c.cards[0].s > 0 && c.cards[0].due === T0 + 3 * DAY, "Learn daily's deck now uses FSRS");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
