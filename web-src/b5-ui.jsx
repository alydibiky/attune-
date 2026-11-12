/* ---- v9.9.22 B5 screens. N3 (Ali picked A): a small "A year ago today" card on Home, once a day when there is something — the
   person's own note or payment from this calendar day in an earlier year (b5people.js onThisDay, 10,000 cases). Tap → the original
   (the note in Mind / the payment in Money). "Nice" hides it for today; "Hide these" turns the card off (kept in this phone). */
import React, { useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { onThisDay } from "./b5people.js";
import { loadLedger } from "./myledger.js";
import * as EN from "./entities.js";
import { keepInTouch, nudgeToday, occasions, wishFor } from "./b5people.js";
import { getLang } from "./i18n.js";
const OFF = "attune:onthisday:off", SEEN = "attune:onthisday:seen";
const get = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const today = () => new Date().toDateString();
export function OnThisDayCard({ records = [], open }) {
  const [, setV] = useState(0);
  if (get(OFF) === "1" || get(SEEN) === today()) return null;
  let x = null; try { const L = loadLedger(); x = onThisDay({ records, txns: (L && L.txns) || [] }); } catch (e) { x = null; }
  if (!x) return null;
  const when = (() => { try { return new Date(x.date + "T12:00:00").toLocaleDateString(dateLocale(), { day: "numeric", month: "long", year: "numeric" }); } catch (e) { return x.date; } })();
  return <div className="rounded-[20px] p-4 space-y-2" style={{ background: "var(--c-soft)" }} data-testid="home-onthisday">
    <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub">{x.years === 1 ? tr("A year ago today") : tr("{n} years ago today", { n: x.years })}</p>
    <button onClick={() => open && open(x)} className="w-full flex items-center gap-3 text-start" data-testid="onthisday-open">
      <span className="flex-1 min-w-0"><b className="block text-[14.5px] truncate" dir="auto">{x.src === "money" ? (x.type === "income" ? tr("You received") : tr("You paid")) + " · " + (x.title || "") : x.title}</b>
        <span className="c-sub text-[12.5px]">{when}</span></span>
      {x.amount ? <b className="tabular-nums text-[15px]" dir="ltr">{Math.round(x.amount).toLocaleString()}</b> : null}</button>
    <div className="flex gap-2">
      <button onClick={() => { put(SEEN, today()); setV((n) => n + 1); }} className="min-h-[36px] px-3 rounded-full text-[12.5px] font-bold border border-[var(--c-ln)] bg-[var(--c-surf)]" data-testid="onthisday-nice">{tr("Nice")}</button>
      <button onClick={() => { put(OFF, "1"); setV((n) => n + 1); }} className="min-h-[36px] px-3 rounded-full text-[12.5px] font-bold c-sub" data-testid="onthisday-hide">{tr("Hide these")}</button></div>
  </div>;
}

/* ---- P1 Keep in touch (Ali picked A — a list with how long since) and P3 Occasions (combined: the page + the card on the day with a
   wish). Both live on the People page (and each person's card); Home gets one nudge a day (P1) and the occasion card from 9:00 (P3).
   A chat with that person seen in Attune's notifications resets "how long since" by itself (a missed call never counts); "✓ Talked"
   resets it by hand — Google Play keeps the call log from apps, so a phone call is the tap. Logic: b5people.js (10,000 cases each). */
const inbox = () => { try { const N = window.AttuneNative; return N && N.chatInbox ? JSON.parse(N.chatInbox() || "[]") : []; } catch (e) { return []; } };
/** Chats in the notifications → contact events per card (by any of the card's names). */
export function chatEvents(dir, items = inbox()) {
  const out = [];
  for (const x of items || []) { if (!x || x.group || !x.who || !x.ts) continue; const w = EN.fold(x.who).trim();
    const p = (dir.items || []).find((c) => EN.keysOf(c).some((k) => k && (w === k || w.split(/\s+/)[0] === k))); if (p) out.push({ who: p.id, at: x.ts, kind: "chat" }); }
  return out;
}
export function touchList(dir, now = Date.now()) {
  const people = (dir.items || []).filter((p) => p.touch && p.touch.every > 0).map((p) => ({ id: p.id, name: p.name, every: p.touch.every, since: p.touch.since || p.created || null }));
  const manual = (dir.items || []).filter((p) => p.touch && p.touch.last).map((p) => ({ who: p.id, at: p.touch.last, kind: "visit" }));
  return keepInTouch(people, [...manual, ...chatEvents(dir)], now);
}
export function datesOf(dir) { return (dir.items || []).flatMap((p) => (p.dates || []).map((d, i) => ({ id: p.id + ":" + i, pid: p.id, who: p.name, lang: p.lang || "", kind: d.kind, md: d.md, year: d.year }))); }
const sinceText = (x) => (x.since == null ? tr("not yet") : x.since === 0 ? tr("today") : x.since === 1 ? tr("yesterday") : x.since < 14 ? tr("{n} days", { n: x.since }) : tr("{n} weeks", { n: Math.round(x.since / 7) }));
const everyText = (n) => (n === 1 ? tr("every day") : n === 7 ? tr("every week") : n === 14 ? tr("every 2 weeks") : n === 30 ? tr("every month") : tr("every {n} days", { n }));
const KIND = { birthday: "birthday", anniversary: "anniversary", other: "date" };
const mdWords = (md) => { try { return new Date(2024, +md.slice(0, 2) - 1, +md.slice(3, 5)).toLocaleDateString(dateLocale(), { day: "numeric", month: "long" }); } catch (e) { return md; } };
const talked = (dir, id) => EN.updateCard(dir, id, { touch: { ...((dir.items.find((p) => p.id === id) || {}).touch || {}), last: Date.now() } });
/** The People page: Keep in touch + Occasions. */
export function PeopleB5({ dir, save, open }) {
  const list = touchList(dir), dates = occasions(datesOf(dir)).slice(0, 6);
  if (!list.length && !dates.length) return null;
  return <div className="space-y-3">
    {list.length ? <div className="rounded-[20px] border p-3 space-y-1" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="people-touch">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub">{tr("Keep in touch")}</p>
      {list.map((x) => <div key={x.id} className="flex items-center gap-2 min-h-[48px]" data-testid="touch-row" data-due={x.due ? "1" : "0"}>
        <button onClick={() => open(x.id)} className="flex-1 min-w-0 text-start"><b className="block text-[14px]" dir="auto">{x.name}</b>
          <span className={"block text-[12.5px] " + (x.due ? "font-bold" : "c-sub")} style={x.due ? { color: "var(--c-warn)" } : undefined}>{everyText(x.every)} · {sinceText(x)}</span></button>
        {x.due ? <button onClick={() => save(talked(dir, x.id))} className="min-h-[36px] px-3 rounded-full text-[12.5px] font-extrabold" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="touch-talked">✓ {tr("Talked")}</button>
          : <span className="c-pos text-[14px] px-2" aria-label={tr("On track")}>✓</span>}</div>)}
    </div> : null}
    {dates.length ? <div className="rounded-[20px] border p-3 space-y-1" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="people-occasions">
      <p className="m-0 text-[12px] font-extrabold tracking-[0.08em] uppercase c-sub">{tr("Occasions")}</p>
      {dates.map((o) => <button key={o.id} onClick={() => open(o.pid)} className="w-full flex items-center gap-2 min-h-[44px] text-start" data-testid="occasion-row">
        <span className="flex-1 min-w-0"><b className="block text-[14px]" dir="auto">{o.who}</b><span className="block text-[12.5px] c-sub">{tr(KIND[o.kind] || "date")} · {mdWords(o.md)}{o.turns ? " · " + tr("turns {n}", { n: o.turns }) : ""}</span></span>
        <span className="text-[12.5px] font-extrabold shrink-0">{o.inDays === 0 ? tr("Today") : o.inDays === 1 ? tr("Tomorrow") : tr("{n} days", { n: o.inDays })}</span></button>)}
    </div> : null}
  </div>;
}
/** On a person's card: how often to talk + their dates (each tap to change). */
export function PersonB5({ p, dir, save }) {
  const [form, setForm] = useState(null);
  const every = (p.touch && p.touch.every) || 0;
  return <div className="rounded-[20px] border p-3 space-y-2" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="person-b5">
    <div className="flex items-center gap-2"><span className="flex-1 text-[13.5px]"><b>{tr("Keep in touch")}</b> · <span className="c-sub">{every ? everyText(every) : tr("off")}</span></span>
      {every ? <button onClick={() => save(talked(dir, p.id))} className="min-h-[34px] px-2.5 rounded-full text-[12px] font-bold border border-[var(--c-ln)]" data-testid="person-talked">✓ {tr("Talked")}</button> : null}</div>
    <div className="flex flex-wrap gap-1.5">{[0, 3, 7, 14, 30].map((n) => <button key={n} onClick={() => save(EN.updateCard(dir, p.id, { touch: n ? { ...(p.touch || {}), every: n, since: (p.touch && p.touch.since) || Date.now() } : null }))} aria-pressed={every === n}
      className="min-h-[34px] px-3 rounded-full text-[12px] font-bold border" style={every === n ? { background: "var(--c-soft)", borderColor: "var(--c-acc)", color: "var(--c-acc)" } : { borderColor: "var(--c-ln)" }} data-testid={"person-every-" + n}>{n ? everyText(n) : tr("off")}</button>)}</div>
    <div className="space-y-1">{(p.dates || []).map((d, i) => <div key={i} className="flex items-center gap-2 text-[13.5px]" data-testid="person-date"><span className="flex-1">{tr(KIND[d.kind] || "date")} · {mdWords(d.md)}{d.year ? " " + d.year : ""}</span>
      <button onClick={() => save(EN.updateCard(dir, p.id, { dates: (p.dates || []).filter((_, k) => k !== i) }))} className="w-8 h-8 c-sub" aria-label={tr("Remove")}>×</button></div>)}</div>
    {form ? <div className="flex flex-wrap gap-2 items-end">
      <div className="flex gap-1.5">{["birthday", "anniversary"].map((k) => <button key={k} onClick={() => setForm({ ...form, kind: k })} aria-pressed={form.kind === k} className="min-h-[34px] px-3 rounded-full text-[12px] font-bold border" style={form.kind === k ? { background: "var(--c-soft)", borderColor: "var(--c-acc)" } : { borderColor: "var(--c-ln)" }} data-testid={"person-date-kind-" + k}>{tr(KIND[k])}</button>)}</div>
      <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="min-h-[40px] rounded-[12px] border border-[var(--c-ln)] px-2" data-testid="person-date-input" />
      <label className="text-[12px] flex items-center gap-1"><input type="checkbox" checked={form.year} onChange={(e) => setForm({ ...form, year: e.target.checked })} />{tr("I know the year")}</label>
      <button disabled={!form.date} onClick={() => { const d = { kind: form.kind, md: form.date.slice(5, 10), ...(form.year ? { year: +form.date.slice(0, 4) } : {}) }; save(EN.updateCard(dir, p.id, { dates: [...(p.dates || []), d] })); setForm(null); }} className="min-h-[40px] px-3 rounded-[12px] font-extrabold text-[13px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="person-date-save">{tr("Save")}</button></div>
      : <button onClick={() => setForm({ kind: "birthday", date: "", year: true })} className="text-[13px] font-extrabold c-acc min-h-[36px]" data-testid="person-date-add">+ {tr("Add a birthday or date")}</button>}
  </div>;
}
/** Home: today's occasion from 9:00 (a wish ready, Send opens WhatsApp) — else one keep-in-touch nudge a day. */
export function PeopleHomeCard({ nativeCall }) {
  const [, setV] = useState(0), now = Date.now(), dir = EN.loadDir(), day = new Date().toDateString();
  const later = (() => { try { return JSON.parse(localStorage.getItem("attune:b5:later") || "{}"); } catch (e) { return {}; } })();
  const hide = (k) => { try { localStorage.setItem("attune:b5:later", JSON.stringify({ ...later, [k]: day })); } catch (e) {} setV((n) => n + 1); };
  const occ = new Date(now).getHours() >= 9 ? occasions(datesOf(dir), now).find((o) => o.inDays === 0 && later[o.id] !== day) : null;
  if (occ) {
    const p = dir.items.find((x) => x.id === occ.pid) || {}, wish = wishFor(occ, p.lang || getLang()), phone = p.contact && p.contact.phone ? String(p.contact.phone).replace(/[^\d+]/g, "") : "";
    return <div className="rounded-[20px] p-4 space-y-2" style={{ background: "var(--c-soft)" }} data-testid="home-occasion">
      <b className="block text-[15px]" dir="auto">♡ {occ.kind === "anniversary" ? tr("{n}: anniversary today", { n: occ.who }) : tr("{n}'s birthday today", { n: occ.who })}{occ.turns ? " · " + tr("turns {n}", { n: occ.turns }) : ""}</b>
      <p className="m-0 text-[14px] rounded-[12px] p-2.5" style={{ background: "var(--c-surf)" }} dir="auto" data-testid="home-occasion-wish">{wish}</p>
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => { const u = "https://wa.me/" + phone.replace(/^\+/, "") + "?text=" + encodeURIComponent(wish); try { if (window.AttuneNative && window.AttuneNative.openUrl) window.AttuneNative.openUrl(u); else window.open(u, "_blank"); } catch (e) {} hide(occ.id); }} className="min-h-[40px] px-3.5 rounded-[12px] font-extrabold text-[13px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="home-occasion-send">{tr("Send on WhatsApp")}</button>
        <button onClick={() => { try { navigator.clipboard.writeText(wish); } catch (e) {} }} className="min-h-[40px] px-3.5 rounded-[12px] font-bold text-[13px] border border-[var(--c-ln)] bg-[var(--c-surf)]">{tr("Copy")}</button>
        <button onClick={() => hide(occ.id)} className="min-h-[40px] px-3.5 rounded-[12px] font-bold text-[13px] c-sub" data-testid="home-occasion-later">{tr("Later")}</button></div>
    </div>;
  }
  const n = nudgeToday(touchList(dir, now), later.touch === day ? new Date(now).toISOString().slice(0, 10) : "", now);
  if (!n || later.touch === day) return null;
  return <div className="rounded-[20px] p-4 space-y-2" style={{ background: "var(--c-amber, var(--c-soft))" }} data-testid="home-touch">
    <b className="block text-[14.5px]" dir="auto">{tr("Say hi to {n}?", { n: n.name })}</b>
    <p className="m-0 text-[12.5px] c-sub">{everyText(n.every)} · {tr("last time: {t}", { t: sinceText(n) })}</p>
    <div className="flex gap-2"><button onClick={() => { EN.saveDir(talked(EN.loadDir(), n.id)); hide("touch"); }} className="min-h-[38px] px-3 rounded-[12px] font-extrabold text-[13px]" style={{ background: "var(--c-acc)", color: "var(--c-on-acc,#fff)" }} data-testid="home-touch-talked">✓ {tr("Talked")}</button>
      <button onClick={() => hide("touch")} className="min-h-[38px] px-3 rounded-[12px] font-bold text-[13px] c-sub" data-testid="home-touch-later">{tr("Later")}</button></div>
  </div>;
}
