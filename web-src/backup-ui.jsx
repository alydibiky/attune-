/* ---- Backup & restore screen ----------------------------------------------------
   Opened from More. Two halves:
   - Back up: shows what will be saved, asks for a password twice, locks the data
     (backup.js) and hands the file to Android's "Save to…" picker, so it can go
     straight to Google Drive, Downloads or a USB stick.
   - Restore: pick a .attune file, see its date and contents WITHOUT the
     password, then unlock, choose Replace or Merge, confirm. The phone's
     current data is kept aside first so the restore can be undone.            */
import React, { useState, useRef } from "react";
import { X, Lock, Download, RefreshCw, ShieldCheck, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { tr, fmtNum } from "./i18n.js";
import { SyncPanel } from "./sync-ui.jsx";
import * as K from "./ui-kit.jsx";
import {
  collectData, summarize, encryptBackup, decryptBackup, readHeader, restoreData, passwordProblem,
  passwordStrength, backupFileName, LAST_BACKUP_KEY, daysSinceBackup,
} from "./backup.js";

const UNDO_NAME = "before-restore.json";

function kb(n) { return n > 1e6 ? fmtNum(n / 1e6, { maximumFractionDigits: 1 }) + " MB" : fmtNum(Math.max(1, Math.round(n / 1e3))) + " KB"; }

function Summary({ s }) {
  const rows = [
    [tr("Chats"), s.chats], [tr("Money ledger entries"), s.ledger], [tr("Cycle days logged"), s.cycleDays],
    [tr("Memory items"), s.memory], [tr("Reminders"), s.reminders],
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5 text-[12px]">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2">
          <span className="text-[var(--c-mut)]">{k}</span><span className="text-[var(--c-ink)] font-extrabold tabular-nums" dir="ltr">{fmtNum(v || 0)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-2 rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 py-2">
        <span className="text-[var(--c-mut)]">{tr("Size")}</span><span className="text-[var(--c-ink)] font-extrabold tabular-nums" dir="ltr">{kb(s.bytes || 0)}</span>
      </div>
    </div>
  );
}

function PwBox({ value, onChange, placeholder, show, autoFocus, testid }) {
  return (
    <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      autoFocus={autoFocus} autoComplete="new-password" autoCapitalize="off" spellCheck={false} data-testid={testid} dir="ltr"
      className={K.inp} />
  );
}

export function BackupPanel({ close, flash, nativeCall, native }) {
  const [tab, setTab] = useState("backup");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(""); const [err, setErr] = useState(""); const [done, setDone] = useState("");
  const [file, setFile] = useState(null);      // { name, text, head }
  const [opened, setOpened] = useState(null);  // keys from the backup
  const [mode, setMode] = useState("replace");
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef(null);
  const now = summarize(collectData());
  const since = daysSinceBackup();
  const strength = passwordStrength(pw);
  const hasUndo = (() => { try { return native && native.stashGet ? !!native.stashGet(UNDO_NAME) : !!sessionStorage.getItem("attune:undo"); } catch (e) { return false; } })();

  async function doBackup() {
    const p = passwordProblem(pw, pw2);
    if (p) return setErr(tr(p));
    setErr(""); setDone(""); setBusy(tr("Locking your data…"));
    try {
      const text = await encryptBackup(collectData(), pw, { app: "5" });
      const name = backupFileName();
      if (native) {
        setBusy(tr("Choose where to save it…"));
        const r = await nativeCall("saveFile", { name, mime: "application/octet-stream", text });
        setDone(tr("Saved as {name}", { name: r.name || name }));
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
        a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        setDone(tr("Saved as {name}", { name }));
      }
      try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) {}
      setPw(""); setPw2("");
    } catch (e) {
      setErr(/cancel/i.test(e.message) ? tr("Not saved — you closed the picker.") : e.message);
    } finally { setBusy(""); }
  }

  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!f) return;
    setErr(""); setOpened(null); setConfirm(false); setPw("");
    try {
      const text = await f.text();
      setFile({ name: f.name, text, head: readHeader(text) });
    } catch (x) { setFile(null); setErr(tr(x.message)); }
  }

  async function unlock() {
    if (!pw) return setErr(tr("Type the backup's password."));
    setErr(""); setBusy(tr("Unlocking…"));
    try { setOpened(await decryptBackup(file.text, pw)); }
    catch (x) { setErr(tr(x.message)); }
    finally { setBusy(""); }
  }

  function doRestore() {
    setErr("");
    try {
      const before = collectData();
      const undo = JSON.stringify({ at: Date.now(), keys: before });
      try { if (native && native.stashPut) native.stashPut(UNDO_NAME, undo); else sessionStorage.setItem("attune:undo", undo); } catch (e) {}
      restoreData(opened, mode);
      flash && flash(tr("Restored — reopening…"));
      setTimeout(() => location.reload(), 600);
      setDone(tr("Restored — reopening…"));
    } catch (x) { setErr(tr(x.message)); }
  }

  function undoRestore() {
    try {
      const raw = native && native.stashGet ? native.stashGet(UNDO_NAME) : sessionStorage.getItem("attune:undo");
      const u = JSON.parse(raw || "null");
      if (!u || !u.keys) return setErr(tr("Nothing to undo."));
      restoreData(u.keys, "replace");
      if (native && native.stashDel) native.stashDel(UNDO_NAME); else sessionStorage.removeItem("attune:undo");
      setDone(tr("Undone — reopening…"));
      setTimeout(() => location.reload(), 600);
    } catch (x) { setErr(tr(x.message)); }
  }

  const tabBtn = (id, label) => (
    <button onClick={() => { setTab(id); setErr(""); setDone(""); setPw(""); setPw2(""); }}
      className={`flex-1 min-h-[40px] rounded-full text-[13.5px] font-bold transition-colors duration-150 ${tab === id ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] font-extrabold shadow-sm" : "text-[var(--c-mut)]"}`}>{label}</button>
  );

  return (
    <div className="calm fixed inset-0 z-[60] bg-black/70! flex items-center justify-center p-4" onClick={close}>
      <div className={K.card + " max-w-md w-full p-5"} onClick={(e) => e.stopPropagation()} data-testid="backup-panel">
        <div className="flex items-center justify-between mb-1">
          <h2 className={K.h1 + " text-[20px] flex items-center gap-2"}><ShieldCheck size={19} className="text-[var(--c-acc)]" />{tr("Backup & sync")}</h2>
          <button onClick={close} className="-me-2 w-11 h-11 grid place-items-center rounded-full text-[var(--c-mut)] hover:text-[var(--c-ink)] hover:bg-[var(--c-surf-2)]" aria-label={tr("Close")}><X size={20} /></button>
        </div>
        <p className="text-xs text-[var(--c-mut)] mb-3">{tr("Everything in Attune lives only on this phone. A backup is one file, locked with your password, that you can keep anywhere.")}</p>
        <div className="flex gap-1 bg-[var(--c-bg)] border border-[var(--c-ln)] rounded-full p-1 mb-4">{tabBtn("backup", tr("Back up"))}{tabBtn("restore", tr("Restore"))}{tabBtn("sync", tr("Sync"))}</div>

        {/* v6.37: Sync — Wi-Fi or Google Drive (sync-ui.jsx) */}
        {tab === "sync" ? <SyncPanel native={native} flash={flash} /> : tab === "backup" ? (
          <div className="space-y-3">
            <p className={K.label}>{tr("What will be saved")}</p>
            <Summary s={now} />
            <p className="text-[11px] text-[var(--c-mut)]">{since == null ? tr("You have never made a backup.") : since === 0 ? tr("Last backup: today.") : tr("Last backup: {n} days ago.", { n: since })} {tr("Models are not included — download them again from Engine.")}</p>
            <PwBox value={pw} onChange={setPw} placeholder={tr("Password (8+ characters)")} show={show} testid="bk-pw" />
            <PwBox value={pw2} onChange={setPw2} placeholder={tr("Same password again")} show={show} testid="bk-pw2" />
            <div className="flex items-center justify-between text-[11px]">
              <div className="flex gap-1 items-center">
                {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-8 rounded-full ${strength >= i ? (strength === 1 ? "bg-[var(--c-warn)]" : "bg-[var(--c-acc)]") : "bg-[var(--c-surf-2)]"}`} />)}
                <span className="text-[var(--c-mut)] ms-1">{[tr("Too short"), tr("Weak"), tr("Good"), tr("Strong")][strength]}</span>
              </div>
              <label className="text-[var(--c-mut)] flex items-center gap-1"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />{tr("Show")}</label>
            </div>
            <div className="flex gap-2 items-start rounded-[16px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-2.5 text-[11px] text-[var(--c-warn)]">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{tr("If you forget this password the backup cannot be opened — by anyone. Write it down somewhere safe.")}</span>
            </div>
            <button onClick={doBackup} disabled={!!busy} data-testid="bk-save"
              className={K.btnP + " w-full"}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}{busy || tr("Lock and save backup")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input ref={fileRef} type="file" accept="*/*" className="hidden" onChange={pick} data-testid="bk-file" />
            <button onClick={() => fileRef.current && fileRef.current.click()}
              className={K.btnS + " w-full !h-12 !min-h-[48px]"}>
              <Download size={16} />{file ? tr("Choose a different file") : tr("Choose backup file")}
            </button>
            {file ? (
              <div className="rounded-[18px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3.5 space-y-2">
                <p className="text-[13px] font-bold text-[var(--c-ink)] break-all">{file.name}</p>
                <p className="text-[11px] text-[var(--c-mut)]">{tr("Made on {d}", { d: new Date(file.head.created).toLocaleString() })}</p>
                {file.head.summary ? <Summary s={file.head.summary} /> : null}
              </div>
            ) : null}
            {file && !opened ? (
              <>
                <PwBox value={pw} onChange={setPw} placeholder={tr("Backup password")} show={show} autoFocus testid="rs-pw" />
                <button onClick={unlock} disabled={!!busy} data-testid="rs-unlock"
                  className={K.btnP + " w-full"}>
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}{busy || tr("Unlock")}
                </button>
              </>
            ) : null}
            {opened ? (
              <div className="space-y-2">
                <p className="text-[12px] text-[var(--c-acc)] flex items-center gap-1.5"><CheckCircle2 size={14} />{tr("Unlocked. How should it be restored?")}</p>
                {[["replace", tr("Replace everything on this phone"), tr("This phone becomes exactly like the backup.")],
                  ["merge", tr("Merge"), tr("Keep everything on this phone and add the backup's chats, memory, reminders and cycle days. The Money ledger is only taken from the backup if this phone has none.")]].map(([id, a, b]) => (
                  <label key={id} className={`block rounded-[16px] border p-3 min-h-[48px] transition-colors duration-150 ${mode === id ? "border-[var(--c-acc-2)] bg-[var(--c-surf-2)]" : "border-[var(--c-ln)]"}`}>
                    <span className="flex items-center gap-2 text-sm text-[var(--c-ink)]"><input type="radio" name="rmode" checked={mode === id} onChange={() => { setMode(id); setConfirm(false); }} />{a}</span>
                    <span className="block text-[11px] text-[var(--c-mut)] ms-6">{b}</span>
                  </label>
                ))}
                {!confirm ? (
                  <button onClick={() => setConfirm(true)} data-testid="rs-restore" className={K.btnP + " w-full"}>{tr("Restore")}</button>
                ) : (
                  <div className="rounded-[18px] border border-[var(--c-neg)]/40 bg-[var(--c-neg)]/10 p-3.5 space-y-2">
                    <p className="text-[12px] text-[var(--c-neg)]">{mode === "replace"
                      ? tr("This phone's {c} chats and {l} ledger entries will be replaced by the backup's. You can undo this once, right after.", { c: now.chats, l: now.ledger })
                      : tr("The backup's items will be added to this phone. You can undo this once, right after.")}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setConfirm(false)} className={K.btnS + " flex-1"}>{tr("Cancel")}</button>
                      <button onClick={doRestore} data-testid="rs-confirm" className="flex-1 min-h-[44px] bg-[var(--c-neg)] text-[var(--c-on-acc)] font-extrabold rounded-[14px] text-sm">{tr("Yes, restore")}</button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
            {hasUndo && !opened ? (
              <button onClick={undoRestore} data-testid="rs-undo" className={K.btnS + " w-full !text-[var(--c-mut)]"}>
                <RefreshCw size={14} />{tr("Undo the last restore")}
              </button>
            ) : null}
          </div>
        )}
        {err ? <p className="mt-3 text-[12px] text-[var(--c-neg)]" role="alert" data-testid="bk-err">{err}</p> : null}
        {done ? <p className="mt-3 text-[12px] text-[var(--c-acc)]" data-testid="bk-done">{done}</p> : null}
      </div>
    </div>
  );
}

/** The line under "Backup" in More: nudges when it has been a while. */
export function backupNudge() {
  const d = daysSinceBackup();
  if (d == null) return { text: tr("Never — do it now"), warn: true };
  if (d === 0) return { text: tr("Backed up today"), warn: false };
  return { text: tr("{n} days ago", { n: d }), warn: d >= 14 };
}
