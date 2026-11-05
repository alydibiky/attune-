/* ---- v9.3 "Is this a scam?" — in Money Guardian (Deal Check's scam signs folded in, as decided on 4 Nov; scamcheck.js does the work). */
import React, { useRef, useState } from "react";
import { ShieldCheck as ShieldAlert, ImagePlus as ImageIcon } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as U from "./ui-kit.jsx";
import { scamCheck } from "./scamcheck.js";
import { shrinkPhoto } from "./money-pages-ui.jsx";

const LOOK = { scam: ["Scam — don't reply, don't pay", "border-[var(--c-neg)] bg-[var(--c-neg)]/10 text-[var(--c-neg)]"],
  careful: ["Be careful", "border-[var(--c-warn)] bg-[var(--c-warn)]/10 text-[var(--c-warn)]"], none: ["No warning signs found", "border-[var(--c-pos)] bg-[var(--c-soft)] text-[var(--c-pos)]"] };
export function ScamCheck() {
  const [text, setText] = useState(""), [res, setRes] = useState(null), [busy, setBusy] = useState(false);
  const ref = useRef(null), ar = getLang() === "ar";
  const check = (t) => setRes(scamCheck(t == null ? text : t));
  const fromShot = async (f) => {
    if (!f) return; setBusy(true);
    try {
      const url = await shrinkPhoto(f), call = typeof window !== "undefined" && window.__attuneNativeCall;
      const r = call ? await call("readText", { b64: url.split(",")[1] }) : null;
      const words = r && r.lines ? r.lines.map((l) => l.text).join("\n") : "";
      if (words) { setText(words); check(words); } else setRes({ level: "none", score: 0, reasons: [], noText: true });
    } catch (e) { setRes({ level: "none", score: 0, reasons: [], noText: true }); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  const look = res ? LOOK[res.level] : null;
  return <div className={U.cardPad + " space-y-2.5"} data-testid="scam-check">
    <b className="flex items-center gap-2 text-[15px]"><ShieldAlert size={17} className="c-acc" />{tr("Is this a scam?")}</b>
    <p className="m-0 text-[12.5px] c-sub">{tr("Paste a message, an offer or a link — or pick a screenshot. Checked on this phone; nothing is sent anywhere.")}</p>
    <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(null); }} dir="auto" rows={3} className={U.area} placeholder={tr("e.g. “You won 5,000 EGP from InstaPay — send the code you'll receive…”")} data-testid="scam-text" />
    <div className="flex gap-2">
      <button onClick={() => check()} disabled={!text.trim()} className={U.btnP + " flex-1"} data-testid="scam-go">{tr("Check")}</button>
      <button onClick={() => ref.current && ref.current.click()} disabled={busy} className={U.btnS} data-testid="scam-shot"><ImageIcon size={16} />{busy ? tr("Reading…") : tr("Screenshot")}</button>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => fromShot(e.target.files && e.target.files[0])} data-testid="scam-shot-input" />
    </div>
    {res ? <div className={"rounded-[14px] border p-3 space-y-1.5 " + look[1]} data-testid="scam-result" data-level={res.level}>
      <b className="block text-[15px]">{res.noText ? tr("No text found in the picture") : tr(look[0])}</b>
      {res.reasons.map((r) => <p key={r.id + (r.link || "")} className="m-0 text-[13px] text-[var(--c-ink)] flex gap-2" data-testid="scam-reason"><span aria-hidden="true">•</span><span dir="auto">{ar ? r.ar : tr(r.en, r.v)}</span></p>)}
      <p className="m-0 text-[12px] c-sub">{tr("Whatever it says: never share a code, a card number or a password.")}</p>
    </div> : null}
  </div>;
}
