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
import { payReader, openAccess, RestrictedHelp } from "./paylog-ui.jsx";
import { LEFT, RIGHT, DeskEmpty } from "./desk.jsx";
import * as U from "./ui-kit.jsx";

const KIND_LABEL = { trial: "Free trial", renewal: "Renewal", return: "Return window", warranty: "Warranty", expiry: "Document expiry", other: "Other" };
const DOC_LABEL = { passport: "Passport", visa: "Visa", licence: "Driving licence", id: "ID card", insurance: "Insurance", registration: "Car registration", card: "Bank card" };
const DONE_ACTS = { trial: [["cancelled", "Cancelled it"], ["kept", "Keep it"]], renewal: [["cancelled", "Cancelled it"], ["renewed", "Let it renew"]],
  return: [["returned", "Returned it"], ["kept", "Keep it"]], warranty: [["claimed", "Claimed"], ["kept", "Ended"]], expiry: [["renewed", "Renewed it"]], other: [["kept", "Done"]] };
// v6.27 computer layout A: a narrower left panel here, so the deadlines on the right fit two cards side by side
const PANES_N = "lg:grid lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)] lg:gap-6 lg:items-start";
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
  const field = U.inp;
  const st = undefined;
  const okDate = /^\d{4}-\d{2}-\d{2}$/.test(f.date);
  return (
    <div className={U.cardPad + " space-y-2.5"} data-testid="radar-form">
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(KIND_LABEL).map((k) => <button key={k} onClick={() => set("kind", k)} className={U.chip(f.kind === k)} aria-pressed={f.kind === k} data-testid={"radar-kind-" + k}>{tr(KIND_LABEL[k])}</button>)}
      </div>
      {f.kind === "expiry" ? (
        <select value={f.doc} onChange={(e) => { set("doc", e.target.value); if (!f.title && e.target.value) set("title", tr(DOC_LABEL[e.target.value])); }} className={field} style={st} data-testid="radar-doc">
          <option value="">{tr("Which document?")}</option>
          {Object.keys(DOC_LABEL).map((k) => <option key={k} value={k}>{tr(DOC_LABEL[k])}</option>)}
        </select>) : null}
      <input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={tr("What is it? (Netflix, the TV, my passport…)")} className={field} style={st} dir="auto" data-testid="radar-title" />
      <label className="block space-y-1"><span className={U.label}>{f.kind === "trial" ? tr("Trial ends on") : f.kind === "renewal" ? tr("Renews on") : f.kind === "return" ? tr("Last day to return") : f.kind === "warranty" ? tr("Warranty ends on") : f.kind === "expiry" ? tr("Expires on") : tr("Date")}</span>
        <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} className={field} style={st} data-testid="radar-date" /></label>
      <div className="flex gap-2">
        <input value={f.amount} onChange={(e) => set("amount", e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" placeholder={tr("Amount (optional)")} className={field} style={st} data-testid="radar-amount" />
        <input value={f.currency} onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))} className={field + " max-w-[5.5rem]"} style={st} aria-label={tr("Currency")} />
      </div>
      <input value={f.note} onChange={(e) => set("note", e.target.value)} placeholder={tr("Note (optional): order number, where to cancel…")} className={field} style={st} dir="auto" />
      {photo ? <img src={photo} alt="" className="max-h-28 rounded-[12px] border border-[var(--c-ln)]" /> : null}
      <div className="flex gap-2 pt-1">
        <button className={U.btnP} disabled={!okDate || !f.title.trim()} onClick={() => onSave({ ...f, amount: parseFloat(String(f.amount).replace(",", ".")) || 0, title: f.title.trim() })} data-testid="radar-save">{tr("Save and remind me")}</button>
        <button className={U.btnS} onClick={onCancel}>{tr("Cancel")}</button>
      </div>
    </div>);
}

function Item({ x, onDone, onEdit, onDelete }) {
  const left = D.daysLeft(x), [img, setImg] = useState(""), [kit, setKit] = useState(false), [copied, setCopied] = useState(false);
  const K = kit ? D.cancelKit(x, getLang() === "ar" ? "ar" : "en") : null;
  const when = left < 0 ? tr("{n} days ago", { n: -left }) : left === 0 ? tr("today") : left === 1 ? tr("tomorrow") : left < 60 ? tr("in {n} days", { n: left }) : left < 730 ? tr("in {n} months", { n: Math.round(left / 30.4) }) : tr("in {n} years", { n: Math.round(left / 365) });
  return (
    <div className={U.cardPad} data-testid="radar-item">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Bell size={17} /></div>
        <div className="flex-1 min-w-0">
          <b className="block font-extrabold text-[14.5px]" dir="auto">{x.title || tr(KIND_LABEL[x.kind])}</b>
          <div className={"text-[12.5px] tabular-nums " + U.muted}>{tr(KIND_LABEL[x.kind])}{x.doc ? " · " + tr(DOC_LABEL[x.doc] || x.doc) : ""} · {x.date}{x.amount ? " · " + fmt(x.amount) + " " + (x.currency || "") : ""}</div>
        </div>
        <span className={U.tag(x.status === "done" ? "gray" : left <= 2 ? "red" : left <= D.alertDays(x) ? "amber" : "green")} data-testid="radar-when">{x.status === "done" ? tr("done") : when}</span>
      </div>
      {x.note ? <p className={"text-[12.5px] mt-1.5 " + U.muted} dir="auto">{x.note}</p> : null}
      {img ? <img src={img} alt="" className="mt-2 max-h-64 rounded-[12px] border border-[var(--c-ln)]" /> : null}
      {x.status !== "done" ? (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {(DONE_ACTS[x.kind] || DONE_ACTS.other).map(([o, l], i) => <button key={o} className={i === 0 ? U.btnP : U.btnS} onClick={() => onDone(x, o)} data-testid={"radar-" + o}>{i === 0 ? <Check size={14} /> : null}{tr(l)}</button>)}
          {D.cancelLink(x) ? <button className={U.btnS} onClick={() => window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: D.cancelLink(x), plan: null, inApp: false } }))} data-testid="radar-cancel-page">{tr("Where to cancel")}</button> : null}
          {x.kind === "trial" || x.kind === "renewal" ? <button className={U.btnS} onClick={() => setKit(!kit)} aria-expanded={kit} data-testid="radar-kit">{tr("Cancel kit")}</button> : null}
          {x.kind === "return" || x.kind === "warranty" ? <button className={U.btnS} onClick={() => openOwed({ letter: { title: x.kind === "return" ? "Return request" : "Warranty claim", text: x.kind === "return" ? O.returnLetter(x, { lang: getLang() === "ar" ? "ar" : "en" }) : O.warrantyLetter(x, { lang: getLang() === "ar" ? "ar" : "en" }) } })} data-testid="radar-letter">{tr("Write the request")}</button> : null}
          <button className={U.btnS} onClick={() => onEdit(x)} data-testid="radar-edit">{tr("Edit")}</button>
          {x.photo ? <button className={U.btnS} onClick={async () => setImg(img ? "" : await getPhoto(x.photo))} data-testid="radar-photo">{img ? tr("Hide receipt") : tr("Receipt")}</button> : null}
          <button className={U.btnS + " ms-auto w-11 px-0 " + U.muted} aria-label={tr("Delete")} onClick={() => onDelete(x)}><Trash2 size={14} /></button>
        </div>) : null}
      {/* v6.37 (M5): the cancel kit — the steps and a ready message */}
      {K ? (
        <div className="mt-2.5 rounded-[20px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 text-[12.5px] grid gap-2" data-testid="radar-kit-panel">
          <ol className="m-0 ps-5 grid gap-1">{K.steps.map((st, i) => <li key={i} dir="auto">{st}</li>)}</ol>
          <p className={U.muted} dir="auto" data-testid="radar-kit-msg">{K.message}</p>
          <div className="flex flex-wrap gap-2">
            <button className={U.btnP} onClick={() => { try { navigator.clipboard.writeText(K.message).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }, () => {}); } catch (e) {} }} data-testid="radar-kit-copy">{copied ? tr("Copied") : tr("Copy the message")}</button>
            {K.link ? <button className={U.btnS} onClick={() => window.dispatchEvent(new CustomEvent("attune-agent", { detail: { link: K.link, plan: null, inApp: false } }))}>{tr("Open the page")}</button> : null}
          </div>
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
  // the right panel has something a phone shows (else it keeps no gap, as before)
  const rightHas = data.items.length > 3 || (!V.soon.length && !V.later.length && !drafts.length && mode !== "form") || [V.soon, V.later, V.done.slice(0, 20)].some((l) => l.filter(match).length);

  return (
    <div className={U.page + " rounded-[20px] p-4 md:p-6 space-y-4"} style={{ minHeight: "70vh" }} data-testid="radar-page">
      <div><h2 className={U.h1 + " flex items-center gap-2"}><Radar size={20} className="text-[var(--c-acc)]" />{tr("Deadline Radar")}</h2>
        <p data-intro="" className={"m-0 mt-0.5 text-[13px] lg:max-w-[70ch] " + U.muted}>{tr("Free trials, renewals, returns, warranties and documents — Attune warns you before each one. Everything stays on this phone.")}</p></div>

      {/* v6.27 computer layout A: the counters and the ways in on the left, the deadlines on the right (stacked on a phone) */}
      <div className={PANES_N}><div className={LEFT}>
      {radarSaved > 0 || auto > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <div className={U.card + " p-3.5 space-y-1.5"}><span className={"block text-[12px] font-bold truncate " + U.muted}>{tr("Saved by the Radar")}</span><b className="block tabular-nums text-[clamp(17px,4.6vw,21px)] font-black tracking-tight text-[var(--c-pos)]" dir="ltr" data-testid="radar-saved">{fmt(radarSaved)}</b></div>
          <div className={U.card + " p-3.5 space-y-1.5"}><span className={"block text-[12px] font-bold truncate " + U.muted}>{tr("Added by itself")}</span><b className="block tabular-nums text-[clamp(17px,4.6vw,21px)] font-black tracking-tight" dir="ltr">{auto}</b></div>
        </div>) : null}

      {/* automatic */}
      {payReader(N) && !access ? (
        <div className={U.cardPad} data-testid="radar-access"><b className="flex items-center gap-2 font-extrabold"><Bell size={15} className="text-[var(--c-acc)]" />{tr("Find deadlines by itself")}</b>
          <p className={"text-[13px] mt-1 " + U.muted}>{tr("Turn on notification access and the Radar catches free trials and renewals from your apps and bank by itself. Nothing leaves the phone.")}</p>
          <button className={U.btnP + " mt-2"} onClick={() => openAccess(N)}>{tr("Turn on")}</button><RestrictedHelp N={N} /></div>
      ) : null}
      {sugg.length ? (
        <div className={U.cardPad + " space-y-2"} data-testid="radar-suggestions"><span className={U.label}>{tr("Found in your notifications")}</span>
          {sugg.slice(0, 8).map((s) => (
            <div key={s.nid + s.kind} className="flex items-center gap-2" data-testid="radar-sugg">
              <span className="flex-1 min-w-0"><b className="block text-[14px] font-extrabold" dir="auto">{s.title || tr(KIND_LABEL[s.kind])}</b><span className={"text-[12px] " + U.muted}>{tr(KIND_LABEL[s.kind])} · {s.date}{s.app ? " · " + s.app : ""}</span></span>
              <button className={U.btnP} onClick={() => { if (saveOne(s)) { put(D.markSeen(D.loadRadar(), [s.nid])); setSugg((x) => x.filter((y) => y !== s)); } }} data-testid="radar-sugg-keep">{tr("Keep")}</button>
              <button className={U.btnS + " w-11 px-0 " + U.muted} aria-label={tr("Not this")} onClick={() => { put(D.markSeen(data, [s.nid])); setSugg((x) => x.filter((y) => y !== s)); }}><X size={15} /></button>
            </div>))}
        </div>) : null}

      {/* by hand */}
      <div className="grid grid-cols-3 gap-2">
        <button className={U.card + " text-center py-3 px-1 min-h-[72px] hover:border-[var(--c-acc)]"} onClick={() => (full ? openPlan && openPlan() : fileRef.current && fileRef.current.click())} data-testid="radar-scan"><Camera size={18} className="text-[var(--c-acc)] mx-auto" /><span className="block text-[12.5px] font-bold mt-1">{tr("Scan a receipt")}</span></button>
        <button className={U.card + " text-center py-3 px-1 min-h-[72px] hover:border-[var(--c-acc)]"} onClick={() => (full ? openPlan && openPlan() : setMode(mode === "paste" ? null : "paste"))} data-testid="radar-paste"><ClipboardPaste size={18} className="text-[var(--c-acc)] mx-auto" /><span className="block text-[12.5px] font-bold mt-1">{tr("Paste or type")}</span></button>
        <button className={U.card + " text-center py-3 px-1 min-h-[72px] hover:border-[var(--c-acc)]"} onClick={() => { if (full) { openPlan && openPlan(); return; } setEdit({}); setMode("form"); }} data-testid="radar-add"><Plus size={18} className="text-[var(--c-acc)] mx-auto" /><span className="block text-[12.5px] font-bold mt-1">{tr("Add by hand")}</span></button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files && e.target.files[0]); e.target.value = ""; }} data-testid="radar-file" />
      {full ? (
        <button className={U.cardPad + " w-full text-start hover:border-[var(--c-acc)]"} onClick={openPlan} data-testid="radar-limit"><b className="flex items-center gap-2 font-extrabold"><Crown size={15} className="text-[var(--c-acc-2)]" />{tr("Free watches {n} deadlines", { n: D.FREE_LIMIT })}</b>
          <span className={"text-[13px] " + U.muted}>{tr("Pro watches all of them and keeps your receipts — one cancelled trial usually pays for it.")}</span></button>) : null}
      {busy ? <p className={U.muted} data-testid="radar-busy">{busy}</p> : null}
      {mode === "paste" ? (
        <div className={U.cardPad + " space-y-2"}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={tr("Paste an email or message, or type: “my Netflix trial ends on 20 November”")} className={U.area} dir="auto" data-testid="radar-text" />
          <button className={U.btnP} disabled={!text.trim()} onClick={() => read(text)} data-testid="radar-read">{tr("Find the deadline")}</button>
        </div>) : null}
      {drafts.map((d, i) => (
        <div key={d._k || i} className="space-y-1.5"><span className={U.label}>{tr("Check it, then save")}</span>
          <Form init={d} photo={i === 0 ? photo : ""} onCancel={() => setDrafts((x) => x.filter((y) => y !== d))}
            onSave={(f) => { const { _k, ...rest } = { ...d, ...f }; if (saveOne(rest)) setDrafts((x) => x.filter((y) => y !== d)); }} /></div>))}
      {mode === "form" && edit ? (
        <Form init={edit} photo={edit.photo && photo ? photo : ""} onCancel={() => { setMode(null); setEdit(null); }}
          onSave={(f) => {
            if (edit.id) { const d = D.updateDeadline(data, edit.id, { ...f }); put(d); const it = d.items.find((x) => x.id === edit.id); unremind && unremind("radar-" + edit.id); const rem = D.radarReminder(it); if (rem && remind) remind(rem); flash && flash(tr("Saved")); }
            else saveOne({ ...edit, ...f, source: edit.source || "manual" });
            setMode(null); setEdit(null); setPhoto(""); }} />) : null}
      </div><div className={rightHas ? RIGHT : "min-w-0"}>

      {data.items.length > 3 ? (
        <div className="relative"><Search size={15} className={"absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none " + U.muted} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Find a receipt or document…")} className={U.inp + " ps-10"} data-testid="radar-search" /></div>) : null}
      {!V.soon.length && !V.later.length && !drafts.length && mode !== "form" ? (
        <p className={"text-[13.5px] " + U.muted} data-testid="radar-empty">{tr("Nothing to watch yet. Scan a receipt, paste a trial email, or add a passport or warranty by hand.")}</p>) : null}
      {[["Soon", V.soon], ["Later", V.later], ["Done", V.done.slice(0, 20)]].map(([h, list]) => list.filter(match).length ? (
        <div key={h} className="space-y-2 @container" data-testid={"radar-" + h.toLowerCase()}><span className={U.label}>{tr(h)}</span>
          {/* v6.28: two columns only when each card has room for its buttons on one line (they wrapped at 1366 px) */}
          <div className="space-y-2 @[920px]:space-y-0 @[920px]:grid @[920px]:grid-cols-2 @[920px]:gap-3 @[920px]:items-start" data-testid="radar-grid">
          {list.filter(match).map((x) => <Item key={x.id} x={x} onDone={done} onEdit={(it) => { setEdit(it); setMode("form"); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) {} }} onDelete={del} />)}
          </div>
        </div>) : null)}
      {!data.items.length && (drafts.length || mode === "form") ? <DeskEmpty icon={Radar} title={tr("Your deadlines appear here")} testid="radar-desk-empty" /> : null}
      </div></div>
    </div>);
}
