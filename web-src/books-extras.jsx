/* ---- Business extras on screen: ETA export, encrypted automatic backups, users & roles, currencies, price lists,
   delivery notes. Logic lives in books-eta.js / books-vault.js / books-more.js / books-ops2.js; this file only shows it. */
import React, { useState, useEffect, useMemo } from "react";
import { Upload, ShieldCheck, Package as Truck, Plus, Trash2 } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import * as O2 from "./books-ops2.js";
import * as M from "./books-more.js";
import * as ETA from "./books-eta.js";
import * as V from "./books-vault.js";
import { replaceBooks } from "./books-store.js";
import { shareDelivery, shareDeliveryWord } from "./books-docs.jsx";
import { L, useBooks, useTheme, Card, Section, Money, Badge, Field, Input, Select, Sheet, BTN, btnPrimary, today, fmtDate } from "./books-kit.jsx";

const actorCan = (perm) => { const a = O.getActor(); return !a || M.can(a.role, perm); };
export { actorCan };
const noFiles = () => L("Saving files works in the Android app", "حفظ الملفات شغال في تطبيق أندرويد");

// ---- ETA ----------------------------------------------------------------------------------------------------------
function saveEta(saveFile, flash, name, obj, report) {
  if (!actorCan("export")) return flash(L("Your role cannot export", "دورك مش مسموح له بالتصدير"));
  if (!saveFile) return flash(noFiles());
  saveFile(name, ETA.etaFileText(obj), "application/json");
  flash(report);
}
export function EtaButton({ doc }) {
  const { s, saveFile, flash } = useBooks();
  const th = useTheme();
  const [res, setRes] = useState(null);
  const go = () => {
    const j = ETA.etaDocument(s, doc), v = ETA.validateEta(j);
    if (!v.ok) return setRes(v);
    saveEta(saveFile, flash, `ETA-${doc.number}.json`, j, L("ETA file saved (unsigned)", "اتحفظ ملف المصلحة (غير موقّع)"));
    setRes(v);
  };
  return (
    <>
      <button onClick={go} className={`${BTN} border ${th.line}`} data-testid="doc-eta">{L("Export for ETA", "تصدير للضرائب")}</button>
      {res ? <Sheet title={L("ETA e-invoice", "الفاتورة الإلكترونية")} onClose={() => setRes(null)} testid="eta-result"><EtaResult v={res} /></Sheet> : null}
    </>
  );
}
function EtaResult({ v }) {
  const th = useTheme();
  return (
    <div className="space-y-3 text-[13px]">
      <p className={v.ok ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"} data-testid="eta-status">{v.ok ? L("Valid — the file was saved.", "سليم — الملف اتحفظ.") : L("Not ready — fix these first:", "مش جاهز — صلّح دول الأول:")}</p>
      {v.errors.map((e, i) => <p key={i} className="text-red-600" dir="ltr">• {e}</p>)}
      {v.warnings.map((e, i) => <p key={i} className="text-amber-700" dir="ltr">• {e}</p>)}
      <p className={`text-[12px] ${th.sub}`}>{L(ETA.ETA_NOTE.en, ETA.ETA_NOTE.ar)}</p>
    </div>
  );
}
export function EtaReport({ from, to }) {
  const { s, saveFile, flash, today: td } = useBooks();
  const th = useTheme();
  const b = useMemo(() => ETA.etaBatch(s, from, to), [s, from, to]);
  const bad = b.report.filter((r) => !r.ok);
  return (
    <div data-testid="eta-report">
      <Card className="divide-y">
        <div className="flex justify-between px-3 py-2.5 text-[13.5px]"><span>{L("Documents in the period", "مستندات الفترة")}</span><b>{b.count}</b></div>
        <div className="flex justify-between px-3 py-2.5 text-[13.5px]"><span>{L("Ready", "جاهزة")}</span><b className="text-emerald-700">{b.count - bad.length}</b></div>
        <div className="flex justify-between px-3 py-2.5 text-[13.5px]"><span>{L("Need fixing", "محتاجة تصليح")}</span><b className={bad.length ? "text-red-600" : ""}>{bad.length}</b></div>
        {bad.slice(0, 10).map((r) => <div key={r.number} className="px-3 py-2 text-[12px]"><b>{r.number}</b><span className="text-red-600" dir="ltr"> — {r.errors[0]}</span></div>)}
      </Card>
      <button disabled={!b.count || bad.length > 0} onClick={() => saveEta(saveFile, flash, `ETA-batch-${from || "all"}-${to || td}.json`, b.documents, L(`${b.count} documents saved (unsigned)`, `اتحفظ ${b.count} مستند (غير موقّع)`))} className={`${btnPrimary} mt-3 w-full`} data-testid="eta-batch">{L("Export all for ETA", "تصدير الكل للضرائب")}</button>
      <p className={`text-[11.5px] mt-2 ${th.sub}`}>{L(ETA.ETA_NOTE.en, ETA.ETA_NOTE.ar)}</p>
    </div>
  );
}
export function EtaSettings({ eta, setEta }) {
  const set = (k) => (v) => setEta((x) => ({ ...x, [k]: v }));
  return (
    <Section title={L("E-invoice (Tax Authority)", "الفاتورة الإلكترونية (مصلحة الضرائب)")}>
      <div className="grid grid-cols-2 gap-2">
        <Field label={L("Activity code (4 digits)", "كود النشاط (٤ أرقام)")}><Input value={eta.activityCode} onChange={set("activityCode")} inputMode="numeric" data-testid="eta-activity" /></Field>
        <Field label={L("Branch no.", "رقم الفرع")}><Input value={eta.branchID} onChange={set("branchID")} inputMode="numeric" /></Field>
        <Field label={L("Governorate", "المحافظة")}><Input value={eta.governate} onChange={set("governate")} data-testid="eta-gov" /></Field>
        <Field label={L("City / area", "المدينة / المنطقة")}><Input value={eta.regionCity} onChange={set("regionCity")} data-testid="eta-city" /></Field>
        <Field label={L("Street", "الشارع")}><Input value={eta.street} onChange={set("street")} data-testid="eta-street" /></Field>
        <Field label={L("Building no.", "رقم المبنى")}><Input value={eta.buildingNumber} onChange={set("buildingNumber")} data-testid="eta-building" /></Field>
      </div>
    </Section>
  );
}

// ---- encrypted backups ------------------------------------------------------------------------------------------------
const INDEX = "books-snaps.json";
const native = () => (typeof window !== "undefined" && window.AttuneNative) || null;
const stash = {
  get(name) { try { const n = native(); return n && n.stashGet ? n.stashGet(name) || "" : localStorage.getItem("attune:vault:" + name) || ""; } catch (e) { return ""; } },
  put(name, text) { try { const n = native(); if (n && n.stashPut) return n.stashPut(name, text); localStorage.setItem("attune:vault:" + name, text); return true; } catch (e) { return false; } },
  del(name) { try { const n = native(); if (n && n.stashDel) return n.stashDel(name); localStorage.removeItem("attune:vault:" + name); return true; } catch (e) { return false; } },
};
export const snapList = () => { try { return JSON.parse(stash.get(INDEX) || "[]"); } catch (e) { return []; } };
/** On open: take a snapshot if the books changed (encrypted with the PIN typed to open them), apply the keep policy. */
export async function autoSnapshot(state, secret, who, td = today()) {
  if (!secret) return { took: false, reason: "no-secret" };
  const fp = await V.fingerprint(state);
  const name = `books-${td}.vault`;
  const plan = V.planSnapshots(snapList(), td, fp, name);
  if (!plan.take) return { took: false, reason: "unchanged" };
  const text = await V.seal(state, secret);
  if (!stash.put(name, text)) return { took: false, reason: "storage" };
  for (const n of plan.drop) stash.del(n);
  stash.put(INDEX, JSON.stringify(plan.keep.map((x) => (x.name === name ? { ...x, who: who || "", docs: state.docs.length } : x))));
  return { took: true, name, kept: plan.keep.length };
}
export function VaultSection({ onClose }) {
  const { s, run, flash, saveFile } = useBooks();
  const th = useTheme();
  const [list, setList] = useState(snapList);
  const [pass, setPass] = useState("");
  const [pick, setPick] = useState(null);           // { text, name }
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef(null);
  const exportNow = async () => {
    if (!actorCan("export")) return flash(L("Your role cannot export", "دورك مش مسموح له بالتصدير"));
    if (pass.length < 8) return flash(L("A backup passphrase needs at least 8 characters", "كلمة سر النسخة لازم ٨ حروف على الأقل"));
    setBusy(true);
    try { const text = await V.seal(s, pass); saveFile ? saveFile(`books-${today()}.vault`, text, "application/json") : flash(noFiles()); } catch (e) { flash(e.message); }
    setBusy(false);
  };
  return (
    <Section title={L("Encrypted backups", "نسخ احتياطية مشفّرة")}>
      <p className={`text-[12px] mb-2 ${th.sub}`}>{L("Every time the books are opened with a PIN and something changed, an encrypted copy is kept on this phone (last 7 + one per month). It opens only with the PIN used that day.", "كل مرة الدفاتر تتفتح بالرقم السري ويكون فيه تغيير، بتتحفظ نسخة مشفّرة على التليفون (آخر ٧ + نسخة كل شهر). مش بتتفتح غير بالرقم السري اللي اتفتحت بيه في اليوم ده.")}</p>
      <Card className="divide-y mb-2" testid="vault-list">
        {!list.length ? <p className={`px-3 py-2.5 text-[12.5px] ${th.sub}`}>{L("No automatic copies yet — set a PIN (above) to turn them on.", "مفيش نسخ تلقائية لسه — حط رقم سري (فوق) عشان تشتغل.")}</p>
          : list.map((x) => <button key={x.name} onClick={() => actorCan("restore") ? setPick({ text: stash.get(x.name), name: x.name }) : flash(L("Only the owner can restore", "المالك بس اللي يقدر يسترجع"))} className="w-full flex justify-between px-3 py-2.5 text-[13px] text-start" data-testid="vault-row"><span>{fmtDate(x.date)}{x.who ? ` · ${x.who}` : ""}</span><span className={th.sub}>{x.docs != null ? `${x.docs} ${L("docs", "مستند")}` : ""}</span></button>)}
      </Card>
      <Field label={L("Passphrase for a backup file to keep elsewhere", "كلمة سر لنسخة تحفظها بره التليفون")}><Input value={pass} onChange={setPass} type="password" data-testid="vault-pass" /></Field>
      <div className="flex gap-2 mt-2">
        <button onClick={exportNow} disabled={busy} className={`${BTN} border ${th.line} flex items-center gap-1.5`} data-testid="vault-export"><ShieldCheck size={14} />{L("Save encrypted copy", "احفظ نسخة مشفّرة")}</button>
        <button onClick={() => fileRef.current && fileRef.current.click()} className={`${BTN} border ${th.line} flex items-center gap-1.5`}><Upload size={14} />{L("Restore a file", "استرجع من ملف")}</button>
        <input ref={fileRef} type="file" className="hidden" onChange={async (e) => { const f = e.target.files && e.target.files[0]; if (f) setPick({ text: await f.text(), name: f.name }); }} data-testid="vault-file" />
      </div>
      {pick ? <RestoreSheet pick={pick} onClose={() => setPick(null)} onDone={() => { setPick(null); onClose && onClose(); }} /> : null}
    </Section>
  );
}
/** Restore = open (integrity checked) → dry-run diff → confirm → replace. */
export function RestoreSheet({ pick, onClose, onDone }) {
  const { s, run, flash } = useBooks();
  const th = useTheme();
  const [secret, setSecret] = useState("");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const check = async () => {
    setBusy(true); setErr("");
    try { const r = await V.open(pick.text, secret); setRes({ ...r, diff: V.diffBooks(s, r.state) }); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const LBL = { customers: ["Customers", "العملاء"], items: ["Items", "الأصناف"], docs: ["Sales documents", "مستندات البيع"], bills: ["Bills", "فواتير الموردين"], payments: ["Receipts", "المقبوضات"], expenses: ["Expenses", "المصروفات"], journal: ["Ledger entries", "قيود اليومية"] };
  const restore = async () => {
    if (!window.confirm(L("Replace ALL current books with this backup?", "تستبدل كل الدفاتر الحالية بالنسخة دي؟"))) return;
    O.log(res.state, null, "restore", pick.name, res.header.created);
    await replaceBooks(res.state); await run(() => res.state, L("Backup restored", "النسخة اتسترجعت")); onDone();
  };
  return (
    <Sheet title={L("Restore", "استرجاع")} onClose={onClose} testid="vault-restore" footer={res ? <button onClick={restore} disabled={!res.check.ok || res.diff.same} className={`${btnPrimary} w-full`} data-testid="vault-restore-go">{L("Replace my books with this copy", "استبدل دفاتري بالنسخة دي")}</button> : null}>
      {!res ? (
        <div className="space-y-2">
          <Field label={L("PIN or passphrase of that copy", "الرقم السري أو كلمة السر بتاعة النسخة")}><Input value={secret} onChange={setSecret} type="password" data-testid="vault-secret" /></Field>
          <button onClick={check} disabled={busy || secret.length < 4} className={`${btnPrimary} w-full`} data-testid="vault-check">{busy ? L("Checking…", "بيتأكد…") : L("Open and compare (nothing changes yet)", "افتح وقارن (مفيش حاجة هتتغيّر لسه)")}</button>
          {err ? <p className="text-[12.5px] text-red-600" data-testid="vault-error">{L(err, "الرقم غلط، أو الملف اتغيّر أو باظ")}</p> : null}
        </div>
      ) : (
        <div className="space-y-2 text-[13px]" data-testid="vault-diff">
          <p className={res.check.ok ? "text-emerald-700" : "text-red-600"}>{res.check.ok ? L("Integrity checked: fingerprint, audit log and balance are all good.", "اتأكدنا: البصمة وسجل المراجعة والتوازن سليمين.") : L("This copy fails the integrity check — it will not be restored.", "النسخة دي فشلت في التأكد — مش هتتسترجع.")}</p>
          <p className={th.sub}>{L("Made", "اتعملت")} {fmtDate(res.header.created.slice(0, 10))}</p>
          <Card className="divide-y">{Object.entries(LBL).map(([k, [en, ar]]) => { const d = res.diff.lists[k]; return (
            <div key={k} className="flex justify-between px-3 py-2"><span>{L(en, ar)}</span><span className="tabular-nums" dir="ltr">{d.now} → {d.backup}{d.added ? ` +${d.added}` : ""}{d.removed ? ` −${d.removed}` : ""}{d.changed ? ` ~${d.changed}` : ""}</span></div>); })}</Card>
          {res.diff.same ? <p className={th.sub}>{L("This copy is the same as your books — nothing to restore.", "النسخة دي زي دفاترك بالظبط — مفيش حاجة تتسترجع.")}</p> : null}
        </div>
      )}
    </Sheet>
  );
}

// ---- users and roles ---------------------------------------------------------------------------------------------------
export function UsersSection() {
  const { s, run, flash } = useBooks();
  const th = useTheme();
  const [f, setF] = useState({ name: "", role: s.users && s.users.length ? "cashier" : "owner", pin: "" });
  const add = async () => { const r = await run((st) => O2.saveUser(st, f), L("User saved", "اتحفظ المستخدم")); if (r) { if (!O.getActor()) O.setActor((r.state.users || []).find((u) => u.id === r.id)); setF({ name: "", role: "cashier", pin: "" }); } };
  const P = { post: ["Sell & receive", "بيع وتحصيل"], void: ["Cancel (credit note)", "إلغاء (إشعار دائن)"], prices: ["Change prices", "تغيير الأسعار"], profit: ["See profit", "يشوف الربح"], export: ["Export", "تصدير"], restore: ["Restore", "استرجاع"], users: ["Users & settings", "المستخدمين والإعدادات"] };
  return (
    <Section title={L("Users & roles", "المستخدمين والصلاحيات")}>
      <Card className="divide-y mb-2" testid="users-list">{(s.users || []).map((u) => (
        <div key={u.id} className="flex items-center justify-between px-3 py-2.5 text-[13px]"><span>{u.name} <Badge tone={u.role === "owner" ? "blue" : "gray"}>{L(M.ROLES[u.role].en, M.ROLES[u.role].ar)}</Badge></span>
          {actorCan("users") ? <button onClick={() => run((st) => O2.removeUser(st, u.id))} className="p-1.5 text-red-600" aria-label={L("Remove", "شيل")}><Trash2 size={14} /></button> : null}</div>))}
        {!(s.users || []).length ? <p className={`px-3 py-2.5 text-[12.5px] ${th.sub}`}>{L("One owner, no users. Add the owner first, then the staff — each with their own PIN.", "مالك واحد ومفيش مستخدمين. ضيف المالك الأول، وبعدين الموظفين — كل واحد برقمه السري.")}</p> : null}
      </Card>
      {actorCan("users") ? <div className="grid grid-cols-3 gap-2">
        <Input value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder={L("Name", "الاسم")} data-testid="user-name" />
        <Select value={f.role} onChange={(v) => setF({ ...f, role: v })} data-testid="user-role">{Object.entries(M.ROLES).map(([k, r]) => <option key={k} value={k}>{L(r.en, r.ar)}</option>)}</Select>
        <Input value={f.pin} onChange={(v) => setF({ ...f, pin: v.replace(/\D/g, "").slice(0, 6) })} placeholder={L("PIN", "الرقم السري")} inputMode="numeric" data-testid="user-pin" />
        <button onClick={add} className={`${BTN} border ${th.line} col-span-3`} data-testid="user-add">{L("Add user", "ضيف مستخدم")}</button></div> : null}
      <div className="overflow-x-auto mt-2"><table className="w-full text-[11.5px]" data-testid="perm-matrix"><thead><tr><th className="text-start p-1"></th>{Object.values(M.ROLES).map((r) => <th key={r.en} className="p-1">{L(r.en, r.ar)}</th>)}</tr></thead>
        <tbody>{M.permMatrix().map((row) => <tr key={row.perm} className={`border-t ${th.line}`}><td className="p-1">{L(...P[row.perm])}</td>{Object.keys(M.ROLES).map((k) => <td key={k} className="p-1 text-center">{row[k] ? "✓" : "—"}</td>)}</tr>)}</tbody></table></div>
    </Section>
  );
}
/** The lock screen when the books have users: a PIN finds its user. Returns the PIN so it can key the automatic backup. */
export function UserLock({ s, onOk, onBack }) {
  const th = useTheme();
  const [pin, setPin] = useState(""); const [bad, setBad] = useState(0);
  const tryPin = (v) => { const u = O2.userByPin(s, v); if (u) { O.setActor(u); onOk(v, u); } else setBad((b) => b + 1); };
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-6 ${th.page}`} data-testid="books-lock">
      <p className="text-[15px] font-semibold">{L("Enter your PIN", "اكتب رقمك السري")}</p>
      <input value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); if (v.length >= 4 && O2.userByPin(s, v)) tryPin(v); }} type="password" inputMode="numeric" autoFocus data-testid="books-pin" className={`w-40 text-center tracking-[0.5em] text-xl rounded-lg border px-3 py-2 ${th.input}`} />
      {bad ? <p className="text-[12px] text-red-600">{L("Wrong PIN", "الرقم غلط")}</p> : null}
      <button onClick={() => tryPin(pin)} className={btnPrimary} disabled={pin.length < 4}>{L("Open", "فتح")}</button>
      <button onClick={onBack} className={`text-[12px] ${th.sub}`}>{L("Back", "رجوع")}</button>
    </div>
  );
}

// ---- currencies ----------------------------------------------------------------------------------------------------------
export function CurrencySection() {
  const { s, run } = useBooks();
  const th = useTheme();
  const [f, setF] = useState({ currency: "USD", date: today(), rate: "" });
  const latest = Object.keys(M.CURRENCIES).filter((c) => c !== "EGP").map((c) => [c, M.rateOn(s.fxRates || [], c, today())]);
  return (
    <Section title={L("Currencies (EGP for 1 unit)", "العملات (جنيه لكل وحدة)")}>
      <Card className="divide-y mb-2" testid="fx-list">{latest.map(([c, r]) => <div key={c} className="flex justify-between px-3 py-2 text-[13px]"><span>{c} · {L(M.CURRENCIES[c].en, M.CURRENCIES[c].ar)}</span><span className="tabular-nums" dir="ltr">{r ? M.rateText(r) : "—"}</span></div>)}</Card>
      <div className="grid grid-cols-3 gap-2">
        <Select value={f.currency} onChange={(v) => setF({ ...f, currency: v })} data-testid="fx-cur">{Object.keys(M.CURRENCIES).filter((c) => c !== "EGP").map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        <Input type="date" value={f.date} onChange={(v) => setF({ ...f, date: v })} />
        <Input value={f.rate} onChange={(v) => setF({ ...f, rate: v })} inputMode="decimal" placeholder="48.50" data-testid="fx-rate" />
        <button onClick={() => run((st) => O2.setRate(st, f), L("Rate saved", "اتحفظ السعر")).then((r) => r && setF({ ...f, rate: "" }))} className={`${BTN} border ${th.line} col-span-3`} data-testid="fx-save">{L("Save rate", "احفظ السعر")}</button>
      </div>
    </Section>
  );
}
/** The currency picker inside the invoice editor. value: { currency, rate } */
export function DocCurrency({ d, setD }) {
  const { s } = useBooks();
  const cur = (d.fx && d.fx.currency) || "EGP";
  const pick = (c) => setD((x) => { if (c === "EGP") { const { fx, ...rest } = x; return rest; } return { ...x, fx: { currency: c, rate: M.rateOn(s.fxRates || [], c, x.date) || 0 } }; });
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label={L("Currency", "العملة")}><Select value={cur} onChange={pick} data-testid="doc-currency">{Object.keys(M.CURRENCIES).map((c) => <option key={c} value={c}>{c}</option>)}</Select></Field>
      {cur !== "EGP" ? <Field label={L("Rate (EGP)", "السعر (جنيه)")} hint={!d.fx.rate ? L("Add the rate in Settings → Currencies", "ضيف السعر من الإعدادات ← العملات") : null}><Input value={d.fx.rate ? M.rateText(d.fx.rate) : ""} onChange={(v) => setD((x) => ({ ...x, fx: { ...x.fx, rate: M.toRate5(v) || 0 } }))} inputMode="decimal" data-testid="doc-rate" /></Field> : <div />}
    </div>
  );
}
/** Totals line for a foreign-currency document: own currency and the EGP equivalent. */
export function FxNote({ doc }) {
  const { s } = useBooks();
  if (!doc.fx || !doc.fx.rate) return null;
  const own = B.docTotals(doc.lines.some((l) => l.fxPrice != null) ? M.fxView(doc) : doc, s.tax).total;
  return <p className="text-[12px] text-end" data-testid="fx-note" dir="ltr">{B.fmt(own)} {doc.fx.currency} × {M.rateText(doc.fx.rate)} = {B.fmt(M.toEGP(own, doc.fx.rate))} EGP</p>;
}

// ---- price lists -----------------------------------------------------------------------------------------------------------
export function PriceListSection() {
  const { s, run } = useBooks();
  const th = useTheme();
  const [ed, setEd] = useState(null);
  const groups = [...new Set((s.customers || []).map((c) => c.group).filter(Boolean))];
  return (
    <Section title={L("Price lists", "قوائم الأسعار")}>
      <p className={`text-[12px] mb-2 ${th.sub}`}>{L("Give a customer a group (in the customer's card), then a list for that group. The newest list in force on the invoice date wins; quantity breaks lower the price.", "ادّي العميل مجموعة (في بطاقة العميل)، وبعدين قائمة للمجموعة دي. أحدث قائمة سارية في تاريخ الفاتورة هي اللي بتتطبّق؛ وشرائح الكمية بتنزّل السعر.")}</p>
      <Card className="divide-y mb-2" testid="pl-list">{(s.priceLists || []).map((l) => <button key={l.id} onClick={() => setEd(l)} className="w-full flex justify-between px-3 py-2.5 text-[13px] text-start"><span>{l.name} · {l.group}</span><span className={th.sub}>{l.from ? fmtDate(l.from) : "…"} → {l.to ? fmtDate(l.to) : "…"}</span></button>)}</Card>
      <button onClick={() => setEd({ name: "", group: groups[0] || "", from: today(), to: "", prices: {} })} className={`${BTN} border ${th.line} flex items-center gap-1.5`} data-testid="pl-add"><Plus size={14} />{L("New price list", "قائمة أسعار جديدة")}</button>
      {ed ? <PriceListEditor list={ed} onClose={() => setEd(null)} /> : null}
    </Section>
  );
}
function PriceListEditor({ list, onClose }) {
  const { s, run } = useBooks();
  const th = useTheme();
  const [l, setL] = useState(list);
  const [rows, setRows] = useState(() => { const r = []; for (const [item, br] of Object.entries(list.prices || {})) for (const b of br) r.push({ item, minQty: String(b.minQty || 0), price: (b.price / 100).toFixed(2) }); return r.length ? r : [{ item: (s.items[0] || {}).id || "", minQty: "0", price: "" }]; });
  const save = async () => {
    const prices = {};
    for (const r of rows) if (r.item && B.toMinor(r.price) != null) (prices[r.item] = prices[r.item] || []).push({ minQty: Number(r.minQty) || 0, price: B.toMinor(r.price) });
    const out = await run((st) => O2.savePriceList(st, { ...l, prices }), L("Price list saved", "اتحفظت القائمة"));
    if (out) onClose();
  };
  return (
    <Sheet title={l.name || L("Price list", "قائمة أسعار")} onClose={onClose} testid="pl-editor" footer={<button onClick={save} className={`${btnPrimary} w-full`} data-testid="pl-save">{L("Save", "حفظ")}</button>}>
      <div className="space-y-2">
        <Field label={L("Name", "الاسم")}><Input value={l.name} onChange={(v) => setL({ ...l, name: v })} data-testid="pl-name" /></Field>
        <Field label={L("Customer group", "مجموعة العملاء")}><Input value={l.group} onChange={(v) => setL({ ...l, group: v })} data-testid="pl-group" /></Field>
        <div className="grid grid-cols-2 gap-2"><Field label={L("From", "من")}><Input type="date" value={l.from || ""} onChange={(v) => setL({ ...l, from: v })} /></Field><Field label={L("To (optional)", "إلى (اختياري)")}><Input type="date" value={l.to || ""} onChange={(v) => setL({ ...l, to: v })} /></Field></div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_90px_auto] gap-1.5 items-end">
            <Select value={r.item} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, item: v } : x)))} data-testid="pl-item">{s.items.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}</Select>
            <Input value={r.minQty} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, minQty: v } : x)))} inputMode="decimal" placeholder={L("from qty", "من كمية")} data-testid="pl-min" />
            <Input value={r.price} onChange={(v) => setRows(rows.map((x, j) => (j === i ? { ...x, price: v } : x)))} inputMode="decimal" placeholder={L("price", "السعر")} data-testid="pl-price" />
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-2 text-red-600" aria-label={L("Remove", "شيل")}><Trash2 size={14} /></button>
          </div>))}
        <button onClick={() => setRows([...rows, { item: (s.items[0] || {}).id || "", minQty: "0", price: "" }])} className={`${BTN} border ${th.line} w-full`} data-testid="pl-row-add">{L("Add a price", "ضيف سعر")}</button>
      </div>
    </Sheet>
  );
}

// ---- delivery notes ------------------------------------------------------------------------------------------------------------
export function DeliveryButton({ doc }) {
  const th = useTheme();
  const [open, setOpen] = useState(false);
  return (<>
    <button onClick={() => setOpen(true)} className={`${BTN} border ${th.line} flex items-center gap-1.5`} data-testid="doc-delivery"><Truck size={14} />{L("Delivery note", "إذن تسليم")}</button>
    {open ? <DeliverySheet doc={doc} onClose={() => setOpen(false)} /> : null}
  </>);
}
function DeliverySheet({ doc, onClose }) {
  const { s, run, flash, saveFile } = useBooks();
  const th = useTheme();
  const info = useMemo(() => { try { return O2.toDeliver(s, doc.id); } catch (e) { return { left: [] }; } }, [s, doc.id]);
  const [qty, setQty] = useState(() => Object.fromEntries(info.left.map((x) => [x.line, String(x.left)])));
  const [date, setDate] = useState(today()); const [driver, setDriver] = useState("");
  const notes = (s.deliveries || []).filter((n) => n.source === doc.number);
  const post = async () => {
    const r = await run((st) => O2.postDelivery(st, { docId: doc.id, date, driver, lines: info.left.map((x) => ({ line: x.line, qty: Number(qty[x.line]) || 0 })) }), L("Delivery note posted", "اتسجّل إذن التسليم"));
    if (r) { const note = r.state.deliveries.find((n) => n.id === r.id); shareDelivery({ s: r.state, note, flash }); }
  };
  const left = info.left.some((x) => x.left > 0);
  return (
    <Sheet title={L("Delivery note", "إذن تسليم") + " · " + doc.number} onClose={onClose} testid="delivery-sheet" footer={left ? <button onClick={post} className={`${btnPrimary} w-full`} data-testid="delivery-post">{L("Post & share", "سجّل وشارك")}</button> : null}>
      <div className="space-y-2">
        {info.left.map((x) => (
          <Card key={x.line} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0 text-[13px]"><p className="truncate font-medium">{x.desc || (s.items.find((i) => i.id === x.item) || {}).name}</p><p className={`text-[11.5px] ${th.sub}`}>{L("ordered", "المطلوب")} {x.ordered} · {L("delivered", "اتسلّم")} {x.delivered} · {L("left", "الباقي")} {x.left}</p></div>
            <div className="w-20"><Input value={qty[x.line] ?? ""} onChange={(v) => setQty({ ...qty, [x.line]: v })} inputMode="decimal" data-testid="delivery-qty" /></div>
          </Card>))}
        {left ? <div className="grid grid-cols-2 gap-2"><Field label={L("Date", "التاريخ")}><Input type="date" value={date} onChange={setDate} /></Field><Field label={L("Driver", "السائق")}><Input value={driver} onChange={setDriver} /></Field></div>
          : <p className={`text-[12.5px] ${th.sub}`} data-testid="delivery-done">{L("Everything has been delivered.", "كله اتسلّم.")}</p>}
        {doc.type === "invoice" ? <p className={`text-[11.5px] ${th.sub}`}>{L("The stock left when the invoice was posted; the note records the delivery.", "المخزون نزل لما الفاتورة اترحّلت؛ الإذن بيسجّل التسليم بس.")}</p> : <p className={`text-[11.5px] ${th.sub}`}>{L("Goods leave stock with this note.", "البضاعة بتخرج من المخزون بالإذن ده.")}</p>}
        {notes.length ? <Section title={L("Notes already sent", "أذونات اتعملت")}><Card className="divide-y" testid="delivery-list">{notes.map((n) => (
          <div key={n.id} className="flex items-center justify-between px-3 py-2 text-[13px]"><span>{n.number} · {fmtDate(n.date)}</span><span className="flex gap-1.5">
            <button onClick={() => shareDelivery({ s, note: n, flash })} className={`${BTN} border ${th.line} !py-1`}>PDF</button>
            <button onClick={() => shareDeliveryWord({ s, note: n, flash, saveFile })} className={`${BTN} border ${th.line} !py-1`}>{L("Word", "وورد")}</button></span></div>))}</Card></Section> : null}
      </div>
    </Sheet>
  );
}
