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
      <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
        <p dir="auto" className="text-[15px] text-slate-100 leading-relaxed">{tr(q.message)}</p>
        <p className="text-[12px] text-slate-500 mt-1">{tr("This can't be undone.")}</p>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => done(false)} data-testid="confirm-no" className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm">{tr(q.no)}</button>
          <button onClick={() => done(true)} data-testid="confirm-yes" className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold" autoFocus>{tr(q.yes)}</button>
        </div>
      </div>
    </div>
  );
}
