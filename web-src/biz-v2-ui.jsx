/* ---- v6.32 Business builder v2 — the screens: sign in by PIN, and "Team & tools" for a system ---------------------------
   One sheet with five short sections (minimal design A): Team & roles · Currencies · Price lists · Encrypted backup ·
   Export as a project. Logic: erp-v2.js, biz-vault.js. Tests: tests/unit/v732bizv2.test.mjs, tests/e2e_v732bizv2.py.   */
import React, { useState } from "react";
import { X, Plus, Trash2, Lock, Download, Upload, Users, Wallet, FileText, Check, ChevronLeft } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as V from "./erp-v2.js";
import { zipStore } from "./convert.js";
import { sealData, openData, vaultHeader } from "./biz-vault.js";
import { useSubBack } from "./backstack.js";
import { askConfirm } from "./confirm.jsx";

const card = "rounded-2xl bg-[var(--c-surf)] border border-[var(--c-ln)] shadow-[0_1px_3px_rgba(15,23,42,.06)]";
const btnP = "h-12 px-5 rounded-2xl text-[var(--c-on-acc)] font-bold text-[15px] disabled:opacity-40 flex items-center justify-center gap-2";
const btnS = "h-10 px-3 rounded-xl border border-[var(--c-ln)] bg-[var(--c-surf)] text-[13.5px] font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40";
const inp = "w-full min-w-0 h-11 rounded-xl bg-[var(--c-surf-2)] border border-transparent px-3 text-[15px] text-[var(--c-ink)] focus:outline-none focus:border-[var(--biz)] focus:bg-[var(--c-surf)]";
const muted = "text-[var(--c-mut)]";
const roleName = (r) => (getLang() === "ar" ? V.ROLES[r].ar : V.ROLES[r].en);
function saveOut(saveFile, name, data, mime) {
  if (saveFile) {
    if (data instanceof Uint8Array) { let s = ""; for (let i = 0; i < data.length; i += 0x8000) s += String.fromCharCode.apply(null, data.subarray(i, i + 0x8000)); return saveFile(name, "", mime, btoa(s)); }
    return saveFile(name, data, mime);
  }
  try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: mime })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); } catch (e) {}
}

/** The PIN screen in front of a system that has a team. */
export function PinGate({ sys, onIn, onBack, color }) {
  const [pin, setPin] = useState(""), [bad, setBad] = useState(false);
  const go = async (p) => { const u = await V.login(sys, p); if (u) onIn(u); else { setBad(true); setPin(""); } };
  const press = (d) => { const p = (pin + d).slice(0, 8); setPin(p); setBad(false); if (p.length >= 4) V.login(sys, p).then((u) => u && onIn(u)); };
  return (
    <section className="min-h-[80vh] flex flex-col items-center justify-center px-6 gap-5" data-testid="biz-pin">
      <button onClick={onBack} aria-label={tr("Back")} className="self-start w-11 h-11 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center"><ChevronLeft size={20} className="rtl:-scale-x-100" /></button>
      <span className="w-14 h-14 rounded-2xl grid place-items-center text-[var(--c-on-acc)]" style={{ background: color }}><Lock size={24} /></span>
      <p className="text-[20px] font-extrabold text-center" dir="auto">{sys.name}</p>
      <p className={"text-[14px] -mt-3 " + muted}>{tr("Enter your PIN")}</p>
      <div className="flex gap-2.5 h-4" aria-hidden="true">{[0, 1, 2, 3].map((i) => <span key={i} className={"w-3.5 h-3.5 rounded-full " + (i < pin.length ? "" : "bg-[var(--c-ln)]")} style={i < pin.length ? { background: color } : null} />)}</div>
      {bad ? <p className="text-[13px] text-[var(--c-neg)]">{tr("Wrong PIN")}</p> : null}
      <input value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 8)); setBad(false); }} onKeyDown={(e) => { if (e.key === "Enter") go(pin); }} inputMode="numeric" type="password" className="sr-only" data-testid="biz-pin-input" aria-label={tr("PIN")} autoFocus />
      <div className="grid grid-cols-3 gap-3 w-64" dir="ltr">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) => d === "" ? <span key={i} /> :
        <button key={i} onClick={() => (d === "⌫" ? setPin(pin.slice(0, -1)) : press(d))} className="h-14 rounded-2xl bg-[var(--c-surf)] border border-[var(--c-ln)] text-[20px] font-bold">{d}</button>)}</div>
      {pin.length >= 4 ? <button className={btnP + " w-64"} style={{ background: color }} onClick={() => go(pin)} data-testid="biz-pin-go">{tr("Sign in")}</button> : null}
    </section>);
}

/** "Team & tools" for one system. user = who is signed in (null when the system has no team). */
export function SystemTools({ sys, setSys, user, onSignIn, onClose, flash, saveFile, onImport, wide, site = false }) {
  const [sec, setSec] = useState(null);
  useSubBack(true, () => (sec ? setSec(null) : onClose()));
  const owner = V.can(sys, user, "own");
  const S = [["team", Users, "Team & roles", V.hasTeam(sys) ? tr("{n} people", { n: V.teamOf(sys).length }) : tr("Only you — add people with their own PIN")],
    ["money", Wallet, "Currencies", tr("Main currency: {c}", { c: V.baseCurrency(sys) }) + (sys.rates && Object.keys(sys.rates).length ? " · " + Object.keys(sys.rates).join(", ") : "")],
    ["prices", FileText, "Price lists", (sys.priceLists || []).length ? (sys.priceLists || []).map((l) => l.name).join(", ") : tr("Wholesale, retail, contract prices…")],
    ["backup", Lock, "Encrypted backup", tr("One file, locked with a passphrase")],
    ["project", Download, "Export as a project", tr("A folder: the app, a phone web app, a Windows program, the data")]].filter((x) => !(site && x[0] === "project"));
  return (
    <div className={"fixed inset-0 z-[70] bg-black/60 flex " + (wide ? "items-center justify-center p-6" : "items-end")} onClick={onClose}>
      <div className={"bg-[var(--c-bg)] w-full max-h-[92vh] overflow-y-auto p-4 space-y-3 " + (wide ? "max-w-xl rounded-3xl" : "rounded-t-3xl pb-8")} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" data-testid="biz-tools">
        <div className="flex items-center gap-2">
          {sec ? <button onClick={() => setSec(null)} aria-label={tr("Back")} className="w-10 h-10 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center"><ChevronLeft size={18} className="rtl:-scale-x-100" /></button> : null}
          <p className="flex-1 text-[18px] font-extrabold">{sec ? tr(S.find((x) => x[0] === sec)[2]) : tr("Team & tools")}</p>
          <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full bg-[var(--c-surf)] border border-[var(--c-ln)] grid place-items-center"><X size={18} /></button></div>
        {user ? <p className={"text-[12.5px] " + muted}>{tr("Signed in as {n} ({r})", { n: user.name, r: roleName(user.role) })}</p> : null}
        {!sec ? S.map(([k, I, l, sub]) => (
          <button key={k} onClick={() => setSec(k)} disabled={!owner && k !== "project"} data-testid={"biz-tools-" + k} className={card + " w-full text-start p-3.5 flex items-center gap-3 disabled:opacity-50"}>
            <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0 text-[var(--c-on-acc)]" style={{ background: "var(--c-acc)" }}><I size={18} /></span>
            <span className="min-w-0"><span className="block font-bold text-[14.5px]">{tr(l)}</span><span className={"block text-[12.5px] truncate " + muted} dir="auto">{sub}</span></span></button>))
          : sec === "team" ? <Team sys={sys} setSys={setSys} flash={flash} onSignIn={onSignIn} />
          : sec === "money" ? <Money sys={sys} setSys={setSys} flash={flash} />
          : sec === "prices" ? <Prices sys={sys} setSys={setSys} flash={flash} />
          : sec === "backup" ? <Backup sys={sys} flash={flash} saveFile={saveFile} onImport={onImport} />
          : <Project sys={sys} flash={flash} saveFile={saveFile} />}
        {!owner ? <p className={"text-[12px] " + muted}>{tr("Only an owner can change these.")}</p> : null}
      </div></div>);
}

function Team({ sys, setSys, flash, onSignIn }) {
  const [f, setF] = useState({ name: "", role: V.hasTeam(sys) ? "editor" : "owner", pin: "", tables: [] });
  const add = async () => {
    try {
      const first = !V.hasTeam(sys), next = await V.setUser(sys, f);
      if (first && onSignIn) onSignIn(V.teamOf(next)[0]);      // the owner who sets up the team stays signed in
      setSys(next, tr("Added {n}", { n: f.name })); setF({ name: "", role: "editor", pin: "", tables: [] });
    } catch (e) { flash(tr(e.message)); }
  };
  return <div className="space-y-2.5" data-testid="biz-team">
    <p className={"text-[13px] " + muted}>{tr("When you add people, the system asks for a PIN when it opens, and each person can do only what their role allows.")}</p>
    {V.teamOf(sys).map((u) => <div key={u.id} className={card + " p-3 flex items-center gap-2"} data-testid="biz-team-user"><span className="flex-1 min-w-0"><span className="block font-semibold text-[14px]" dir="auto">{u.name}</span><span className={"block text-[12px] " + muted}>{roleName(u.role)}{u.tables && u.tables.length ? " · " + u.tables.map((id) => (sys.tables.find((t) => t.id === id) || {}).name).join(", ") : ""}</span></span>
      <button className="w-9 h-9 grid place-items-center text-[var(--c-mut)]" aria-label={tr("Remove")} onClick={async () => { if (await askConfirm("Remove this person?", { yes: "Remove" })) { try { setSys(V.removeUser(sys, u.id)); } catch (e) { flash(tr(e.message)); } } }}><Trash2 size={15} /></button></div>)}
    <div className={card + " p-3.5 space-y-2.5"}>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("Name")} className={inp} dir="auto" data-testid="biz-team-name" />
      <div className="grid grid-cols-2 gap-2"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={inp} data-testid="biz-team-role">{Object.keys(V.ROLES).map((r) => <option key={r} value={r}>{roleName(r)}</option>)}</select>
        <input value={f.pin} onChange={(e) => setF({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} placeholder={tr("PIN (4–8 digits)")} inputMode="numeric" className={inp} data-testid="biz-team-pin" /></div>
      <p className={"text-[12px] " + muted}>{tr(V.ROLES[f.role].note)}</p>
      {f.role === "editor" ? <div className="flex flex-wrap gap-1.5">{sys.tables.map((t) => { const on = f.tables.includes(t.id); return <button key={t.id} onClick={() => setF({ ...f, tables: on ? f.tables.filter((x) => x !== t.id) : [...f.tables, t.id] })} className={"h-8 px-3 rounded-full text-[12.5px] font-semibold border " + (on ? "text-[var(--c-on-acc)] border-transparent" : "bg-[var(--c-surf)] border-[var(--c-ln)]")} style={on ? { background: "var(--c-acc)" } : null} dir="auto">{t.name}</button>; })}
        <p className={"w-full text-[11.5px] " + muted}>{tr("Pick the tables they may change — none picked = all tables.")}</p></div> : null}
      <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={add} disabled={!f.name.trim() || f.pin.length < 4} data-testid="biz-team-add"><Plus size={17} />{tr("Add")}</button>
    </div></div>;
}
function Money({ sys, setSys, flash }) {
  const [cur, setCur] = useState("USD"), [rate, setRate] = useState("");
  const money = sys.tables.flatMap((t) => t.fields.filter((f) => f.type === "money").map((f) => ({ t, f })));
  const curs = [...new Set([V.baseCurrency(sys), ...V.CURRENCIES, ...Object.keys(sys.rates || {})])];
  return <div className="space-y-2.5" data-testid="biz-money">
    <p className={"text-[13px] " + muted}>{tr("Totals are shown in {c}. A column in another currency is converted with the rate you set here.", { c: V.baseCurrency(sys) })}</p>
    {Object.entries(sys.rates || {}).map(([k, v]) => <div key={k} className={card + " p-3 flex items-center gap-2 text-[14px]"}><span className="flex-1" dir="ltr">1 {k} = {v} {V.baseCurrency(sys)}</span>
      <button className="w-9 h-9 grid place-items-center text-[var(--c-mut)]" aria-label={tr("Remove")} onClick={() => { const r = { ...sys.rates }; delete r[k]; setSys({ ...sys, rates: r, updated: Date.now() }); }}><Trash2 size={15} /></button></div>)}
    <div className="flex gap-2"><select value={cur} onChange={(e) => setCur(e.target.value)} className={inp + " w-28"} dir="ltr">{V.CURRENCIES.filter((c) => c !== V.baseCurrency(sys)).map((c) => <option key={c}>{c}</option>)}</select>
      <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={tr("1 {c} = ? {b}", { c: cur, b: V.baseCurrency(sys) })} inputMode="decimal" className={inp} data-testid="biz-rate" dir="ltr" />
      <button className={btnS + " h-11 shrink-0"} onClick={() => { try { setSys(V.setRate(sys, cur, rate), tr("Saved")); setRate(""); } catch (e) { flash(tr(e.message)); } }} data-testid="biz-rate-save"><Check size={16} /></button></div>
    {money.length ? <><p className="font-bold text-[14px] pt-1">{tr("Money columns")}</p>
      {money.map(({ t, f }) => <div key={f.id} className="flex items-center gap-2"><span className="flex-1 min-w-0 text-[13.5px] truncate" dir="auto">{t.name} · {f.name}</span>
        <select value={V.fieldCurrency(sys, f)} onChange={(e) => setSys(V.setFieldCurrency(sys, t.id, f.id, e.target.value))} className={inp + " w-28 h-10"} dir="ltr" data-testid="biz-field-cur">{curs.map((c) => <option key={c}>{c}</option>)}</select></div>)}</> : null}
  </div>;
}
function Prices({ sys, setSys, flash }) {
  const tabs = V.priceTables(sys);
  const blank = () => { const t = tabs[0]; return { name: "", tid: t ? t.id : "", fid: t ? t.fields.find((f) => f.type === "money").id : "", adjust: "", prices: {} }; };
  const [l, setL] = useState(null);
  if (!tabs.length) return <p className={card + " p-4 text-[13.5px] " + muted}>{tr("Add a table with a price (a money column) first.")}</p>;
  if (!l) return <div className="space-y-2" data-testid="biz-prices">
    {(sys.priceLists || []).map((x) => <button key={x.id} onClick={() => setL({ ...x, adjust: String(x.adjust || ""), prices: Object.fromEntries(Object.entries(x.prices || {}).map(([k, v]) => [k, String(v)])) })} className={card + " w-full text-start p-3.5 flex items-center gap-2"} data-testid="biz-pricelist">
      <span className="flex-1 font-semibold text-[14px]" dir="auto">{x.name}</span><span className={"text-[12.5px] " + muted} dir="ltr">{x.adjust ? (x.adjust > 0 ? "+" : "") + x.adjust + "%" : ""} {Object.keys(x.prices || {}).length ? "· " + tr("{n} fixed", { n: Object.keys(x.prices).length }) : ""}</span></button>)}
    <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={() => setL(blank())} data-testid="biz-pricelist-new"><Plus size={17} />{tr("New price list")}</button>
    <p className={"text-[12px] " + muted}>{tr("In a form, choose the list at the top — picking a product then fills its price from the list.")}</p></div>;
  const t = sys.tables.find((x) => x.id === l.tid) || tabs[0];
  const nameF = t.fields.find((f) => f.type === "text") || t.fields[0];
  const save = () => { try { setSys(V.savePriceList(sys, { ...l, adjust: l.adjust || 0 }), tr("Saved")); setL(null); } catch (e) { flash(tr(e.message)); } };
  return <div className="space-y-2.5" data-testid="biz-pricelist-form">
    <input value={l.name} onChange={(e) => setL({ ...l, name: e.target.value })} placeholder={tr("List name, e.g. Wholesale")} className={inp} dir="auto" data-testid="biz-pl-name" />
    <div className="grid grid-cols-2 gap-2"><select value={l.tid} onChange={(e) => { const nt = sys.tables.find((x) => x.id === e.target.value); setL({ ...l, tid: nt.id, fid: nt.fields.find((f) => f.type === "money").id, prices: {} }); }} className={inp} dir="auto">{tabs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
      <select value={l.fid} onChange={(e) => setL({ ...l, fid: e.target.value })} className={inp} dir="auto">{t.fields.filter((f) => f.type === "money").map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
    <input value={l.adjust} onChange={(e) => setL({ ...l, adjust: e.target.value })} placeholder={tr("Change for everything, % (e.g. -10)")} inputMode="decimal" className={inp} data-testid="biz-pl-adjust" dir="ltr" />
    <p className="font-bold text-[13.5px]">{tr("Fixed prices (optional)")}</p>
    <div className="space-y-1.5 max-h-64 overflow-y-auto">{(sys.rows[t.id] || []).slice(0, 200).map((r) => <div key={r._id} className="flex items-center gap-2"><span className="flex-1 min-w-0 text-[13.5px] truncate" dir="auto">{String(r[nameF.id] ?? "")}</span>
      <span className={"text-[12px] tabular-nums " + muted} dir="ltr">{r[l.fid] ?? ""}</span>
      <input value={l.prices[r._id] ?? ""} onChange={(e) => setL({ ...l, prices: { ...l.prices, [r._id]: e.target.value } })} inputMode="decimal" className={inp + " w-24 h-9"} dir="ltr" /></div>)}</div>
    <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={save} disabled={!l.name.trim()} data-testid="biz-pl-save"><Check size={17} />{tr("Save")}</button>
    {l.id ? <button className={btnS + " w-full text-[var(--c-neg)]"} onClick={() => { setSys(V.removePriceList(sys, l.id)); setL(null); }}><Trash2 size={15} />{tr("Delete")}</button> : null}
  </div>;
}
function Backup({ sys, flash, saveFile, onImport }) {
  const [pass, setPass] = useState(""), [busy, setBusy] = useState(false), [file, setFile] = useState(null);
  const make = async () => { setBusy(true); try { const text = await sealData(sys, pass, { kind: "system", name: sys.name, counts: Object.fromEntries(sys.tables.map((t) => [t.name, (sys.rows[t.id] || []).length])) });
    saveOut(saveFile, `${V.projectName(sys).replace("-project.zip", "")}-backup.attune-biz`, text, "application/json"); flash(tr("Encrypted backup saved — keep the passphrase safe")); } catch (e) { flash(tr(e.message)); } setBusy(false); };
  const restore = async () => { setBusy(true); try { const { data } = await openData(file.text, pass, "system"); onImport(data); } catch (e) { flash(tr(e.message)); } setBusy(false); };
  return <div className="space-y-2.5" data-testid="biz-backup">
    <p className={"text-[13px] " + muted}>{tr("The whole system — design and every record — locked with your passphrase (AES-256). Without it nobody can open the file.")}</p>
    <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={tr("Passphrase")} className={inp} data-testid="biz-pass" />
    <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={make} disabled={busy || pass.length < 4} data-testid="biz-backup-make"><Lock size={17} />{busy ? tr("Working…") : tr("Save an encrypted backup")}</button>
    <label className={btnS + " w-full h-12 cursor-pointer"}><Upload size={16} />{file ? file.name : tr("Open a backup as a copy")}
      <input type="file" className="hidden" accept=".attune-biz,.json,application/json" data-testid="biz-backup-file" onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; const text = await f.text(); try { vaultHeader(text); setFile({ name: f.name, text }); } catch (err) { flash(tr(err.message)); } }} /></label>
    {file ? <button className={btnS + " w-full h-12"} onClick={restore} disabled={busy || pass.length < 4} data-testid="biz-backup-open">{tr("Open it")}</button> : null}
  </div>;
}
/** v6.32: the website template (the full Business app, www/business-site.html); null when it can't be read (then the small app). */
let TEMPLATE = null;
export async function siteTemplate() {
  if (TEMPLATE) return TEMPLATE;
  try { const r = await fetch("business-site.html"); if (r.ok) { const t = await r.text(); if (/__SITE_DATA__/.test(t)) return (TEMPLATE = t); } } catch (e) {}
  return null;
}
/** Save a system (kind "system") or Fleet (kind "fleet") as a project .zip: website + phone app + Windows program + data. */
export async function saveProject(data, { kind = "system", name = null, saveFile, flash }) {
  try {
    const template = await siteTemplate();
    const zip = zipStore(V.projectFiles(data, { kind, name, template, lang: getLang() }));
    const file = V.projectName(data, name);
    saveOut(saveFile, file, zip, "application/zip"); flash(tr("Saved {f}", { f: file }));
  } catch (e) { flash(tr(e.message)); }
}
function Project({ sys, flash, saveFile }) {
  const [busy, setBusy] = useState(false);
  const go = async () => { setBusy(true); await saveProject(sys, { saveFile, flash }); setBusy(false); };
  const pts = [["index.html", "the full app — the same screens as in Attune, in any browser, offline; upload the folder to your own website"], ["manifest + sw.js", "installs on a phone like an app"], ["package.json + main.js", "a Windows program: npm install, then npm run build"], ["data/system.json", "all tables and records, for a developer or another database"], ["README.md", "how to run it, in English and Arabic"]];
  return <div className="space-y-2.5" data-testid="biz-project">
    <div className={card + " p-4 space-y-1.5"}>{pts.map(([a, b]) => <p key={a} className="text-[13.5px]"><b dir="ltr">{a}</b> — {tr(b)}</p>)}</div>
    <button className={btnP + " w-full"} style={{ background: "var(--c-acc)" }} onClick={go} disabled={busy} data-testid="biz-project-save"><Download size={17} />{tr("Save the project (.zip)")}</button>
    <p className={"text-[12px] " + muted}>{tr("The team's PINs stay in Attune; the exported app opens without them.")}</p>
  </div>;
}
