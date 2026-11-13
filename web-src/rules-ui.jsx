/* ---- v9.9.18 AU1 screen (Ali OK'd the combined screen): "New rule — I understood" with When / If / Do, Save rule · Try it now ·
   Change; "One question first" with choices when a name or a part wasn't clear; "Your rules" with on / off. Logic: rules.js +
   rulestore.js (tested). */
import React, { useState, useEffect } from "react";
import { tr } from "./i18n.js";
import * as RS from "./rulestore.js";
import { RecipesGallery } from "./recipes-ui.jsx";
import { card as kCard, btnP, btnS, inp, label } from "./ui-kit.jsx";
const card = kCard + " p-4";
const Row = ({ k, children }) => <div className="flex items-start gap-3 py-1.5 border-t border-[var(--c-ln)] first:border-0"><span className="w-7 h-7 shrink-0 rounded-[9px] bg-[var(--c-soft)] text-[var(--c-acc)] grid place-items-center text-[12px] font-black">{k}</span><div className="flex-1 min-w-0 text-[14px] font-bold break-words" dir="auto">{children}</div></div>;
export function RulesSection({ native, flash, schedule, unschedule, lang }) {
  const [draft, setDraft] = useState(RS.loadDraft), [rules, setRules] = useState(RS.loadRules), [edit, setEdit] = useState(false), [text, setText] = useState("");
  useEffect(() => { const f = () => { setDraft(RS.loadDraft()); setRules(RS.loadRules()); }; window.addEventListener("attune-rules", f); return () => window.removeEventListener("attune-rules", f); }, []);
  const ctx = RS.ruleCtx();
  const pick = (field, value) => { const n = RS.answer(draft, field, value); RS.saveDraft(n); setDraft(n); };
  const save = () => { const r = RS.saveRule(draft, { schedule, native, lang }); RS.saveDraft(null); setDraft(null); setRules(RS.loadRules()); flash && flash(r.live ? tr("Rule saved — it's on") : tr("Rule saved — it starts working when the phone part arrives")); };
  const tryNow = () => { const L = RS.ruleLines(draft, ctx); flash && flash(tr("Test: {x}", { x: L.dos.join(" · ") })); };
  const read = () => { const r = RS.ruleFor(text, ctx); if (!r) { flash && flash(tr("I couldn't read a rule in that — try “when …, …”")); return; } RS.saveDraft(r); setDraft(r); setEdit(false); setText(""); };
  // v9.9.26 (R2-A): on the phone the device comes from the paired list (its address), so the old "which device" question steps aside
  const phone = RS.hasPhoneRules(), needDev = phone && draft && draft.when && draft.when.type === "bluetooth" && !(draft.when.device && typeof draft.when.device === "object" && draft.when.device.address);
  const needNet = phone && draft && draft.when && draft.when.type === "wifi" && !draft.when.ssid;
  const qs = draft ? RS.questions(draft, ctx).filter((q) => !(phone && q.field === "device")) : [], L = draft ? RS.ruleLines(draft, ctx) : null;
  const setWhen = (patch) => { const n = { ...draft, when: { ...draft.when, ...patch }, ask: (draft.ask || []).filter((x) => x.field !== "device") }; RS.saveDraft(n); setDraft(n); };
  const status = (() => { try { return JSON.parse((native && native.phoneRulesStatus && native.phoneRulesStatus()) || "{}"); } catch (e) { return {}; } })();
  return (
    <div className="space-y-3" data-testid="rules-section">
      {draft && qs.length ? <div className={card + " space-y-2 bg-[var(--c-soft)]"} data-testid="rule-ask">
        <p className={label + " m-0"}>{tr("One question first")}</p>
        <p className="m-0 text-[15px] font-extrabold" dir="auto">{qs[0].q}</p>
        <div className="flex flex-wrap gap-1.5">{qs[0].choices.map(([v, l]) => <button key={String(v)} className="min-h-[40px] px-3 rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)] text-[13px] font-bold" onClick={() => pick(qs[0].field, v)} data-testid="rule-ask-choice">{l}</button>)}</div>
        <p className="m-0 text-[12px] text-[var(--c-mut)]">{tr("I'll remember your answer.")}</p>
      </div> : null}
      {draft && needDev ? <DevicePick native={native} pick={(d) => setWhen({ device: d })} /> : null}
      {draft && !needDev && needNet ? <WifiPick native={native} pick={(n) => setWhen({ ssid: n })} /> : null}
      {draft && !qs.length && !needDev && !needNet ? <div className={card + " space-y-1"} data-testid="rule-card">
        <p className={label + " m-0"}>{tr("New rule — I understood")}</p>
        <Row k="W"><span className="text-[var(--c-mut)] text-[12px] block">{tr("When")}</span>{L.when}</Row>
        {L.ifs.length ? <Row k="I"><span className="text-[var(--c-mut)] text-[12px] block">{tr("If")}</span>{L.ifs.join(" · ")}</Row> : null}
        <Row k="D"><span className="text-[var(--c-mut)] text-[12px] block">{tr("Do")}</span>{L.dos.join(" · ")}</Row>
        {!RS.isLive(draft) ? <p className="m-0 text-[12px] text-[var(--c-warn)] font-bold" data-testid="rule-needs-phone">{tr("Needs the phone part for this kind of trigger — it's saved and starts when that arrives")}</p> : null}
        <div className="flex flex-wrap gap-2 pt-1"><button className={btnP} onClick={save} data-testid="rule-save">{tr("Save rule")}</button><button className={btnS} onClick={tryNow} data-testid="rule-try">{tr("Try it now")}</button><button className={btnS} onClick={() => setEdit(true)} data-testid="rule-change">{tr("Change")}</button></div>
        {edit ? <form onSubmit={(e) => { e.preventDefault(); read(); }} className="flex gap-2 pt-1"><input dir="auto" value={text} onChange={(e) => setText(e.target.value)} placeholder={tr("Write it again your way")} className={inp} data-testid="rule-rewrite" /><button className={btnP} type="submit">{tr("Read")}</button></form> : null}
      </div> : null}
      <RecipesGallery flash={flash} schedule={schedule} native={native} lang={lang} />
      {rules.length ? <div className={card + " space-y-1"} data-testid="rule-list">
        <p className={label + " m-0"}>{tr("Your rules · {n}", { n: rules.length })}</p>
        {rules.map((r) => { const l = RS.ruleLines(r, ctx); return <div key={r.id} className="flex items-center gap-2 py-2 border-t border-[var(--c-ln)] first:border-0" data-testid="rule-row">
          <div className="flex-1 min-w-0"><p className="m-0 text-[14px] font-bold break-words" dir="auto">{l.when} → {l.dos.join(" · ")}</p>{!r.live ? <p className="m-0 text-[11.5px] text-[var(--c-warn)]">{tr("Waiting for the phone part")}</p> : null}
            {r.live && ["bluetooth", "charging", "wifi"].includes((r.when || {}).type) ? <p className="m-0 text-[11.5px] text-[var(--c-mut)]" data-testid="rule-speed">
              <span className="font-bold" style={{ color: "var(--c-acc)" }}>{r.when.type === "bluetooth" ? tr("instant") : tr("within 15 min")}</span>
              {status["fired_" + r.id] ? " · " + tr("last: {t}", { t: new Date(status["fired_" + r.id]).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) }) : ""}</p> : null}</div>
          <button className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] text-[12.5px] font-bold" onClick={() => { RS.removeRule(r.id, { unschedule, native, lang }); setRules(RS.loadRules()); flash && flash(tr("Removed")); }} data-testid="rule-remove">{tr("Remove")}</button></div>; })}
      </div> : null}
    </div>);
}
/** R2-A: Android's "Nearby devices" once, then the paired devices to tap (two with one name are told apart by their type and address). */
function DevicePick({ native, pick }) {
  const [, re] = useState(0); useEffect(() => { const f = () => re((x) => x + 1); window.addEventListener("attune-bt", f); return () => window.removeEventListener("attune-bt", f); }, []);
  let ok = false, list = []; try { ok = native.btAllowed(); list = JSON.parse(native.btPaired() || "[]"); } catch (e) {}
  const same = (d) => list.filter((x) => x.name === d.name).length > 1;
  const ICON = { car: "🚗", headphones: "🎧", speaker: "🔊", other: "⌁" };
  return <div className={card + " space-y-2 bg-[var(--c-soft)]"} data-testid="rule-device-pick">
    <p className="m-0 text-[15px] font-extrabold">{tr("Which device?")}</p>
    {!ok ? <><p className="m-0 text-[13px] text-[var(--c-mut)]">{tr("Android asks once to let Attune see your paired devices' names.")}</p>
      <button className={btnP} onClick={() => { try { native.btAsk(); } catch (e) {} }} data-testid="rule-bt-allow">{tr("Allow Nearby devices")}</button></> : null}
    {ok && !list.length ? <p className="m-0 text-[13px] text-[var(--c-mut)]">{tr("No paired devices yet — pair your car in Android's Bluetooth settings first.")}</p> : null}
    {list.map((d) => <button key={d.address} className="w-full text-start flex items-center gap-2 min-h-[48px] px-3 rounded-[12px] border border-[var(--c-ln)] bg-[var(--c-surf)]" onClick={() => pick({ address: d.address, name: d.name, type: d.type })} data-testid="rule-device">
      <span className="text-[18px]">{ICON[d.type] || "⌁"}</span><span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{d.name}</b>
      <span className="text-[11.5px] text-[var(--c-mut)]">{tr({ car: "car", headphones: "headphones", speaker: "speaker", other: "device" }[d.type] || "device")}{same(d) ? " · " + d.address.slice(-5) : ""}</span></span></button>)}
  </div>;
}
/** The Wi-Fi's name: the one the phone is on now, or typed (Android shows the name only with location on). */
function WifiPick({ native, pick }) {
  let now = ""; try { now = native.wifiNow() || ""; } catch (e) {}
  const [v, setV] = useState("");
  return <div className={card + " space-y-2 bg-[var(--c-soft)]"} data-testid="rule-wifi-pick">
    <p className="m-0 text-[15px] font-extrabold">{tr("Which Wi-Fi?")}</p>
    {now ? <button className={btnP} onClick={() => pick(now)} data-testid="rule-wifi-now">{tr("This one: {n}", { n: now })}</button>
      : <p className="m-0 text-[12.5px] text-[var(--c-mut)]">{tr("Android shows the Wi-Fi's name only when location is on — type it, or turn location on.")}</p>}
    <div className="flex gap-2"><input value={v} onChange={(e) => setV(e.target.value)} placeholder={tr("The network's name, e.g. Home-5G")} className={inp} dir="auto" data-testid="rule-wifi-name" />
      <button className={btnS} disabled={!v.trim()} onClick={() => pick(v.trim())} data-testid="rule-wifi-save">{tr("Use it")}</button></div>
  </div>;
}
