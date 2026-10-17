/* ---- v6.29 Privacy (mode "privacy"): the privacy policy in the app — from the menu, and from Health Connect's
   "why this app reads your data" link (Android sends ACTION_SHOW_PERMISSIONS_RATIONALE / VIEW_PERMISSION_USAGE). */
import React from "react";
import { ShieldCheck } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { PRIVACY, PRIVACY_UPDATED } from "./privacy.js";
import { VaultSettings } from "./vault-ui.jsx";

export function PrivacyPage({ flash, onVault } = {}) {
  const ar = getLang() === "ar", P = PRIVACY[ar ? "ar" : "en"];
  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4 lg:max-w-[76ch]" style={{ minHeight: "70vh" }} data-testid="privacy-page" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-start gap-3"><span className="c-ic"><ShieldCheck size={17} /></span>
        <div><h2 className="text-[20px] font-semibold m-0">{tr("Privacy")}</h2><p className="c-sub m-0">{tr("Updated {d}", { d: PRIVACY_UPDATED })}</p></div></div>
      <VaultSettings flash={flash} onChange={onVault} />
      {P.map(([h, t], i) => (
        <section key={i} className={i === 0 ? "c-card" : ""}>
          <h3 className="text-[15px] font-semibold m-0 mb-1">{h}</h3>
          <p className="text-[14px] leading-relaxed m-0" style={{ color: "var(--c-ink)" }}>{t}</p>
        </section>))}
    </div>);
}
