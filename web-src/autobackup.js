/* ---- v8.7 (Ali, 29 Oct: "offline backup and online backup like WhatsApp") — Attune backs itself up every day.
   Set up once: a backup password (kept on this phone only — never inside a backup, never synced) and a folder picked with
   Android's own picker: on the phone / SD card (offline) or in Google Drive (online — the Drive app uploads it; no Google setup).
   Then, once a day when Attune opens, the backup file (backup.js: everything + Recall's messages, locked with the password) is
   written there; the newest 3 are kept (AutoBackup.kt). It restores like any backup: Backup & restore → Restore → pick the file.
   What Gmail gave stays out (it is read again from Gmail; Google's free review — docs/GMAIL_VERIFICATION.md).
   Tests: tests/unit/v870autobackup.test.mjs.                                                                                     */
import { collectData, encryptBackup, withPhoneData, passwordProblem } from "./backup.js";

export const AUTO_KEY = "attune:autobackup:v1";
const DAY = 864e5;
const ls = () => (typeof localStorage !== "undefined" ? localStorage : null);
export const loadAuto = (s = ls()) => { try { return { on: false, pw: "", last: 0, ...(JSON.parse((s && s.getItem(AUTO_KEY)) || "null") || {}) }; } catch (e) { return { on: false, pw: "", last: 0 }; } };
export const saveAuto = (a, s = ls()) => { try { s && s.setItem(AUTO_KEY, JSON.stringify(a)); } catch (e) {} return a; };
/** Turn it on with a password (checked like the manual backup's). → a problem to show, or "". */
export function setAutoPassword(pw, again, s = ls()) { const p = passwordProblem(pw, again); if (p) return p; saveAuto({ ...loadAuto(s), pw, on: true }, s); return ""; }
export const autoDue = (a = loadAuto(), folderSet = false, now = Date.now()) => !!(a.on && a.pw && folderSet && now - (a.last || 0) >= 20 * 3600e3);
const NO_GMAIL = [/^attune:gmail:/, /^attune:sms-old:/];
/** What goes into the daily backup: everything the manual backup saves, minus what Gmail gave. */
export function autoKeys(all) {
  const out = {};
  for (const [k, v] of Object.entries(all || {})) if (!NO_GMAIL.some((re) => re.test(k))) out[k] = v;
  if (out["attune:overpay:v1"]) { try { const o = JSON.parse(out["attune:overpay:v1"]); if (o && Array.isArray(o.emails)) { o.emails = o.emails.filter((e) => !String(e && e.id).startsWith("gm:")); out["attune:overpay:v1"] = JSON.stringify(o); } } catch (e) {} }
  return out;
}
export const autoName = (d = new Date()) => { const p = (n) => String(n).padStart(2, "0"); return `attune-auto-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.attune`; };
/** Make today's backup and write it into the folder. `call` = nativeCall. → { name, at } */
export async function runAutoBackup(call, native, { s = ls(), now = Date.now(), iterations } = {}) {
  const a = loadAuto(s); if (!a.on || !a.pw) throw new Error("Set a backup password first");
  const text = await encryptBackup(withPhoneData(autoKeys(collectData(s)), native), a.pw, { app: "auto", ...(iterations ? { iterations } : {}) });
  const r = await call("autoBackupWrite", { name: autoName(new Date(now)), text });
  saveAuto({ ...loadAuto(s), last: now, lastName: (r && r.name) || "" }, s);
  return { name: (r && r.name) || "", at: now };
}
