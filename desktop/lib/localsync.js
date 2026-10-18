// v6.37 Wi-Fi sync on the computer — the same protocol as the phone (LocalSync.kt), so a phone and the Windows app swap
// their encrypted files on the home network. Only already-encrypted text crosses (the page locks it, sync.js).
//   POST /attune-sync/push  → 202 (409 if one came)   GET /attune-sync/pull → 204 / 403 (wrong code) / 200 + file
//   GET /attune-sync/hello  → 200 "attune"
"use strict";
const http = require("http");
const os = require("os");

const MAX = 64 * 1024 * 1024;
let server = null, pushed = null, taken = false, reply = null, stopTimer = null;

function ip() {
  const all = Object.entries(os.networkInterfaces()).flatMap(([name, list]) => (list || []).map((x) => ({ name, ...x })));
  const v4 = all.filter((x) => x.family === "IPv4" && !x.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(x.address));
  v4.sort((a, b) => (/wi-?fi|wlan|wireless/i.test(b.name) ? 1 : 0) - (/wi-?fi|wlan|wireless/i.test(a.name) ? 1 : 0));
  return v4.length ? v4[0].address : "";
}

/** Starts hosting → Promise<{ ok, ip, port }>. Stops by itself after 10 minutes. */
function start() {
  stop();
  pushed = null; taken = false; reply = null;
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const send = (code, body = "") => { res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8", Connection: "close" }); res.end(body); };
      if (req.method === "GET" && req.url === "/attune-sync/hello") return send(200, "attune");
      if (req.method === "GET" && req.url === "/attune-sync/pull") return !pushed || reply == null ? send(204) : reply === "ERR" ? send(403) : send(200, reply);
      if (req.method === "POST" && req.url === "/attune-sync/push") {
        const parts = []; let n = 0, big = false;
        req.on("data", (c) => { n += c.length; if (n > MAX) { big = true; req.destroy(); } else parts.push(c); });
        req.on("end", () => { if (big) return; if (pushed != null) return send(409); pushed = Buffer.concat(parts).toString("utf8"); taken = false; reply = null; send(202); });
        return;
      }
      send(404);
    });
    s.on("error", (e) => resolve({ ok: false, error: e.message }));
    s.listen(0, "0.0.0.0", () => { server = s; stopTimer = setTimeout(stop, 10 * 60 * 1000); resolve({ ok: true, ip: ip(), port: s.address().port }); });
  });
}
function stop() { clearTimeout(stopTimer); if (server) { try { server.close(); } catch (e) {} } server = null; }
function take() { if (pushed != null && !taken) { taken = true; return pushed; } return ""; }
function answer(t) { reply = String(t); }

function request(host, port, method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : Buffer.from(body, "utf8");
    const r = http.request({ host, port, method, path, timeout: 30000, headers: data ? { "Content-Length": data.length } : {} }, (res) => {
      const parts = []; res.on("data", (c) => parts.push(c)); res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString("utf8") }));
    });
    r.on("timeout", () => r.destroy(new Error("The other device did not answer")));
    r.on("error", () => reject(new Error("Could not reach the other device — are both on the same Wi-Fi?")));
    if (data) r.write(data); r.end();
  });
}
/** This computer → the device hosting: send our file, wait up to 2 minutes for theirs. */
async function exchange(host, port, body) {
  const p = await request(host, port, "POST", "/attune-sync/push", body);
  if (p.status === 409) throw new Error("That device already received a file — start it again there.");
  if (p.status !== 202) throw new Error("The other device did not answer (" + p.status + ").");
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    const r = await request(host, port, "GET", "/attune-sync/pull", null);
    if (r.status === 200) return r.body;
    if (r.status === 403) throw new Error("Wrong code — nothing was changed.");
    await new Promise((ok) => setTimeout(ok, 800));
  }
  throw new Error("The other device took too long.");
}

module.exports = { start, stop, take, answer, exchange, request, ip, hosting: () => !!server };
