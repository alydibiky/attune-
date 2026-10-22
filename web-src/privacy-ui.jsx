/* ---- v6.29 Privacy (mode "privacy"): the privacy policy in the app — from the menu, and from Health Connect's
   "why this app reads your data" link (Android sends ACTION_SHOW_PERMISSIONS_RATIONALE / VIEW_PERMISSION_USAGE). */
import React, { useState } from "react";
import { ShieldCheck, Globe, Ban } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { PRIVACY, PRIVACY_UPDATED } from "./privacy.js";
import { VaultSettings } from "./vault-ui.jsx";
import { fold, weekReport, loadNetWeek, saveNetWeek } from "./netreport.js";

const fmtDay = (d) => { const [y, m, dd] = d.split("-").map(Number); return new Date(y, m - 1, dd).toLocaleDateString(getLang() === "ar" ? "ar-EG" : undefined, { day: "numeric", month: "short" }); };
/** v6.37 (X3): this week on this device — every place Attune connected to and why, and what it blocked. */
export function PrivacyWeek({ readNet }) {
  const [ago, setAgo] = useState(0);
  const [st] = useState(() => { const s = loadNetWeek(); const raw = readNet ? readNet() : null; return raw ? saveNetWeek(fold(s, raw)) : s; });
  const r = weekReport(st, Date.now(), ago);
  return (
    <section className="c-card space-y-2" data-testid="privacy-week">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold m-0">{tr("Your week in privacy")}</h3>
        <span className="flex gap-1 text-[12px]">
          {[0, 1].map((k) => <button key={k} onClick={() => setAgo(k)} className={"px-2 py-0.5 rounded-md " + (ago === k ? "c-pill font-semibold" : "c-sub")} data-testid={"privacy-week-" + k}>{k ? tr("Last week") : tr("This week")}</button>)}
        </span>
      </div>
      <p className="c-sub text-[12px] m-0">{fmtDay(r.from)} – {fmtDay(r.to)}</p>
      <p className="text-[14px] m-0" data-testid="privacy-week-sum">{r.sent || r.blocked
        ? tr("Connections: {n} · places: {p} · blocked: {b}. Each place and why is below.", { n: r.sent, p: r.places.filter((x) => x.n).length, b: r.blocked })
        : tr("No connections at all — Attune worked fully offline.")}</p>
      <p className="text-[13px] m-0" style={{ color: "var(--c-ink)" }}>{tr("The AI ran on this device: none of your chats, notes, photos or money went to an AI company.")}</p>
      {r.places.length ? <ul className="m-0 p-0 list-none space-y-1" data-testid="privacy-week-places">{r.places.slice(0, 12).map((x) => (
        <li key={x.host} className="flex items-start gap-2 text-[13px]" data-testid="privacy-week-place">
          {x.n ? <Globe size={14} className="mt-0.5 shrink-0" /> : <Ban size={14} className="mt-0.5 shrink-0 text-[var(--c-neg)]" />}
          <span className="min-w-0"><b dir="ltr">{x.host}</b> <span className="c-sub">· {x.n ? tr("{n} times", { n: x.n }) : ""}{x.b ? (x.n ? " · " : "") + tr("{n} blocked", { n: x.b }) : ""}{x.what.length ? " · " + x.what.map((w) => tr(w)).join(", ") : ""}</span></span>
        </li>))}</ul> : null}
      <p className="c-sub text-[11px] m-0">{tr("Only the place and the reason are kept, never what was sent. Counted on this device; it starts from the day you installed this update.")}</p>
    </section>);
}

export function PrivacyPage({ flash, onVault, readNet } = {}) {
  const ar = getLang() === "ar", P = PRIVACY[ar ? "ar" : "en"];
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4 lg:max-w-[76ch]" style={{ minHeight: "70vh" }} data-testid="privacy-page" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3"><span className="c-ic"><ShieldCheck size={17} /></span>
        <div><h2 className="text-[20px] font-semibold m-0">{tr("Privacy")}</h2><p className="c-sub m-0">{tr("Updated {d}", { d: PRIVACY_UPDATED })}</p></div></div>
      <PrivacyWeek readNet={readNet} />
      <VaultSettings flash={flash} onChange={onVault} />
      {P.map(([h, t], i) => (
        <section key={i} className={i === 0 ? "c-card" : ""}>
          <h3 className="text-[15px] font-semibold m-0 mb-1">{h}</h3>
          <p className="text-[14px] leading-relaxed m-0" style={{ color: "var(--c-ink)" }}>{t}</p>
        </section>))}
    </div>);
}
