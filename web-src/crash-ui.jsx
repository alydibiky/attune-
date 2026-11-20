/* ---- v10.8 problem reports (Ali picked CR3; OK-CR: "I don't want users to see the problem — they just send it") ----------------
   The phone keeps what went wrong quietly (CrashLog.kt). People see only:
     · Home, after Attune really closed by itself (once): "Attune closed by itself last time" — Send a report · Not now
     · Settings: "Send a problem report" while there is something to send
   Send opens the phone's share sheet with the report (they choose e-mail, WhatsApp…). The problem itself is never shown, and
   nothing is ever sent by itself. */
import React, { useState } from "react";
import { tr } from "./i18n.js";

const N = () => (typeof window !== "undefined" && window.AttuneNative) || null;
export const crashState = () => { try { const n = N(); return n && n.crashState ? JSON.parse(n.crashState() || "{}") : {}; } catch (e) { return {}; } };
// the phone opens its share sheet; the computer has none — it copies the report to paste into an e-mail or WhatsApp
const send = () => { try { const n = N(); const r = n && n.crashSend && n.crashSend(); return r === "copied" ? "copied" : !!r; } catch (e) { return false; } };
const thanks = (r) => flash(r === "copied" ? tr("Report copied — paste it into an e-mail or WhatsApp.") : tr("Thank you — that helps fix it."));
const flash = (m) => { try { window.dispatchEvent(new CustomEvent("attune-flash", { detail: m })); } catch (e) {} };

export function CrashCard() {
  const [st, setSt] = useState(crashState);
  if (!st.pending) return null;
  const done = (sent) => { if (!sent) { try { N().crashDismiss(); } catch (e) {} } else thanks(sent); setSt({ ...st, pending: false }); };
  return <div className="c-card space-y-2" style={{ borderColor: "var(--c-acc)" }} data-testid="crash-card" role="status">
    <p className="m-0 text-[14.5px] font-extrabold">{tr("Attune closed by itself last time")}</p>
    <p className="m-0 text-[13px] c-sub">{tr("Send a report so it gets fixed? You choose where it goes — nothing is sent by itself.")}</p>
    <div className="flex flex-wrap gap-2">
      <button onClick={() => done(send())} className="min-h-[44px] px-4 rounded-full font-extrabold text-[13.5px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="crash-send">{tr("Send a report")}</button>
      <button onClick={() => done(false)} className="min-h-[44px] px-4 rounded-full font-extrabold text-[13.5px] border border-[var(--c-ln)] c-sub" data-testid="crash-later">{tr("Not now")}</button>
    </div>
  </div>;
}

export function ProblemReportRow() {
  const [st] = useState(crashState);
  if (!st.count) return null;
  return <button onClick={() => { const r = send(); if (r) thanks(r); }} className="mt-2 w-full min-h-[52px] rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] px-3.5 py-2.5 flex items-center gap-2.5 text-start text-[13px] font-bold text-[var(--c-ink)]" data-testid="more-report">
    <span aria-hidden="true">✉️</span><span className="flex-1">{tr("Send a problem report")}</span><span aria-hidden="true" className="c-sub rtl:-scale-x-100">›</span></button>;
}
