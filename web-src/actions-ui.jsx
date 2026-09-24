/* ---- reminders & actions: the card in Chat and the Reminders screen -------------
   The card shows exactly what will happen — kind, title, date and time, who —
   with each part editable, and nothing happens until "Set it" is tapped.     */
import React, { useState } from "react";
import { Bell, Trash2, X, Plus, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import { newReminderId, nextOccurrence } from "./actions.js";

export const KIND_ICON = { reminder: "🔔", alarm: "⏰", timer: "⏱️", calendar: "📅", whatsapp: "💬", call: "📞", none: "❔" };
export const KIND_LABEL = { reminder: "Reminder", alarm: "Alarm", timer: "Timer", calendar: "Calendar event", whatsapp: "WhatsApp message", call: "Phone call", none: "Nothing to do" };
const REPEAT_LABEL = { none: "Once", daily: "Every day", weekly: "Every week", weekdays: "Working days (Sun–Thu)" };

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
      <div className="rounded-2xl border border-teal-800/60 bg-teal-500/5 p-3.5 text-sm text-slate-300 flex items-center gap-2" data-testid="action-card">
        <Loader2 size={15} className="animate-spin text-teal-300" /> {tr("Reading what you want set…")}
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
  const field = "w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500";
  return (
    <div className={`rounded-2xl border p-3.5 ${done ? "border-emerald-800/70 bg-emerald-500/5" : cancelled ? "border-slate-800 opacity-60" : "border-teal-800/70 bg-teal-500/5"}`} data-testid="action-card">
      <p className="text-sm font-medium text-slate-100 flex items-center gap-1.5">
        <span className="text-base">{KIND_ICON[a.kind]}</span>{tr(KIND_LABEL[a.kind])}
        {msg.via ? <span className="ms-auto text-[10px] text-slate-500">{msg.via === "model" ? tr("read by the model · checked by the app") : tr("read on the phone")}</span> : null}
      </p>
      {done ? (
        <p className="text-sm text-emerald-200 mt-1.5 flex items-start gap-1.5" data-testid="action-done"><CheckCircle2 size={15} className="mt-0.5 shrink-0" />{tr(msg.doneText || "Done")}</p>
      ) : cancelled ? (
        <p className="text-sm text-slate-400 mt-1">{tr("Cancelled — nothing was set.")}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {a.kind !== "call" ? (
            <input dir="auto" value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} className={field} aria-label={tr("Title")} data-testid="act-title" />
          ) : null}
          {needsTime ? (
            <>
              <input type="datetime-local" value={toLocalInput(a.at)} onChange={(e) => setA({ ...a, at: fromLocalInput(e.target.value), allDay: false })} className={field} dir="ltr" data-testid="act-when" />
              {a.at ? <p className="text-[12px] text-teal-200" data-testid="act-when-text">{whenText(a.at, a.allDay)}</p> : null}
            </>
          ) : null}
          {a.kind === "reminder" || a.kind === "alarm" ? (
            <select value={a.repeat || "none"} onChange={(e) => setA({ ...a, repeat: e.target.value })} className={field}>
              {Object.keys(REPEAT_LABEL).map((k) => <option key={k} value={k}>{tr(REPEAT_LABEL[k])}</option>)}
            </select>
          ) : null}
          {a.kind === "timer" ? <p className="text-[13px] text-teal-200">{a.durationSec ? durText(a.durationSec) : tr("How long should the timer be?")}</p> : null}
          {a.kind === "calendar" && a.place ? <p className="text-[12px] text-slate-400">📍 {a.place}</p> : null}
          {a.kind === "whatsapp" || a.kind === "call" ? (
            <input dir="ltr" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value.replace(/[^\d+ ]/g, "") })} placeholder={a.contact ? tr("{name}'s number (optional)", { name: a.contact }) : tr("Phone number")} className={field} data-testid="act-phone" />
          ) : null}
          {a.kind === "whatsapp" ? (
            <textarea dir="auto" value={a.message} onChange={(e) => setA({ ...a, message: e.target.value })} rows={2} placeholder={tr("Message")} className={field + " resize-none"} />
          ) : null}
          {a.kind === "whatsapp" && !a.phone ? <p className="text-[11px] text-slate-500">{tr("No number — WhatsApp will open its contact list with the message ready.")}</p> : null}
          {problems.length ? problems.map((p) => <p key={p} className="text-[12px] text-amber-300 flex items-start gap-1"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{tr(p)}</p>) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={blocked || busy} data-testid="act-confirm" onClick={async () => { setBusy(true); try { await onDo(a); } finally { setBusy(false); } }}
              className="px-4 py-2 rounded-lg bg-teal-500 disabled:opacity-40 text-slate-950 text-sm font-semibold">
              {{ reminder: tr("Set reminder"), alarm: tr("Open in Clock"), timer: tr("Start in Clock"), calendar: tr("Add to calendar"), whatsapp: tr("Open WhatsApp"), call: tr("Open the dialer"), none: tr("Set it") }[a.kind]}
            </button>
            <button onClick={onCancel} className="px-3 py-2 rounded-lg border border-slate-700 text-sm text-slate-300" data-testid="act-cancel">{tr("Cancel")}</button>
            <button onClick={onAnswer} className="px-3 py-2 rounded-lg text-sm text-slate-400">{tr("Just answer")}</button>
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
  const now = Date.now();
  const list = reminders.map((r) => ({ ...r, next: r.done ? null : nextOccurrence(r, now - 60000) }))
    .sort((a, b) => (a.next || Infinity) - (b.next || Infinity));
  const upcoming = list.filter((r) => r.next && r.next >= now - 60000);
  const past = list.filter((r) => !(r.next && r.next >= now - 60000)).slice(0, 20);
  const exact = native && native.canExact ? native.canExact() : true;
  const notify = native && native.notifyAllowed ? native.notifyAllowed() : true;
  const add = () => {
    const t = fromLocalInput(at);
    if (!title.trim()) return flash(tr("Give it a title"));
    if (!t || t < Date.now()) return flash(tr("Pick a time in the future"));
    onSchedule({ id: newReminderId(), at: t, title: title.trim(), body: "", repeat, created: Date.now(), source: "manual" });
    setTitle("");
  };
  const remove = (id) => { setReminders(reminders.filter((r) => r.id !== id)); try { native && native.unschedule && native.unschedule(id); } catch (e) {} flash(tr("Removed")); };
  const field = "bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-teal-500";
  return (
    <div className="mt-3 space-y-4" data-testid="reminders-panel">
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <p className="text-sm text-slate-200 font-medium flex items-center gap-2"><Bell size={16} className="text-teal-300" />{tr("Reminders & actions")}</p>
        <p className="text-[12px] text-slate-500 mt-1">{tr("Just say it in Chat: “remind me tomorrow at 9 to call Ahmed”, “صحيني الساعة 6”, “ابعت لمحمود على الواتساب إني هتأخر”. You always confirm first.")}</p>
        {native && !notify ? (
          <button onClick={() => native.askNotifications && native.askNotifications()} className="mt-3 w-full text-start rounded-xl border border-amber-700/60 bg-amber-500/10 p-2.5 text-[12px] text-amber-200">
            {tr("Notifications are off for Attune — tap to allow them, or reminders can't appear.")}</button>
        ) : null}
        {native && !exact ? (
          <button onClick={() => native.askExact && native.askExact()} className="mt-2 w-full text-start rounded-xl border border-slate-700 p-2.5 text-[12px] text-slate-300" data-testid="ask-exact">
            {tr("Reminders may come up to 10 minutes late. Tap to allow “Alarms & reminders” for Attune so they ring on the minute.")}</button>
        ) : null}
        {!native ? <p className="mt-2 text-[11px] text-slate-500">{tr("In the browser reminders are only listed — the Android app rings them.")}</p> : null}
      </div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Add one")}</p>
        <input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr("What to remind you about")} className={field + " w-full"} data-testid="rem-title" />
        <div className="flex gap-2">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={field + " flex-1 min-w-0"} dir="ltr" data-testid="rem-at" />
          <select value={repeat} onChange={(e) => setRepeat(e.target.value)} className={field}>
            {Object.keys(REPEAT_LABEL).map((k) => <option key={k} value={k}>{tr(REPEAT_LABEL[k])}</option>)}
          </select>
        </div>
        <button onClick={add} className="w-full flex items-center justify-center gap-1.5 bg-teal-500 text-slate-950 font-semibold rounded-xl py-2.5 text-sm" data-testid="rem-add"><Plus size={16} />{tr("Add reminder")}</button>
      </div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4">
        <p className="text-[11px] uppercase tracking-wider text-slate-500 mb-2">{tr("Coming up")} · {upcoming.length}</p>
        {upcoming.length === 0 ? <p className="text-sm text-slate-500">{tr("Nothing set.")}</p> : (
          <div className="space-y-1.5">
            {upcoming.map((r) => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl bg-slate-950 border border-slate-800 px-3 py-2" data-testid="rem-item">
                <span>🔔</span>
                <div className="flex-1 min-w-0">
                  <p dir="auto" className="text-sm text-slate-100 truncate">{r.title}</p>
                  <p className="text-[11px] text-teal-300/80">{whenText(r.next)}{r.repeat && r.repeat !== "none" ? " · " + tr(REPEAT_LABEL[r.repeat]) : ""}{r.source === "promise" ? " · " + tr("from a promise") : ""}</p>
                </div>
                <button onClick={() => remove(r.id)} className="p-2 text-slate-500" aria-label={tr("Delete")}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
        {past.length ? (
          <>
            <p className="text-[11px] uppercase tracking-wider text-slate-600 mt-4 mb-2">{tr("Done")}</p>
            {past.map((r) => (
              <div key={r.id} className="flex items-center gap-2 px-1 py-1 text-[12px] text-slate-500">
                <span className="flex-1 truncate" dir="auto">{r.title}</span><span>{new Date(r.at).toLocaleDateString(locale())}</span>
                <button onClick={() => remove(r.id)} className="p-1" aria-label={tr("Delete")}><X size={13} /></button>
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
