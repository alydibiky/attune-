/* ---- "Are you sure?" before anything is deleted (v5.28) ---------------------------------
   Ali: "make the delete with confirmation". One small dialog for the whole app:
   `await askConfirm("Delete this reminder?")` → true / false. <ConfirmHost/> is mounted once
   in the app shell.                                                                        */
import React, { useEffect, useState } from "react";
import { tr } from "./i18n.js";

let show = null;

/** Ask before deleting. → Promise<boolean> */
export function askConfirm(message, { yes = "Delete", no = "Cancel" } = {}) {
  return new Promise((resolve) => {
    if (show) show({ message, yes, no, resolve });
    else resolve(true);                         // (no dialog mounted — tests of single screens)
  });
}

export function ConfirmHost() {
  const [q, setQ] = useState(null);
  useEffect(() => { show = setQ; return () => { if (show === setQ) show = null; }; }, []);
  if (!q) return null;
  const done = (v) => { setQ(null); q.resolve(v); };
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-6" onClick={() => done(false)} data-testid="confirm">
      <div className="calm w-full max-w-sm rounded-[22px] border border-[var(--c-ln)] bg-[var(--c-surf)]! text-[var(--c-ink)] p-5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <p dir="auto" className="text-[16px] font-extrabold text-[var(--c-ink)] leading-relaxed m-0">{tr(q.message)}</p>
        <p className="text-[12.5px] text-[var(--c-mut)] mt-1 mb-0">{tr("This can't be undone.")}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => done(false)} data-testid="confirm-no" className="min-h-[44px] h-11 px-4 rounded-[14px] border border-[var(--c-ln)] bg-[var(--c-surf)] text-[var(--c-ink)] text-[13.5px] font-bold hover:border-[var(--c-acc)] transition-colors duration-150">{tr(q.no)}</button>
          <button onClick={() => done(true)} data-testid="confirm-yes" className="min-h-[44px] h-11 px-5 rounded-[14px] bg-[var(--c-neg)] text-[var(--c-on-acc)] text-[13.5px] font-extrabold" autoFocus>{tr(q.yes)}</button>
        </div>
      </div>
    </div>
  );
}
