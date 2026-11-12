/* ---- v9.9.24 B6 X4 the emergency card screen (Ali picked A+B combined, OK'd 12 Nov): Family health → Emergency — a tab per family member,
   each the full card (blood type, medicines from Family health — today's only —, allergies, conditions, doctor, insurance, who to call
   first); what is missing shows as "Add …"; one Edit for everything; Share one person or all, in the READER's language. Logic: emergency.js. */
import React, { useState } from "react";
import { tr, getLang, LANGS } from "./i18n.js";
import { cardOf, shareText, bloodType } from "./emergency.js";
import { cardPad, btnP, btnS, chip, inp, label } from "./ui-kit.jsx";
const MISS = { blood: "Blood type", call: "Who to call", doctor: "Doctor", allergies: "Allergies" };
function share(text) { const N = typeof window !== "undefined" ? window.AttuneNative : null;
  try { if (N && N.share) { N.share(text); return; } } catch (e) {} try { if (navigator.share) { navigator.share({ text }).catch(() => {}); return; } } catch (e) {}
  try { navigator.clipboard.writeText(text); } catch (e) {} }
export function EmergencyTab({ data, put, flash }) {
  const members = data.members || [];
  const [sel, setSel] = useState(() => (members[0] || {}).id || ""), [edit, setEdit] = useState(false), [lang, setLang] = useState(getLang());
  if (!members.length) return <div className={cardPad} data-testid="emergency-empty"><p className="m-0 text-[14px] font-bold">{tr("Add your family first")}</p>
    <p className="m-0 mt-1 c-sub text-[13px]">{tr("Each person gets an emergency card: blood type, medicines, allergies, doctor, insurance and who to call.")}</p></div>;
  const m = members.find((x) => x.id === sel) || members[0], c = cardOf(m, data);
  const saveE = (e) => { put({ ...data, members: members.map((x) => (x.id === m.id ? { ...x, emergency: e } : x)) }); setEdit(false); flash && flash(tr("Saved")); };
  const row = (k, l, v, extra) => <div className="flex items-start gap-3 min-h-[44px] py-1.5 border-t border-[var(--c-ln)] first:border-t-0" data-testid={"em-" + k}>
    <span className={label + " w-[34%] shrink-0 pt-0.5"}>{tr(l)}</span><span className="flex-1 min-w-0 text-[14px] font-semibold" dir="auto">{v}{extra}</span></div>;
  return <div className="space-y-2" data-testid="emergency">
    <div className="flex gap-1.5 flex-wrap" role="tablist">{members.map((x) => <button key={x.id} role="tab" aria-selected={x.id === m.id} className={chip(x.id === m.id)} onClick={() => { setSel(x.id); setEdit(false); }} data-testid="em-person">{x.name}</button>)}</div>
    {edit ? <EditCard m={m} onSave={saveE} onCancel={() => setEdit(false)} /> : <>
      <div className={cardPad} data-testid="em-card">
        {c.blood ? row("blood", "Blood type", <b className="text-[18px] c-acc">{c.blood}</b>, !c.bloodSure ? <span className="ms-2 text-[11px] font-extrabold rounded-full px-2 py-0.5" style={{ background: "var(--c-amber, #FBF0DC)" }} data-testid="em-blood-check">{tr("check")}</span> : null) : null}
        {row("meds", "Medicines", c.meds.length ? c.meds.join(" · ") : <span className="c-sub">{tr("None in Family health")}</span>)}
        {c.allergies.length || c.noAllergies ? row("allergies", "Allergies", c.allergies.length ? c.allergies.join(", ") : tr("No known allergies")) : null}
        {c.conditions ? row("conditions", "Conditions", c.conditions) : null}
        {c.doctor ? row("doctor", "Doctor", [c.doctor.name, c.doctor.phone].filter(Boolean).join(" · ")) : null}
        {c.insurance ? row("insurance", "Insurance", [c.insurance.company, c.insurance.number].filter(Boolean).join(" · ")) : null}
        {c.call.length ? row("call", "Call first", c.call.map((x, i) => (i + 1) + ". " + [x.name, x.rel ? "(" + x.rel + ")" : "", x.phone].filter(Boolean).join(" ")).join("  ")) : null}
      </div>
      {c.missing.length ? <div className="flex flex-wrap gap-1.5" data-testid="em-missing">{c.missing.map((k) => <button key={k} className={btnS + " h-10! min-h-[40px]!"} onClick={() => setEdit(true)} data-testid={"em-add-" + k}>+ {tr(MISS[k])}</button>)}</div> : null}
      <div className="flex flex-wrap gap-2 items-center">
        <button className={btnS} onClick={() => setEdit(true)} data-testid="em-edit">{tr("Edit")}</button>
        <button className={btnP} onClick={() => share(shareText(c, lang))} data-testid="em-share">{tr("Share {n}", { n: m.name })}</button>
        {members.length > 1 ? <button className={btnS} onClick={() => share(shareText(members.map((x) => cardOf(x, data)), lang))} data-testid="em-share-all">{tr("Share all")}</button> : null}
      </div>
      <label className="flex items-center gap-2 text-[13px] c-sub">{tr("In the reader's language")}
        <select className={inp + " w-auto! h-10! min-h-[40px]!"} value={lang} onChange={(e) => setLang(e.target.value)} data-testid="em-lang">{LANGS.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
    </>}
  </div>;
}
function EditCard({ m, onSave, onCancel }) {
  const e0 = m.emergency || {};
  const [e, setE] = useState({ blood: e0.blood || "", allergies: (e0.allergies || []).join(", "), noAllergies: !!e0.noAllergies, conditions: e0.conditions || "",
    dname: (e0.doctor || {}).name || "", dphone: (e0.doctor || {}).phone || "", ico: (e0.insurance || {}).company || "", ino: (e0.insurance || {}).number || "",
    call: (e0.call && e0.call.length ? e0.call : [{ name: "", phone: "", rel: "" }]).map((x) => ({ ...x })) });
  const set = (k, v) => setE({ ...e, [k]: v }), bt = e.blood.trim() ? bloodType(e.blood) : null;
  const done = () => onSave({ blood: bt || e.blood.trim(), allergies: e.allergies.split(/\s*[,،、;]\s*/).map((s) => s.trim()).filter(Boolean), noAllergies: e.noAllergies && !e.allergies.trim(),
    conditions: e.conditions.trim(), doctor: { name: e.dname.trim(), phone: e.dphone.trim() }, insurance: { company: e.ico.trim(), number: e.ino.trim() }, call: e.call.filter((x) => x.name.trim() || x.phone.trim()) });
  const F = (k, ph, t) => <input value={e[k]} onChange={(x) => set(k, x.target.value)} placeholder={tr(ph)} className={inp} dir="auto" type={t || "text"} data-testid={"em-f-" + k} />;
  return <div className={cardPad + " space-y-2"} data-testid="em-form">
    <p className={label + " m-0"}>{tr("Blood type")}</p>{F("blood", "e.g. O+")}
    {e.blood.trim() ? <p className="m-0 text-[12.5px] c-sub" data-testid="em-blood-read">{bt ? tr("Read as {b}", { b: bt }) : tr("Not clear — it will show as \"check\"")}</p> : null}
    <p className={label + " m-0"}>{tr("Allergies")}</p>{F("allergies", "e.g. Penicillin, peanuts")}
    {!e.allergies.trim() ? <label className="flex items-center gap-2 text-[13.5px] min-h-[40px]"><input type="checkbox" checked={e.noAllergies} onChange={(x) => set("noAllergies", x.target.checked)} className="w-5 h-5 accent-[var(--c-acc)]" data-testid="em-f-none" />{tr("No known allergies")}</label> : null}
    <p className={label + " m-0"}>{tr("Conditions")}</p>{F("conditions", "e.g. diabetes, asthma")}
    <p className={label + " m-0"}>{tr("Doctor")}</p><div className="flex gap-2">{F("dname", "Name")}{F("dphone", "Phone", "tel")}</div>
    <p className={label + " m-0"}>{tr("Insurance")}</p><div className="flex gap-2">{F("ico", "Company")}{F("ino", "Card number")}</div>
    <p className={label + " m-0"}>{tr("Call first")}</p>
    {e.call.map((x, i) => <div key={i} className="flex gap-2" data-testid="em-f-call">
      {["name", "rel", "phone"].map((k) => <input key={k} value={x[k] || ""} onChange={(v) => set("call", e.call.map((y, j) => (j === i ? { ...y, [k]: v.target.value } : y)))} placeholder={tr(k === "name" ? "Name" : k === "rel" ? "Who (brother…)" : "Phone")} type={k === "phone" ? "tel" : "text"} className={inp} dir="auto" data-testid={"em-f-call-" + k} />)}</div>)}
    <button className={btnS} onClick={() => set("call", [...e.call, { name: "", phone: "", rel: "" }])} data-testid="em-f-call-add">+ {tr("Another person")}</button>
    <div className="flex gap-2 pt-1"><button className={btnP + " flex-1"} onClick={done} data-testid="em-f-save">{tr("Save")}</button><button className={btnS} onClick={onCancel}>{tr("Cancel")}</button></div>
  </div>;
}
