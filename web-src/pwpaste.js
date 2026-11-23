/* ---- v10.9.4 Passwords in one go (Ali's OK-PW, 23 Nov 2026: "it doesn't have to have a username, I just want it as it is" — his Notion
   page has a toggle per account). Two readers, pure, nothing leaves the phone:
     readPastedPage(text) → [{ title, lines: [{ name, value, secret }] }] — a page pasted from Notion (toggles "▸ Microsoft", or its Markdown
       export "- Microsoft" with indented lines), headings ("## Steam"), or blocks with an empty line between; EVERY line kept as written
       (its own name and order; a line without a name keeps just its words). A secret (pass / pw / PIN / code / «باسورد» …, or a bare line
       that looks like a password) is marked to be locked with the fingerprint.
     readPasswordFile(csvText) → [{ title, lines }] — the .csv of Google Passwords / Chrome / Edge / Firefox / Bitwarden / 1Password / Apple /
       LastPass / Dashlane; the same login twice is kept once.
   Tests: tests/pw/gen.mjs (10,000 composed HARD pages + 10,000 files) + tests/unit/v1094pw.test.mjs. */

export const SECRET_NAME = /^(?:pass(?:word|wd|code|phrase)?|pw|pwd|pin|pin ?code|code|recovery(?: code| key)?|backup codes?|2fa|totp|otp|secret|security (?:answer|code|question)|cvv|cvc|mot de passe|contraseña|clave|passwort|kennwort|senha|şifre|parola|sandi|kata sandi|пароль|पासवर्ड|رمز عبور|পাসওয়ার্ড|nenosiri|รหัสผ่าน|mật khẩu|密码|パスワード|비밀번호|باسورد|الباسورد|باس|كلمة السر|كلمه السر|كلمة المرور|الرقم السري|رقم سري|كود|الكود|بن|pin كود)$/i;
const MARK = /^\s*(?:[▸▶►‣▾▼▽⯈⏵>]|[-*•]|\d+[.)]|#{1,6})\s+/;
const KV = /^\s*([^:=：\n]{1,40}?)\s*(?:[:=：]|\s[-–—]\s)\s*(.+)$/;
// an e-mail only when its ending is a real domain ending — a password like "A84dCjPU@7dtu.XY" is NOT an e-mail (it stays locked)
const TLD = "com|net|org|edu|gov|mil|int|io|co|me|info|biz|app|dev|ai|tech|online|site|store|xyz|cloud|email|live|mail|eg|sa|ae|kw|qa|bh|om|jo|lb|ma|dz|tn|iq|sy|ye|ly|sd|ps|tr|ir|pk|in|bd|lk|id|my|sg|th|vn|ph|cn|jp|kr|tw|hk|ru|ua|pl|de|fr|es|it|pt|nl|be|ch|at|se|no|dk|fi|ie|uk|gr|cz|ro|hu|bg|rs|hr|us|ca|mx|br|ar|cl|pe|ng|ke|za|gh|et|tz|ug|au|nz";
const EMAIL = new RegExp("^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\\.)+(?:" + TLD + ")$", "i"), URL_ = /^(?:https?:\/\/|www\.)\S+$/i, PHONE = /^\+?[\d\s()-]{7,}$/;
/** A bare word that looks like a password: no spaces, 6–64 characters, at least two of: letters, digits, symbols; not an email / link / phone. */
export const looksLikePassword = (v) => { const t = String(v || "").trim(); if (!t || /\s/.test(t) || t.length < 6 || t.length > 64 || EMAIL.test(t) || URL_.test(t) || PHONE.test(t)) return false;
  return [/\p{L}/u, /\d/, /[^\p{L}\d]/u].filter((r) => r.test(t)).length >= 2; };
const clean = (s) => String(s || "").replace(/[‎‏‪-‮⁦-⁩﻿]/g, "").replace(/\t/g, "    ").replace(/ /g, " ");
const indent = (l) => (l.match(/^ */) || [""])[0].length;
const lineOf = (raw) => {
  const t = raw.replace(MARK, "").trim();
  const m = t.match(KV);
  if (m && !URL_.test(t) && !/^https?$/i.test(m[1].trim())) { const name = m[1].trim(), value = m[2].trim(); return { name, value, secret: SECRET_NAME.test(name.replace(/[*_`]/g, "").trim()) }; }
  return { name: "", value: t, secret: looksLikePassword(t) };
};
const titleOf = (raw) => raw.replace(MARK, "").replace(/[*_`]+/g, "").replace(/\s*[:：]\s*$/, "").trim();

/** A page pasted from Notion / notes → accounts, every line as written. */
export function readPastedPage(text0) {
  const lines = clean(text0).split(/\r?\n/).map((l) => l.replace(/\s+$/, ""));
  const out = [];
  let cur = null;
  const start = (title) => { cur = { title: title.slice(0, 120), lines: [] }; out.push(cur); };
  const nonEmpty = lines.filter((l) => l.trim());
  if (!nonEmpty.length) return [];
  const base = Math.min(...nonEmpty.map(indent));
  // a title: a toggle / bullet / heading at the left edge that is not "name: value"; or, in plain notes, a line with no "name: value"
  // after an empty line (or at the top) that is followed by a line of its own
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]; if (!l.trim()) continue;
    const marked = MARK.test(l), atEdge = indent(l) <= base, kv = KV.test(l.replace(MARK, "").trim()) && !URL_.test(l.replace(MARK, "").trim());
    const afterGap = i === 0 || !lines[i - 1].trim() || !cur;
    const nextIn = (() => { for (let k = i + 1; k < lines.length; k++) if (lines[k].trim()) return indent(lines[k]) > indent(l) || !MARK.test(lines[k]) || KV.test(lines[k].replace(MARK, "").trim()); return false; })();
    const isTitle = atEdge && !kv && ((marked && (nextIn || !cur)) || (!marked && afterGap && nextIn) || /^\s*#{1,6}\s/.test(l));
    if (isTitle) { start(titleOf(l)); continue; }
    if (!cur) start(kv ? "" : titleOf(l));
    if (!kv && cur.lines.length === 0 && !cur.title) { cur.title = titleOf(l); continue; }
    cur.lines.push(lineOf(l));
  }
  return out.filter((a) => a.title || a.lines.length).map((a) => ({ ...a, title: a.title || (a.lines.find((x) => !x.secret) || {}).value || "Account" }));
}

/** RFC 4180 CSV → rows (quotes, commas and line breaks inside quotes, "" = a quote). */
export function csvRows(text) {
  const t = String(text || "").replace(/^﻿/, ""), rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"' && f === "") q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); f = ""; if (row.some((x) => x !== "")) rows.push(row); row = []; }
    else f += c;
  }
  row.push(f); if (row.some((x) => x !== "")) rows.push(row);
  return rows;
}
const COL = { title: /^(?:name|title)$/i, url: /^(?:url|login_uri|website|origin_url|uri)$/i, user: /^(?:username|login_username|user ?name|login|email|user)$/i,
  pass: /^(?:password|login_password|pass)$/i, note: /^(?:note|notes|extra|comment|comments)$/i, totp: /^(?:totp|login_totp|otpauth|otpsecret|otp)$/i };
const hostOf = (u) => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : "https://" + u).hostname.replace(/^www\./, ""); } catch (e) { return String(u || "").slice(0, 60); } };
/** A password app's export (.csv) → accounts. */
export function readPasswordFile(text) {
  const rows = csvRows(text); if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim()), at = {};
  for (const [k, re] of Object.entries(COL)) { const i = head.findIndex((h) => re.test(h)); if (i >= 0) at[k] = i; }
  if (at.pass == null) return [];
  const out = [], seen = new Set();
  for (const r of rows.slice(1)) {
    const g = (k) => (at[k] != null ? String(r[at[k]] || "").trim() : "");
    const pass = g("pass"); if (!pass) continue;
    const url = g("url"), user = g("user"), title = g("title") || (url ? hostOf(url) : "") || user || "Account";
    const key = [title.toLowerCase(), user.toLowerCase(), pass].join("\u0001"); if (seen.has(key)) continue; seen.add(key);
    const lines = [];
    if (user) lines.push({ name: EMAIL.test(user) ? "Email" : "Username", value: user, secret: false });
    lines.push({ name: "Password", value: pass, secret: true });
    if (url) lines.push({ name: "Website", value: url, secret: false });
    if (g("totp")) lines.push({ name: "2FA", value: g("totp"), secret: true });
    if (g("note")) lines.push({ name: "Notes", value: g("note"), secret: false });
    out.push({ title: title.slice(0, 120), lines });
  }
  return out;
}
