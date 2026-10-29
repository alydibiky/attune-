/* ---- v8.7 the "Back up by itself every day" card (like WhatsApp) — in Backup & restore and on the Recall page (autobackup.js). */
import React, { useEffect, useState } from "react";
import { tr } from "./i18n.js";
import * as A from "./autobackup.js";
import * as U from "./ui-kit.jsx";

const stateOf = (N) => { try { return (N && N.autoBackupState && JSON.parse(N.autoBackupState() || "{}")) || {}; } catch (e) { return {}; } };
export function AutoBackupCard({ native: N, nativeCall, flash, compact = false }) {
  const [a, setA] = useState(A.loadAuto), [st, setSt] = useState(() => stateOf(N));
  const [pw, setPw] = useState(""), [pw2, setPw2] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { const on = (e) => setSt(e.detail && e.detail.ok ? e.detail : stateOf(N)); window.addEventListener("attune-backup-folder", on); return () => window.removeEventListener("attune-backup-folder", on); }, []);
  if (!N || !N.autoBackupPick) return null;
  const pick = () => { try { N.autoBackupPick(); } catch (e) {} };
  const savePw = () => { const p = A.setAutoPassword(pw, pw2); if (p) return setErr(tr(p)); setErr(""); setPw(""); setPw2(""); setA(A.loadAuto()); };
  const now = async () => { setBusy(true); setErr(""); try { await A.runAutoBackup(nativeCall, N); setA(A.loadAuto()); flash && flash(tr("Backed up")); } catch (e) { setErr(tr(String((e && e.message) || e))); } setBusy(false); };
  const ready = a.on && a.pw && st.set;
  const where = st.set ? (st.where === "drive" ? tr("Google Drive · {f}", { f: st.name }) : tr("This phone · {f}", { f: st.name })) : "";
  const last = a.last ? new Date(a.last).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return <div className={(compact ? "" : U.card + " ") + "px-3.5 py-3 space-y-2"} data-testid="autobackup">
    <p className="m-0 text-[13.5px] font-extrabold">{ready ? tr("Backs up by itself every day") : tr("Back up by itself every day")}</p>
    <p className={"m-0 text-[12.5px] leading-relaxed " + U.muted}>{ready ? tr("To {w}. Last: {t}. Everything, with Recall's messages, locked with your backup password; the newest 3 are kept.", { w: where, t: last || "—" })
      : tr("Like WhatsApp: pick a folder once — on this phone (offline) or in Google Drive (online) — and Attune saves a locked backup there every day, messages included.")}</p>
    {!(a.on && a.pw) ? <div className="space-y-2">
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={tr("Backup password (8+ characters)")} autoComplete="new-password" dir="ltr" className={U.inp} data-testid="autobackup-pw" />
      <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder={tr("Same password again")} autoComplete="new-password" dir="ltr" className={U.inp} data-testid="autobackup-pw2" />
      <p className={"m-0 text-[11.5px] " + U.muted}>{tr("You need this password to restore — write it down. It stays on this phone.")}</p>
      <button onClick={savePw} className={U.btnP} data-testid="autobackup-pw-save">{tr("Save the password")}</button>
    </div> : null}
    <div className="flex flex-wrap gap-2">
      <button onClick={pick} className={st.set ? U.btnS : U.btnP} data-testid="autobackup-folder">{st.set ? tr("Change the folder") : tr("Choose the backup folder")}</button>
      {ready ? <button onClick={now} disabled={busy} className={U.btnS} data-testid="autobackup-now">{busy ? tr("Backing up…") : tr("Back up now")}</button> : null}
    </div>
    {!st.set ? <p className={"m-0 text-[11.5px] " + U.muted}>{tr("For Google Drive: in the picker tap ☰ → Drive → a folder (make one called Attune) → Use this folder.")}</p> : null}
    {err ? <p className="m-0 text-[12px] text-[var(--c-neg)]" data-testid="autobackup-err">{err}</p> : null}
  </div>;
}
