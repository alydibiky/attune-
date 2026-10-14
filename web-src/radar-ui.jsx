/* ---- v6.27: the Deadline Radar page (design A "Calm") — see deadlines.js ---------------------------------------------------
   Automatic first: payment/app notifications are read by themselves (runAutoRadar at app open and on every return; the sure
   ones are added and reminded, the others wait here as suggestions). Then three ways in by hand: scan a receipt or document
   (the phone reads it), paste or type a sentence, or "Add by hand" (a form). Each item gets a reminder before its deadline;
   "Cancelled it" / "Returned it" / "Claimed" count in the Guardian's honest "saved" counter.
   Free: 3 active deadlines; Pro: as many as you like, plus the receipt vault. Tests: tests/e2e_v727radar.py.            */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Radar, Camera, ClipboardPaste, Plus, Search, Trash2, Check, X, Bell, Crown, FileText } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as D from "./deadlines.js";
import { homeCurrency, dateOrder } from "./locale.js";
import { loadGuardian, saveGuardian, markSaved, savedTotals } from "./guardian.js";
import { fmt } from "./money-calm.js";
import * as O from "./owed.js";
import { openOwed } from "./owed-ui.jsx";

const KIND_LABEL = { trial: "Free trial", renewal: "Renewal", return: "Return window", warranty: "Warranty", expiry: "Document expiry", other: "Other" };
const DOC_LABEL = { passport: "Passport", visa: "Visa", licence: "Driving licence", id: "ID card", insurance: "Insurance", registration: "Car registration", card: "Bank card" };
const DONE_ACTS = { trial: [["cancelled", "Cancelled it"], ["kept", "Keep it"]], renewal: [["cancelled", "Cancelled it"], ["renewed", "Let it renew"]],
  return: [["returned", "Returned it"], ["kept", "Keep it"]], warranty: [["claimed", "Claimed"], ["kept", "Ended"]], expiry: [["renewed", "Renewed it"]], other: [["kept", "Done"]] };
const opts = () => ({ now: Date.now(), home: homeCurrency(), order: dateOrder() });

// ---- receipt photos: kept on the phone in IndexedDB (never in the backup text, never online) ----
const PDB = "attune-radar", PST = "photos";
function pdb() { return new Promise((ok, no) => { try { const r = indexedDB.open(PDB, 1); r.onupgradeneeded = () => r.result.createObjectStore(PST); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); } catch (e) { no(e); } }); }
export async function putPhoto(key, dataUrl) { try { const db = await pdb(); await new Promise((ok) => { const t = db.transaction(PST, "readwrite"); t.objectStore(PST).put(dataUrl, key); t.oncomplete = ok; t.onerror = ok; }); } catch (e) {} }
async function getPhoto(key) { try { const db = await pdb(); return await new Promise((ok) => { const r = db.transaction(PST).objectStore(PST).get(key); r.onsuccess = () => ok(r.result || ""); r.onerror = () => ok(""); }); } catch (e) { return ""; } }
async function delPhoto(key) { try { const db = await pdb(); db.transaction(PST, "readwrite").objectStore(PST).delete(key); } catch (e) {} }
/** A picture file → a JPEG data URL no wider than 1400 px (small enough to keep, sharp enough to read). */
function shrink(file) {
  return new Promise((ok, no) => {
    const fr = new FileReader();
    fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1400 / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", 0.8)); }; img.onerror = () => ok(fr.result); img.src = fr.result; };
    fr.onerror = () => no(fr.error); fr.readAsDataURL(file);
  });
}

// ---- automatic: notifications → deadlines (app open, every return) ----
/** Adds the sure deadlines found in the phone's notifications (a trial or renewal with its date, from the notification
 *  itself), schedules their reminders, and keeps the rest as suggestions. Respects the Free limit. → how many were added. */
export function runAutoRadar(N, { pro, remind } = {}) {
  if (!N || !N.payQueue) return 0;
  let q = []; try { q = JSON.parse(N.payQueue() || "[]"); } catch (e) {}
  let data = D.loadRadar();
  const found = D.fromNotifications(q, data.seen, opts());
  if (!found.length) return 0;
  let added = 0;
  for (const f of found) {
    const active = data.items.filter((x) => x.status !== "done").length;
    if (f.confidence !== "high" || (!pro && active >= D.FREE_LIMIT) || f.date < D.isoDay(Date.now())) continue;
    const r = D.addDeadline(data, { ...f, source: "notification" });
    data = D.markSeen(r.data, [f.nid]);
    if (!r.dup) { added++; const rem = D.radarReminder(r.item); if (rem && remind) remind(rem); }
  }
  D.saveRadar(data);
  if (added) { try { localStorage.setItem("attune:radar:auto", String(added + (+localStorage.getItem("attune:radar:auto") || 0))); } catch (e) {} }
  return added;
}

/** The form: an item to check or edit, or a new one by hand. */
function Form({ init, onSave, onCancel, photo }) {
  const [f, setF] = useState(() => ({ kind: "trial", title: "", date: "", amount: "", currency: homeCurrency(), doc: "", note: "", ...init, amount: init && init.amount ? String(init.amount) : "" }));
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const field = "w-full rounded-lg px-3 py-2 text-[14px] border bg-transparent";
  const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(f.date);
  return (
    <div className="c-card space-y-2.5" data-testid="radar-form">
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(KIND_LABEL).map((k) => <button key={k} onClick={() => set("kind", k)} className="c-pill" aria-pressed={f.kind === k} style={f.kind === k ? { background: "var(--c-acc)", color: "#fff" } : {}} data-testid={"radar-kind-" + k}>{tr(KIND_LABEL[k])}</button>)}
      </div>
      {f.kind === "expiry" ? (
        <select value={f.doc} onChange={(e) => { set("doc", e.target.value); if (!f.title && e.target.value) set("title", tr(DOC_LABEL[e.target.value])); }} className={field} style={st} data-testid="radar-doc">
          <option value="">{tr("Which document?")}</option>
          {Object.keys(DOC_LABEL).map((k) => <option key={k} value={k}>{tr(DOC_LABEL[k])}</option>)}
        </select>) : null}
      <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={tr("What is it? (Netflix, the TV, my passport…)")} className={field} style={st} dir="auto" data-testid="radar-title" />
      <label className="block"><span className="c-lbl">{f.kind === "trial" ? tr("Trial ends on") : f.kind === "renewal" ? tr("Renews on") : f.kind === "return" ? tr("Last day to return") : f.kind === "warranty" ? tr("Warranty ends on") : f.kind === "expiry" ? tr("Expires on") : tr("Date")}</span>
        <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} style={st} data-testid="radar-date" /></label>
      <div className="flex gap-2">
        <input value={f.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder={tr("Amount (optional)")} className={field} style={st} data-testid="radar-amount" />
        <input value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} className={field + " max-w-[5.5rem]"} style={st} aria-label={tr("Currency")} />
      </div>
      <input value={f.note} onChange={(e) => set("note", e.target.value)} placeholder={tr("Note (optional): order number, where to cancel…")} className={field} style={st} dir="auto" />
      {photo ? <img src={photo} alt="" className="max-h-28 rounded-lg" /> : null}
      <div className="flex gap-2 pt-1">
        <button className="c-btn" disabled={!okDate || !f.title.trim()} style={!okDate || !f.title.trim() ? { opacity: 0.5 } : {}} onClick={() => onSave({ ...f, amount: parseFloat(String(f.amount).replace(",", ".")) || 0, title: f.title.trim() })} data-testid="radar-save">{tr("Save and remind me")}</button>
        <button className="c-sub px-2" onClick={onCancel}>{tr("Cancel")}</button>
      </div>
    </div>);
}

function Item({ x, onDone, onEdit, onDelete }) {
  const left = D.daysLeft(x), [img, setImg] = useState("");
  const when = left < 0 ? tr("{n} days ago", { n: -left }) : left === 0 ? tr("today") : left === 1 ? tr("tomorrow") : left < 60 ? tr("in {n} days", { n: left }) : left < 730 ? tr("in {n} months", { n: Math.round(left / 30.4) }) : tr("in {n} years", { n: Math.round(left / 365) });
  return (
    <div className="c-card" data-testid="radar-item">
      <div className="flex items-start gap-3">
        <div className="c-ic"><Bell size={16} /></div>
        <div className="flex-1 min-w-0">
          <b className="block" dir="auto">{x.title || tr(KIND_LABEL[x.kind])}</b>
          <div className="c-sub text-[12.5px]">{tr(KIND_LABEL[x.kind])}{x.doc ? " · " + tr(DOC_LABEL[x.doc] || x.doc) : ""} · {x.date}{x.amount ? " · " + fmt(x.amount) + " " + (x.currency || "") : ""}</div>
        </div>
        <span className={"c-pill " + (left <= 2 ? "late" : left <= D.alertDays(x) ? "due" : "")} data-testid="radar-when">{x.status === "done" ? tr("done") : when}</span>
      </div>
      {x.note ? <p className="c-sub text-[12.5px] mt-1.5" dir="auto">{x.note}</p> : null}
      {img ? <img src={img} alt="" className="mt-2 max-h-64 rounded-lg" /> : null}
      {x.status !== "done" ? (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {(DONE_ACTS[x.kind] || DONE_ACTS.other).map(([o, l], i) => <button key={o} className={i === 0 ? "c-btn" : "c-sub px-1"} onClick={() => onDone(x, o)} data-testid={"radar-" + o}>{i === 0 ? <Check size={14} className="inline -mt-0.5 me-1" /> : null}{tr(l)}</button>)}
          {D.cancelLink(x) ? <button className="c-sub px-1" onClick={() => window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: D.cancelLink(x), plan: null, inApp: false } }))} data-testid="radar-cancel-page">{tr("Where to cancel")}</button> : null}
          {x.kind === "return" || x.kind === "warranty" ? <button className="c-sub px-1" onClick={() => openOwed({ letter: { title: x.kind === "return" ? "Return request" : "Warranty claim", text: x.kind === "return" ? O.returnLetter(x, { lang: getLang() === "ar" ? "ar" : "en" }) : O.warrantyLetter(x, { lang: getLang() === "ar" ? "ar" : "en" }) } })} data-testid="radar-letter">{tr("Write the request")}</button> : null}
          <button className="c-sub px-1" onClick={() => onEdit(x)} data-testid="radar-edit">{tr("Edit")}</button>
          {x.photo ? <button className="c-sub px-1" onClick={async () => setImg(img ? "" : await getPhoto(x.photo))} data-testid="radar-photo">{img ? tr("Hide receipt") : tr("Receipt")}</button> : null}
          <button className="c-sub px-1 ms-auto" aria-label={tr("Delete")} onClick={() => onDelete(x)}><Trash2 size={14} /></button>
        </div>) : null}
    </div>);
}

export function RadarPage({ pro, openPlan, flash, N, readText, ask, remind, unremind }) {
  const [data, setData] = useState(() => D.loadRadar());
  const put = (d) => setData(D.saveRadar(d));
  const [mode, setMode] = useState(null);        // null | "paste" | "form"
  const [drafts, setDrafts] = useState([]);       // found in a paste / photo, to check
  const [edit, setEdit] = useState(null);         // an item or a draft in the form
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const fileRef = useRef(null);
  const [sugg, setSugg] = useState([]);
  const [access, setAccess] = useState(() => { try { return !!(N && N.payAccess && N.payAccess()); } catch (e) { return false; } });
  const V = D.radarView(data);
  const radarSaved = (loadGuardian().saved || []).filter((s) => s.kind === "radar").reduce((a, s) => a + s.amount, 0);
  const auto = (() => { try { return +localStorage.getItem("attune:radar:auto") || 0; } catch (e) { return 0; } })();
  const full = !pro && V.active >= D.FREE_LIMIT;

  // the notifications not added by themselves (unsure ones, or over the Free limit) → suggestions
  const scan = () => {
    try { setAccess(!!(N && N.payAccess && N.payAccess())); } catch (e) {}
    runAutoRadar(N, { pro, remind });
    const d = D.loadRadar(); setData(d);
    let qq = []; try { qq = JSON.parse((N && N.payQueue && N.payQueue()) || "[]"); } catch (e) {}
    setSugg(D.fromNotifications(qq, d.seen, opts()).filter((f) => f.date >= D.isoDay(Date.now())));
  };
  useEffect(() => {
    scan();
    // from Chat: «my Netflix trial ends on 20 November» → Watch it
    let t0 = ""; try { t0 = localStorage.getItem("attune:radar:ask") || ""; localStorage.removeItem("attune:radar:ask"); } catch (e) {}
    if (t0) { setText(t0); read(t0); }
    const f = () => scan(); document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f);
  }, []);

  const saveOne = (d0, ph) => {
    if (full) { openPlan && openPlan(); return null; }
    const r = D.addDeadline(D.loadRadar(), { ...d0, photo: ph || d0.photo || "" });
    put(r.data);
    if (!r.dup) { const rem = D.radarReminder(r.item); if (rem && remind) remind(rem); }
    flash && flash(r.dup ? tr("Already on your Radar") : tr("Saved — Attune reminds you before it"));
    return r.item;
  };
  const read = async (t) => {
    let found = D.readDeadlines(t, opts());
    if (!found.length && ask) { setBusy(tr("Reading…")); try { found = D.readDeadlineModel(await ask(D.deadlineModelPrompt(t)), opts()); } catch (e) { found = []; } setBusy(""); }
    if (!found.length) { setEdit({ note: t.slice(0, 200) }); setMode("form"); flash && flash(tr("No date found — fill it in")); return; }
    setDrafts(found.map((x, i) => ({ ...x, note: x.note || "", _k: Date.now() + ":" + i }))); setMode(null);
  };
  const onPhoto = async (file) => {
    if (!file) return;
    setBusy(tr("Reading the photo…"));
    let url = ""; try { url = await shrink(file); } catch (e) {}
    const key = "p" + Date.now().toString(36);
    if (url) { await putPhoto(key, url); setPhoto(url); }
    let txt = "";
    try { if (readText && url) { const r = await readText(url.split(",")[1]); txt = (r && r.text) || ""; } } catch (e) {}
    setBusy("");
    const found = txt ? D.readDeadlines(txt, opts()) : [];
    if (found.length) setDrafts(found.map((x, i) => ({ ...x, photo: key, source: "photo", _k: key + ":" + i })));
    else { setEdit({ photo: key, source: "photo", note: txt.slice(0, 160) }); setMode("form"); flash && flash(tr("Couldn't find a date in the photo — fill it in, the photo is kept")); }
  };
  const done = (x, outcome) => {
    const r = D.resolveDeadline(data, x.id, outcome); put(r.data);
    unremind && unremind("radar-" + x.id);
    if (r.saved > 0) { saveGuardian(markSaved(loadGuardian(), { id: "radar:" + x.id, kind: "radar", amount: r.saved, title: x.title })); flash && flash(tr("Counted as saved: {a}", { a: fmt(r.saved) + " " + (x.currency || "") })); }
  };
  const del = (x) => { if (!window.confirm(tr("Delete this?"))) return; put(D.removeDeadline(data, x.id)); unremind && unremind("radar-" + x.id); if (x.photo) delPhoto(x.photo); };
  const search = q.trim().toLowerCase();
  const match = (x) => !search || [x.title, x.note, x.doc, KIND_LABEL[x.kind]].join(" ").toLowerCase().includes(search);

  return (
    <div className="calm rounded-2xl p-4 md:p-6 space-y-4" style={{ minHeight: "70vh" }} data-testid="radar-page">
      <div><h2 className="text-[22px] font-bold m-0 flex items-center gap-2"><Radar size={20} className="c-acc" />{tr("Deadline Radar")}</h2>
        <p className="c-sub m-0">{tr("Free trials, renewals, returns, warranties and documents — Attune warns you before each one. Everything stays on this phone.")}</p></div>

      {radarSaved > 0 || auto > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="c-card"><span className="c-lbl">{tr("Saved by the Radar")}</span><div className="c-amt" data-testid="radar-saved">{fmt(radarSaved)}</div></div>
          <div className="c-card"><span className="c-lbl">{tr("Added by itself")}</span><div className="c-amt">{auto}</div></div>
        </div>) : null}

      {/* automatic */}
      {N && N.payAccess && !access ? (
        <div className="c-card" data-testid="radar-access"><b className="flex items-center gap-2"><Bell size={15} className="c-acc" />{tr("Find deadlines by itself")}</b>
          <p className="c-sub text-[13px] mt-1">{tr("Turn on notification access and the Radar catches free trials and renewals from your apps and bank by itself. Nothing leaves the phone.")}</p>
          <button className="c-btn mt-2" onClick={() => { try { N.openPayAccess(); } catch (e) {} }}>{tr("Turn on")}</button></div>
      ) : null}
      {sugg.length ? (
        <div className="c-card space-y-2" data-testid="radar-suggestions"><span className="c-lbl">{tr("Found in your notifications")}</span>
          {sugg.slice(0, 8).map((s) => (
            <div key={s.nid + s.kind} className="flex items-center gap-2" data-testid="radar-sugg">
              <span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{s.title || tr(KIND_LABEL[s.kind])}</b><span className="c-sub text-[12px]">{tr(KIND_LABEL[s.kind])} · {s.date}{s.app ? " · " + s.app : ""}</span></span>
              <button className="c-btn" onClick={() => { if (saveOne(s)) { put(D.markSeen(D.loadRadar(), [s.nid])); setSugg((x) => x.filter((y) => y !== s)); } }} data-testid="radar-sugg-keep">{tr("Keep")}</button>
              <button className="c-sub" aria-label={tr("Not this")} onClick={() => { put(D.markSeen(data, [s.nid])); setSugg((x) => x.filter((y) => y !== s)); }}><X size={15} /></button>
            </div>))}
        </div>) : null}

      {/* by hand */}
      <div className="grid grid-cols-3 gap-2">
        <button className="c-card text-center py-3" onClick={() => (full ? openPlan && openPlan() : fileRef.current && fileRef.current.click())} data-testid="radar-scan"><Camera size={18} className="c-acc mx-auto" /><span className="block text-[12.5px] mt-1">{tr("Scan a receipt")}</span></button>
        <button className="c-card text-center py-3" onClick={() => (full ? openPlan && openPlan() : setMode(mode === "paste" ? null : "paste"))} data-testid="radar-paste"><ClipboardPaste size={18} className="c-acc mx-auto" /><span className="block text-[12.5px] mt-1">{tr("Paste or type")}</span></button>
        <button className="c-card text-center py-3" onClick={() => { if (full) { openPlan && openPlan(); return; } setEdit({}); setMode("form"); }} data-testid="radar-add"><Plus size={18} className="c-acc mx-auto" /><span className="block text-[12.5px] mt-1">{tr("Add by hand")}</span></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="radar-file" />
      {full ? (
        <button className="c-card w-full text-start" onClick={openPlan} data-testid="radar-limit"><b className="flex items-center gap-2"><Crown size={15} className="c-warn" />{tr("Free watches {n} deadlines", { n: D.FREE_LIMIT })}</b>
          <span className="c-sub text-[13px]">{tr("Pro watches all of them and keeps your receipts — one cancelled trial usually pays for it.")}</span></button>) : null}
      {busy ? <p className="c-sub" data-testid="radar-busy">{busy}</p> : null}
      {mode === "paste" ? (
        <div className="c-card space-y-2">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={tr("Paste an email or message, or type: “my Netflix trial ends on 20 November”")} className="w-full rounded-lg px-3 py-2 text-[14px] border bg-transparent" style={{ borderColor: "var(--c-ln)", color: "var(--c-ink)" }} dir="auto" data-testid="radar-text" />
          <button className="c-btn" disabled={!text.trim()} onClick={() => read(text)} data-testid="radar-read">{tr("Find the deadline")}</button>
        </div>) : null}
      {drafts.map((d, i) => (
        <div key={d._k || i}><span className="c-lbl">{tr("Check it, then save")}</span>
          <Form init={d} photo={i === 0 ? photo : ""} onCancel={() => setDrafts((x) => x.filter((y) => y !== d))}
            onSave={(f) => { const { _k, ...rest } = { ...d, ...f }; if (saveOne(rest)) setDrafts((x) => x.filter((y) => y !== d)); }} /></div>))}
      {mode === "form" && edit ? (
        <Form init={edit} photo={edit.photo && photo ? photo : ""} onCancel={() => { setMode(null); setEdit(null); }}
          onSave={(f) => {
            if (edit.id) { const d = D.updateDeadline(data, edit.id, { ...f }); put(d); const it = d.items.find((x) => x.id === edit.id); unremind && unremind("radar-" + edit.id); const rem = D.radarReminder(it); if (rem && remind) remind(rem); flash && flash(tr("Saved")); }
            else saveOne({ ...edit, ...f, source: edit.source || "manual" });
            setMode(null); setEdit(null); setPhoto(""); }} />) : null}

      {data.items.length > 3 ? (
        <div className="flex items-center gap-2 c-card py-2"><Search size={15} className="c-sub" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a receipt or document…")} className="flex-1 bg-transparent outline-none text-[14px]" style={{ color: "var(--c-ink)" }} data-testid="radar-search" /></div>) : null}
      {!V.soon.length && !V.later.length && !drafts.length && mode !== "form" ? (
        <p className="c-sub" data-testid="radar-empty">{tr("Nothing to watch yet. Scan a receipt, paste a trial email, or add a passport or warranty by hand.")}</p>) : null}
      {[["Soon", V.soon], ["Later", V.later], ["Done", V.done.slice(0, 20)]].map(([h, list]) => list.filter(match).length ? (
        <div key={h} className="space-y-2" data-testid={"radar-" + h.toLowerCase()}><span className="c-lbl">{tr(h)}</span>
          {list.filter(match).map((x) => <Item key={x.id} x={x} onDone={done} onEdit={(it) => { setEdit(it); setMode("form"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }} onDelete={del} />)}
        </div>) : null)}
    </div>);
}
