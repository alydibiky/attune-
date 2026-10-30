/* ---- v8.8 People (Saved → People): one card per person / place / thing — Ali: "an option to add a referable name the first time
   or a contact … give me both: add his contact and refer to him as X". A card holds YOUR name for them, other names, what they
   are to you (plumber, work…), the phone contact (Android's picker — no contacts permission), and everything linked to them in
   the app (links.js). "Who is X?" lists names Attune met in Money and your notes that have no card yet. Logic: entities.js. */
import React, { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, Phone, ChevronRight, ChevronLeft, X, Users, Link2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as E from "./entities.js";
import * as K from "./links.js";
import * as LA from "./lifeask.js";
import { loadPots } from "./planner.js";
import { askConfirm } from "./confirm.jsx";
import { cardPad, card, btnP, btnS, inp, label, h1, muted, tag } from "./ui-kit.jsx";

export const OPEN_KEY = "attune:people:open";
/** Open a card from anywhere (a name tapped in Chat, Money, Follow-ups): the People page opens on it. */
export function openPerson(id, navTo) { try { localStorage.setItem(OPEN_KEY, String(id)); } catch (e) {} if (navTo) navTo("people"); else try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: "people" } })); } catch (e) {} }

const SRC = { money: ["Money", "الفلوس"], followups: ["Follow-ups", "المتابعات"], notes: ["Notes", "الملاحظات"], mind: ["Mind", "العقل"], todo: ["To-do", "المهام"], messages: ["Messages", "الرسايل"],
  reminders: ["Reminders", "التذكيرات"], dates: ["Dates", "المواعيد"], goals: ["Goals", "الأهداف"], health: ["Health", "الصحة"], agents: ["Agents", "الوكلاء"] };
export const srcName = (k, ar) => (SRC[k] ? SRC[k][ar ? 1 : 0] : k);

/** Names Attune met (Money notes, your notes) with no card yet — newest first, at most 6. */
export function namesToAsk(stores, dir) {
  const seen = new Map();
  const add = (text, ts) => { for (const n of E.newNames(text, dir)) { const k = E.fold(n).trim(); const was = seen.get(k); if (!was) seen.set(k, { name: n, ts, n: 1 }); else { was.n++; was.ts = Math.max(was.ts, ts); } } };
  for (const t of ((stores.ledger && stores.ledger.txns) || []).slice(-400)) if (t && t.note) add(t.note, Date.parse(t.date) || 0);
  for (const r of (stores.memory || []).slice(-300)) if (r && (r.kind === "note" || (r.meta && r.meta.book))) add([r.title, r.text].join(" "), r.ts || 0);
  return [...seen.values()].sort((a, b) => b.n - a.n || b.ts - a.ts).slice(0, 6);
}

function Editor({ init, onSave, onCancel, nativeCall, dir }) {
  const ar = getLang() === "ar";
  const [name, setName] = useState(init.name || ""), [role, setRole] = useState(init.role || ""), [aliases, setAliases] = useState((init.aliases || []).join(", "));
  const [contact, setContact] = useState(init.contact || null), [kind, setKind] = useState(init.kind || "person"), [err, setErr] = useState("");
  const pick = async () => {
    setErr("");
    if (!nativeCall) { setErr(tr("Picking a contact works in the Android app")); return; }
    try { const c = await nativeCall("contactPick", {}); if (c && (c.name || c.phone)) { setContact({ name: c.name || "", phone: c.phone || "" }); if (!name.trim()) setName(c.name || ""); } } catch (e) { if (!/cancel/i.test(String(e && e.message))) setErr(String((e && e.message) || e)); }
  };
  const same = name.trim() ? dir.items.filter((p) => p.id !== init.id && E.keysOf(p).includes(E.fold(name).trim().split(" ")[0])) : [];
  return <div className={cardPad + " space-y-3"} data-testid="people-editor">
    <div className="flex gap-1.5">{[["person", tr("A person")], ["place", tr("A place")], ["thing", tr("A thing")]].map(([k, l]) => <button key={k} type="button" onClick={() => setKind(k)} data-testid={"people-kind-" + k}
      className={"min-h-[40px] px-3 rounded-full text-[13px] font-extrabold border " + (kind === k ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-transparent" : "border-[var(--c-ln)] " + muted)}>{l}</button>)}</div>
    <label className="block"><span className={label + " block mb-1"}>{kind === "person" ? tr("What you call him / her") : tr("What you call it")}</span>
      <input className={inp} value={name} onChange={(e) => setName(e.target.value)} dir="auto" placeholder={kind === "person" ? tr("e.g. Ahmed the plumber") : kind === "place" ? tr("e.g. the flat in Maadi") : tr("e.g. the Kia")} data-testid="people-name" /></label>
    {same.length ? <p className="m-0 text-[12px] text-[var(--c-warn)] font-bold">{tr("You already have {n} — add what tells them apart (plumber, work…), and Attune will ask which one when it isn't clear.", { n: same.map(E.labelOf).join(" · ") })}</p> : null}
    <label className="block"><span className={label + " block mb-1"}>{tr("Who / what is it to you")}</span>
      <input className={inp} value={role} onChange={(e) => setRole(e.target.value)} dir="auto" placeholder={tr("plumber, barber, work, my brother…")} data-testid="people-role" /></label>
    <label className="block"><span className={label + " block mb-1"}>{tr("Other names you use (optional)")}</span>
      <input className={inp} value={aliases} onChange={(e) => setAliases(e.target.value)} dir="auto" placeholder={tr("e.g. Hamada, الحلاق")} data-testid="people-aliases" /></label>
    {kind === "person" ? <div className="flex items-center gap-2 flex-wrap">
      {contact ? <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" data-testid="people-contact"><Phone size={14} className="c-acc" /><span dir="auto">{contact.name}</span> <span className={muted} dir="ltr">{contact.phone}</span>
        <button onClick={() => setContact(null)} aria-label={tr("Remove the contact")} className={"w-8 h-8 grid place-items-center " + muted}><X size={14} /></button></span>
        : <button type="button" onClick={pick} className={btnS} data-testid="people-pick-contact"><Phone size={15} />{tr("Link a phone contact")}</button>}
      <span className={"text-[11.5px] " + muted}>{tr("Optional — Attune keeps using your name for them.")}</span></div> : null}
    {err ? <p className="m-0 text-[12.5px] text-[var(--c-neg)] font-bold">{err}</p> : null}
    <div className="flex gap-2"><button className={btnP + " flex-1"} disabled={!name.trim() && !(contact && contact.name)} data-testid="people-save"
      onClick={() => onSave({ kind, name: name.trim(), role: role.trim(), aliases: aliases.split(/[,،]/).map((x) => x.trim()).filter(Boolean), contact })}>{tr("Save")}</button>
      <button className={btnS} onClick={onCancel}>{tr("Cancel")}</button></div>
  </div>;
}

export function PeoplePage({ nativeCall, navTo, flash }) {
  const ar = getLang() === "ar";
  const [dir, setDirRaw] = useState(() => E.loadDir());
  const [q, setQ] = useState(""), [open, setOpen] = useState(null), [edit, setEdit] = useState(null), [merge, setMerge] = useState(false);
  const save = (d) => setDirRaw(E.saveDir(d));
  const stores = useMemo(() => { try { return { ...LA.loadStores(), pots: loadPots() }; } catch (e) { return {}; } }, [dir]);
  // once: the people the app already knows (People & plans, the voice's nicknames) become cards
  useEffect(() => { try { if (!localStorage.getItem("attune:people:seeded")) { const v = JSON.parse(localStorage.getItem("attune:voice:people") || "{}"); const d = E.seedFrom(dir, { life: stores.life, voicePeople: v }); localStorage.setItem("attune:people:seeded", "1"); if (d.items.length !== dir.items.length) save(d); } } catch (e) {} }, []);
  // a card asked for from somewhere else (a name tapped in Chat / Money)
  useEffect(() => { const take = () => { try { const id = localStorage.getItem(OPEN_KEY); if (id) { localStorage.removeItem(OPEN_KEY); setOpen(id); setEdit(null); } } catch (e) {} }; take(); window.addEventListener("attune-people", take); return () => window.removeEventListener("attune-people", take); }, []);
  const ask = useMemo(() => { try { return namesToAsk(stores, dir); } catch (e) { return []; } }, [stores, dir]);
  const list = dir.items.filter((p) => !q.trim() || E.keysOf(p).some((k) => k.includes(E.fold(q).trim())) || E.fold(p.role).includes(E.fold(q).trim()))
    .sort((a, b) => (b.last || b.created || 0) - (a.last || a.created || 0));
  const card0 = open ? dir.items.find((p) => p.id === open) : null;
  const linked = useMemo(() => { if (!card0) return null; try { return K.connect(card0.name, stores, dir, { pick: card0.id }); } catch (e) { return null; } }, [card0 && card0.id, stores, dir]);

  if (edit) return <div className="space-y-3" data-testid="people-page">
    <Editor init={edit} dir={dir} nativeCall={nativeCall} onCancel={() => setEdit(null)} onSave={(v) => {
      if (edit.id) { save(E.updateCard(dir, edit.id, v)); flash && flash(tr("Saved")); setEdit(null); setOpen(edit.id); return; }
      const r = E.addCard(dir, v); save(r.dir); setEdit(null); setOpen(r.id); flash && flash(tr("Added — Attune links everything about {n} now", { n: v.name || (v.contact && v.contact.name) }));
    }} /></div>;

  if (card0) {
    const p = card0, others = dir.items.filter((x) => x.id !== p.id);
    return <div className="space-y-3" data-testid="people-card">
      <button onClick={() => { setOpen(null); setMerge(false); }} className={"inline-flex items-center gap-1 min-h-[40px] text-[13px] font-bold " + muted} data-testid="people-back"><ChevronLeft size={16} className="rtl:rotate-180" />{tr("All people")}</button>
      <div className={cardPad + " space-y-2"}>
        <div className="flex items-start gap-3"><span className="w-12 h-12 rounded-full grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] text-[18px] font-black shrink-0">{(p.name || "?").slice(0, 1)}</span>
          <div className="min-w-0 flex-1"><p className="m-0 text-[19px] font-black" dir="auto">{p.name}</p>
            <p className={"m-0 text-[13px] " + muted} dir="auto">{[p.role, ...(p.aliases || [])].filter(Boolean).join(" · ") || tr("Add who they are to you — it helps Attune tell people apart")}</p>
            {p.contact ? <p className="m-0 mt-1 text-[13px] font-bold inline-flex items-center gap-1.5"><Phone size={13} className="c-acc" /><span dir="auto">{p.contact.name}</span> <span className={muted} dir="ltr">{p.contact.phone}</span></p> : null}</div></div>
        <div className="flex gap-1.5 flex-wrap"><button className={btnS} onClick={() => setEdit(p)} data-testid="people-edit">{tr("Edit")}</button>
          {others.length ? <button className={btnS} onClick={() => setMerge(!merge)} data-testid="people-merge">{tr("Same person as…")}</button> : null}
          <button className={btnS + " text-[var(--c-neg)]!"} data-testid="people-delete" onClick={async () => { if (!(await askConfirm(tr("Delete {n}'s card? Nothing else is deleted — only the link.", { n: p.name }), { yes: tr("Delete") }))) return; save(E.removeCard(dir, p.id)); setOpen(null); }}><Trash2 size={15} /></button></div>
        {merge ? <div className="flex gap-1.5 flex-wrap pt-1">{others.slice(0, 30).map((o) => <button key={o.id} className={btnS} data-testid="people-merge-with" onClick={() => { save(E.mergeCards(dir, p.id, o.id)); setMerge(false); flash && flash(tr("One card now")); }}>{E.labelOf(o)}</button>)}</div> : null}
      </div>
      {linked && (linked.money.count || linked.owe.toMe || linked.owe.iOwe) ? <div className="grid grid-cols-2 gap-2" data-testid="people-sums">
        {linked.money.out ? <div className={cardPad}><p className={label + " m-0"}>{tr("You paid")}</p><b className="text-[18px] tabular-nums" dir="ltr">{Math.round(linked.money.out).toLocaleString("en-US")} {linked.money.cur}</b></div> : null}
        {linked.money.in ? <div className={cardPad}><p className={label + " m-0"}>{tr("You got")}</p><b className="text-[18px] tabular-nums c-acc" dir="ltr">{Math.round(linked.money.in).toLocaleString("en-US")} {linked.money.cur}</b></div> : null}
        {linked.owe.toMe ? <div className={cardPad}><p className={label + " m-0"}>{tr("Owes you")}</p><b className="text-[18px] tabular-nums c-acc" dir="ltr">{Math.round(linked.owe.toMe).toLocaleString("en-US")}</b></div> : null}
        {linked.owe.iOwe ? <div className={cardPad}><p className={label + " m-0"}>{tr("You owe")}</p><b className="text-[18px] tabular-nums text-[var(--c-warn)]" dir="ltr">{Math.round(linked.owe.iOwe).toLocaleString("en-US")}</b></div> : null}
      </div> : null}
      <div className={cardPad + " space-y-1"} data-testid="people-linked">
        <p className={label + " m-0 mb-1"}>{tr("Everything about {n}", { n: p.name })}</p>
        {linked && linked.items.length ? linked.items.slice(0, 30).map((x) => <button key={x.id} onClick={() => navTo && navTo(x.open)} className="w-full text-start flex items-center gap-2 min-h-[44px] border-t border-[var(--c-ln)] first:border-t-0" data-testid="people-item">
          <span className={tag("gray") + " shrink-0"}>{srcName(x.src, ar)}</span><span className="flex-1 min-w-0 truncate text-[13.5px] font-semibold" dir="auto">{x.title}</span>
          {x.amount ? <b className="tabular-nums text-[13px] shrink-0" dir="ltr">{Math.round(x.amount).toLocaleString("en-US")}</b> : null}
          <span className={"text-[11.5px] shrink-0 " + muted}>{x.ts ? new Date(x.ts).toLocaleDateString(ar ? "ar-EG-u-nu-latn" : "en-GB", { day: "numeric", month: "short" }) : ""}</span></button>)
          : <p className={"m-0 text-[13px] " + muted}>{tr("Nothing linked yet. When you write {n} (or another name of theirs) in Money, a note or a message, it shows here.", { n: p.name })}</p>}
      </div>
    </div>;
  }

  return <div className="space-y-3" data-testid="people-page">
    <div className="flex items-center justify-between gap-2"><h2 className={h1 + " flex items-center gap-2"}><Users size={20} className="c-acc" />{tr("People")}</h2>
      <button className={btnP + " h-11! min-h-[44px]! px-4!"} onClick={() => setEdit({})} data-testid="people-add"><Plus size={16} />{tr("Add")}</button></div>
    <p className={"m-0 text-[13px] " + muted}>{tr("The people, places and things in your life. Attune links everything about each one — payments, notes, messages, follow-ups — and Chat answers from it. Two with the same name? It asks which one.")}</p>
    {ask.length ? <div className={cardPad + " space-y-2"} data-testid="people-ask">
      <p className={label + " m-0"}>{tr("Who is this?")}</p>
      {ask.map((a) => <div key={a.name} className="flex items-center gap-2 flex-wrap border-t border-[var(--c-ln)] first:border-t-0 pt-2 first:pt-0" data-testid="people-ask-row">
        <b className="text-[14.5px] flex-1 min-w-[90px]" dir="auto">{a.name}{a.n > 1 ? <span className={"text-[12px] font-bold " + muted}> · {tr("{n} times", { n: a.n })}</span> : null}</b>
        <button className={btnS + " h-10! min-h-[40px]!"} onClick={() => setEdit({ name: a.name })} data-testid="people-ask-new">{tr("New person")}</button>
        {dir.items.length ? <select className={inp + " w-auto! h-10! min-h-[40px]!"} value="" onChange={(e) => { const id = e.target.value; if (!id) return; const c = dir.items.find((x) => x.id === id); save(E.updateCard(dir, id, { aliases: [...new Set([...(c.aliases || []), a.name])] })); flash && flash(tr("{a} = {b}", { a: a.name, b: c.name })); }} data-testid="people-ask-is">
          <option value="">{tr("It's…")}</option>{dir.items.map((c) => <option key={c.id} value={c.id}>{E.labelOf(c)}</option>)}</select> : null}
        <button className={"min-h-[40px] px-2 text-[12.5px] font-bold " + muted} onClick={() => save(E.skipName(dir, a.name))} data-testid="people-ask-skip">{tr("Not a person")}</button>
      </div>)}
    </div> : null}
    {dir.items.length > 6 ? <div className="relative"><Search size={16} className={"absolute start-3 top-1/2 -translate-y-1/2 " + muted} />
      <input className={inp + " ps-9!"} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search people")} dir="auto" data-testid="people-search" /></div> : null}
    {list.length ? <div className="grid gap-2 lg:grid-cols-2">{list.map((p) => <button key={p.id} onClick={() => setOpen(p.id)} className={card + " w-full text-start p-3 flex items-center gap-3 min-h-[60px] hover:border-[var(--c-acc)]"} data-testid="people-row">
      <span className="w-10 h-10 rounded-full grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] font-black shrink-0">{(p.name || "?").slice(0, 1)}</span>
      <span className="min-w-0 flex-1"><span className="block font-extrabold text-[15px] truncate" dir="auto">{p.name}</span>
        <span className={"block text-[12.5px] truncate " + muted} dir="auto">{[p.role, p.contact && p.contact.name !== p.name ? p.contact.name : ""].filter(Boolean).join(" · ") || (p.kind === "place" ? tr("A place") : p.kind === "thing" ? tr("A thing") : "")}</span></span>
      {p.contact ? <Phone size={14} className={muted} /> : null}<ChevronRight size={16} className={muted + " rtl:rotate-180"} /></button>)}</div>
      : <div className={cardPad + " text-center"}><p className="m-0 text-[14px] font-bold">{tr("No one yet")}</p><p className={"m-0 mt-1 text-[12.5px] " + muted}>{tr("Add the people you deal with — your barber, the plumber, Ahmed from work — with your own name for each.")}</p></div>}
  </div>;
}
