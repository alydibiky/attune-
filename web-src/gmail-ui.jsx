/* ---- v8.7 (Ali: "reads Gmail by itself"): the one card that connects Gmail and says what it read (gmail.js). Shown in the
   Overpaying check and in Recall. Not in the Android app (the website, the computer app) → nothing.                      */
import React, { useState } from "react";
import { FileText as Mail } from "lucide-react";
import { tr } from "./i18n.js";
import * as G from "./gmail.js";
import * as U from "./ui-kit.jsx";

const call = (m, a) => (typeof window !== "undefined" && window.__attuneNativeCall ? window.__attuneNativeCall(m, a) : Promise.reject(new Error("Only in the Android app")));
export function GmailCard({ onRead, compact = false }) {
  const N = typeof window !== "undefined" && window.AttuneNative;
  const [g, setG] = useState(G.loadGmail), [busy, setBusy] = useState(false), [msg, setMsg] = useState("");
  if (!N || typeof N.gmailRead !== "function") return null;
  const go = async () => {
    setBusy(true); setMsg("");
    try { const r = await G.readGmail(call); setMsg(tr("{n} emails about money read — {p} payments are waiting in Money for a tap.", { n: r.added, p: r.payments })); onRead && onRead(r); }
    catch (e) { setMsg(tr(String((e && e.message) || e))); }
    setG(G.loadGmail()); setBusy(false);
  };
  const off = () => { G.disconnectGmail(); setG(G.loadGmail()); setMsg(""); };
  const last = g.last ? new Date(g.last).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
  return <div className={(compact ? "" : U.card + " ") + "px-3.5 py-3"} data-testid="gmail-card">
    <p className="m-0 text-[13.5px] font-extrabold flex items-center gap-2"><Mail size={15} className="text-[var(--c-acc)]" />{g.on ? tr("Gmail is connected") : tr("Read my Gmail by itself")}</p>
    <p className={"m-0 mt-0.5 text-[12.5px] leading-relaxed " + U.muted}>{msg || (g.on && g.reconnect ? tr("Google asks you to confirm again — tap Read now.") : g.on ? tr("Once a day Attune reads the new emails about money — receipts, bank alerts, subscriptions, price changes. Last read: {t}. {n} kept for Recall.", { t: last || "—", n: g.emails.length })
      : tr("Receipts, bank alerts, subscriptions and price changes go to Money, the Overpaying check and Recall. Read on this phone; never one-time codes. Google asks you once."))}</p>
    {g.on ? null : <p className={"m-0 mt-1 text-[11.5px] leading-relaxed " + U.muted} data-testid="gmail-limited-use">{tr("Attune only reads emails about money, on this phone. They never go to Attune, to an AI in the cloud or to anyone else, and are never used for ads. Disconnect any time.")}</p>}
    <div className="flex gap-2 mt-2">
      <button onClick={go} disabled={busy} className={U.btnP} data-testid="gmail-go">{busy ? tr("Reading…") : g.on ? tr("Read now") : tr("Connect Gmail")}</button>
      {g.on ? <button onClick={off} className={U.btnS + " " + U.muted} data-testid="gmail-off">{tr("Disconnect")}</button> : null}
    </div>
  </div>;
}
