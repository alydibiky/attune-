// v6.32 Private vault: which pages are locked, staying open for a minute in the background, the PIN fallback.
import * as V from "../../web-src/vault.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const v = { on: true, areas: ["money", "cycle"] };
ok(V.vaulted("money", v) && V.vaulted("guardian", v) && V.vaulted("cycle", v) && !V.vaulted("chat", v) && !V.vaulted("care", v), "Money's pages and Cycle are locked; Chat and Family health are not");
ok(!V.vaulted("money", { ...v, on: false }), "off → nothing locked");
const T = 1e12;
ok(V.stillOpen({ open: true }, T) && V.stillOpen({ open: true, hiddenAt: T - 30000 }, T) && !V.stillOpen({ open: true, hiddenAt: T - 120000 }, T) && !V.stillOpen({}, T), "open until it has been in the background for over a minute");
const p = V.withPin(v, "4821", "salt");
ok(V.pinOk(p, "4821") && !V.pinOk(p, "1234") && !JSON.stringify(p).includes("4821"), "a PIN is checked but never stored as typed");
ok(V.withPin(v, "12") === v, "a PIN must be 4–6 digits");
ok(V.unlockWay({ bio: true, secure: true }) === "bio" && V.unlockWay({ bio: false, secure: true }) === "bio" && V.unlockWay(null) === "pin", "fingerprint or the phone's lock when there is one; else a PIN");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
