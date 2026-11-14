// v9.9.22 X1 passport / ID photo → fields: a 2,500 sample of tests/mrz/gen.mjs (see the v9.9.38 note below), plus
// held-out cases written after it: the ICAO 9303 specimen passport and ID card, a phone-camera read with spaces and «, a true misread.
import { execFileSync } from "child_process";
import * as M from "../../web-src/mrz.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../mrz/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
// v9.9.38 (the 1M test): the generator's random numbers were broken (they repeated after a few hundred draws), so "100%" was measured on
// a small repeated set. With real random numbers: ≥ 96 % right, and a number marked OK but wrong ≤ 0.5 % (a true misread that passes two
// check digits by luck — no check digit can catch it)
const pct = +((out.match(/\(([\d.]+)%\)/) || [0, 0])[1]), wrongOk = +((out.match(/number marked OK but wrong — (\d+)/) || [0, 0])[1]);
ok(pct >= 96, "2,500 generated documents: ≥ 96% — " + (out.match(/Passed: \*\*[^*]+/) || [""])[0]);
ok(wrongOk <= 12 && !/birth marked OK but wrong|expiry marked OK but wrong|was called sure|crash/.test(out), "a number marked OK but wrong ≤ 0.5 % (" + wrongOk + " of 2,500); dates never");
// the ICAO 9303 specimen passport
const p = M.readMrz("PASSPORT\nUtopia\nP<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10");
ok(p && p.doc === "passport" && p.surname === "ERIKSSON" && p.given === "ANNA MARIA" && p.number === "L898902C3" && p.nationality === "UTO" && p.birth === "1974-08-12" && p.sex === "F" && p.expiry === "2012-04-15" && p.ok.birth && p.ok.expiry && !p.ok.number,
  "ICAO specimen passport → Anna Maria Eriksson, L898902C3, born 12 Aug 1974, expires 15 Apr 2012 — the number read right but asked to check (an L first could be a 1 by every check digit)");
{ const g = M.readMrz("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\n5859053GA" + M.checkDigit("58590536A") + "UTO7408122F1204159ZE184226B<<<<<1" + M.checkDigit("58590536A" + M.checkDigit("58590536A") + "7408122" + "1204159" + "ZE184226B<<<<<1"));
  ok(g && g.number === "58590536A" && g.ok.number, "a G read for a 6 inside the number is fixed (a look-alike letter after the first place is a misreading): " + (g && g.number)); }
// the ICAO 9303 specimen ID card (TD1)
const c = M.readMrz("I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<");
ok(c && c.type === "TD1" && c.doc === "id" && c.number === "D23145890" && c.birth === "1974-08-12" && c.expiry === "2012-04-15" && c.surname === "ERIKSSON" && c.sure, "ICAO specimen ID card (3 lines) read the same way");
// as a phone camera reads it: spaces, «, O for 0 in the dates
const cam = M.readMrz("P<UTOERIKSSON«ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36 UTO74O8122F 12O4159ZE184226B<<<<<10");
ok(cam && cam.birth === "1974-08-12" && cam.expiry === "2012-04-15" && cam.ok.birth && cam.ok.expiry && cam.number === "L898902C3", "spaces, « and O-for-0 are fixed, the dates still checked");
// a true misread: one digit of the expiry wrong → never sure, the expiry marked to check
const bad = M.readMrz("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204189ZE184226B<<<<<10");
ok(bad && !bad.sure && bad.ok.expiry === false && bad.ok.birth === true, "one digit of the expiry misread → 'check this' on the expiry, never sure");
ok(M.readMrz("Just a receipt\nTotal 450 EGP") === null, "no MRZ on the page → nothing (the old scan reads it)");
ok(M.remindBefore({ doc: "passport" }).join() === "183,30", "a passport is reminded 6 months and 30 days before it ends");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
