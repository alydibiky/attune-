/* ---- v6.27 "What you're owed" — one sheet any page opens (no new page, no new tile): window event "attune-owed" with
   { flight: {...facts} } → the flight check and the claim letter, or { letter: { title, text } } → a ready letter to copy or
   send. Opened from Travel → Trip, Chat ("my flight was 4 hours late"), Deadline Radar (returns, warranties) and Money
   Guardian (a double charge). A bottom sheet on a phone, a centred window on a computer. Logic: owed.js.                 */
import React, { useEffect, useState } from "react";
import { X, Copy, Send, ShieldCheck } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as O from "./owed.js";
import { airportOf } from "./agent.js";

export const openOwed = (detail) => { try { window.dispatchEvent(new CustomEvent("attune-owed", { detail })); } catch (e) {} };
export function shareText(text) {
  const N = typeof window !== "undefined" && window.AttuneNative;
  try { if (N && N.share) N.share(text); else if (navigator.share) navigator.share({ text }).catch(() => {}); else window.open("mailto:?body=" + encodeURIComponent(text), "_blank"); } catch (e) {}
}
const WHY_AR = {
  "no-rule": "لا يوجد قانون تعويض يغطي هذا المسار (يوجد في أوروبا وبريطانيا وكندا). قد تمنحك سياسة شركة الطيران استردادًا أو وجبات أو قسيمة — اسألهم.",
  extraordinary: "الظروف الاستثنائية لا تستحق تعويضًا. لكن تستحق الرعاية (وجبات، وفندقًا إن بِتَّ ليلة)، واسترداد ثمن التذكرة إن لم تسافر بعد تأخير 5 ساعات أو إلغاء.",
  under3: "يبدأ التعويض عند تأخير 3 ساعات أو أكثر في الوصول.",
  notice14: "الإلغاء المُعلن قبل 14 يومًا أو أكثر لا يستحق تعويضًا — لكن تستحق استرداد المبلغ كاملًا أو رحلة بديلة.",
};
const field = "w-full rounded-lg px-3 py-2 text-[14px] border bg-transparent";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };

function Sheet({ children, onClose, label }) {
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div className="calm fixed inset-0 z-[80] flex items-end md:items-center justify-center" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose} data-testid="owed-sheet" role="dialog" aria-label={label}>
      <div className="w-full md:max-w-lg max-h-[92vh] overflow-auto rounded-t-3xl md:rounded-3xl p-4 md:p-6 space-y-3" style={{ background: "var(--c-bg)", color: "var(--c-ink)", paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><b className="text-[17px] flex items-center gap-2"><ShieldCheck size={18} className="c-acc" />{label}</b>
          <button onClick={onClose} className="c-ic border-0 cursor-pointer" aria-label={tr("Close")} data-testid="owed-close"><X size={16} /></button></div>
        {children}
      </div>
    </div>);
}

function Letter({ text, setText, flash }) {
  return (<div className="space-y-2" data-testid="owed-letter">
    <textarea value={text} onChange={(e) => setText(e.target.value)} rows={11} dir="auto" className={field + " text-[13.5px] leading-relaxed"} style={st} data-testid="owed-letter-text" />
    <div className="flex gap-2">
      <button className="c-btn flex-1 inline-flex items-center justify-center gap-1.5" onClick={() => shareText(text)} data-testid="owed-send"><Send size={15} />{tr("Send")}</button>
      <button className="c-btn inline-flex items-center gap-1.5" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} onClick={() => { try { navigator.clipboard.writeText(text); } catch (e) {} flash && flash(tr("Copied")); }} data-testid="owed-copy"><Copy size={15} />{tr("Copy")}</button>
    </div>
    <p className="c-sub m-0">{tr("Send it to the company's customer service (e-mail or their claim form). Keep your boarding pass and receipts.")}</p>
  </div>);
}

function FlightCheck({ init, flash }) {
  const [f, setF] = useState(() => ({ from: "", to: "", flight: "", date: "", kind: "delay", arrivalDelayH: "", noticeDays: "", cause: "unknown", passengers: 1, ...init }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const [lang, setLang] = useState(getLang() === "ar" ? "ar" : "en");
  const [letter, setLetter] = useState("");
  const code = (v) => { const s = String(v || "").trim(); return /^[A-Za-z]{3}$/.test(s) ? s.toUpperCase() : airportOf(s) || s.toUpperCase(); };
  const r = O.flightClaim({ ...f, from: code(f.from), to: code(f.to), arrivalDelayH: f.arrivalDelayH === "" ? undefined : Number(f.arrivalDelayH), noticeDays: f.noticeDays === "" ? undefined : Number(f.noticeDays), euCarrier: f.euCarrier, ukCarrier: f.ukCarrier });
  const money = (a, c) => (c === "EUR" ? "€" : c === "GBP" ? "£" : c + " ") + a.toLocaleString();
  return (<div className="space-y-3" data-testid="owed-flight">
    <div className="grid grid-cols-2 gap-2">
      <label><span className="c-sub">{tr("From (city or code)")}</span><input value={f.from} onChange={(e) => set("from", e.target.value)} className={field} style={st} placeholder="FRA" data-testid="owed-from" /></label>
      <label><span className="c-sub">{tr("To")}</span><input value={f.to} onChange={(e) => set("to", e.target.value)} className={field} style={st} placeholder="JFK" data-testid="owed-to" /></label>
      <label><span className="c-sub">{tr("Flight number")}</span><input value={f.flight} onChange={(e) => set("flight", e.target.value.toUpperCase())} className={field} style={st} placeholder="LH400" data-testid="owed-flightno" /></label>
      <label><span className="c-sub">{tr("Date")}</span><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} style={st} /></label>
    </div>
    <div className="flex gap-1.5 flex-wrap" role="radiogroup">{[["delay", "Delayed"], ["cancel", "Cancelled"], ["denied", "Refused boarding"]].map(([k, l]) =>
      <button key={k} role="radio" aria-checked={f.kind === k} onClick={() => set("kind", k)} className="rounded-full px-3 py-1.5 text-[13px] border cursor-pointer" style={{ ...st, background: f.kind === k ? "var(--c-soft)" : "transparent", borderColor: f.kind === k ? "var(--c-acc)" : "var(--c-ln)" }} data-testid={"owed-kind-" + k}>{tr(l)}</button>)}</div>
    <div className="grid grid-cols-2 gap-2">
      {f.kind === "cancel" ? <label><span className="c-sub">{tr("Told how many days before?")}</span><input type="number" min="0" value={f.noticeDays} onChange={(e) => set("noticeDays", e.target.value)} className={field} style={st} data-testid="owed-notice" /></label> : null}
      {f.kind !== "denied" ? <label><span className="c-sub">{tr("Hours late at arrival")}</span><input type="number" min="0" step="0.5" value={f.arrivalDelayH} onChange={(e) => set("arrivalDelayH", e.target.value)} className={field} style={st} data-testid="owed-hours" /></label> : null}
      <label><span className="c-sub">{tr("Passengers")}</span><input type="number" min="1" max="9" value={f.passengers} onChange={(e) => set("passengers", Math.max(1, +e.target.value || 1))} className={field} style={st} /></label>
    </div>
    <label className="block"><span className="c-sub">{tr("The reason they gave")}</span>
      <select value={f.cause} onChange={(e) => set("cause", e.target.value)} className={field} style={st} data-testid="owed-cause">{Object.entries(O.CAUSES).map(([k, c]) => <option key={k} value={k}>{getLang() === "ar" ? c.ar : tr(c.en)}</option>)}</select></label>

    <div className="c-card space-y-1.5" data-testid="owed-result">
      {r.status === "ask" ? (<>{r.ask.map((q) => <p key={q} className="c-warn m-0 text-[13.5px]">{tr(q)}</p>)}
        {r.ask.some((q) => /European one/.test(q)) ? <div className="flex gap-2"><button className="c-btn" onClick={() => set("euCarrier", true)}>{tr("Yes")}</button><button className="c-btn" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} onClick={() => set("euCarrier", false)}>{tr("No")}</button></div> : null}
        {r.ask.some((q) => /UK one/.test(q)) ? <div className="flex gap-2"><button className="c-btn" onClick={() => set("ukCarrier", true)}>{tr("Yes")}</button><button className="c-btn" style={{ background: "var(--c-soft)", color: "var(--c-acc)" }} onClick={() => set("ukCarrier", false)}>{tr("No")}</button></div> : null}</>)
        : r.status === "owed" || r.status === "likely" ? (<>
          <p className="c-lbl m-0">{r.status === "owed" ? tr("You are owed") : tr("You are probably owed")}</p>
          <div className="c-amt c-pos" data-testid="owed-amount">{money(r.amount * Math.max(1, f.passengers), r.cur)}</div>
          <p className="c-sub m-0">{money(r.amount, r.cur)} {tr("per passenger")} · {getLang() === "ar" ? `${r.rule}: ${r.km.toLocaleString("en")} كم، ${{ delay: `تأخير ${f.arrivalDelayH} ساعة عند الوصول`, cancel: `أُلغيت قبل ${f.noticeDays} يوم`, denied: "رُفض الصعود" }[r.kind]}` : r.why}</p>
          {r.note ? <p className="c-warn m-0 text-[12.5px]">{tr(r.note)}</p> : null}
          {r.askCause ? <p className="c-sub m-0">{tr("Ask the airline for the reason: weather or an air-traffic strike would cancel it; a technical fault or crew shortage would not.")}</p> : null}
          <button className="c-btn w-full mt-1" onClick={() => setLetter(O.claimLetter(r, { date: f.date, passengers: f.passengers, lang }))} data-testid="owed-write">{tr("Write the claim")}</button>
          <div className="flex gap-2 justify-center">{[["en", "English"], ["ar", "العربية"]].map(([k, l]) => <button key={k} onClick={() => { setLang(k); if (letter) setLetter(O.claimLetter(r, { date: f.date, passengers: f.passengers, lang: k })); }} className="c-sub bg-transparent border-0 cursor-pointer" style={{ fontWeight: lang === k ? 700 : 400 }}>{l}</button>)}</div>
        </>) : (<>
          <p className="c-lbl m-0">{tr("No compensation")}</p>
          <p className="m-0 text-[13.5px]" data-testid="owed-why">{getLang() === "ar" ? WHY_AR[r.code] || r.why : r.why}</p>
        </>)}
    </div>
    {letter ? <Letter text={letter} setText={setLetter} flash={flash} /> : null}
    <p className="c-sub m-0">{tr("Worked out from the published rules (EU 261, UK 261, Canada's APPR). Airlines sometimes refuse at first — a polite second letter or the national enforcement body usually settles it.")}</p>
  </div>);
}

/** Mounted once in the app: opens the sheet for whichever page asked. */
export function OwedHost({ flash }) {
  const [d, setD] = useState(null);
  const [text, setText] = useState("");
  useEffect(() => { const on = (e) => { setD(e.detail || {}); setText((e.detail && e.detail.letter && e.detail.letter.text) || ""); }; window.addEventListener("attune-owed", on); return () => window.removeEventListener("attune-owed", on); }, []);
  if (!d) return null;
  const close = () => setD(null);
  if (d.letter) return <Sheet onClose={close} label={tr(d.letter.title || "Your letter")}><Letter text={text} setText={setText} flash={flash} /></Sheet>;
  return <Sheet onClose={close} label={tr("What you're owed")}><FlightCheck init={d.flight || {}} flash={flash} /></Sheet>;
}
