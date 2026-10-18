// v6.37 Wi-Fi sync on the computer: host + client on this machine, a 2 MB file, a refused file. node desktop/test/localsync.js
const L = require("../lib/localsync.js");
let failed = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) failed++; };
(async () => {
  const h = await L.start();
  ok(h.ok && h.port > 0 && L.hosting(), "the computer hosts (" + JSON.stringify(h) + ")");
  ok((await L.request("127.0.0.1", h.port, "GET", "/attune-sync/hello")).body === "attune", "hello");
  const t = setInterval(() => { const x = L.take(); if (x) { clearInterval(t); L.answer("host:" + x.length); } }, 50);
  ok(await L.exchange("127.0.0.1", h.port, "y".repeat(2e6)) === "host:2000000", "a 2 MB file over, the host's file back");
  ok((await L.request("127.0.0.1", h.port, "POST", "/attune-sync/push", "again")).status === 409, "a second file waits for a new start");
  const h2 = await L.start();
  const t2 = setInterval(() => { if (L.take()) { clearInterval(t2); L.answer("ERR"); } }, 50);
  let msg = ""; try { await L.exchange("127.0.0.1", h2.port, "bad"); } catch (e) { msg = e.message; }
  ok(/^Wrong code/.test(msg), "refused → Wrong code (" + msg + ")");
  L.stop(); ok(!L.hosting(), "stops");
  console.log(failed ? "FAILED" : "ALL PASSED"); process.exit(failed ? 1 : 0);
})();
