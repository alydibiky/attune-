/* ---- Voice step 1.5–1.6 (VOICE_PLAN.md) — "Ya Attune", design A (Ali's pick, 25 Oct 2026: the calm orb).
   A quiet full screen: the jade orb breathes while it listens, your words under it, then ONE card — a question (which person,
   which language) or the read-back (the full contact, the app, their last message, Change / Send) or the messages read aloud.
   Hands-free: after Attune speaks it listens again until the conversation ends. Typing works too (a box under the orb).
   The brain is voice-cmd.js (code, no guessing); anything that is not a message goes to the Home box (doIt) — money, reminders,
   Agents, apps — and its answer is spoken. Sending: the chat's own notification reply (ChatInbox.kt, exactly that chat), else
   the app opens with the text ready and the person picks the contact. */
import React, { useEffect, useRef, useState } from "react";
import { X, Send, Mic, Check, Pencil, Car, MessageCircle, MapPin, Volume2 } from "lucide-react";
import { tr, getLang } from "./i18n.js";
import * as V from "./voice-cmd.js";
import { loadPeople, savePeople } from "./franco.js";
import { SmsSwitch } from "./sms-ui.jsx";
import { WakeSwitch } from "./wake-ui.jsx";
import { smallTalk, forSpeech } from "./voice-talk.js";
import { mindAnswer } from "./personal.js";
import * as LA from "./lifeask.js";

const STYLE_BY_COUNTRY = { EG: "eg", SA: "gulf", AE: "gulf", KW: "gulf", QA: "gulf", BH: "gulf", OM: "gulf", JO: "lev", LB: "lev", SY: "lev", PS: "lev", IQ: "gulf", MA: "maghreb", DZ: "maghreb", TN: "maghreb", LY: "maghreb" };
const LISTEN_TAG = { eg: "ar-EG", gulf: "ar-SA", lev: "ar-JO", maghreb: "ar-MA" };
// global (2.2): the languages the mic and the voice speak besides Arabic and English, from the country and the app's language
const COUNTRY_LANG = { TR: "tr", ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", FR: "fr", BE: "fr", CH: "fr", SN: "fr", CI: "fr" };
const TAG = { en: "en-US", tr: "tr-TR", es: "es-ES", fr: "fr-FR" };
/** The tag the mic listens in for this country and app language (the quiet orb uses the same one). */
export function voiceTag(country = "EG") {
  const style = STYLE_BY_COUNTRY[(country || "EG").toUpperCase()] || "eg";
  const local = COUNTRY_LANG[(country || "").toUpperCase()] || (["tr", "es", "fr"].includes(getLang()) ? getLang() : null);
  const l = getLang() === "ar" ? "ar" : local || "en";
  return l === "ar" ? LISTEN_TAG[style] : TAG[l] || "en-US";
}
const APP_NAME = { whatsapp: "WhatsApp", telegram: "Telegram", messenger: "Messenger", signal: "Signal", instagram: "Instagram" };

export function VoiceScreen({ native: N, nativeCall, onClose, doIt, ask, country = "EG", flash, initialText = "" }) {
  const style = STYLE_BY_COUNTRY[(country || "EG").toUpperCase()] || "eg";
  const [st, setSt] = useState(() => ({ ...V.newVoiceState(), ui: getLang() === "ar" ? "ar" : "en" }));
  const [edit, setEdit] = useState(null);   // the read-back's words being changed by hand
  const [heard, setHeard] = useState("");
  const [say, setSay] = useState("");
  const [card, setCard] = useState(null);
  const [listening, setListening] = useState(false);
  const [typed, setTyped] = useState("");
  const local = COUNTRY_LANG[(country || "").toUpperCase()] || (["tr", "es", "fr"].includes(getLang()) ? getLang() : null);
  const langs = [...new Set([getLang() === "ar" ? "ar" : local || "en", "ar", "en", ...(local ? [local] : [])])];
  const [speakLang, setSpeakLang] = useState(langs[0]);   // what the mic listens for (the button cycles through langs)
  const stRef = useRef(st); stRef.current = st;
  const history = useRef([]);              // the last turns of a free conversation (sent to the model with the next question)
  // Voice 2.1 car mode (design A's car screen): big buttons, the newest message read aloud by itself, Reply / Navigate by voice
  const [car, setCar] = useState(false);
  const [newest, setNewest] = useState(null);
  const pending = useRef(null);            // what the next words are for: "reply" | "nav" | null
  const seen = useRef(0);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; try { N && N.stopListening && N.stopListening(); N && N.stopSpeaking && N.stopSpeaking(); N && N.wakeResume && N.wakeResume(); } catch (e) {} }, []);   // closing gives the mic back to «يا أتيون»

  const inbox = () => { try { return N && N.chatInbox ? JSON.parse(N.chatInbox() || "[]") : []; } catch (e) { return []; } };
  const speakOut = async (text, lang) => {
    if (!text) return;
    const tag = lang === "ar" ? LISTEN_TAG[style] : TAG[lang] || "en-US";
    try {
      if (N && N.speakWait && nativeCall) { await nativeCall("speakWait", { text, lang: tag }); return; }
      if (N && N.speak) { N.speak(text, tag); return; }
      if (typeof window !== "undefined" && window.speechSynthesis) await new Promise((res) => { const u = new SpeechSynthesisUtterance(text); u.lang = tag; u.onend = res; u.onerror = res; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); setTimeout(res, 15000); });
    } catch (e) {}
  };
  const send = async (a) => {
    if (a.key && N && N.chatReply) {
      let r = {}; try { r = JSON.parse(N.chatReply(JSON.stringify({ key: a.key, text: a.text })) || "{}"); } catch (e) {}
      if (r.ok) return true;
    }
    // no reply action (no recent chat, or Attune restarted): the app opens with the text ready — the person picks the contact
    if (a.app === "sms") { try { if (N && N.intent) { const r = JSON.parse(N.intent(JSON.stringify({ kind: "sms", phone: "", message: a.text })) || "{}"); return r.ok !== false; } } catch (e) {} }
    try {
      if (N && N.intent) { const r = JSON.parse(N.intent(JSON.stringify({ kind: "whatsapp", phone: "", message: a.text })) || "{}"); return r.ok !== false; }
    } catch (e) {}
    try { window.open("https://wa.me/?text=" + encodeURIComponent(a.text), "_blank"); } catch (e) {}
    return true;
  };
  const navigate = (place) => {
    const url = "https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=" + encodeURIComponent(place);
    try { if (N && N.openAnyApp) { N.openAnyApp(JSON.stringify({ pkg: "com.google.android.apps.maps", url })); return; } } catch (e) {}
    try { window.open(url, "_blank"); } catch (e) {}
  };
  // words heard (or typed): in car mode they may be the reply or the destination the screen asked for
  const heardDone = async (said) => {
    const text = String(said || "").trim(); if (!text) return;
    const p = pending.current; pending.current = null;
    if (p === "nav") { setHeard(text); const line = (stRef.current.ui === "ar" ? "رايحين " : "Navigating to ") + text; setSay(line); setCard({ kind: "done", ok: true }); navigate(text); await speakOut(line, stRef.current.ui); return; }
    if (p === "reply") return turn((stRef.current.ui === "ar" ? "رد عليه " : "reply saying ") + text);
    return turn(text);
  };
  const turn = async (said) => {
    const text = String(said || "").trim(); if (!text) return;
    if (/^(?:وضع العربي[هة]|وضع السواقه|وضع السواقة|car mode|driving mode)$/i.test(text)) { setCar(true); return; }
    setHeard(text);
    const people = loadPeople();
    const r = V.voiceTurn(stRef.current, text, { inbox: inbox(), people, style, defaultApp: "whatsapp" });
    if (r.people) savePeople(r.people);
    setSt(r.state);
    if (r.action && r.action.kind === "pass") {
      // not a message: the Home box does it (money, reminders, Agents, apps) and its answer is spoken
      let line = "", talk = false;
      const ui = /[\u0600-\u06ff]/.test(text) ? "ar" : r.state.ui;
      // (v8.7: an answer from your data is an {en, ar} — it was read out as nothing)
      try { const res = doIt ? await doIt(text) : null; line = res ? (res.answer ? (typeof res.answer === "string" ? res.answer : (ui === "ar" ? res.answer.ar : res.answer.en) || "") : (res.lines || []).map((l) => l.text).join(" · ")) : ""; } catch (e) {}
      // v8.6 (Ali: "fix the voice part for good"): not an action → a real conversation — small talk by code at once, anything
      // else to the AI model on the phone (short spoken answer, the last turns kept), never a dead "I didn't get that"
      // v8.7 (Ali: the voice said "I don't have access to your personal information like your barber" — it was in the app)
      if (!line) { try { const pm = mindAnswer(text, LA.loadStores()); if (pm) line = ui === "ar" ? pm.ar : pm.en; } catch (e) {} }
      if (!line) { line = smallTalk(text, ui); talk = !!line; }
      if (!line && ask) {
        setSay(ui === "ar" ? "بفكر…" : "Thinking…"); setCard({ kind: "done", ok: false });
        try { line = forSpeech(await ask(text, history.current, ui)); talk = !!line; } catch (e) { line = ""; }
      }
      if (line && talk) history.current = [...history.current, { role: "user", content: text }, { role: "assistant", content: line }].slice(-8);
      const ok = !!line;
      line = line || (ask ? (ui === "ar" ? "معرفتش أرد دلوقتي — جرّب تاني." : "I couldn't answer just now — try again.")
        : (ui === "ar" ? "علشان أرد على أي سؤال، نزّل موديل ذكاء اصطناعي من «المحرك». الأوامر (ابعت لـ… · فكرني… · افتح…) شغالة من غيره." : "To answer any question, install an AI model in Engine. Commands (send…, remind me…, open…) work without one."));
      setSay(line); setCard({ kind: "done", ok });
      await speakOut(line, ui);
      // a conversation keeps going hands-free, like a call
      if (talk && alive.current) listen();
      return;
    }
    setSay(r.say || ""); setCard(r.card || null);
    if (r.action && r.action.kind === "send") { const ok = await send(r.action); if (!ok && flash) flash(tr("Could not send — opened the app instead")); }
    await speakOut(r.say, r.state.ui);
    // hands-free: keep listening while Attune is waiting for an answer
    if (alive.current && r.state.step !== "idle") listen();
  };
  const listen = async () => {
    if (!N || !nativeCall || !N.listen || listening) return;
    setListening(true); setHeard("");
    try {
      const tag = speakLang === "ar" ? LISTEN_TAG[style] : TAG[speakLang] || "en-US";
      const res = await nativeCall("listen", tag, (pct, stage, detail) => { if (stage === "partial") setHeard(detail); });
      setListening(false);
      if (res && res.text) await heardDone(res.text);
    } catch (e) { setListening(false); }
  };
  // opens listening, like pressing a mic — or, opened by the quiet orb (voice option C), starts with the words it heard
  useEffect(() => { if (initialText) heardDone(initialText); else if (N && N.listen) listen(); }, []);
  // car mode: a new message (newer than when car mode opened) shows big and is read aloud by itself
  useEffect(() => {
    if (!car) return;
    seen.current = Date.now() - 60000;
    const tick = async () => {
      const all = inbox().sort((a, b) => (b.ts || 0) - (a.ts || 0));
      if (all[0]) setNewest(all[0]);
      const fresh = all.find((m) => (m.ts || 0) > seen.current);
      if (fresh) { seen.current = fresh.ts; const ui = stRef.current.ui; await speakOut((ui === "ar" ? `${fresh.who} على ${APP_NAME[fresh.app] || fresh.app}: ` : `${fresh.who} on ${APP_NAME[fresh.app] || fresh.app}: `) + fresh.text, ui); }
    };
    tick(); const t = setInterval(tick, 6000); return () => clearInterval(t);
  }, [car]);
  const replyTo = (m) => { setSt({ ...stRef.current, step: "idle", draft: null, last: { name: m.who, key: m.group ? null : m.key, app: m.app } }); pending.current = "reply";
    const q = stRef.current.ui === "ar" ? `أقول لـ${m.who} إيه؟` : `What should I tell ${m.who}?`; setSay(q); setCard({ kind: "ask", q }); speakOut(q, stRef.current.ui).then(() => listen()); };
  const askPlace = () => { pending.current = "nav"; const q = stRef.current.ui === "ar" ? "رايح فين؟" : "Where to?"; setSay(q); setCard({ kind: "ask", q }); speakOut(q, stRef.current.ui).then(() => listen()); };

  const ar = st.ui === "ar";
  const choose = (label) => turn(label);
  if (car) {
    const n = inbox().length;
    const tile = "w-full min-h-[84px] rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] flex items-center gap-4 px-5 text-[22px] font-black text-start";
    const well = "w-14 h-14 rounded-[20px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0";
    return (
      <div className="calm fixed inset-0 z-[90] bg-[#0b0e0d] text-[var(--c-ink)] flex flex-col" data-testid="car-mode" dir={ar ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2 px-4 pb-2" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
          <Car size={24} /><b className="text-[22px] font-black flex-1">{ar ? "وضع العربية" : "Car mode"}</b>
          <button onClick={() => setCar(false)} aria-label={tr("Close")} className="w-12 h-12 rounded-full grid place-items-center c-sub" data-testid="car-close"><X size={24} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 max-w-xl w-full mx-auto">
          {newest ? <div className="rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4" data-testid="car-newest">
            <p className="m-0 text-[13px] font-extrabold c-sub">{newest.who}{newest.group && newest.convo ? " · " + newest.convo : ""} · {APP_NAME[newest.app] || newest.app}</p>
            <p className="m-0 mt-1 text-[22px] font-extrabold" dir="auto">{newest.text}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => speakOut(newest.who + ": " + newest.text, st.ui)} className="flex-1 min-h-[56px] rounded-[20px] border border-[var(--c-ln)] text-[17px] font-extrabold inline-flex items-center justify-center gap-2" data-testid="car-read"><Volume2 size={20} />{ar ? "اقرا" : "Read"}</button>
              <button onClick={() => replyTo(newest)} className="flex-1 min-h-[56px] rounded-[20px] bg-[var(--c-acc)] text-[var(--c-on-acc)] text-[17px] font-extrabold inline-flex items-center justify-center gap-2" data-testid="car-reply"><Mic size={20} />{ar ? "رد" : "Reply"}</button>
            </div></div> : null}
          {card ? <div className="rounded-[20px] bg-[var(--c-soft)] p-4" data-testid="car-say"><p className="m-0 text-[19px] font-extrabold" dir="auto">{card.kind === "readback" ? `${card.to}: «${card.text}»` : say}</p>
            {card.kind === "readback" ? <div className="flex gap-2 mt-3"><button onClick={() => turn(ar ? "لا" : "no")} className="flex-1 min-h-[56px] rounded-[20px] border border-[var(--c-ln)] text-[17px] font-extrabold" data-testid="car-cancel">{ar ? "لا" : "No"}</button>
              <button onClick={() => turn(ar ? "ابعت" : "send")} className="flex-1 min-h-[56px] rounded-[20px] bg-[var(--c-acc)] text-[var(--c-on-acc)] text-[17px] font-extrabold" data-testid="car-send">{ar ? "ابعت" : "Send"}</button></div> : null}</div> : null}
          <button onClick={listen} className={tile} data-testid="car-talk"><span className={well}><Mic size={26} /></span>{ar ? "اتكلم" : "Talk"}</button>
          <button onClick={() => turn(ar ? "مين بعتلي" : "who messaged me")} className={tile} data-testid="car-messages"><span className={well}><MessageCircle size={26} /></span>{(ar ? "الرسايل" : "Messages") + (n ? " · " + n : "")}</button>
          <button onClick={askPlace} className={tile} data-testid="car-nav"><span className={well}><MapPin size={26} /></span>{ar ? "ودّيني" : "Navigate"}</button>
          <form onSubmit={(e) => { e.preventDefault(); const t = typed; setTyped(""); heardDone(t); }} className="flex gap-2 pt-2">
            <input value={typed} onChange={(e) => setTyped(e.target.value)} dir="auto" placeholder={ar ? "أو اكتب (للي جنبك)…" : "Or type (for a passenger)…"} className="flex-1 min-w-0 min-h-[48px] rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-3.5 text-[16px]" data-testid="car-input" />
            <button aria-label={tr("Send")} className="w-12 h-12 rounded-full grid place-items-center bg-[var(--c-surf-2)]" data-testid="car-type-go"><Send size={18} className="rtl:-scale-x-100" /></button></form>
        </div>
      </div>);
  }
  return (
    <div className="calm fixed inset-0 z-[90] bg-[var(--c-bg)] text-[var(--c-ink)] flex flex-col" data-testid="voice-screen" dir={ar ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2" style={{ paddingTop: "calc(16px + env(safe-area-inset-top))" }}>
        <b className="text-[17px] font-black">{ar ? "يا أتيون" : "Ya Attune"}</b>
        <span className="text-[11.5px] font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--c-soft)] text-[var(--c-acc)]">{tr("Offline · private")}</span>
        <span className="flex-1" />
        <button onClick={() => setCar(true)} aria-label={ar ? "وضع العربية" : "Car mode"} className="w-10 h-10 rounded-full grid place-items-center border border-[var(--c-ln)]" data-testid="voice-car"><Car size={17} /></button>
        <button onClick={() => setSpeakLang(langs[(langs.indexOf(speakLang) + 1) % langs.length])} className="min-h-[36px] px-3 rounded-full border border-[var(--c-ln)] text-[12.5px] font-extrabold" data-testid="voice-lang">{({ ar: "عربي", en: "English", tr: "Türkçe", es: "Español", fr: "Français" })[speakLang]}</button>
        <button onClick={onClose} aria-label={tr("Close")} className="w-11 h-11 rounded-full grid place-items-center c-sub" data-testid="voice-close"><X size={20} /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-4 max-w-xl w-full mx-auto">
        <div className={"mx-auto rounded-full transition-all duration-500 " + (listening ? "animate-pulse" : "")} data-testid="voice-orb"
          style={{ width: card ? 110 : 190, height: card ? 110 : 190, margin: card ? "16px auto 10px" : "40px auto 18px", background: "radial-gradient(circle at 40% 35%,#7fe0cf,#2c8f80 60%,#173530)", boxShadow: "0 0 0 18px rgba(79,194,175,.12),0 0 0 40px rgba(79,194,175,.06)" }} />
        {heard ? <p className="text-center text-[18px] font-extrabold m-0 px-2" dir="auto" data-testid="voice-heard">«{heard}»</p> : null}
        <p className="text-center text-[13px] c-sub mt-1.5 mb-0">{listening ? (speakLang === "ar" ? "بسمعك…" : "Listening…") : ""}</p>
        {card && card.kind === "ask" ? <div className={"rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4 mt-3"} data-testid="voice-ask">
          <p className="m-0 text-[16px] font-extrabold" dir="auto">{card.q}</p>
          {card.options ? <div className="flex gap-2 mt-3 flex-wrap">{card.options.map((o, i) => <button key={o} onClick={() => choose(o)} data-testid="voice-option"
            className={"flex-1 min-h-[44px] px-3 rounded-full border text-[14px] font-extrabold " + (card.suggest && ["ar", "franco", "en"][i] === card.suggest ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "border-[var(--c-ln)]")}>{o}</button>)}</div> : null}
        </div> : null}
        {card && card.kind === "readback" ? <div className="rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4 mt-3" data-testid="voice-readback">
          <p className="m-0 text-[13px] font-extrabold c-sub" data-testid="voice-to" dir="auto">{(card.isGroup ? (ar ? "جروب " : "Group ") : (ar ? "إلى " : "To ")) + card.to} · {APP_NAME[card.app] || card.app}</p>
          {card.last ? <p className="m-0 mt-1 text-[12.5px] c-sub" dir="auto">{ar ? "آخر رسالة منه: " : "Their last message: "}«<bdi>{card.last}</bdi>»</p> : null}
          {card.onlyInGroup ? <p className="m-0 mt-1 text-[12.5px] text-[var(--c-warn)]" data-testid="voice-group-note">{ar ? `كتب في جروب «${card.onlyInGroup}» بس — هفتح الأبلكيشن عليه هو، مش الجروب.` : `They only wrote in the “${card.onlyInGroup}” group — the app opens on them, not the group.`}</p> : null}
          {edit != null ? <form onSubmit={(e) => { e.preventDefault(); const t = edit.trim(); setEdit(null); if (t) turn((ar ? "غيرها ل " : "change it to ") + t); }} className="my-2 flex gap-2">
            <input autoFocus value={edit} onChange={(e) => setEdit(e.target.value)} dir="auto" className="flex-1 min-w-0 min-h-[44px] rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-acc)] px-3 text-[16px] font-bold" data-testid="voice-edit" />
            <button className="min-h-[44px] px-4 rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold" data-testid="voice-edit-ok">{ar ? "تمام" : "OK"}</button></form>
            : <p className="m-0 my-2 text-[19px] font-extrabold" dir="auto" data-testid="voice-text">{card.text}</p>}
          {!card.direct ? <p className="m-0 text-[12px] c-sub">{ar ? "مفيش محادثة حديثة معاه — هفتح الأبلكيشن والرسالة جاهزة، وإنت اختار الشخص." : "No recent chat with them — the app opens with the message ready; you pick the person."}</p> : null}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setEdit(card.text)} className="flex-1 min-h-[46px] rounded-[12px] border border-[var(--c-ln)] font-extrabold inline-flex items-center justify-center gap-1.5" data-testid="voice-change"><Pencil size={15} />{ar ? "غيّر" : "Change"}</button>
            <button onClick={() => turn(ar ? "ابعت" : "send")} className="flex-1 min-h-[46px] rounded-[12px] bg-[var(--c-acc)] text-[var(--c-on-acc)] font-extrabold inline-flex items-center justify-center gap-1.5" data-testid="voice-send"><Send size={15} className="rtl:-scale-x-100" />{ar ? "ابعت" : "Send"}</button>
          </div>
        </div> : null}
        {card && card.kind === "messages" ? <div className="rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4 mt-3 space-y-2" data-testid="voice-messages">
          {(card.items || []).length ? card.items.map((m, i) => <div key={i} className="border-t border-[var(--c-ln)] first:border-t-0 pt-2 first:pt-0"><p className="m-0 text-[12px] font-extrabold c-sub">{m.who}{m.group && m.convo ? " · " + m.convo : ""} · {APP_NAME[m.app] || m.app}</p><p className="m-0 text-[15px]" dir="auto">{m.text}</p></div>)
            : <p className="m-0 text-[14px] c-sub">{say}</p>}
        </div> : null}
        {card && card.kind === "done" ? <div className="rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] p-4 mt-3 flex gap-2 items-start" data-testid="voice-done">
          {card.ok ? <Check size={18} className="text-[var(--c-acc)] shrink-0 mt-0.5" /> : null}<p className="m-0 text-[15px] font-bold" dir="auto">{say}</p></div> : null}
        {!card ? <div className="mt-6 rounded-[20px] border border-[var(--c-ln)] p-3 space-y-3"><WakeSwitch native={N} compact tag={speakLang === "ar" ? LISTEN_TAG[style] : TAG[speakLang] || "en-US"} /><SmsSwitch native={N} compact /></div> : null}
        <form onSubmit={(e) => { e.preventDefault(); const t = typed; setTyped(""); heardDone(t); }} className="mt-4 flex gap-2">
          <input value={typed} onChange={(e) => setTyped(e.target.value)} dir="auto" placeholder={ar ? "أو اكتب هنا…" : "Or type here…"} className="flex-1 min-w-0 min-h-[44px] rounded-[12px] bg-[var(--c-surf)] border border-[var(--c-ln)] px-3.5 text-[15px]" data-testid="voice-input" />
          <button aria-label={tr("Send")} className="w-11 h-11 rounded-full grid place-items-center bg-[var(--c-surf-2)]" data-testid="voice-type-go"><Send size={16} className="rtl:-scale-x-100" /></button>
        </form>
      </div>
      <div className="pb-6 pt-2 grid place-items-center" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
        <button onClick={listen} disabled={!N || !N.listen} aria-label={tr("Speak")} className={"w-[74px] h-[74px] rounded-full grid place-items-center bg-[var(--c-acc)] text-[var(--c-on-acc)] shadow-lg disabled:opacity-40 " + (listening ? "animate-pulse" : "")} data-testid="voice-mic"><Mic size={30} /></button>
      </div>
    </div>);
}
