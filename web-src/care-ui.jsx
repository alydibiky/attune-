/* ---- v6.27 Family Health Keeper — the page (mode "care", All → Health, next to Fit & Food and Cycle) — design A "Calm" ----------
   Today (every family member's doses, ✓ taken, late in red) · Medicines (from a prescription photo / typed / by hand — each line
   shown with what was read, missing parts asked; daily reminders; interaction warnings quoted from official labels) · Lab
   results (read from a report, judged only by its printed range, trends) · Family. See care.js for the safety rules.
   Tests: tests/e2e_v727care.py.                                                                                              */
import React, { useEffect, useRef, useState } from "react";
import { Heart, Camera, Pencil, Plus, Check, AlertTriangle, Trash2, Users, Pill } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as H from "./care.js";
import { PANES, PANES_WIDE_LEFT, LEFT, RIGHT, DeskEmpty } from "./desk.jsx";

const TABS = [["today", "Today"], ["meds", "Medicines"], ["labs", "Lab results"], ["family", "Family"]];
const FREQS = [["once a day", 1], ["twice a day", 2], ["3 times a day", 3], ["4 times a day", 4], ["every 8 hours", 3], ["every 12 hours", 2], ["at bedtime", 1], ["once a week", "week"], ["only when needed", "prn"]];
const TIMES_FOR = { "once a day": ["09:00"], "twice a day": ["09:00", "21:00"], "3 times a day": ["08:00", "14:00", "20:00"], "4 times a day": ["08:00", "12:00", "16:00", "20:00"], "every 8 hours": ["06:00", "14:00", "22:00"], "every 12 hours": ["08:00", "20:00"], "at bedtime": ["22:00"] };
function shrink(file) { return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.85)); }; img.onerror = () => ok(""); img.src = fr.result; }; fr.onerror = () => ok(""); fr.readAsDataURL(file); }); }
// v6.27 computer layout A: the two panels with this page's own 12-px gaps (so a phone shows exactly what it did)
const L3 = "space-y-3 lg:sticky lg:top-4", R3 = "space-y-3 mt-3 lg:mt-0 min-w-0";
const field = "w-full rounded-lg px-3 py-2 text-[14px] border bg-transparent";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };

function MedForm({ init, members, onSave, onCancel }) {
  const [m, setM] = useState(() => ({ member: (members[0] || {}).id || "", name: "", strength: "", dose: "", freq: "", times: [], days: 0, food: "", prn: false, ...init }));
  const set = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const missing = [!m.name && "Name", !m.dose && "How much each time?", !m.freq && "How often?"].filter(Boolean);
  return (
    <div className="c-card space-y-2" data-testid="care-medform">
      {init && init.raw ? <p className="c-sub text-[12px] m-0" dir="auto" data-testid="care-raw">{tr("From the prescription:")} «{init.raw}»</p> : null}
      {(init && init.missing || []).filter((q) => /changes during/.test(q)).map((q) => <p key={q} className="c-warn text-[12.5px] m-0 flex gap-1.5" data-testid="care-taper"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{tr(q)}</p>)}
      {members.length > 1 ? <select value={m.member} onChange={(e) => set("member", e.target.value)} className={field} style={st}>{members.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : null}
      <input value={m.name} onChange={(e) => set("name", e.target.value)} placeholder={tr("Medicine name")} className={field} style={st} dir="auto" data-testid="care-name" />
      <div className="grid grid-cols-2 gap-2">
        <input value={m.strength} onChange={(e) => set("strength", e.target.value)} placeholder={tr("Strength (e.g. 500 mg)")} className={field} style={st} />
        <input value={m.dose} onChange={(e) => set("dose", e.target.value)} placeholder={tr("Each time (e.g. 1 tablet)")} className={field} style={{ ...st, borderColor: m.dose ? st.borderColor : "var(--c-warn)" }} data-testid="care-dose" />
      </div>
      <select value={m.prn ? "only when needed" : m.freq} onChange={(e) => { const v = e.target.value; set("freq", v); set("prn", v === "only when needed"); set("times", TIMES_FOR[v] || []); }} className={field} style={{ ...st, borderColor: m.freq ? st.borderColor : "var(--c-warn)" }} data-testid="care-freq">
        <option value="">{tr("How often?")}</option>{FREQS.map(([f]) => <option key={f} value={f}>{tr(f)}</option>)}
        {m.freq && !FREQS.some(([f]) => f === m.freq) ? <option value={m.freq}>{m.freq}</option> : null}
      </select>
      {(m.times || []).length ? <div className="flex flex-wrap gap-1.5 items-center"><span className="c-lbl">{tr("At")}</span>{m.times.map((t, i) => <input key={i} type="time" value={t} onChange={(e) => set("times", m.times.map((x, k) => (k === i ? e.target.value : x)))} className="rounded-lg px-2 py-1 border bg-transparent text-[13px]" style={st} />)}</div> : null}
      <div className="grid grid-cols-2 gap-2">
        <label><span className="c-lbl">{tr("For how many days (0 = ongoing)")}</span><input type="number" min="0" value={m.days || 0} onChange={(e) => set("days", Math.max(0, +e.target.value || 0))} className={field} style={st} /></label>
        <label><span className="c-lbl">{tr("Food")}</span><select value={m.food} onChange={(e) => set("food", e.target.value)} className={field} style={st}><option value="">—</option>{["before food", "with food", "after food"].map((f) => <option key={f} value={f}>{tr(f)}</option>)}</select></label>
      </div>
      <label className="block"><span className="c-lbl">{H.isInsulin(m) ? tr("Units left in your pens or vials (optional — for a refill reminder)") : tr("How many are left (optional — for a refill reminder)")}</span>
        <input type="number" min="0" value={m.stock || ""} onChange={(e) => set("stock", Math.max(0, +e.target.value || 0))} className={field} style={st} data-testid="care-stock" /></label>
      {missing.length ? <p className="c-warn text-[12.5px] m-0" data-testid="care-missing">{tr("Fill in from the prescription:")} {missing.map((x) => tr(x)).join(" · ")}</p> : null}
      <div className="flex gap-2"><button className="c-btn" disabled={missing.length > 0} style={missing.length ? { opacity: 0.5 } : {}} onClick={() => onSave(m)} data-testid="care-save">{tr("Save and remind")}</button><button className="c-sub px-2" onClick={onCancel}>{tr("Cancel")}</button></div>
    </div>);
}

function Spark({ list }) {
  if (list.length < 2) return null;
  const vals = list.map((x) => x.value), lo = Math.min(...vals, list[list.length - 1].low ?? Infinity), hi = Math.max(...vals, list[list.length - 1].high ?? -Infinity), span = hi - lo || 1;
  const X = (i) => 6 + (i / (list.length - 1)) * 148, Y = (v) => 44 - ((v - lo) / span) * 38;
  const L = list[list.length - 1];
  return (
    <svg viewBox="0 0 160 50" className="w-40 h-12" aria-hidden="true">
      {L.low != null && L.high != null ? <rect x="0" y={Y(L.high)} width="160" height={Math.max(1, Y(L.low) - Y(L.high))} fill="var(--c-soft)" /> : null}
      <polyline points={list.map((x, i) => `${X(i)},${Y(x.value)}`).join(" ")} fill="none" stroke="var(--c-acc)" strokeWidth="2" />
      {list.map((x, i) => <circle key={i} cx={X(i)} cy={Y(x.value)} r="2.5" fill="var(--c-acc)" />)}
    </svg>);
}

export function CarePage({ readText, search, packs, installPack, remind, unremind, flash, incoming, clearIncoming }) {
  const [data, setData] = useState(() => H.loadCare());
  const put = (d) => setData(H.saveCare(d));
  const [tab, setTab] = useState(() => (H.loadCare().meds.length ? "today" : "meds"));
  const [drafts, setDrafts] = useState([]);
  const [labDraft, setLabDraft] = useState(null);
  const [busy, setBusy] = useState("");
  const [typing, setTyping] = useState(""); // "" | "rx" | "lab"
  const [text, setText] = useState("");
  const [warn, setWarn] = useState(null);   // null = not checked; [] = none found; [...] = from labels
  const [packOk, setPackOk] = useState(true);
  const fileRx = useRef(null), fileLab = useRef(null);
  const members = data.members.length ? data.members : [];

  // course over → its reminders go; on every open
  useEffect(() => {
    const done = H.ended(data);
    if (done.length) { let d = data; for (const m of done) { for (const r of H.medReminders(m, null)) unremind && unremind(r.id); d = H.updateMed(d, m.id, { stopped: true }); } put(d); }
  }, []);
  // interactions: only from the official labels in the medicines pack
  useEffect(() => {
    const meds = data.meds.filter((m) => !m.stopped);
    if (meds.length < 2 || !search) { setWarn(meds.length < 2 ? [] : null); return; }
    let live = true;
    (async () => {
      let have = true; try { have = !packs || (packs() || []).some((p) => p.id === "medicines"); } catch (e) {}
      setPackOk(have); if (!have) { setWarn(null); return; }
      const byMed = {};
      for (const m of meds) { try { byMed[m.id] = (await search(m.name + " interactions", ["medicines"], 12)) || []; } catch (e) { byMed[m.id] = []; } }
      if (live) setWarn(H.interactions(meds, byMed));
    })();
    return () => { live = false; };
  }, [data.meds.map((m) => m.id + (m.stopped ? "x" : "")).join()]);

  const ensureMember = () => { if (data.members.length) return data; const r = H.addMember(data, { name: tr("Me") }); return r.data; };
  const saveMed = (m) => {
    let d = ensureMember(); if (!m.member) m = { ...m, member: d.members[0].id };
    const r = H.addMed(d, m); put(r.data);
    for (const x of H.medReminders(r.item, r.data.members.find((p) => p.id === r.item.member))) remind && remind(x);
    flash && flash(tr("Saved — reminders set"));
    return r.item;
  };
  const stopMed = (m) => { if (!window.confirm(tr("Stop this medicine and its reminders?"))) return; for (const x of H.medReminders(m, null)) unremind && unremind(x.id); put(H.updateMed(data, m.id, { stopped: true })); };
  const readRx = (t) => { const lines = H.readPrescription(t); if (!lines.length) { flash && flash(tr("No medicine found — add it by hand")); setDrafts([{ _k: "h" + Date.now() }]); return; } setDrafts(lines.map((l, i) => ({ ...l, source: "prescription", _k: Date.now() + ":" + i }))); setTab("meds"); };
  const readLab = (t) => { const r = H.readLabs(t); if (!r.length) { flash && flash(tr("No results found — type them")); return; } setLabDraft({ date: H.isoDay(Date.now()), member: (members[0] || {}).id || "", rows: r }); setTab("labs"); };
  const photo = async (file, kind) => {
    if (!file) return; setBusy(tr("Reading…"));
    const url = await shrink(file); let t = "";
    try { const r = readText ? await readText(url.split(",")[1]) : null; t = (r && r.text) || ""; } catch (e) {}
    setBusy("");
    if (!t.trim()) { flash && flash(tr("Couldn't read the photo — type it")); setTyping(kind); return; }
    kind === "rx" ? readRx(t) : readLab(t);
  };
  // v6.27: a prescription read by "Read it to me" arrives here, line by line, to check and save
  useEffect(() => { if (incoming && incoming.text) { readRx(incoming.text); clearIncoming && clearIncoming(); } }, [incoming && incoming.id]);
  const doses = H.dosesOn(data);
  const ins = H.insulinState(data), low = H.lowSupply(data);
  const [sugar, setSugar] = useState(""), [sugarUnit, setSugarUnit] = useState("mg/dL");
  // v6.28: a dose marked taken lowers what is left; when a medicine gets near its end, a refill reminder is set (once per count)
  const take = (key) => {
    const d = H.markTaken(data, key); put(d);
    for (const x of H.lowSupply(d)) remind && remind(H.supplyReminder(x));
  };
  const refill = (m) => { const v = window.prompt(tr(H.isInsulin(m) ? "How many units do you have now?" : "How many do you have now?"), ""); if (v == null || !(+v > 0)) return; unremind && unremind("supply-" + m.id); put(H.updateMed(data, m.id, { stock: +v, stockAt: Date.now() })); flash && flash(tr("Saved")); };
  const saveSugar = () => { const v = +String(sugar).replace(",", "."); if (!(v > 0)) return; const d = ensureMember(); put(H.addGlucose(d, d.members[0].id, v, sugarUnit)); setSugar(""); if (H.mgdl(v, sugarUnit) < 70) { flash && flash(tr("Low blood sugar — see the steps below")); remind && remind({ id: "sugar-recheck", at: Date.now() + 15 * 60000, repeat: "none", title: tr("Check your blood sugar again"), body: tr("15 minutes since a low reading. Under 70 mg/dL: another 15 g of fast sugar.") }); } };
  const tests = [...new Set(data.labs.map((x) => x.test))];

  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="care-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Heart size={20} className="c-acc" />{tr("Family health")}</h2>
        <p className="c-sub m-0 lg:max-w-[70ch]">{tr("Medicines, reminders and lab results for your family — read from the prescription and the report, kept on this phone. Not medical advice: ask your doctor or pharmacist.")}</p></div>
      <div className="flex gap-4 border-b" style={{ borderColor: "var(--c-ln)" }} role="tablist">
        {TABS.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} className="c-tab pb-2" onClick={() => setTab(id)} data-testid={"care-tab-" + id}>{tr(l)}</button>)}
      </div>
      {busy ? <p className="c-sub">{busy}</p> : null}

      {tab === "today" && (ins.onInsulin || low.length || (ins.sugar && ins.sugar.low)) ? (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start" data-testid="care-insulin">
          {ins.onInsulin ? <div className="c-card space-y-2"><span className="c-lbl">{tr("Blood sugar now")}</span>
            <div className="flex gap-2"><input type="number" inputMode="decimal" value={sugar} onChange={(e) => setSugar(e.target.value)} className={field} style={st} data-testid="care-sugar" />
              <select value={sugarUnit} onChange={(e) => setSugarUnit(e.target.value)} className="rounded-lg px-2 border bg-transparent text-[13px]" style={st}><option>mg/dL</option><option>mmol/L</option></select>
              <button className="c-btn" disabled={!sugar} onClick={saveSugar} data-testid="care-sugar-save">{tr("Save")}</button></div>
            {ins.sugar ? <span className="c-sub text-[12.5px]">{tr("Last reading")}: <b className={ins.sugar.low ? "c-neg" : ""}>{ins.sugar.value} {ins.sugar.unit}</b> · {new Date(ins.sugar.at).toTimeString().slice(0, 5)} · {tr("Fit & Food uses it for its tips")}</span> : <span className="c-sub text-[12.5px]">{tr("Fit & Food shows each meal's carbohydrates and warns you when your sugar is low.")}</span>}
          </div> : null}
          {H.insulinTips(ins).filter((t) => t.kind === "hypo").map((t) => <div key={t.id} className="c-card text-[13.5px]" style={{ borderColor: "var(--c-neg)" }} data-testid="care-hypo"><b className="c-neg flex items-center gap-2"><AlertTriangle size={15} />{tr("Low blood sugar")}</b><p className="m-0 mt-1" dir="auto">{getLang() === "ar" ? t.ar : t.text}</p></div>)}
          {low.map((x) => <div key={x.med.id} className="c-card flex items-center gap-3" style={{ borderColor: "var(--c-warn)" }} data-testid="care-lowsupply"><AlertTriangle size={16} className="c-warn shrink-0" /><span className="flex-1 text-[13.5px]" dir="auto"><b>{x.med.name}</b> · {x.days <= 0 ? tr("runs out today") : (x.days === 1 ? tr("about 1 day left") : tr("about {n} days left", { n: x.days }))} ({x.left})</span><button className="c-btn" onClick={() => refill(x.med)} data-testid="care-refill">{tr("I refilled")}</button></div>)}
        </div>) : null}
      {tab === "today" ? (
        <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start" data-testid="care-today">
          {!doses.length ? <p className="c-sub">{tr("No doses today. Add a prescription in Medicines.")}</p> : doses.map((x) => (
            <button key={x.key} onClick={() => take(x.key)} className="c-card w-full flex items-center gap-3 text-start py-2.5" data-testid="care-dose-row" aria-pressed={x.taken}>
              <span className={"c-num font-bold w-14 " + (x.late ? "c-neg" : "")}>{x.time}</span>
              <span className="flex-1 min-w-0"><b className="block" dir="auto">{x.med.name} {x.med.strength}</b><span className="c-sub text-[12.5px]" dir="auto">{[x.member && members.length > 1 ? x.member.name : "", x.med.dose, x.med.food ? tr(x.med.food) : ""].filter(Boolean).join(" · ")}</span></span>
              <span className="w-7 h-7 rounded-full grid place-items-center" style={{ background: x.taken ? "var(--c-acc)" : "transparent", border: "1.5px solid " + (x.late ? "var(--c-neg)" : "var(--c-ln)"), color: "#fff" }}>{x.taken ? <Check size={15} /> : null}</span>
            </button>))}
        </div>) : null}

      {tab === "meds" ? (
        <div className="space-y-3" data-testid="care-meds">
          {/* v6.27 computer layout A: the ways in and the forms on the left, the warnings and the medicines on the right */}
          <div className={PANES}><div className={L3}>
          <div className="grid grid-cols-3 gap-2">
            <button className="c-card text-center py-3" onClick={() => fileRx.current && fileRx.current.click()} data-testid="care-rx-photo"><Camera size={18} className="c-acc mx-auto" /><span className="block text-[12px] mt-1">{tr("Prescription photo")}</span></button>
            <button className="c-card text-center py-3" onClick={() => setTyping(typing === "rx" ? "" : "rx")} data-testid="care-rx-type"><Pencil size={18} className="c-acc mx-auto" /><span className="block text-[12px] mt-1">{tr("Type it")}</span></button>
            <button className="c-card text-center py-3" onClick={() => setDrafts((x) => [...x, { _k: "h" + Date.now() }])} data-testid="care-rx-hand"><Plus size={18} className="c-acc mx-auto" /><span className="block text-[12px] mt-1">{tr("Add by hand")}</span></button>
          </div>
          <input ref={fileRx} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { photo(e.target.files && e.target.files[0], "rx"); e.target.value = ""; }} data-testid="care-rx-file" />
          {typing === "rx" ? <div className="c-card space-y-2"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} dir="auto" placeholder={tr("e.g. Amoxicillin 500 mg — 1 cap 3 times daily for 7 days")} className={field} style={st} data-testid="care-rx-text" /><button className="c-btn" disabled={!text.trim()} onClick={() => { readRx(text); setTyping(""); }} data-testid="care-rx-read">{tr("Read it")}</button></div> : null}
          {drafts.map((d) => <MedForm key={d._k} init={d} members={members} onCancel={() => setDrafts((x) => x.filter((y) => y._k !== d._k))} onSave={(m) => { const { _k, missing, raw0, ...rest } = m; saveMed(rest); setDrafts((x) => x.filter((y) => y._k !== d._k)); }} />)}
          </div><div className={(warn && warn.length) || data.meds.some((m) => !m.stopped) ? R3 : "min-w-0"}>
          {warn && warn.length ? (
            <div className="c-card space-y-2" style={{ borderColor: "var(--c-warn)" }} data-testid="care-warnings">
              <b className="flex items-center gap-2 c-warn"><AlertTriangle size={16} />{tr("Check with your pharmacist")}</b>
              {warn.map((w, i) => <div key={i} className="text-[13px]"><b dir="auto">{w.a} + {w.b}</b><p className="c-sub m-0 mt-0.5" dir="ltr">“{w.quote}”</p><span className="c-sub text-[11px]">{tr("From the official label of {m}", { m: w.a })}{w.url ? " · " : ""}{w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="underline">{tr("source")}</a> : null}</span></div>)}
            </div>) : null}
          {!packOk && data.meds.filter((m) => !m.stopped).length > 1 ? (
            <div className="c-card" data-testid="care-pack"><b>{tr("Check medicines together")}</b><p className="c-sub text-[13px] m-0 mt-1">{tr("Download the Medicines pack (official drug labels, 39 MB, offline) and Attune checks each pair against what the labels say.")}</p>
              {installPack ? <button className="c-btn mt-2" onClick={async () => { setBusy(tr("Downloading…")); try { await installPack("medicines"); setPackOk(true); } catch (e) { flash && flash(String(e.message || e)); } setBusy(""); }}>{tr("Download")}</button> : null}</div>) : null}
          {data.meds.filter((m) => !m.stopped).map((m) => {
            const left = m.days > 0 ? m.days - Math.round((Date.parse(H.isoDay(Date.now()) + "T12:00:00") - Date.parse(m.start + "T12:00:00")) / 86400000) : null;
            return (
              <div key={m.id} className="c-card flex items-start gap-3" data-testid="care-med">
                <div className="c-ic"><Pill size={16} /></div>
                <div className="flex-1 min-w-0"><b className="block" dir="auto">{m.name} {m.strength}</b>
                  <span className="c-sub text-[12.5px]" dir="auto">{[members.find((p) => p.id === m.member) && members.length > 1 ? members.find((p) => p.id === m.member).name : "", m.dose, tr(m.freq), (m.times || []).join(", "), m.food ? tr(m.food) : "", left != null ? tr("{n} days left", { n: Math.max(0, left) }) : "", H.daysOfSupply(data, m) != null ? tr("supply for {n} days", { n: H.daysOfSupply(data, m) }) : ""].filter(Boolean).join(" · ")}</span>
                  {m.stock > 0 ? <button className="c-sub underline text-[12px] block mt-0.5" onClick={() => refill(m)} data-testid="care-med-refill">{tr("Update how many are left")}</button> : null}</div>
                <button className="c-sub" aria-label={tr("Stop")} onClick={() => stopMed(m)}><Trash2 size={15} /></button>
              </div>); })}
          {!data.meds.some((m) => !m.stopped) ? <DeskEmpty icon={Pill} title={tr("Your medicines appear here")} testid="care-desk-empty" /> : null}
          </div></div>
        </div>) : null}

      {tab === "labs" ? (
        <div className="space-y-3" data-testid="care-labs">
          {/* v6.27 computer layout A: adding results on the left, each test over time on the right */}
          <div className={PANES}><div className={L3}>
          <div className="grid grid-cols-2 gap-2">
            <button className="c-card text-center py-3" onClick={() => fileLab.current && fileLab.current.click()} data-testid="care-lab-photo"><Camera size={18} className="c-acc mx-auto" /><span className="block text-[12px] mt-1">{tr("Photo of a lab report")}</span></button>
            <button className="c-card text-center py-3" onClick={() => setTyping(typing === "lab" ? "" : "lab")} data-testid="care-lab-type"><Pencil size={18} className="c-acc mx-auto" /><span className="block text-[12px] mt-1">{tr("Type results")}</span></button>
          </div>
          <input ref={fileLab} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { photo(e.target.files && e.target.files[0], "lab"); e.target.value = ""; }} data-testid="care-lab-file" />
          {typing === "lab" ? <div className="c-card space-y-2"><textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} dir="auto" placeholder={tr("e.g. HbA1c 7.2 % (4.0 - 5.6)")} className={field} style={st} data-testid="care-lab-text" /><button className="c-btn" disabled={!text.trim()} onClick={() => { readLab(text); setTyping(""); }} data-testid="care-lab-read">{tr("Read it")}</button></div> : null}
          {labDraft ? (
            <div className="c-card space-y-2" data-testid="care-labdraft"><span className="c-lbl">{tr("Check the values, then save")}</span>
              <input type="date" value={labDraft.date} onChange={(e) => setLabDraft({ ...labDraft, date: e.target.value })} className={field} style={st} />
              {labDraft.rows.map((r, i) => <div key={i} className="flex items-center gap-2 text-[13.5px]"><span className="flex-1">{tr(r.test)}</span><input value={r.value} onChange={(e) => setLabDraft({ ...labDraft, rows: labDraft.rows.map((x, k) => (k === i ? { ...x, value: +e.target.value || 0 } : x)) })} className="w-20 rounded-lg px-2 py-1 border bg-transparent c-num" style={st} /><span className="c-sub w-16">{r.unit}</span></div>)}
              <button className="c-btn" onClick={() => { const d = ensureMember(); put(H.addLabs(d, labDraft.member || d.members[0].id, labDraft.date, labDraft.rows.map((r) => ({ ...r, flag: r.low != null && r.value < r.low ? "low" : r.high != null && r.value > r.high ? "high" : r.low != null || r.high != null ? "in range" : "" })))); setLabDraft(null); }} data-testid="care-lab-save">{tr("Save")}</button>
            </div>) : null}
          </div><div className={tests.length || !labDraft ? R3 : "min-w-0"}>
          {tests.map((t) => { const tr0 = H.trendOf(data.labs, t), L = tr0[tr0.length - 1] || data.labs.filter((x) => x.test === t).pop();
            return (
              <div key={t} className="c-card flex items-center gap-3" data-testid="care-lab">
                <div className="flex-1 min-w-0"><b className="block">{tr(t)}</b><span className="c-sub text-[12.5px]">{L.date}{L.low != null || L.high != null ? " · " + tr("report range") + " " + [L.low, L.high].filter((x) => x != null).join("–") : ""}</span></div>
                <Spark list={tr0} />
                <div className="text-end"><div className="c-num font-bold">{L.value} <span className="c-sub text-[11px]">{L.unit}</span></div>{L.flag ? <span className={"c-pill " + (L.flag === "in range" ? "" : "late")} data-testid="care-flag">{tr(L.flag)}</span> : null}</div>
              </div>); })}
          {!tests.length && !labDraft ? <p className="c-sub">{tr("No results yet. Add a lab report to see each test over time.")}</p> : null}
          {!tests.length && labDraft ? <DeskEmpty icon={Heart} title={tr("Each test over time appears here")} testid="care-desk-empty" /> : null}
          </div></div>
        </div>) : null}

      {tab === "family" ? (
        <div className="space-y-2" data-testid="care-family">
          {/* v6.27 computer layout A: the family as cards on the left (2 columns), adding someone on the right */}
          <div className={PANES_WIDE_LEFT}>
          {data.members.length ? <div className="space-y-2 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:items-start">
          {data.members.map((p) => <div key={p.id} className="c-card flex items-center gap-3"><div className="c-ic"><Users size={16} /></div><div className="flex-1"><b>{p.name}</b>{p.notes ? <span className="block c-sub text-[12.5px]" dir="auto">{p.notes}</span> : null}</div><span className="c-sub text-[12px]">{tr("{n} medicines", { n: data.meds.filter((m) => m.member === p.id && !m.stopped).length })}</span></div>)}
          </div> : <DeskEmpty icon={Users} title={tr("Your family appears here")} testid="care-desk-family" />}
          <div className={(data.members.length ? "mt-2 " : "") + "lg:mt-0 lg:sticky lg:top-4"}><AddMember onAdd={(m) => put(H.addMember(data, m).data)} /></div>
          </div>
        </div>) : null}
    </div>);
}
function AddMember({ onAdd }) {
  const [n, setN] = useState(""), [notes, setNotes] = useState("");
  return (
    <div className="c-card space-y-2"><span className="c-lbl">{tr("Add a family member")}</span>
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder={tr("Name (e.g. Mum, Dad, Omar)")} className={field} style={st} dir="auto" data-testid="care-member-name" />
      <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tr("Allergies or conditions (optional)")} className={field} style={st} dir="auto" />
      <button className="c-btn" disabled={!n.trim()} onClick={() => { onAdd({ name: n.trim(), notes }); setN(""); setNotes(""); }} data-testid="care-member-add">{tr("Add")}</button></div>);
}
