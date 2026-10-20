// v6.45 Google sync on the computer — the same ONE file the phone uses ("attune-sync.attune" in the hidden app folder of the
// person's own Drive, scope drive.appdata; GoogleDrive.kt), so the Windows app and the phone sync through Google too.
// Sign-in: Google's own page in the person's browser (the "installed app" loopback flow with PKCE): a one-time listener on
// 127.0.0.1 receives the code, it is exchanged for tokens; the refresh token is kept encrypted by the system (Electron
// safeStorage: DPAPI on Windows), so the next sync needs no sign-in. The file is locked by the page before it gets here
// (sync.js), so Google only stores noise. Needs a "Desktop app" OAuth client from Ali's Google Cloud project
// (SETUP_CLOUD.md §A step 5) — Google treats its secret as not secret for installed apps.
"use strict";
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/** Filled in after Ali's setup (SETUP_CLOUD.md §A step 5); or a google-client.json {id, secret} in the app's data folder. */
const CLIENT = { id: "", secret: "" };
const NAME = "attune-sync.attune";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const API = "https://www.googleapis.com/drive/v3/files";
const UP = "https://www.googleapis.com/upload/drive/v3/files";

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** PKCE: a random verifier and its SHA-256 challenge. */
function pkce() { const v = b64url(crypto.randomBytes(48)); return { verifier: v, challenge: b64url(crypto.createHash("sha256").update(v).digest()) }; }

function clientOf(dataDir) {
  try { const j = JSON.parse(fs.readFileSync(path.join(dataDir, "google-client.json"), "utf8")); if (j.id) return { id: String(j.id), secret: String(j.secret || "") }; } catch (e) {}
  return CLIENT;
}
const ready = (c) => /\.apps\.googleusercontent\.com$/.test(String((c || {}).id || ""));

/** The sign-in address for Google's page. */
function authUrl(c, redirect, challenge, state) {
  const q = new URLSearchParams({ client_id: c.id, redirect_uri: redirect, response_type: "code", scope: SCOPE, code_challenge: challenge, code_challenge_method: "S256", access_type: "offline", prompt: "consent", state });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + q.toString();
}

/**
 * makeDrive({ dataDir, openExternal, safe, fetchFn }) → { ready(), sync({op, id, text}) }.
 * safe = Electron safeStorage ({ isEncryptionAvailable, encryptString, decryptString }); fetchFn = fetch (tests pass a stand-in).
 */
function makeDrive({ dataDir, openExternal, safe, fetchFn = fetch, timeoutMs = 5 * 60 * 1000 }) {
  const tokFile = path.join(dataDir, "google-token.bin");
  let access = null, accessUntil = 0;
  const saveRefresh = (t) => { try { fs.writeFileSync(tokFile, safe && safe.isEncryptionAvailable() ? safe.encryptString(t) : Buffer.from("plain:" + t)); } catch (e) {} };
  const loadRefresh = () => { try { const b = fs.readFileSync(tokFile); if (b.slice(0, 6).toString() === "plain:") return b.slice(6).toString(); return safe ? safe.decryptString(b) : null; } catch (e) { return null; } };

  async function token(c, body) {
    const r = await fetchFn("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, ...body }).toString() });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error(j.error === "invalid_grant" ? "Google sign-in expired — sync again to sign in" : "Google sign-in failed (" + (j.error || r.status) + ")");
    access = j.access_token; accessUntil = Date.now() + Math.max(60, (j.expires_in || 3600) - 60) * 1000;
    if (j.refresh_token) saveRefresh(j.refresh_token);
    return access;
  }
  /** Google's page in the browser → the code on 127.0.0.1 → tokens. */
  function signIn(c) {
    const { verifier, challenge } = pkce(), state = b64url(crypto.randomBytes(16));
    return new Promise((resolve, reject) => {
      let done = false;
      const s = http.createServer((req, res) => {
        const u = new URL(req.url, "http://127.0.0.1");
        if (u.pathname !== "/") { res.writeHead(404); return res.end(); }
        const ok = u.searchParams.get("state") === state && u.searchParams.get("code");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(ok ? "<!doctype html><meta charset=utf-8><body style='font:16px system-ui;padding:40px'>✓ Attune is signed in to Google. You can close this tab.</body>" : "<!doctype html><meta charset=utf-8><body style='font:16px system-ui;padding:40px'>Google sign-in was cancelled.</body>");
        if (done) return; done = true; clearTimeout(t); s.close();
        if (!ok) return reject(new Error(u.searchParams.get("error") === "access_denied" ? "Google sign-in was cancelled" : "Google sign-in failed"));
        token(c, { grant_type: "authorization_code", code: u.searchParams.get("code"), code_verifier: verifier, redirect_uri: redirect }).then(resolve, reject);
      });
      let redirect = "";
      const t = setTimeout(() => { if (!done) { done = true; s.close(); reject(new Error("Google sign-in took too long — try again")); } }, timeoutMs);
      s.listen(0, "127.0.0.1", () => { redirect = "http://127.0.0.1:" + s.address().port; Promise.resolve(openExternal(authUrl(c, redirect, challenge, state))).catch(() => {}); });
    });
  }
  async function bearer(c) {
    if (access && Date.now() < accessUntil) return access;
    const r = loadRefresh();
    if (r) { try { return await token(c, { grant_type: "refresh_token", refresh_token: r }); } catch (e) { try { fs.unlinkSync(tokFile); } catch (x) {} } }
    return signIn(c);
  }
  async function call(c, method, url, body, type) {
    const t = await bearer(c);
    const r = await fetchFn(url, { method, headers: { Authorization: "Bearer " + t, ...(type ? { "Content-Type": type } : {}) }, body });
    if (r.status === 401) { access = null; throw new Error("Google sign-in expired — tap Sync again."); }
    if (r.status === 403) throw new Error("Google refused (403): the Drive API may not be turned on for Attune yet.");
    if (!r.ok) throw new Error("Google Drive answered " + r.status);
    return r.text();
  }
  return {
    ready: () => ready(clientOf(dataDir)),
    /** The phone's driveSync: {op:"get"} → {id, modified, text} or {}; {op:"put", id, text} → {id}. */
    async sync(a) {
      const c = clientOf(dataDir);
      if (!ready(c)) throw new Error("Google sync on the computer needs Attune's Google client — see SETUP_CLOUD.md §A step 5");
      if (a.op === "put") {
        if (a.id) { await call(c, "PATCH", UP + "/" + encodeURIComponent(a.id) + "?uploadType=media", a.text, "application/octet-stream"); return { id: a.id }; }
        const boundary = "attune" + Date.now();
        const meta = JSON.stringify({ name: NAME, parents: ["appDataFolder"] });
        const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n${a.text}\r\n--${boundary}--\r\n`;
        return { id: JSON.parse(await call(c, "POST", UP + "?uploadType=multipart&fields=id", body, "multipart/related; boundary=" + boundary)).id };
      }
      const q = encodeURIComponent(`name='${NAME}' and trashed=false`);
      const list = JSON.parse(await call(c, "GET", `${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime%20desc`));
      const f = (list.files || [])[0]; if (!f) return {};
      return { id: f.id, modified: f.modifiedTime || "", text: await call(c, "GET", `${API}/${encodeURIComponent(f.id)}?alt=media`) };
    },
    signOut() { access = null; try { fs.unlinkSync(tokFile); } catch (e) {} },
  };
}
module.exports = { makeDrive, pkce, authUrl, CLIENT, NAME };
