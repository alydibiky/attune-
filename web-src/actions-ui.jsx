/* ---- reminders & actions: the card in Chat and the Reminders screen -------------
   The card shows exactly what will happen — kind, title, date and time, who —
   with each part editable, and nothing happens until "Set it" is tapped.     */
import { PrayerPlanner } from "./prayer-ui.jsx";
import { askConfirm } from "./confirm.jsx";
import React, { useState } from "react";
import { Bell, Trash2, X, Plus, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { newReminderId, nextOccurrence, quickAction, daysText, firstOnDays } from "./actions.js";
import { PANES, LEFT, RIGHT } from "./desk.jsx";
import { cardPad, btnP, btnS, inp, label, muted } from "./ui-kit.jsx";

export const KIND_ICON = { reminder: "🔔", alarm: "⏰", timer: "⏱️", calendar: "📅", whatsapp: "💬", call: "📞", none: "❔" };
export const KIND_LABEL = { reminder: "Reminder", alarm: "Alarm", timer: "Timer", calendar: "Calendar event", whatsapp: "WhatsApp message", call: "Phone call", none: "Nothing to do" };
const REPEAT_LABEL = { none: "Once", daily: "Every day", weekly: "Every week", weekdays: "Working days (Sun–Thu)", monthly: "Every month", days: "On these days" };
const DAY_BTN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// "days:0,2,4" → "Sun · Tue · Thu"; the rest by name
const LAST_DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const repeatLabel = (r) => (/^days:/.test(String(r || "")) ? daysText(r).split(" · ").map((d) => tr(d)).join(" · ")
  : /^last:\d$/.test(String(r || "")) ? tr("Last {d} of every month", { d: (getLang() === "ar" ? ["حد", "اتنين", "تلات", "أربع", "خميس", "جمعة", "سبت"] : LAST_DAY)[+String(r).slice(5)] }) : tr(REPEAT_LABEL[r] || ""));

const pad = (n) => String(n).padStart(2, "0");
export function toLocalInput(ms) { if (!ms) return ""; const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function fromLocalInput(v) { if (!v) return null; const t = new Date(v).getTime(); return isNaN(t) ? null : t; }
const locale = () => (getLang() === "ar" ? "ar-EG-u-nu-latn" : "en-GB");
export function whenText(ms, allDay) {
  if (!ms) return "";
  const d = new Date(ms), now = new Date();
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(d) - day0(now)) / 86400000);
  const dayWord = diff === 0 ? tr("Today") : diff === 1 ? tr("Tomorrow") : d.toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
  return allDay ? `${dayWord} · ${time} (${tr("no time given — change it if you like")})` : `${dayWord} · ${time}`;
}
function durText(sec) { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return [h ? tr("{n} h", { n: h }) : "", m ? tr("{n} min", { n: m }) : ""].filter(Boolean).join(" "); }

/** In Chat: one proposed action, editable, confirmed with a tap. */
export function ActionCard({ msg, onDo, onCancel, onAnswer }) {
  const [a, setA] = useState(msg.action);
  const [busy, setBusy] = useState(false);
  if (msg.status === "reading") {
    return (
      <div className="rounded-[22px] border border-[var(--c-acc)]/40 bg-[var(--c-soft)] p-4 text-sm text-[var(--c-ink)] flex items-center gap-2" data-testid="action-card">
        <Loader2 size={15} className="animate-spin text-[var(--c-acc)]" /> {tr("Reading what you want set…")}
      </div>
    );
  }
  if (!a) return null;
  const done = msg.status === "done", cancelled = msg.status === "cancelled";
  const needsTime = ["reminder", "alarm", "calendar"].includes(a.kind);
  const problems = (a.problems || []).filter((p) => !(needsTime && a.at && /When\?/.test(p)) && !(/passed/.test(p) && a.at > Date.now()));
  // What must be there before "Set it" can be tapped. WhatsApp without a number is fine:
  // WhatsApp then asks who to send it to.
  const blocked = a.kind === "none" || (needsTime && (!a.at || a.at < Date.now() - 60000)) ||
    (a.kind === "timer" && !a.durationSec) || (a.kind === "call" && !a.phone);
  const field = inp;
  return (
    <div className={`rounded-[22px] border p-4 text-[var(--c-ink)] ${done ? "border-[var(--c-pos)]/40 bg-[var(--c-pos)]/10" : cancelled ? "border-[var(--c-ln)] bg-[var(--c-surf)] opacity-60" : "border-[var(--c-ln)] bg-[var(--c-surf)]"}`} data-testid="action-card">
      <p className="text-[15px] font-extrabold text-[var(--c-ink)] flex items-center gap-2 m-0">
        <span className="text-base">{KIND_ICON[a.kind]}</span>{tr(KIND_LABEL[a.kind])}
        {msg.via ? <span className="ms-auto text-[10px] text-[var(--c-mut)]">{msg.via === "model" ? tr("read by the model · checked by the app") : tr("read on the phone")}</span> : null}
      </p>
      {done ? (
        <p className="text-sm text-[var(--c-pos)] mt-1.5 flex items-start gap-1.5" data-testid="action-done"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{tr(msg.doneText || "Done")}</p>
      ) : cancelled ? (
        <p className="text-sm text-[var(--c-mut)] mt-1">{tr("Cancelled — nothing was set.")}</p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {a.kind !== "call" ? (
            <input dir="auto" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} className={field} aria-label={tr("Title")} data-testid="act-title" />
          ) : null}
          {needsTime ? (
            <>
              <input type="datetime-local" value={toLocalInput(a.at)} onChange={(e) => setA({ ...a, at: fromLocalInput(e.target.value), allDay: false })} className={field} dir="ltr" data-testid="act-when" />
              {a.at ? <p className="text-[12px] text-[var(--c-acc)]" data-testid="act-when-text">{whenText(a.at, a.allDay)}</p> : null}
            </>
          ) : null}
          {a.kind === "reminder" || a.kind === "alarm" ? (
            <select value={a.repeat || "none"} onChange={(e) => setA({ ...a, repeat: e.target.value })} className={field}>
              {/^days:/.test(a.repeat || "") ? <option value={a.repeat}>{repeatLabel(a.repeat)}</option> : null}
              {Object.keys(REPEAT_LABEL).filter((k) => k !== "days").map((k) => <option key={k} value={k}>{tr(REPEAT_LABEL[k])}</option>)}
            </select>
          ) : null}
          {a.kind === "timer" ? <p className="text-[13px] text-[var(--c-acc)]">{a.durationSec ? durText(a.durationSec) : tr("How long should the timer be?")}</p> : null}
          {a.kind === "calendar" && a.place ? <p className="text-[12px] text-[var(--c-mut)]">📍 {a.place}</p> : null}
          {a.kind === "whatsapp" || a.kind === "call" ? (
            <input dir="ltr" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value.replace(/[^\d+ ]/g, "") })} placeholder={a.contact ? tr("{name}'s number (optional)", { name: a.contact }) : tr("Phone number")} className={field} data-testid="act-phone" />
          ) : null}
          {a.kind === "whatsapp" ? (
            <textarea dir="auto" value={a.message} onChange={(e) => setA({ ...a, message: e.target.value })} rows={2} placeholder={tr("Message")} className={field + " resize-none"} />
          ) : null}
          {a.kind === "whatsapp" && !a.phone ? <p className="text-[11px] text-[var(--c-mut)]">{tr("No number — WhatsApp will open its contact list with the message ready.")}</p> : null}
          {problems.length ? problems.map((p) => <p key={p} className="text-[12px] text-[var(--c-warn)] flex items-start gap-1"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{tr(p)}</p>) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={blocked || busy} data-testid="act-confirm" onClick={async () => { setBusy(true); try { await onDo(a); } finally { setBusy(false); } }}
              className={btnP}>
              {{ reminder: tr("Set reminder"), alarm: tr("Open in Clock"), timer: tr("Start in Clock"), calendar: tr("Add to calendar"), whatsapp: tr("Open WhatsApp"), call: tr("Open the dialer"), none: tr("Set it") }[a.kind]}
            </button>
            <button onClick={onCancel} className={btnS} data-testid="act-cancel">{tr("Cancel")}</button>
            <button onClick={onAnswer} className={"min-h-[44px] px-3 rounded-[14px] text-[13.5px] font-bold hover:text-[var(--c-ink)] " + muted}>{tr("Just answer")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** More → Reminders: everything set, add by hand, allow exact timing. */
export function RemindersPanel({ reminders, setReminders, native, flash, onSchedule }) {
  const [title, setTitle] = useState("");
  const [at, setAt] = useState(toLocalInput(Date.now() + 3600000));
  const [repeat, setRepeat] = useState("none");
  const [days, setDays] = useState([]);       // v8.4: "On these days" — the weekdays picked
  const [say, setSay] = useState("");         // v8.4 (Ali: "make the reminder free text — every Sunday, Tuesday and Thursday …")
  const now = Date.now();
  const list = reminders.map((r) => ({ ...r, next: r.done ? null : nextOccurrence(r, now - 60000) }))
    .sort((a, b) => (a.next || Infinity) - (b.next || Infinity));
  const upcoming = list.filter((r) => r.next && r.next >= now - 60000);
  const past = list.filter((r) => !(r.next && r.next >= now - 60000)).slice(0, 20);
  const exact = native && native.canExact ? native.canExact() : true;
  const notify = native && native.notifyAllowed ? native.notifyAllowed() : true;
  const add = () => {
    let t = fromLocalInput(at);
    if (!title.trim()) return flash(tr("Give it a title"));
    if (repeat === "days") {
      if (!days.length) return flash(tr("Pick the days"));
      const d0 = t ? new Date(t) : new Date(); t = firstOnDays(days, Date.now(), d0.getHours(), d0.getMinutes());
    }
    if (!t || t < Date.now()) return flash(tr("Pick a time in the future"));
    onSchedule({ id: newReminderId(), at: t, title: title.trim(), body: "", repeat: repeat === "days" ? "days:" + [...days].sort().join(",") : repeat, created: Date.now(), source: "manual" });
    setTitle("");
  };
  // one sentence, any language: "every Sunday, Tuesday and Thursday at 7 pm remind me to train" / «فكرني اتمرن كل حد وتلات وخميس الساعة 7»
  const addSaid = () => {
    const text = say.trim(); if (!text) return;
    const a = quickAction(/remind|فكرني|ذكرني|نبهني|wake|صحيني/i.test(text) ? text : "remind me " + text, Date.now());
    if (!a.at || a.problems.length) return flash(tr(a.problems[0] || "When? Pick the date and time."));
    onSchedule({ id: newReminderId(), at: a.at, title: a.title, body: "", repeat: a.repeat || "none", created: Date.now(), source: "manual" });
    flash(tr("Set: {t} — {w}", { t: a.title, w: (a.repeat && a.repeat !== "none" ? repeatLabel(a.repeat) + " · " : "") + whenText(a.at) })); setSay("");
  };
  const remove = (id) => { setReminders(reminders.filter((r) => r.id !== id)); try { native && native.unschedule && native.unschedule(id); } catch (e) {} flash(tr("Removed")); };
  const field = inp.replace("w-full ", "");
  return (
    <div className="calm mt-3 space-y-4 text-[var(--c-ink)]" data-testid="reminders-panel">
      {/* v6.27 computer layout (option A): what it is and "add one" on the left, what is set on the right as cards */}
      <div className={"flex flex-col gap-4 lg:gap-0 " + PANES}><div className={LEFT}>
      <div className={cardPad}>
        <p className="text-[16px] text-[var(--c-ink)] font-extrabold flex items-center gap-2 m-0"><Bell size={16} className="text-[var(--c-acc)]" />{tr("Reminders & actions")}</p>
        <p className={"text-[12.5px] mt-1.5 mb-0 " + muted}>{tr("Just say it in Chat: “remind me tomorrow at 9 to call Ahmed”, “صحيني الساعة 6”, “ابعت لمحمود على الواتساب إني هتأخر”. You always confirm first.")}</p>
        {native && !notify ? (
          <button onClick={() => native.askNotifications && native.askNotifications()} className="mt-3 w-full min-h-[44px] text-start rounded-[14px] border border-[var(--c-warn)]/40 bg-[var(--c-warn)]/10 p-3 text-[12.5px] font-semibold text-[var(--c-warn)] flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0" />
            {tr("Notifications are off for Attune — tap to allow them, or reminders can't appear.")}</button>
        ) : null}
        {native && !exact ? (
          <button onClick={() => native.askExact && native.askExact()} className="mt-2 w-full min-h-[44px] text-start rounded-[14px] border border-[var(--c-ln)] bg-[var(--c-bg)] p-3 text-[12.5px] text-[var(--c-ink)]" data-testid="ask-exact">
            {tr("Reminders may come up to 10 minutes late. Tap to allow “Alarms & reminders” for Attune so they ring on the minute.")}</button>
        ) : null}
        {!native ? <p className="mt-2 text-[11px] text-[var(--c-mut)]">{tr("In the browser reminders are only listed — the Android app rings them.")}</p> : null}
      </div>
      <div className={cardPad + " space-y-2.5"}>
        <p className={label + " m-0"}>{tr("Add one")}</p>
        <form onSubmit={(e) => { e.preventDefault(); addSaid(); }} className="flex gap-2" data-testid="rem-say-form">
          <input dir="auto" value={say} onChange={(e) => setSay(e.target.value)} placeholder={tr("Say it your way — “every Sun, Tue and Thu at 7 pm: train”")} className={field + " flex-1 min-w-0"} data-testid="rem-say" />
          <button type="submit" disabled={!say.trim()} className={btnP + " shrink-0 px-4 disabled:opacity-40"} data-testid="rem-say-go">{tr("Set")}</button></form>
        <p className={"m-0 text-[11.5px] " + muted}>{tr("…or fill it in:")}</p>
        <input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("What to remind you about")} className={field + " w-full"} data-testid="rem-title" />
        {/* v7.6 (Ali: "fix the interface in the reminders page"): the date and time get the whole row; how often is a row of pills */}
        <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={field + " w-full"} dir="ltr" data-testid="rem-at" />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Repeat")} data-testid="rem-repeat">
          {Object.keys(REPEAT_LABEL).map((k) => <button key={k} type="button" role="radio" aria-checked={repeat === k} onClick={() => setRepeat(k)} data-testid={"rem-repeat-" + k}
            className={"min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold transition-colors duration-150 " + (repeat === k ? "bg-[var(--c-acc-2)] text-[var(--c-on-acc-2)] border-transparent" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)] hover:text-[var(--c-ink)]")}>{tr(REPEAT_LABEL[k])}</button>)}
        </div>
        {repeat === "days" ? <div className="flex flex-wrap gap-1.5" data-testid="rem-days">{DAY_BTN.map((d, i) => <button key={d} type="button" aria-pressed={days.includes(i)} onClick={() => setDays((x) => (x.includes(i) ? x.filter((y) => y !== i) : [...x, i]))} data-testid={"rem-day-" + i}
          className={"min-h-[40px] min-w-[48px] px-2.5 rounded-full border text-[13px] font-bold " + (days.includes(i) ? "bg-[var(--c-acc)] text-[var(--c-on-acc)] border-transparent" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)]")}>{tr(d)}</button>)}</div> : null}
        <button onClick={add} className={btnP + " w-full"} data-testid="rem-add"><Plus size={16} />{tr("Add reminder")}</button>
      </div>
      <PrayerPlanner onSchedule={onSchedule} flash={flash} />
      </div><div className={"order-first lg:order-none " + RIGHT}>
      <div className={cardPad}>
        <p className={label + " mt-0 mb-2.5"}>{tr("Coming up")} · <span className="tabular-nums">{upcoming.length}</span></p>
        {upcoming.length === 0 ? <p className="text-sm text-[var(--c-mut)]">{tr("Nothing set.")}</p> : (
          <div className="space-y-1.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2">
            {upcoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-[16px] bg-[var(--c-bg)] border border-[var(--c-ln)] ps-3 pe-1 py-2 min-h-[56px]" data-testid="rem-item">
                <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-[var(--c-soft)] shrink-0">🔔</span>
                <div className="flex-1 min-w-0">
                  <p dir="auto" className="text-[14px] font-bold text-[var(--c-ink)] truncate m-0">{r.title}</p>
                  <p className="text-[12px] font-semibold text-[var(--c-acc)] tabular-nums m-0">{whenText(r.next)}{r.repeat && r.repeat !== "none" ? " · " + repeatLabel(r.repeat) : ""}{r.source === "promise" ? " · " + tr("from a promise") : r.source === "life" ? " · " + tr("from People & plans") : ""}</p>
                </div>
                <button onClick={async () => { if (await askConfirm("Delete this reminder?")) remove(r.id); }} className="w-11 h-11 grid place-items-center rounded-[12px] text-[var(--c-mut)] hover:text-[var(--c-neg)]" aria-label={tr("Delete")}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        {past.length ? (
          <>
            <p className={label + " mt-4 mb-2"}>{tr("Done")}</p>
            {past.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-1 py-0.5 text-[12.5px] text-[var(--c-mut)]">
                <span className="flex-1 truncate" dir="auto">{r.title}</span><span className="tabular-nums">{new Date(r.at).toLocaleDateString(locale())}</span>
                <button onClick={async () => { if (await askConfirm("Delete this reminder?")) remove(r.id); }} className="w-11 h-11 grid place-items-center rounded-[12px]" aria-label={tr("Delete")}><X size={13} /></button>
              </div>
            ))}
          </>
        ) : null}
      </div>
      </div></div>
    </div>
  );
}
