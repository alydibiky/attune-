// v6.45 Google sync on the computer (lib/gdrive.js) against a stand-in Google: the browser sign-in comes back to the
// loopback listener, the code + PKCE verifier become tokens, the refresh token is kept encrypted, the file is created,
// read and updated in the hidden app folder, and the next run signs in silently with the refresh token.
"use strict";
const assert = require("assert");
const fs = require("fs"), os = require("os"), path = require("path"), crypto = require("crypto");
const { makeDrive, pkce } = require("../lib/gdrive");

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "attune-gd-"));
  assert.strictEqual(makeDrive({ dataDir: dir, openExternal() {}, safe: null }).ready(), false);
  await assert.rejects(makeDrive({ dataDir: dir, openExternal() {}, safe: null }).sync({ op: "get" }), /SETUP_CLOUD/);
  fs.writeFileSync(path.join(dir, "google-client.json"), JSON.stringify({ id: "123-abc.apps.googleusercontent.com", secret: "s" }));
  const p = pkce(); assert.strictEqual(p.challenge, crypto.createHash("sha256").update(p.verifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));

  const G = { files: {}, n: 0, tokens: [], challenge: null, opened: 0 };
  const safe = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from("ENC" + Buffer.from(s).toString("base64")), decryptString: (b) => Buffer.from(b.toString().slice(3), "base64").toString() };
  const res = (status, body) => ({ ok: status < 300, status, json: async () => JSON.parse(body), text: async () => body });
  const fetchFn = async (url, o = {}) => {
    if (url.startsWith("https://oauth2.googleapis.com/token")) {
      const q = new URLSearchParams(o.body); G.tokens.push(q.get("grant_type"));
      if (q.get("grant_type") === "authorization_code") {
        const ch = crypto.createHash("sha256").update(q.get("code_verifier")).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        assert.strictEqual(ch, G.challenge, "PKCE verifier matches the challenge"); assert.strictEqual(q.get("code"), "CODE1");
        return res(200, JSON.stringify({ access_token: "A1", refresh_token: "R1", expires_in: 3600 }));
      }
      assert.strictEqual(q.get("refresh_token"), "R1"); return res(200, JSON.stringify({ access_token: "A2", expires_in: 3600 }));
    }
    assert.ok(/^Bearer A[12]$/.test(o.headers.Authorization));
    if (url.includes("/upload/") && o.method === "POST") { const id = "F" + ++G.n; G.files[id] = String(o.body).split("\r\n\r\n")[2].split("\r\n--")[0]; assert.ok(o.body.includes('"appDataFolder"')); return res(200, JSON.stringify({ id })); }
    if (url.includes("/upload/") && o.method === "PATCH") { const id = url.split("/files/")[1].split("?")[0]; G.files[id] = o.body; return res(200, "{}"); }
    if (url.includes("?alt=media")) { const id = url.split("/files/")[1].split("?")[0]; return res(200, G.files[id]); }
    if (url.includes("spaces=appDataFolder")) return res(200, JSON.stringify({ files: Object.keys(G.files).map((id) => ({ id, modifiedTime: "2026-10-20T10:00:00Z" })) }));
    return res(404, "{}");
  };
  // the "browser": reads the sign-in address and calls the loopback listener back with a code
  const openExternal = async (u) => {
    G.opened++; const q = new URL(u).searchParams;
    assert.strictEqual(q.get("scope"), "https://www.googleapis.com/auth/drive.appdata"); assert.strictEqual(q.get("code_challenge_method"), "S256");
    G.challenge = q.get("code_challenge");
    const back = await fetch(q.get("redirect_uri") + "/?code=CODE1&state=" + q.get("state"));
    assert.ok((await back.text()).includes("signed in"));
  };
  const d1 = makeDrive({ dataDir: dir, openExternal, safe, fetchFn });
  assert.strictEqual(d1.ready(), true);
  assert.deepStrictEqual(await d1.sync({ op: "get" }), {}, "no file yet");
  assert.strictEqual(G.opened, 1, "signed in once in the browser");
  const { id } = await d1.sync({ op: "put", text: "LOCKED-1" });
  assert.strictEqual((await d1.sync({ op: "get" })).text, "LOCKED-1");
  await d1.sync({ op: "put", id, text: "LOCKED-2" });
  assert.strictEqual(G.files[id], "LOCKED-2", "the same file is updated, not a second one");
  assert.ok(fs.readFileSync(path.join(dir, "google-token.bin")).toString().startsWith("ENC"), "the refresh token is kept encrypted");
  const d2 = makeDrive({ dataDir: dir, openExternal, safe, fetchFn });       // the app opened again
  assert.strictEqual((await d2.sync({ op: "get" })).text, "LOCKED-2");
  assert.strictEqual(G.opened, 1, "no second browser sign-in: the refresh token was used");
  assert.deepStrictEqual(G.tokens, ["authorization_code", "refresh_token"]);
  // cancelled in the browser
  const dir3 = fs.mkdtempSync(path.join(os.tmpdir(), "attune-gd-")); fs.copyFileSync(path.join(dir, "google-client.json"), path.join(dir3, "google-client.json"));
  const d3 = makeDrive({ dataDir: dir3, openExternal: async (u) => { const q = new URL(u).searchParams; await fetch(q.get("redirect_uri") + "/?error=access_denied&state=" + q.get("state")); }, safe, fetchFn });
  await assert.rejects(d3.sync({ op: "get" }), /cancelled/, "cancelled in the browser → says so");
  console.log("gdrive: all checks passed");
})().catch((e) => { console.error(e); process.exit(1); });
