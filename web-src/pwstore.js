/* ---- v10.9.4 the Passwords page's store (Ali's OK-PW2, 23 Nov 2026: "as it is", screenshots, Home chat recalls, its own place, all
   together + toggles like Notion). Accounts: { id: "pw:…", title, fields: [{ id, name, value, lock, secs }], photos: [], created, updated }.
   The values of locked lines live in PW_SECRETS_KEY (docfields.js) — both keys start with "attune:pw:": in the encrypted backup file (Ali:
   "yes", 23 Nov), in sync too (Ali, 24 Nov — the same encrypted file; backup.js mergePwSecrets), never sent to any AI. Pure apart from localStorage; tests: tests/unit/v1094pw.test.mjs, e2e_v1094pw.py. */
import * as F from "./docfields.js";

export const PW_KEY = "attune:pw:v1", PW_VIEW = "attune:pw:view";
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
const id8 = () => "pw:" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function loadPw(st = ls()) { try { const v = JSON.parse((st && st.getItem(PW_KEY)) || "null"); return v && Array.isArray(v.items) ? v : { items: [] }; } catch (e) { return { items: [] }; } }
export function savePw(d, st = ls()) { try { st && st.setItem(PW_KEY, JSON.stringify(d)); } catch (e) {} return d; }
/** One line read from a page / a file → a details row (a password line locked with the fingerprint for 30 s). */
const rowOf = (l) => ({ id: "f" + Math.random().toString(36).slice(2, 8), name: String(l.name || "").slice(0, 40), value: String(l.value || "").slice(0, 400), lock: l.secret ? "finger" : "none", secs: l.secret ? 30 : 60 });
const norm = (s) => String(s || "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sig = (a) => norm(a.title) + "|" + a.lines.map((l) => l.value).join("|");

/** Saves accounts read by pwpaste.js; the same account (same title + same lines) is kept once. → { data, added: [ids], same } */
export function addAccounts(data, accounts, st = ls(), now = Date.now()) {
  const secrets = F.loadSecrets(st, F.PW_SECRETS_KEY);
  const have = new Set(data.items.map((x) => norm(x.title) + "|" + F.joined(x.id, x.fields, secrets).map((f) => f.value).join("|")));
  let items = [...data.items], sec = secrets, same = 0; const added = [];
  for (const a of accounts || []) {
    if (!a || (!a.title && !(a.lines || []).length)) continue;
    if (have.has(sig(a))) { same++; continue; } have.add(sig(a));
    const id = id8() + added.length, s = F.split(id, (a.lines || []).map(rowOf), sec);
    sec = s.secrets; items.push({ id, title: String(a.title || "Account").slice(0, 120), fields: s.fields, photos: [], created: now, updated: now }); added.push(id);
  }
  F.saveSecrets(sec, st, F.PW_SECRETS_KEY);
  return { data: { ...data, items }, added, same };
}
/** Undo of a batch. */
export function removeAccounts(data, ids, st = ls()) {
  const drop = new Set(ids), sec = { ...F.loadSecrets(st, F.PW_SECRETS_KEY) }; for (const i of ids) delete sec[i];
  F.saveSecrets(sec, st, F.PW_SECRETS_KEY);
  return { ...data, items: data.items.filter((x) => !drop.has(x.id)) };
}
/** v10.9.6 sync: a password whose account was deleted (on this device or the other) is not kept. */
export function pruneSecrets(data, st = ls()) { try { const sec = F.loadSecrets(st, F.PW_SECRETS_KEY), ids = new Set(data.items.map((x) => x.id)), out = {}; let gone = 0;
  for (const [k, v] of Object.entries(sec)) { if (ids.has(k)) out[k] = v; else gone++; } if (gone) F.saveSecrets(out, st, F.PW_SECRETS_KEY); return gone; } catch (e) { return 0; } }
export const patchAccount = (data, id, patch, now = Date.now()) => ({ ...data, items: data.items.map((x) => (x.id === id ? { ...x, ...patch, updated: now } : x)) });

/** The search box and Home chat: accounts whose title or a SHOWN line (an e-mail, a user name — never a password) matches every word. */
export function searchAccounts(data, q) {
  const words = norm(q).split(" ").filter(Boolean); if (!words.length) return data.items;
  return data.items.filter((x) => { const hay = norm(x.title + " " + (x.fields || []).filter((f) => !F.isLocked(f)).map((f) => f.name + " " + f.value).join(" ")); return words.every((w) => hay.includes(w)); });
}

// Home chat: "what's my discord password?" · "Mariam's password" · «باسورد الفيسبوك» · "which accounts use my outlook email?"
const ASK_PW = /\b(?:passwords?|pass(?:code)?|pw|pin ?(?:code|number)|my pin|logins?|credentials?)\b|باسورد|الباسورد|باس(?![\p{L}])|كلمة السر|كلمه السر|كلمة المرور|الرقم السري|(?<![\p{L}])(?:mot de passe|contraseña|passwort|senha|şifre|password|sandi|пароль|पासवर्ड|رمز عبور|পাসওয়ার্ড|nenosiri|รหัสผ่าน|mật khẩu|密码|パスワード|비밀번호)(?![\p{L}])/iu;
const ASK_USES = /\b(?:which|what) accounts?\b.*\b(?:use|uses|with|have)\b|(?:انهي|أنهي|اي|أي|ايه) (?:الحسابات|حسابات)|الحسابات اللي/iu;
const FILLER = /\b(?:what(?:'s| is)?|whats|my|the|for|of|is|me|show|give|tell|please|account|acc|again|do|i|have|use|uses|with|which|accounts|email|e-mail|mail)\b|إيه|ايه|هو|هي|بتاع|بتاعت|بتاعي|بتاعتي|الحساب|حساب|ابعتلي|قولي|وريني|عايز|عاوز|اعرف|ال(?=\S)/giu;
/** → null (not about passwords) or { kind: "account" | "list" | "none", items } */
// an ORDER that mentions a password is not a question: "remind me to change my netflix password", "my wifi password is 1234" (saving)
const ORDER = /\b(?:remind|reminder|change|update|reset|forgot|forget|set|create|make|save|add|is now|new password|share|send)\b|ذكرني|فكرني|غير|غيّر|اعمل|ضيف|احفظ|سجل|نسيت|ابعت/iu;
export function pwAsk(q, data) {
  const t = String(q || "");
  if (ORDER.test(t) || /\b(?:password|pass|باسورد|كلمة السر)\s*(?:is|=|:|هو|هي)\s*\S/iu.test(t)) return null;
  const uses = ASK_USES.test(t) && /@|mail|email|ايميل|الايميل|user|يوزر/i.test(t);
  if (!ASK_PW.test(t) && !uses) return null;
  if (!data.items.length) return { kind: "none", items: [] };
  const rest = t.replace(ASK_PW, " ").replace(/[?؟!.,'’]/g, " ").replace(FILLER, " ").replace(/\b(?:password|passwords)\b/gi, " ");
  const words = norm(rest).split(" ").filter((w) => w.length > 1 && !/^(?:s|ال)$/.test(w));
  if (!words.length) return { kind: "list", items: data.items };
  // every word that is in an account; the best = the most words matched
  const scored = data.items.map((x) => { const hay = norm(x.title + " " + (x.fields || []).filter((f) => !F.isLocked(f)).map((f) => f.value).join(" ")); return { x, n: words.filter((w) => hay.includes(w) || hay.includes(w.replace(/s$/, ""))).length }; }).filter((s) => s.n > 0);
  if (!scored.length) return { kind: "none", items: [] };
  const top = Math.max(...scored.map((s) => s.n)), best = scored.filter((s) => s.n === top).map((s) => s.x);
  return { kind: uses || best.length > 1 ? "list" : "account", items: best };
}
