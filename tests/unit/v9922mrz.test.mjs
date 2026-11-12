// v9.9.22 X1 passport / ID photo → fields: a 2,500 sample of tests/mrz/gen.mjs must stay 100% (a field marked OK is never wrong), plus
// held-out cases written after it: the ICAO 9303 specimen passport and ID card, a phone-camera read with spaces and «, a true misread.
import { execFileSync } from "child_process";
import * as M from "../../web-src/mrz.js";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const out = execFileSync("node", [new URL("../mrz/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/Passed: \*\*2500 \/ 2500/.test(out), "2,500 generated documents: 100% — " + (out.match(/Passed: \*\*[^*]+/) || [""])[0]);
// the ICAO 9303 specimen passport
const p = M.readMrz("PASSPORT\nUtopia\nP<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204159ZE184226B<<<<<10");
ok(p && p.doc === "passport" && p.surname === "ERIKSSON" && p.given === "ANNA MARIA" && p.number === "L898902C3" && p.nationality === "UTO" && p.birth === "1974-08-12" && p.sex === "F" && p.expiry === "2012-04-15" && p.sure,
  "ICAO specimen passport → Anna Maria Eriksson, L898902C3, born 12 Aug 1974, expires 15 Apr 2012, sure");
// the ICAO 9303 specimen ID card (TD1)
const c = M.readMrz("I<UTOD231458907<<<<<<<<<<<<<<<\n7408122F1204159UTO<<<<<<<<<<<6\nERIKSSON<<ANNA<MARIA<<<<<<<<<<");
ok(c && c.type === "TD1" && c.doc === "id" && c.number === "D23145890" && c.birth === "1974-08-12" && c.expiry === "2012-04-15" && c.surname === "ERIKSSON" && c.sure, "ICAO specimen ID card (3 lines) read the same way");
// as a phone camera reads it: spaces, «, O for 0 in the dates
const cam = M.readMrz("P<UTOERIKSSON«ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36 UTO74O8122F 12O4159ZE184226B<<<<<10");
ok(cam && cam.birth === "1974-08-12" && cam.expiry === "2012-04-15" && cam.sure, "spaces, « and O-for-0 are fixed, still sure");
// a true misread: one digit of the expiry wrong → never sure, the expiry marked to check
const bad = M.readMrz("P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<\nL898902C36UTO7408122F1204189ZE184226B<<<<<10");
ok(bad && !bad.sure && bad.ok.expiry === false && bad.ok.birth === true, "one digit of the expiry misread → 'check this' on the expiry, never sure");
ok(M.readMrz("Just a receipt\nTotal 450 EGP") === null, "no MRZ on the page → nothing (the old scan reads it)");
ok(M.remindBefore({ doc: "passport" }).join() === "183,30", "a passport is reminded 6 months and 30 days before it ends");
console.log(fail ? "FAILED " + fail : "ALL PASSED");
