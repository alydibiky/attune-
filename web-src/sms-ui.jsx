/* ---- SMS notifications switch (Ali picked B, 25 Oct 2026: off by default; 29 Oct: "we agreed that it reads SMS, but not one-time
   codes" → ON by default, also for Money and Recall). When on, the SMS app's NOTIFICATIONS are read for
   Message alerts, "who messaged me" and voice replies (through the SMS app's own Reply). Never the SMS inbox, never one-time
   codes (Prefs.smsNotifs, WatchMatch.smsAllowed, ChatInbox.kt). */
import React, { useState } from "react";
import { tr } from "./i18n.js";

export function SmsSwitch({ native: N, compact = false }) {
  const can = !!(N && N.setSmsNotifs);
  const [on, setOn] = useState(() => { try { return can && N.smsNotifs ? !!N.smsNotifs() : false; } catch (e) { return false; } });
  if (!can) return null;
  const flip = () => { const v = !on; try { N.setSmsNotifs(v); } catch (e) {} setOn(v); };
  return <label className={"flex items-start gap-3 cursor-pointer " + (compact ? "text-[12.5px]" : "text-[13px]")} data-testid="sms-switch">
    <input type="checkbox" checked={on} onChange={flip} className="mt-0.5 w-5 h-5 accent-[var(--c-acc)] shrink-0" data-testid="sms-switch-input" />
    <span><b className="font-extrabold">{tr("Read SMS notifications")}</b>
      <span className="block text-[var(--c-mut)]">{tr("For Money, Recall, message alerts, “who messaged me” and replying by voice. On by default — Attune never keeps one-time codes.")}</span></span>
  </label>;
}
