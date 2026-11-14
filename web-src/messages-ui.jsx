/* ---- v9.7 Messages (Ali, 6 Nov 2026: "I want the scheduling agent to be like the Auto Text app, with my interface" — picked M3 + S1 + S2
   + S3, MOCKUPS.md, https://claude.ai/artifact/EJoWBPbPS2J5B5EsCEnmxj): three tabs — Scheduled · Auto-reply · Sent; the composer (app,
   person, words, templates, "write it for me", time, how it repeats, ask me first, send by itself); auto-reply rules. Logic:
   msgsched.js (tests/unit/v970messages.test.mjs); on the phone: Reminders.kt (sending), AutoReply.kt (rules), AutoSend.kt + SmsOut.kt
   (sending by itself — the full APK only). */
import { proGate } from "./plan-ui.jsx";
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Send, Clock, X, Trash2, Plus, PenLine, MessageCircle, Repeat } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as A from "./agents.js";
import * as A2 from "./agents2.js";
import * as M from "./msgsched.js";
import * as U from "./ui-kit.jsx";

const T = (s, v) => tr(s, v);
const RULES_KEY = "attune:autoreply:v1", TPL_KEY = "attune:msg-templates:v1";
const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || "null"); return v == null ? d : v; } catch (e) { return d; } };
const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const N0 = () => (typeof window !== "undefined" && window.AttuneNative) || null;
const inbox = (N) => { try { return N && N.chatInbox ? JSON.parse(N.chatInbox() || "[]") : []; } catch (e) { return []; } };
const localIso = (t) => { const d = new Date(t); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
const whenTxt = (t) => { try { return new Date(t).toLocaleString(dateLocale(), { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; } };

function AppMark({ app, size = 34 }) {
  const a = M.appOf(app);
  return <span className="grid place-items-center rounded-[11px] text-white font-black shrink-0" style={{ width: size, height: size, background: a.col, fontSize: size * 0.4 }} aria-label={a.label}>{a.short}</span>;
}

/** Saves a message: the agent (Agents' list), and the phone's alarm that sends it (Reminders.kt). Pure enough to test in a browser. */
export function scheduleMessage(m, N = N0(), now = Date.now()) {
  const st = A.loadAgents();
  const chat = m.app === "whatsapp" || m.app === "wab" ? A2.chatFor(m.who, inbox(N)) : null;
  const at = m.repeat && m.repeat !== "none" ? M.nextAt(m.at, m.repeat, now - 60000) || m.at : m.at;
  const base = m.id ? (st.agents.find((x) => x.id === m.id) || {}) : A.makeAgent({ kind: "send", who: m.who, text: m.text, at });
  const a = { ...base, kind: "send", who: m.who, text: m.text, at, app: m.app || "whatsapp", phone: m.phone || "", email: m.email || "", subject: m.subject || "", repeat: m.repeat || "none",
    ask: !!m.ask, auto: !!m.auto, key: chat ? chat.key : "", pkg: M.appOf(m.app).pkg || (chat ? chat.pkg : ""), state: "scheduled", on: true };
  A.saveAgents({ ...st, agents: [a, ...st.agents.filter((x) => x.id !== a.id)] });
  try {
    if (N && N.unschedule) N.unschedule("msg-" + a.id);
    if (N && N.schedule) N.schedule(JSON.stringify({ id: "msg-" + a.id, at, title: T("Message to {who}", { who: a.who }), body: a.text, repeat: a.repeat,
      send: { key: a.key, pkg: a.pkg, phone: a.phone, text: a.text, who: a.who, app: a.app, ask: a.ask, auto: a.auto, email: a.email, subject: a.subject,
        sentTitle: T("Sent to {who}", { who: a.who }), dueTitle: T("Time to send to {who} — tap to open the chat", { who: a.who }),
        askTitle: T("Send to {who} now?", { who: a.who }), sendLabel: tr("Send"), skipLabel: tr("Not now") } }));
  } catch (e) {}
  return a;
}

/** S2 — the composer. */
function Composer({ init, onSave, onClose, nativeCall, drafter, msgState }) {
  const [m, setM] = useState(() => ({ app: "whatsapp", who: "", phone: "", email: "", subject: "", text: "", repeat: "none", ask: false, auto: !!(msgState && msgState.autoOn), at: Date.now() + 3600e3, ...(init || {}) }));
  const [tpl, setTpl] = useState(false), [idea, setIdea] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const pick = async () => { try { const c = await nativeCall("contactPick", {}); if (c) setM((x) => ({ ...x, who: c.name || x.who, phone: c.phone || x.phone })); } catch (e) {} };
  const templates = jget(TPL_KEY, []);
  const ar = getLang() === "ar";
  const write = async () => {
    if (!drafter || !idea || !idea.trim()) return; setBusy(true);
    try { const t = await drafter(`Write one short, warm ${M.appOf(m.app).label} message to ${m.who || "a friend"} about: ${idea.trim()}. Write it in the same language as these words. Reply with the message only.`); if (t) set("text", t); setIdea(null); } catch (e) {}
    setBusy(false);
  };
  const save = () => { const miss = M.missing(m); if (miss.length) { setErr(miss.map((x) => tr(x)).join(" · ")); return; } onSave(m); };
  const keepTpl = () => { if (!m.text.trim()) return; jset(TPL_KEY, [m.text.trim(), ...templates.filter((x) => x !== m.text.trim())].slice(0, 30)); setTpl(false); };
  return <div className={U.cardPad + " space-y-3"} data-testid="msg-composer">
    <div className="flex items-center gap-2"><b className="flex-1 text-[16px]">{m.id ? tr("Edit message") : tr("New message")}</b>
      <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 grid place-items-center rounded-full c-sub" data-testid="msg-close"><X size={17} /></button></div>
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("App")}>{M.APPS.map((a) => <button key={a.id} onClick={() => set("app", a.id)} aria-pressed={m.app === a.id} className={U.chip(m.app === a.id)} data-testid={"msg-app-" + a.id}>{a.label}</button>)}</div>
    <div className="flex gap-2"><input value={m.who} onChange={(e) => set("who", e.target.value)} dir="auto" placeholder={tr("To whom?")} className={U.inp + " flex-1"} data-testid="msg-who" />
      {nativeCall ? <button onClick={pick} className={U.btnS} data-testid="msg-contact">{tr("Contacts")}</button> : null}</div>
    {m.app === "email" ? <div className="grid gap-2"><input value={m.email} onChange={(e) => set("email", e.target.value)} type="email" dir="ltr" placeholder={tr("Their email address")} className={U.inp} data-testid="msg-email" />
      <input value={m.subject} onChange={(e) => set("subject", e.target.value)} dir="auto" placeholder={tr("Subject")} className={U.inp} data-testid="msg-subject" /></div>
      : <input value={m.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" dir="ltr" placeholder={tr("Phone (with country code)")} className={U.inp} data-testid="msg-phone" />}
    <textarea value={m.text} onChange={(e) => set("text", e.target.value)} dir="auto" rows={3} placeholder={tr("The message")} className={U.area} data-testid="msg-text" />
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => setTpl(!tpl)} className={U.btnS + " h-10! min-h-[40px]!"} aria-expanded={tpl} data-testid="msg-templates">{tr("Templates")}</button>
      {drafter ? <button onClick={() => setIdea(idea == null ? "" : null)} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="msg-write">✨ {tr("Write it for me")}</button> : null}
    </div>
    {tpl ? <div className="rounded-[14px] bg-[var(--c-surf-2)] p-2 space-y-1.5" data-testid="msg-tpl-list">
      {[...templates, ...(ar ? ["كل سنة وانت طيب 🎉", "تذكير: القسط بكرة", "أنا في الطريق، هوصل كمان شوية"] : ["Happy birthday! Wishing you a wonderful year 🎉", "Reminder: the payment is due tomorrow", "On my way — I'll be there soon"])].slice(0, 12).map((t, i) =>
        <button key={i} onClick={() => { set("text", t); setTpl(false); }} className="block w-full text-start px-2.5 py-2 rounded-[10px] bg-[var(--c-surf)] text-[13.5px]" dir="auto" data-testid="msg-tpl">{t}</button>)}
      {m.text.trim() ? <button onClick={keepTpl} className="text-[12.5px] font-bold c-acc px-2 min-h-[36px]" data-testid="msg-tpl-keep">{tr("Keep this message as a template")}</button> : null}
    </div> : null}
    {idea != null ? <div className="flex gap-2"><input autoFocus value={idea} onChange={(e) => setIdea(e.target.value)} dir="auto" placeholder={tr("What about? e.g. her birthday, thank him for the help")} className={U.inp + " flex-1"} data-testid="msg-idea" />
      <button onClick={write} disabled={busy} className={U.btnS} data-testid="msg-idea-go">{busy ? "…" : tr("Write")}</button></div> : null}
    <input type="datetime-local" value={localIso(m.at)} onChange={(e) => set("at", Date.parse(e.target.value))} className={U.inp} dir="ltr" aria-label={tr("When")} data-testid="msg-at" />
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("Repeat")}>{M.REPEATS.map((r) => <button key={r} onClick={() => set("repeat", r)} aria-pressed={m.repeat === r} className={U.chip(m.repeat === r)} data-testid={"msg-repeat-" + r}>{tr(M.REPEAT_LINE[r])}</button>)}</div>
    <div className="rounded-[14px] bg-[var(--c-surf-2)] px-3 py-1">
      <Toggle on={m.ask} set={(v) => set("ask", v)} label={tr("Ask me before sending")} sub={tr("At its time you get “Send to … now?” — nothing goes until you tap Send.")} testid="msg-ask" />
      {msgState && msgState.auto ? <Toggle on={m.auto && !m.ask} set={(v) => set("auto", v)} label={tr("Send by itself")} sub={msgState.autoOn ? tr("WhatsApp: Attune presses Send for you (phone unlocked). SMS: sent directly.") : tr("Turn on “Send by itself” below first.")} testid="msg-auto" /> : null}
    </div>
    {err ? <p className="m-0 text-[13px] font-bold text-[var(--c-warn)]" data-testid="msg-missing">{err}</p> : null}
    <button onClick={save} className={U.btnP + " w-full"} data-testid="msg-save"><Clock size={16} />{tr("Schedule")}</button>
  </div>;
}
function Toggle({ on, set, label, sub, testid }) {
  return <button onClick={() => set(!on)} role="switch" aria-checked={!!on} className="w-full flex items-center gap-3 py-2.5 text-start" data-testid={testid}>
    <span className="flex-1 min-w-0"><b className="block text-[14px]">{label}</b>{sub ? <span className="block text-[12px] c-sub">{sub}</span> : null}</span>
    <span className={"w-10 h-6 rounded-full relative shrink-0 transition-colors " + (on ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]")}><span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all " + (on ? "end-0.5" : "start-0.5")} /></span>
  </button>;
}

/** S3 — auto-reply rules: when (on now · on silent · between hours), what words, which apps, who; never groups unless allowed; once a day. */
function RuleCard({ r, save, remove, ar }) {
  const [open, setOpen] = useState(false), [names, setNames] = useState((r.list || []).join(", "));
  const put = (k, v) => save({ ...r, [k]: v });
  const when = r.mode === "silent" ? tr("When the phone is on silent") : r.mode === "hours" ? T("Between {a} and {b}", { a: r.from, b: r.to }) : tr("Now, until I turn it off");
  return <div className={U.cardPad + " space-y-2"} data-testid="msg-rule">
    <div className="flex items-center gap-2"><span className="text-[18px]" aria-hidden="true">{r.icon || "💬"}</span><b className="flex-1 min-w-0 text-[15px] truncate" dir="auto">{tr(r.name)}</b>
      <button onClick={() => put("on", !r.on)} role="switch" aria-checked={!!r.on} aria-label={tr("On")} data-testid="msg-rule-on"
        className={"w-10 h-6 rounded-full relative shrink-0 " + (r.on ? "bg-[var(--c-acc)]" : "bg-[var(--c-ln)]")}><span className={"absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm " + (r.on ? "end-0.5" : "start-0.5")} /></button></div>
    <p className="m-0 text-[13.5px]" dir="auto">«{r.text}»</p>
    <p className="m-0 text-[12px] c-sub">{when} · {(r.apps || []).map((a) => M.appOf(a).label).join(", ")} · {r.who === "only" ? T("only {n}", { n: (r.list || []).join(", ") }) : r.who === "except" ? T("everyone except {n}", { n: (r.list || []).join(", ") }) : tr("everyone")}{r.groups ? "" : " · " + tr("not groups")}{r.once ? " · " + tr("once a day per person") : ""}</p>
    <div className="flex gap-1.5"><button onClick={() => setOpen(!open)} className={U.btnS + " h-9! min-h-[36px]!"} aria-expanded={open} data-testid="msg-rule-edit"><PenLine size={14} />{tr("Change")}</button>
      <button onClick={remove} className={U.btnS + " h-9! min-h-[36px]!"} aria-label={tr("Delete")} data-testid="msg-rule-del"><Trash2 size={14} /></button></div>
    {open ? <div className="space-y-2 pt-1" data-testid="msg-rule-form">
      <textarea value={r.text} onChange={(e) => put("text", e.target.value)} dir="auto" rows={2} className={U.area} aria-label={tr("The reply")} data-testid="msg-rule-text" />
      <div className="flex flex-wrap gap-1.5">{[["now", tr("Now, until I turn it off")], ["silent", tr("When the phone is on silent")], ["hours", tr("Between hours")]].map(([k, l]) => <button key={k} onClick={() => put("mode", k)} aria-pressed={r.mode === k} className={U.chip(r.mode === k)} data-testid={"msg-rule-mode-" + k}>{l}</button>)}</div>
      {r.mode === "hours" ? <div className="flex gap-2 items-center"><input type="time" value={r.from} onChange={(e) => put("from", e.target.value)} className={U.inp} aria-label={tr("From")} /><span>→</span><input type="time" value={r.to} onChange={(e) => put("to", e.target.value)} className={U.inp} aria-label={tr("To")} /></div> : null}
      <div className="flex flex-wrap gap-1.5">{M.APPS.filter((a) => a.id !== "email").map((a) => { const on = (r.apps || []).includes(a.id); return <button key={a.id} onClick={() => put("apps", on ? r.apps.filter((x) => x !== a.id) : [...(r.apps || []), a.id])} aria-pressed={on} className={U.chip(on)}>{a.label}</button>; })}</div>
      <div className="flex flex-wrap gap-1.5">{[["all", tr("Everyone")], ["only", tr("Only these people")], ["except", tr("Everyone except")]].map(([k, l]) => <button key={k} onClick={() => put("who", k)} aria-pressed={r.who === k} className={U.chip(r.who === k)}>{l}</button>)}</div>
      {r.who !== "all" ? <input value={names} onChange={(e) => setNames(e.target.value)} onBlur={() => put("list", names.split(/[,،]/).map((x) => x.trim()).filter(Boolean))} dir="auto" placeholder={ar ? "ماما، أحمد، الشيخ" : tr("Names, separated by commas")} className={U.inp} data-testid="msg-rule-names" /> : null}
      <Toggle on={r.groups} set={(v) => put("groups", v)} label={tr("Reply in groups too")} testid="msg-rule-groups" />
      <Toggle on={r.once} set={(v) => put("once", v)} label={tr("Once a day per person")} testid="msg-rule-once" />
    </div> : null}
  </div>;
}

function MessagesPageInner({ back, flash, nativeCall, drafter, startNew = false }) {
  const N = N0(), ar = getLang() === "ar";
  const [tab, setTab] = useState("scheduled");
  const [tick, setTick] = useState(0);
  const [edit, setEdit] = useState(startNew ? {} : null);
  const [explain, setExplain] = useState(false);
  const [msgState, setMsgState] = useState(() => { try { return N && N.msgState ? JSON.parse(N.msgState() || "{}") : {}; } catch (e) { return {}; } });
  useEffect(() => { const on = () => { if (document.visibilityState === "visible") { try { N && N.msgState && setMsgState(JSON.parse(N.msgState() || "{}")); } catch (e) {} setTick((x) => x + 1); } }; document.addEventListener("visibilitychange", on); return () => document.removeEventListener("visibilitychange", on); }, []);
  const now = Date.now();
  const list = useMemo(() => A.loadAgents().agents.filter((a) => a.kind === "send").map((a) => ({ ...a, next: M.nextAt(a.at, a.repeat || "none", now - 60000) }))
    .sort((a, b) => (a.next == null) - (b.next == null) || (a.next || a.at) - (b.next || b.at)), [tick, edit]);
  const upcoming = list.filter((a) => a.next != null && a.state !== "sent" || (a.repeat && a.repeat !== "none"));
  const [rules, setRulesRaw] = useState(() => { try { const r = N && N.autoReplyRules ? JSON.parse(N.autoReplyRules() || "[]") : null; return r && r.length ? r : jget(RULES_KEY, []); } catch (e) { return jget(RULES_KEY, []); } });
  const setRules = (r) => { setRulesRaw(r); jset(RULES_KEY, r); try { N && N.autoReplySet && N.autoReplySet(JSON.stringify(r)); } catch (e) {} };
  const sent = useMemo(() => { try { return M.sentList(N && N.msgSent ? JSON.parse(N.msgSent() || "[]") : []); } catch (e) { return []; } }, [tick, tab]);
  const today = new Date().toDateString(), repliedToday = sent.filter((x) => x.how === "autoreply" && x.ok && new Date(x.at).toDateString() === today);
  const save = (m) => { const a = scheduleMessage({ ...m, id: m.id || undefined }, N); setEdit(null); setTick((x) => x + 1); flash && flash(T("Scheduled: {who}, {t}", { who: a.who, t: whenTxt(a.at) })); };
  const remove = (a) => { try { N && N.unschedule && N.unschedule("msg-" + a.id); } catch (e) {} const st = A.loadAgents(); A.saveAgents({ ...st, agents: st.agents.filter((x) => x.id !== a.id) }); setTick((x) => x + 1); };
  const sendNow = (a) => {
    let r = {}; try { r = a.key && N && N.chatReply ? JSON.parse(N.chatReply(JSON.stringify({ key: a.key, text: a.text })) || "{}") : {}; } catch (e) {}
    if (r.ok) { const st = A.loadAgents(); A.saveAgents({ ...st, agents: st.agents.map((x) => (x.id === a.id ? { ...x, state: a.repeat && a.repeat !== "none" ? "scheduled" : "sent", doneAt: Date.now() } : x)) }); setTick((x) => x + 1); flash && flash(T("Sent to {who}", { who: a.who })); return; }
    const url = M.linkFor(a);
    try { navigator.clipboard && navigator.clipboard.writeText(a.text); } catch (e) {}
    try { N && N.openAnyApp && N.openAnyApp(JSON.stringify({ pkg: a.pkg || "", url })); } catch (e) {}
    flash && flash(url ? tr("The chat opens with the message written — tap Send") : tr("Copied — paste it in the chat"));
  };
  const HOWL = (h) => tr(M.HOW[h] || M.HOW.failed);
  const tabs = [["scheduled", T("Scheduled {n}", { n: upcoming.length })], ["auto", tr("Auto-reply")], ["sent", tr("Sent")]];
  return <div className="calm pt-1 pb-24 space-y-3 max-w-2xl relative" data-testid="messages-page">
    <div className="flex items-center gap-2">{back ? <button onClick={back} className="w-11 h-11 grid place-items-center rounded-full border border-[var(--c-ln)] bg-[var(--c-surf)]" aria-label={tr("Back")} data-testid="messages-back"><ArrowLeft size={18} className="rtl:-scale-x-100" /></button> : null}
      <b className="flex-1 text-[19px] font-black">{tr("Messages")}</b></div>
    <div className="flex gap-1 rounded-full bg-[var(--c-surf-2)] p-1" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setEdit(null); }}
      className={"flex-1 min-h-[38px] rounded-full text-[13px] font-extrabold " + (tab === k ? "bg-[var(--c-surf)] c-acc shadow-sm" : "c-sub")} data-testid={"messages-tab-" + k}>{l}</button>)}</div>

    {tab === "scheduled" ? <>
      {edit ? <Composer init={edit.id ? edit : edit} onSave={save} onClose={() => setEdit(null)} nativeCall={nativeCall} drafter={drafter} msgState={msgState} /> : null}
      {!edit && !upcoming.length ? <U.EmptyStart testid="messages-empty" title={tr("No scheduled messages yet")} sub={tr("Birthdays, reminders to people, a message for later — once, or every day, week, month or year.")}
        examples={ar ? ["ابعت لماما كل سنة يوم 3 فبراير الساعة 9: كل سنة وانتي طيبة", "ابعت للشيخ كل شهر يوم 4 الساعة 8 بالليل: تذكير بالقسط"] : ["Send Mama every year on 3 Feb at 9: happy birthday", "Remind Sheikh every month on the 4th at 8 pm about the instalment"]}
        onPick={() => setEdit({})} /> : null}
      {upcoming.map((a) => <div key={a.id} className={U.cardPad + " space-y-2"} data-testid="msg-card">
        <div className="flex items-start gap-2.5"><AppMark app={a.app || "whatsapp"} />
          <div className="flex-1 min-w-0"><b className="block text-[15px] truncate" dir="auto">{a.who}</b>
            <span className="block text-[12.5px] c-sub">{a.next ? whenTxt(a.next) : whenTxt(a.at)} · {tr(M.REPEAT_LINE[a.repeat || "none"])}{a.ask ? " · " + tr("asks first") : a.auto ? " · " + tr("by itself") : ""}</span></div>
          {a.repeat === "yearly" ? <span className={U.tag("amber")}>{tr("Every year")}</span> : a.repeat && a.repeat !== "none" ? <span className={U.tag("gray")}><Repeat size={11} className="inline -mt-0.5" /> {tr("Repeats")}</span> : null}</div>
        <p className="m-0 rounded-[12px] bg-[var(--c-surf-2)] px-3 py-2 text-[13.5px]" dir="auto" data-testid="msg-card-text">{a.text}</p>
        <div className="flex gap-1.5"><button onClick={() => sendNow(a)} className={U.btnS + " h-9! min-h-[36px]!"} data-testid="msg-send-now"><Send size={14} />{tr("Send now")}</button>
          <button onClick={() => setEdit({ ...a, at: a.next || a.at })} className={U.btnS + " h-9! min-h-[36px]!"} data-testid="msg-edit"><PenLine size={14} />{tr("Change")}</button>
          <button onClick={() => remove(a)} className={U.btnS + " h-9! min-h-[36px]! ms-auto"} aria-label={tr("Delete")} data-testid="msg-del"><Trash2 size={14} /></button></div>
      </div>)}
      {/* how it sends on this phone (M3): the chat's own reply / one tap everywhere; by itself in the full APK, switched on here */}
      <div className={U.cardPad + " space-y-2"} data-testid="msg-how">
        <b className="block text-[14px]">{tr("How messages are sent")}</b>
        <p className="m-0 text-[12.5px] c-sub">{tr("Through the chat's own reply when its notification is on your phone; otherwise a notification opens the chat with the message written — one tap on Send.")}</p>
        {!msgState.auto && N ? <p className="m-0 text-[12px] c-sub" data-testid="msg-auto-elsewhere">{tr("“Send by itself” (like Auto Text) is in the separate Attune Auto APK — Google Play Protect may block it when installed from a file.")}</p> : null}
        {msgState.auto ? (msgState.autoOn ? <p className="m-0 text-[13px] font-bold text-[var(--c-pos)]" data-testid="msg-auto-on">✓ {tr("Send by itself is on (WhatsApp, phone unlocked).")}</p>
          : <button onClick={() => setExplain(true)} className={U.btnS + " w-full"} data-testid="msg-auto-turn-on">{tr("Turn on “Send by itself” (like Auto Text)")}</button>) : null}
        {msgState.sms && !msgState.smsOn ? <button onClick={() => { try { N.msgAskSms(); } catch (e) {} setTimeout(() => setTick((x) => x + 1), 1500); }} className={U.btnS + " w-full"} data-testid="msg-sms-allow">{tr("Allow SMS to be sent by itself")}</button> : null}
        {explain ? <div className="rounded-[14px] border-2 border-[var(--c-acc)] p-3 space-y-2" data-testid="msg-auto-explain">
          <b className="block text-[14px]">{tr("What “Send by itself” does")}</b>
          <ul className="m-0 ps-5 text-[13px] space-y-1"><li>{tr("At a message's time, Attune opens that WhatsApp chat with your message written and presses Send for you.")}</li>
            <li>{tr("It uses Android's Accessibility service only for that: only in WhatsApp, only for messages you scheduled, only when the box holds your message.")}</li>
            <li>{tr("It reads nothing else and sends nothing else. When the phone is locked it can't — you get the one-tap notification instead.")}</li></ul>
          <div className="flex gap-2"><button onClick={() => { try { N.msgOpenAuto(); } catch (e) {} setExplain(false); }} className={U.btnP + " flex-1"} data-testid="msg-auto-go">{tr("Open Accessibility settings")}</button>
            <button onClick={() => setExplain(false)} className={U.btnS}>{tr("Not now")}</button></div>
          <p className="m-0 text-[11.5px] c-sub">{tr("In Settings: Accessibility → Attune → turn it on. Come back here after.")}</p></div> : null}
      </div>
      {!edit ? <button onClick={() => setEdit({})} className="fixed z-30 end-5 bottom-24 lg:bottom-8 w-14 h-14 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc)] grid place-items-center shadow-lg" aria-label={tr("New message")} data-testid="msg-new"><Plus size={24} /></button> : null}
    </> : null}

    {tab === "auto" ? <div className="space-y-2.5" data-testid="msg-auto">
      <p className="m-0 text-[12.5px] c-sub">{tr("Attune answers by itself through the chat's own reply — it needs Notification access, and works in every version.")}</p>
      {rules.map((r) => <RuleCard key={r.id} r={r} ar={ar} save={(x) => setRules(rules.map((y) => (y.id === x.id ? x : y)))} remove={() => setRules(rules.filter((y) => y.id !== r.id))} />)}
      <div className="flex flex-wrap gap-1.5" data-testid="msg-rule-presets">{M.RULE_PRESETS.filter((p) => !rules.some((r) => r.name === p.name)).map((p) =>
        <button key={p.id} onClick={() => setRules([...rules, M.newRule({ ...p, id: "", text: ar ? p.textAr : tr(p.text), on: false })])} className={U.btnS + " h-10! min-h-[40px]!"} data-testid={"msg-rule-add-" + p.id}>{p.icon} {tr(p.name)}</button>)}
        <button onClick={() => setRules([...rules, M.newRule({ text: "", on: false })])} className={U.btnS + " h-10! min-h-[40px]!"} data-testid="msg-rule-add"><Plus size={14} />{tr("New rule")}</button></div>
      <div className={U.cardPad} data-testid="msg-replied-today"><div className="flex items-center justify-between"><b className="text-[14px]">{tr("Replied today")}</b><span className={U.tag(repliedToday.length ? "green" : "gray")}>{repliedToday.length}</span></div>
        {repliedToday.length ? <p className="m-0 mt-1 text-[12.5px] c-sub" dir="auto">{repliedToday.slice(0, 6).map((x) => x.who + " · " + new Date(x.at).toLocaleTimeString(dateLocale(), { hour: "numeric", minute: "2-digit" })).join(" · ")}</p> : null}</div>
    </div> : null}

    {tab === "sent" ? <div className="space-y-2" data-testid="msg-sent">
      {sent.length ? sent.map((x, i) => <div key={i} className={U.cardPad + " flex items-start gap-2.5"} data-testid="msg-sent-row">
        <AppMark app={x.app || "whatsapp"} size={30} />
        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><b className="flex-1 min-w-0 truncate text-[14px]" dir="auto">{x.who}</b><span className="text-[11.5px] c-sub shrink-0">{whenTxt(x.at)}</span></div>
          <p className="m-0 text-[13px] truncate" dir="auto">{x.text}</p>
          <span className={U.tag(x.ok ? "green" : x.how === "opened" || x.how === "asked" ? "amber" : "red") + " mt-1 inline-block"}>{x.how === "autoreply" ? tr("Auto-reply") + (x.rule ? " · " + tr(x.rule) : "") : HOWL(x.how)}</span></div>
      </div>) : <p className={U.card + " p-4 m-0 text-[13.5px] c-sub"} data-testid="msg-sent-empty">{tr("Nothing sent yet. Scheduled messages and auto-replies show here once they go.")}</p>}
    </div> : null}
  </div>;
}

// v9.9.34 FP-4: Pro only (Free sees "Part of Pro"; nothing made is lost)
export const MessagesPage = proGate("msgSchedule", "Scheduled messages", MessagesPageInner);
