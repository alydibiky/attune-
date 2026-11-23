// v10.9.4 Passwords in one go (Ali's OK-PW, 23 Nov 2026: "it doesn't have to have a username, I just want it as it is").
// EXACTLY 10,000 different cases, COMPOSED from parts in random order:
//   A (7,500) a page pasted from notes: 1–25 accounts (services, people's names, Arabic titles), each with its own lines in any order and
//     any naming (email / user / pass / pw / PIN / recovery code / «باسورد» / «كلمة السر» / notes / a bare password / a bare user name),
//     separators ": " ":" " = " " - ", in one of the page shapes — Notion toggles (▸ + indent), Notion's Markdown export (- + indented -),
//     headings (## ), numbered lists, plain blocks with empty lines between.
//     HARD (paste-real changes — NOT tests/lib/hard.mjs, which changes letter case: a pasted password never changes case): tabs or 2 / 4
//     spaces, Windows line endings, non-breaking spaces, direction marks, extra empty lines, trailing spaces, the toggle sign changed.
//     Must be EXACT: every account, in order, its title, every line's name and value as written; EVERY password locked (a lock on a bare
//     user name is allowed — never a password left open).
//   B (2,500) a password app's .csv (Google / Chrome / Edge / Firefox / Bitwarden / 1Password / Apple / LastPass / Dashlane columns) with
//     commas, quotes and line breaks inside values, a BOM, CRLF, logins without a password, the same login twice → each login once, exact.
//     node tests/pw/gen.mjs        SEED_SHIFT=1 → another 10,000 (held-out)
import { readPastedPage, readPasswordFile } from "../../web-src/pwpaste.js";
import { shapeOf, shapeReport, SHAPE_BAR } from "../lib/hard.mjs";

export function run(total = 10000, shift = 0, { quiet = false } = {}) {
  let seed = 20261125 + 6151 * shift; const rnd = () => { let t = (seed += 0x6D2B79F5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pick = (a) => a[Math.floor(rnd() * a.length)], int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = Math.floor(rnd() * (i + 1)); [a[i], a[k]] = [a[k], a[i]]; } return a; };
  const TITLES = ["Microsoft", "discord account", "Instagram", "Ubisoft", "Steam", "Blizzard · Overwatch", "Epic Games", "Netflix", "Gmail work", "Facebook", "Apple ID", "Wifi home",
    "Mariam's password", "Bank app", "Vodafone Cash", "Telda", "Riot Games", "Spotify", "Amazon", "PlayStation", "Xbox", "Minecraft", "Roblox", "Snapchat", "TikTok", "Twitter / X",
    "ايميل الشغل", "حساب البنك", "واي فاي البيت", "فيسبوك ماما", "انستاباي", "Uni portal", "Canva", "Notion", "GitHub", "Zoom", "Coursera"];
  const NAMES = { email: ["email", "Email", "e-mail", "mail", "الايميل", "ايميل"], user: ["user", "username", "User name", "login", "اليوزر", "يوزر"],
    pass: ["pass", "password", "Password", "pw", "pwd", "PASS", "باسورد", "الباسورد", "باس", "كلمة السر", "mot de passe", "contraseña", "şifre"],
    pin: ["pin", "PIN", "pin code", "الرقم السري"], rec: ["recovery code", "backup codes", "2fa", "Recovery key"], note: ["notes", "note", "hint", "ملاحظة"], sq: ["security question", "Security answer"] };   // (a security question's answer IS a secret — locked)
  const SEC = new Set(["pass", "pin", "rec", "sq"]);
  const W = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ", D = "0123456789", S = "!@#$%^&*_-+.?~";
  const pw = () => { let p = ""; const n = int(8, 18); for (let i = 0; i < n; i++) p += pick(pick([W, W, D, S])); if (!/\d/.test(p)) p += pick(D); if (!/[A-Za-z]/.test(p)) p += pick(W); return p; };
  const email = () => pick(["aly.d", "aly_dibiki", "skittlz", "a.dibiki93", "mariam.h"]) + int(0, 99) + "@" + pick(["gmail.com", "outlook.com", "yahoo.com", "icloud.com", "hotmail.com"]);
  const uname = () => pick(["skittlz", "skittlzcarbon", "aly_d", "AlyD", "carbon_x", "nour.e"]) + (rnd() < 0.5 ? int(1, 999) : "");
  const sep = () => pick([": ", ":", " : ", " = ", " - ", "： "]);
  let ok = 0; const wrong = [], shapes = [];
  const NA = Math.round(total * 0.75);
  for (let i = 0; i < total; i++) {
    if (i < NA) {
      const n = int(1, 25), shape = pick(["notion", "md", "heading", "numbered", "plain"]), ind = pick(["    ", "  ", "\t"]);
      const titles = shuffle([...TITLES]).slice(0, n).map((t) => (rnd() < 0.15 ? t + " " + int(2, 9) : t));
      const exp = [], out = [];
      for (const title of titles) {
        const kinds = shuffle(["pass", ...(rnd() < 0.7 ? [pick(["email", "user"])] : []), ...(rnd() < 0.2 ? ["pin"] : []), ...(rnd() < 0.15 ? ["rec"] : []), ...(rnd() < 0.2 ? ["note"] : []), ...(rnd() < 0.08 ? ["sq"] : [])]);
        const lines = [];
        for (const k of kinds) {
          const bare = (k === "pass" || k === "user") && rnd() < 0.2;
          const value = k === "pass" ? pw() : k === "email" ? email() : k === "user" ? uname() : k === "pin" ? String(int(1000, 999999)) : k === "rec" ? `${int(1000, 9999)}-${int(1000, 9999)}` : k === "sq" ? pick(["Cairo", "my first school", "Max"]) : pick(["first pet", "the old one", "changed in March", "same as gmail"]);
          if (bare) lines.push({ name: "", value, secret: k === "pass", k });
          else lines.push({ name: pick(NAMES[k]), value, secret: SEC.has(k), k });
        }
        exp.push({ title, lines });
        const head = shape === "notion" ? pick(["▸ ", "▶ ", "‣ ", "> "]) + title : shape === "md" ? "- " + title : shape === "heading" ? pick(["## ", "### ", "# "]) + title : shape === "numbered" ? (exp.length) + ". " + title : title;
        out.push(head);
        for (const l of lines) { const txt = l.name ? l.name + sep() + l.value : l.value; out.push(shape === "plain" ? txt : shape === "md" ? ind + "- " + txt : shape === "heading" || shape === "numbered" ? (rnd() < 0.5 ? ind : "") + txt : ind + txt); }
        if (shape === "plain" || rnd() < 0.3) out.push("");
        if (rnd() < 0.1) out.push("");
      }
      // paste-real changes
      let text = out.map((l) => (rnd() < 0.1 ? l + pick([" ", "  ", " "]) : l)).map((l) => (rnd() < 0.05 ? "‏" + l : l)).join(pick(["\n", "\n", "\r\n"]));
      if (rnd() < 0.2) text = "\n\n" + text;
      const got = readPastedPage(text);
      const probs = [];
      if (got.length !== exp.length) probs.push(`accounts ${got.length} ≠ ${exp.length}`);
      for (let a = 0; a < Math.min(got.length, exp.length) && probs.length < 3; a++) {
        const g = got[a], e = exp[a];
        if (g.title !== e.title) probs.push(`title "${g.title}" ≠ "${e.title}"`);
        if (g.lines.length !== e.lines.length) { probs.push(`${e.title}: ${g.lines.length} lines ≠ ${e.lines.length}`); continue; }
        e.lines.forEach((el, k) => { const gl = g.lines[k];
          if (gl.name !== el.name || gl.value !== el.value) probs.push(`${e.title}: "${gl.name}|${gl.value}" ≠ "${el.name}|${el.value}"`);
          else if (el.secret && !gl.secret) probs.push(`${e.title}: the password "${el.value}" is NOT locked`);
          else if (!el.secret && gl.secret && el.name) probs.push(`${e.title}: "${el.name}" locked for no reason`); });
      }
      if (!probs.length) ok++; else if (wrong.length < 40) wrong.push({ shape, probs, text: text.slice(0, 300) });
      shapes.push("A|" + shape + "|" + shapeOf(text.replace(/[^\n▸▶‣>#\-.:=]/g, "x").slice(0, 400)) + "|" + exp.map((e) => e.lines.map((l) => l.k[0] + (l.name ? "n" : "b")).join("")).join(","));
    } else {
      const app = pick(["google", "chrome", "firefox", "bitwarden", "1password", "apple", "lastpass", "dashlane"]);
      const H = { google: ["name", "url", "username", "password", "note"], chrome: ["name", "url", "username", "password", "note"], firefox: ["url", "username", "password", "httpRealm", "formActionOrigin", "guid", "timeCreated"],
        bitwarden: ["folder", "favorite", "type", "name", "notes", "fields", "reprompt", "login_uri", "login_username", "login_password", "login_totp"], "1password": ["Title", "Url", "Username", "Password", "OTPAuth", "Favorite", "Archived", "Tags", "Notes"],
        apple: ["Title", "URL", "Username", "Password", "Notes", "OTPAuth"], lastpass: ["url", "username", "password", "totp", "extra", "name", "grouping", "fav"], dashlane: ["username", "username2", "username3", "title", "password", "note", "url", "category", "otpSecret"] }[app];
      const n = int(1, 60), rows = [], expKeys = new Set(), exp = [];
      for (let k = 0; k < n; k++) {
        const site = pick(["accounts.google.com", "www.netflix.com", "discord.com", "store.steampowered.com", "www.instagram.com", "login.live.com", "my.vodafone.com.eg", "online.cib.eg"]);
        const user = rnd() < 0.9 ? (rnd() < 0.5 ? email() : uname()) : "";
        const pass = rnd() < 0.93 ? pw() + pick(["", ",x", '"q', "a b"]) : "";
        const name = rnd() < 0.7 ? pick(["Google", "Netflix", "Discord", "Steam", "Instagram", "Microsoft", "Vodafone", "CIB online"]) : "";
        const note = rnd() < 0.2 ? pick(["two lines\nhere", "with, comma", 'say "hi"', "عربي"]) : "";
        const v = { name, title: name, url: "https://" + site + pick(["", "/login", "/"]), uri: "", username: user, login_username: user, password: pass, login_password: pass, note, notes: note, extra: note, login_uri: "", Title: name, Url: "", URL: "", Username: user, Password: pass, Notes: note };
        v.uri = v.login_uri = v.Url = v.URL = v.url;
        const row = H.map((h) => (h in v ? v[h] : h === "type" ? "login" : ""));
        rows.push(row); if (rnd() < 0.08) rows.push(row);   // the same login twice
        if (!pass) continue;
        const hasTitle = H.some((h) => /^(?:name|title)$/i.test(h));
        const title = (hasTitle && name) || new URL(v.url).hostname.replace(/^www\./, "");
        const key = [title.toLowerCase(), user.toLowerCase(), pass].join("\u0001"); if (expKeys.has(key)) continue; expKeys.add(key);
        exp.push({ title, user, pass, note: H.some((h) => /^(?:note|notes|extra)$/i.test(h)) ? note : "" });
      }
      const q = (x) => (/[",\n\r]/.test(x) || (rnd() < 0.2 && x) ? '"' + x.replace(/"/g, '""') + '"' : x);
      const nl = pick(["\n", "\r\n"]);
      const text = (rnd() < 0.3 ? "﻿" : "") + [H, ...rows].map((r) => r.map(q).join(",")).join(nl) + (rnd() < 0.5 ? nl : "");
      const got = readPasswordFile(text);
      const probs = [];
      if (got.length !== exp.length) probs.push(`logins ${got.length} ≠ ${exp.length}`);
      else exp.forEach((e, k) => { const g = got[k], val = (nm) => (g.lines.find((l) => l.name === nm) || {}).value || "";
        if (g.title !== e.title) probs.push(`title ${g.title} ≠ ${e.title}`);
        if (val("Password") !== e.pass || !(g.lines.find((l) => l.name === "Password") || {}).secret) probs.push(`password of ${e.title}`);
        if ((val("Email") || val("Username")) !== e.user) probs.push(`user of ${e.title}`);
        if (e.note && val("Notes") !== e.note) probs.push(`note of ${e.title}`); });
      if (!probs.length) ok++; else if (wrong.length < 40) wrong.push({ app, probs: probs.slice(0, 3), text: text.slice(0, 200) });
      shapes.push("B|" + app + "|" + n + "|" + exp.map((e) => (e.user ? "u" : "-") + (e.note ? "n" : "")).join(""));
    }
  }
  const sh = shapeReport(shapes);
  if (!quiet) {
    console.log(`passwords: ${ok} / ${total} right (${(100 * ok / total).toFixed(2)} %) · HARD (paste-real) · ${sh.shapes} different shapes (${(100 * sh.share).toFixed(1)} %, bar ${100 * SHAPE_BAR} %)`);
    for (const w of wrong.slice(0, 12)) console.log("  WRONG " + (w.shape || w.app) + ": " + w.probs.join(" · ") + "\n    " + JSON.stringify(w.text).slice(0, 260));
  }
  return { right: ok, total, share: sh.share, wrong };
}
if (import.meta.url === "file://" + process.argv[1]) run(+(process.argv[2] || 10000), +(process.env.SEED_SHIFT || 0));
