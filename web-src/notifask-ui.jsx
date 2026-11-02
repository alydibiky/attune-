/* ---- v8.9 (Ali: "the app is not reading notifications — make it a pop up in the app to allow it") ---------------------------
   Android lets an app read notifications only after the person turns on "Notification access" for it in Settings (no system
   popup exists for this one). So the app asks itself: a card a few seconds after opening, while access is off — Allow opens
   Attune's own switch (PayListener.openSettings: straight to it on Android 11+); back in the app, it checks again and says so.
   "Not now" waits 3 days. Never shown off the phone, or once access is on.                                                     */
import React, { useEffect, useState } from "react";
import { tr, getLang } from "./i18n.js";

const SNOOZE_KEY = "attune:notif:snooze";
const access = (N) => { try { return !!(N && N.payAccess && N.payAccess()); } catch (e) { return true; } };
export function shouldAsk(N, now = Date.now(), store = typeof localStorage !== "undefined" ? localStorage : null) {
  if (!N || !N.payAccess || !N.openPayAccess || access(N)) return false;
  try { const until = +(store && store.getItem(SNOOZE_KEY)) || 0; return now >= until; } catch (e) { return true; }
}
export function NotifAsk({ native, flash }) {
  const [open, setOpen] = useState(false), [waiting, setWaiting] = useState(false);
  const ar = getLang() === "ar";
  useEffect(() => { const t = setTimeout(() => { if (shouldAsk(native)) setOpen(true); }, 3000); return () => clearTimeout(t); }, []);
  useEffect(() => {
    if (!waiting) return;
    const back = () => { if (document.visibilityState !== "visible") return; if (access(native)) { setOpen(false); setWaiting(false); flash && flash(ar ? "تمام — Attune بيقرا الإشعارات دلوقتي" : tr("Done — Attune now reads your notifications")); } };
    document.addEventListener("visibilitychange", back); window.addEventListener("focus", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [waiting]);
  if (!open) return null;
  const later = () => { try { localStorage.setItem(SNOOZE_KEY, String(Date.now() + 3 * 864e5)); } catch (e) {} setOpen(false); };
  return (
    <div className="calm fixed inset-0 z-[280] bg-black/40 flex items-end sm:items-center justify-center p-4" role="dialog" aria-modal="true" data-testid="notif-ask">
      <div className="w-full max-w-[420px] rounded-[24px] bg-[var(--c-surf)] text-[var(--c-ink)] p-5 shadow-xl">
        <p className="text-[18px] font-black m-0">{ar ? "خلّي Attune يقرا الإشعارات" : tr("Let Attune read your notifications")}</p>
        <p className="text-[14px] leading-relaxed mt-2 mb-0 text-[var(--c-mut)]">{ar
          ? "عشان يسجّل مدفوعاتك من رسايل البنك والمحافظ في المال لوحده، ويقولك مين بعتلك، ويشغّل تنبيهات الرسايل. كله بيفضل على موبايلك، وأكواد OTP بتتجاهل."
          : tr("So payments from bank and wallet messages go into Money by themselves, you can ask who messaged you, and message alerts work. Everything stays on your phone; one-time codes (OTP) are ignored.")}</p>
        <p className="text-[13px] mt-2 mb-0 text-[var(--c-mut)]">{ar ? "هتفتح صفحة في الإعدادات: شغّل «Attune» وارجع." : tr("A Settings page opens: switch Attune on, then come back.")}</p>
        {native.openAppInfo ? <p className="text-[12.5px] mt-2 mb-0 text-[var(--c-mut)]">{ar ? "لو أندرويد قال «إعداد مقيَّد»: افتح " : tr("If Android says “Restricted setting”: open ")}
          <button onClick={() => { setWaiting(true); try { native.openAppInfo(); } catch (e) {} }} className="underline font-bold text-[var(--c-acc)]" data-testid="notif-ask-appinfo">{ar ? "معلومات التطبيق" : tr("App info")}</button>
          {ar ? " ← ⋮ ← «السماح بالإعدادات المقيَّدة»، وبعدين «اسمح» هنا تاني." : tr(" → ⋮ → “Allow restricted settings”, then tap Allow here again.")}</p> : null}
        <div className="flex gap-2 mt-4">
          <button onClick={later} className="flex-1 min-h-[48px] rounded-full border border-[var(--c-ln)] font-bold" data-testid="notif-ask-later">{ar ? "مش دلوقتي" : tr("Not now")}</button>
          <button onClick={() => { setWaiting(true); try { native.openPayAccess(); } catch (e) {} }} className="flex-1 min-h-[48px] rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)] font-extrabold" data-testid="notif-ask-allow">{ar ? "اسمح" : tr("Allow")}</button>
        </div>
      </div>
    </div>);
}
