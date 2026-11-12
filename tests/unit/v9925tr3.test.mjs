// v9.9.25 B7 TR3 the trip's money and papers: a 2,500 sample of tests/tr3/gen.mjs must stay at 100%, a held-out 500, plus the mock-up.
import { run } from "../tr3/gen.mjs";
import * as M from "../../web-src/tripmoney.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const r = run(2500, 0); ok(r.pass === 2500, "2,500 generated trips: " + r.pass + " / 2500 " + JSON.stringify(r.bad.slice(0, 1)));
const h = run(500, 90000); ok(h.pass === 500, "500 held-out: " + h.pass + " / 500");
const b = M.budget({ home: 30000, rate: 0.0767 }, []);
ok(b.home === 30000 && b.trip === 2301, "the mock-up: 30,000 EGP ≈ 2,301 SAR, spent 0");
const s = M.settle(["Ali", "Mona", "Omar"], [{ who: "Ali", amount: 100 }]);
ok(s.net.Ali === 66.66 && s.net.Mona + s.net.Omar === -66.66 && s.transfers.length === 2, "100 among 3 → 33.34 + 33.33 + 33.33: nothing lost, two transfers");
const p = M.papers({ to: "sa", arrive: "2027-03-03", leave: "2027-03-07", passport: "2027-05-01", visa: true });
ok(!p.items[0].ok && p.items[0].mustLast === "2027-09-03", "the mock-up: passport ends 1 May 2027, Saudi needs 6 months from arrival (3 Sep) → renew");
ok(M.papers({ to: "fr", arrive: "2027-03-03", leave: "2027-03-17", passport: "2027-06-17" }).items[0].ok, "France (Schengen): 3 months after leaving — 17 Jun is enough");
ok(M.papers({ to: "br", arrive: "2027-03-03", leave: "2027-03-17", passport: "2027-08-01" }).items[0].ok === false && !M.papers({ to: "br" }).rule.known, "a country without a known rule → the strict one (6 months after leaving), marked 'check the portal'");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
