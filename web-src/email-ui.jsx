/* ---- v8.7 (Ali: "draft the emails in Gmail and send with my confirmation, like Gemini") — the email card on Home.
   The model writes it (emaildraft.js); you see To / Subject / Body and can change any of them; nothing leaves before you tap:
     Open in Gmail  → Gmail's own compose screen, filled in — you press Send there (works today, no setup)
     Send           → from your Gmail directly (gmail.send; Google asks once — after Ali's Google steps)
     Copy           → the subject and the email, to paste anywhere                                                         */
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { tr } from "./i18n.js";
import * as E from "./emaildraft.js";
import * as U from "./ui-kit.jsx";

const N = () => (typeof window !== "undefined" && window.AttuneNative) || null;
export function EmailCard({ text, write, me = "", onClose, onSent }) {
  const ask = E.parseEmailAsk(text);
  const [to, setTo] = useState(ask.to.join(", ")), [subject, setSubject] = useState(""), [body, setBody] = useState("");
  const [busy, setBusy] = useState(true), [note, setNote] = useState(""), [sent, setSent] = useState(false);
  useEffect(() => { let live = true;
    (async () => {
      let d = null;
      if (write) { try { d = E.readDraft(await write(E.draftMessages(ask, { me })), ask); } catch (e) { d = null; } }
      if (!d) d = E.fallbackDraft(ask);
      if (live) { setSubject(d.subject); setBody(d.body); setBusy(false); }
    })();
    return () => { live = false; }; }, [text]);
  const addrs = E.addrsOf(to), bad = addrs.filter((a) => !E.validAddr(a));
  const draft = { to: addrs.filter(E.validAddr), subject, body };
  const openGmail = () => {
    const n = N();
    if (n && n.intent) { let r = {}; try { r = JSON.parse(n.intent(JSON.stringify({ kind: "email", ...draft })) || "{}"); } catch (e) {} if (r.ok === false) setNote(tr(r.error || "Could not open it")); return; }
    try { window.open(E.mailtoOf(draft), "_blank"); } catch (e) {}
  };
  const canSend = !!(N() && typeof N().gmailSend === "function");
  const send = async () => {
    if (!draft.to.length) return setNote(tr("Who should it go to? Add an email address."));
    setBusy(true); setNote("");
    try { await window.__attuneNativeCall("gmailSend", draft); setSent(true); onSent && onSent(draft); }
    catch (e) { setNote(tr(String((e && e.message) || e)) + " · " + tr("You can still use Open in Gmail.")); }
    setBusy(false);
  };
  const copy = () => { try { navigator.clipboard.writeText((subject ? subject + "\n\n" : "") + body); setNote(tr("Copied")); } catch (e) {} };
  const field = "w-full rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-bg)] px-3 py-2 text-[14px] text-[var(--c-ink)]";
  if (sent) return <div className={U.cardPad} data-testid="email-sent"><p className="m-0 text-[14px] font-extrabold">{tr("Sent from your Gmail to {to}.", { to: draft.to.join(", ") })}</p>
    <button onClick={onClose} className={U.btnS + " mt-2"}>{tr("Close")}</button></div>;
  return <div className={U.cardPad + " space-y-2"} data-testid="email-card">
    <div className="flex items-center gap-2"><p className="m-0 flex-1 text-[14px] font-extrabold">{tr("Your email — check it, then send")}</p>
      <button onClick={onClose} aria-label={tr("Close")} className="w-11 h-11 grid place-items-center text-[var(--c-mut)]"><X size={16} /></button></div>
    <label className="block text-[12px] font-bold text-[var(--c-mut)]">{tr("To")}
      <input value={to} onChange={(e) => setTo(e.target.value)} placeholder={ask.toName ? tr("{n}'s email address", { n: ask.toName }) : "name@example.com"} dir="ltr" className={field + " mt-1"} data-testid="email-to" /></label>
    {bad.length ? <p className="m-0 text-[12px] text-[var(--c-neg)]">{tr("Not an email address: {a}", { a: bad.join(", ") })}</p> : null}
    <label className="block text-[12px] font-bold text-[var(--c-mut)]">{tr("Subject")}
      <input value={busy && !subject ? "" : subject} onChange={(e) => setSubject(e.target.value)} dir="auto" className={field + " mt-1"} data-testid="email-subject" /></label>
    <label className="block text-[12px] font-bold text-[var(--c-mut)]">{tr("Email")}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} dir="auto" placeholder={busy ? tr("Writing it…") : ""} className={field + " mt-1 leading-relaxed"} data-testid="email-body" /></label>
    {note ? <p className="m-0 text-[12.5px] text-[var(--c-mut)]" data-testid="email-note">{note}</p> : null}
    <div className="flex flex-wrap gap-2">
      {canSend ? <button onClick={send} disabled={busy || !body.trim()} className={U.btnP} data-testid="email-send">{tr("Send")}</button> : null}
      <button onClick={openGmail} disabled={busy || !body.trim()} className={canSend ? U.btnS : U.btnP} data-testid="email-gmail">{tr("Open in Gmail")}</button>
      <button onClick={copy} disabled={busy} className={U.btnS + " " + U.muted} data-testid="email-copy">{tr("Copy")}</button>
    </div>
    <p className={"m-0 text-[11.5px] " + U.muted}>{tr("Nothing is sent until you tap Send — here or in Gmail.")}</p>
  </div>;
}
