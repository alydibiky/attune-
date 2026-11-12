/* ---- v9.9.24 B6 X3 My things (Documents page; Ali picked A — "option to edit things that can be edited"; combined screen OK'd 12 Nov).
   A receipt photo → the thing's card: price (the TOTAL line), bought (date · shop), warranty → until, every field editable; what isn't
   sure is yellow; the receipt photo kept; later the box photo adds the serial / IMEI. Saving with a warranty also puts its end in Dates
   (warned 30 days before). Photos go through the clarity check (photogate.js). Reader: things.js. */
import React, { useRef, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { readReceipt, readBox } from "./things.js";
import { shrinkPhoto } from "./money-pages-ui.jsx";
import { photoOk, askRetake } from "./photogate.js";
import { choosePhoto } from "./photopick.js";
import * as D from "./deadlines.js";
import { btnP, btnS, inp, label } from "./ui-kit.jsx";
const KEY = "attune:things:v1";
const load = () => { try { const j = JSON.parse(localStorage.getItem(KEY) || "null"); return j && Array.isArray(j.items) ? j.items : []; } catch (e) { return []; } };
const save = (items) => { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, items })); } catch (e) {} return items; };
const n0 = (v) => (+v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const day = (s) => { try { return s ? new Date(s + "T12:00:00").toLocaleDateString(dateLocale() || "en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""; } catch (e) { return s; } };
async function readPhoto(file, input) {
  const url = await shrinkPhoto(file).catch(() => null); if (!url) return null;
  if (!(await photoOk(url, input))) return null;
  const call = typeof window !== "undefined" ? window.__attuneNativeCall : null; let r = null;
  try { r = call ? await call("readText", { b64: url.split(",")[1] }) : null; } catch (e) {}
  return { url, lines: (r && r.lines && r.lines.length ? r.lines : String((r && r.text) || "").split("\n")).map((l) => (l && l.text != null ? l.text : l)), text: (r && r.text) || "" };
}
export function MyThings({ flash }) {
  const [items, setItems] = useState(load), [edit, setEdit] = useState(null), [busy, setBusy] = useState(false);
  const rcp = useRef(null), box = useRef(null);
  const fromReceipt = async (f) => { if (!f) return; setBusy(true); const p = await readPhoto(f, rcp.current); setBusy(false); if (!p) return;
    const x = readReceipt(p.lines);
    if (!x.price && !x.date && !x.name) { askRetake("unread", rcp.current); return; }
    setEdit({ id: "", name: x.name, price: x.price || "", date: x.date, store: x.store, warrantyMonths: x.warrantyMonths || "", until: x.until, serial: "", imei: "", photo: p.url, sure: x.sure }); };
  const fromBox = async (f) => { if (!f || !edit) return; setBusy(true); const p = await readPhoto(f, box.current); setBusy(false); if (!p) return;
    const b = readBox(p.text || p.lines.join("\n"));
    if (!b.serial && !b.imei) { askRetake("unread", box.current); return; }
    setEdit({ ...edit, serial: b.serial || edit.serial, imei: b.imei || edit.imei, model: b.model || edit.model, sure: { ...(edit.sure || {}), serial: true } }); };
  const put = () => { const e = edit, m = +e.warrantyMonths || 0;
    let until = e.until; if (m && e.date && !until) { const [y, mo, d] = e.date.split("-").map(Number); const dt = new Date(y, mo - 1 + m, 1); until = dt.getFullYear() + "-" + String(dt.getMonth() + 1).padStart(2, "0") + "-" + String(Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate())).padStart(2, "0"); }
    const it = { ...e, id: e.id || "t" + Date.now().toString(36), price: +e.price || 0, warrantyMonths: m, until };
    setItems(save(e.id ? items.map((x) => (x.id === e.id ? it : x)) : [...items, it]));
    if (until && !e.id) { try { const r = D.addDeadline(D.loadRadar(), { kind: "warranty", title: it.name || tr("Warranty"), date: until, amount: it.price, note: [it.store, it.serial].filter(Boolean).join(" · "), source: "things" }); D.saveRadar(r.data); } catch (x) {} }
    setEdit(null); flash && flash(until ? tr("Saved — Dates warns you before the warranty ends") : tr("Saved")); };
  const F = (k, l, type) => <div className="flex items-center gap-2 border-t border-[var(--c-ln)] first:border-t-0 py-1.5">
    <span className={label + " w-[30%] shrink-0"}>{tr(l)}</span>
    <input value={edit[k] == null ? "" : edit[k]} onChange={(x) => setEdit({ ...edit, [k]: x.target.value, sure: { ...(edit.sure || {}), [k === "date" ? "date" : k]: true } })} type={type || "text"} dir="auto"
      className={inp + " flex-1"} style={edit.sure && edit.sure[k] === false ? { background: "var(--c-amber, #FBF0DC)" } : null} data-testid={"thing-f-" + k} data-unsure={edit.sure && edit.sure[k] === false ? "1" : ""} /></div>;
  return <div className="space-y-2" data-testid="things">
    <div className="flex items-center justify-between gap-2"><p className={label + " m-0"}>{tr("My things")}</p>
      <button className={btnS + " h-10! min-h-[40px]!"} disabled={busy} onClick={() => choosePhoto(rcp.current)} data-testid="things-receipt">{busy ? tr("Reading…") : "+ " + tr("From a receipt")}</button></div>
    <input ref={rcp} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; fromReceipt(f); }} data-testid="things-receipt-input" />
    <input ref={box} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; fromBox(f); }} data-testid="things-box-input" />
    {edit ? <div className="rounded-[16px] border p-3 space-y-1" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="thing-form">
      {F("name", "Thing")}{F("price", "Price", "number")}{F("date", "Bought", "date")}{F("store", "Shop")}{F("warrantyMonths", "Warranty (months)", "number")}{F("serial", "Serial")}{F("imei", "IMEI")}
      {edit.sure && Object.values(edit.sure).includes(false) ? <p className="m-0 text-[12px] c-sub" data-testid="thing-unsure">{tr("Yellow = not sure from the photo — check it")}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1"><button className={btnP} onClick={put} data-testid="thing-save">{tr("Save")}</button>
        <button className={btnS} onClick={() => choosePhoto(box.current)} data-testid="thing-box">{tr("Add the box photo (serial)")}</button>
        <button className={btnS} onClick={() => setEdit(null)}>{tr("Cancel")}</button></div></div> : null}
    {items.map((x) => <button key={x.id} onClick={() => setEdit({ ...x, sure: {} })} className="w-full text-start rounded-[16px] border p-3" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="thing-row">
      <b className="block text-[14.5px]" dir="auto">{x.name || tr("Thing")}</b>
      <span className="block text-[12.5px] c-sub" dir="auto">{[x.price ? n0(x.price) : "", x.date ? day(x.date) : "", x.store].filter(Boolean).join(" · ")}</span>
      {x.until ? <span className="block text-[12.5px] c-acc">{tr("Warranty until {d}", { d: day(x.until) })}</span> : null}
      {x.serial || x.imei ? <span className="block text-[12px] c-sub" dir="ltr">{x.imei ? "IMEI " + x.imei : "S/N " + x.serial}</span> : null}</button>)}
    {!items.length && !edit ? <p className="m-0 text-[13px] c-sub" data-testid="things-empty">{tr("Take a photo of a receipt — the TV, the washer, the phone — and Attune keeps the price, the date and the warranty, and warns you before it ends.")}</p> : null}
  </div>;
}
