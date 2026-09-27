/* ---- More → Chat X-Ray (v5.35) ---------------------------------------------------------------
   A WhatsApp chat, read on the phone: who owes whom, promises and dates, unanswered questions,
   and "ask this chat". The logic is in chatxray.js; the chat never leaves the phone. */
import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, Loader2, X, Check, Wallet, Clock, AlertTriangle, Search, BarChart3, Bell, FileText, Trash2 } from "lucide-react";
import { tr, getLang, dateLocale } from "./i18n.js";
import { useSubBack } from "./backstack.js";
import * as CX from "./chatxray.js";

const SKEY = "attune:xray:v1";
const loadSaved = () => { try { const v = JSON.parse(localStorage.getItem(SKEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const saveSaved = (v) => { try { localStorage.setItem(SKEY, JSON.stringify(v.slice(0, 6))); } catch (e) {} };
const RANGES = [["3m", "Last 3 months", 92], ["1y", "Last year", 366], ["all", "Everything", 0]];
const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ChatXRay({ llm, flash, openEngine, modelReady, pro, openPlan, scheduleReminder, incoming, clearIncoming }) {
  const ar = getLang() === "ar";
  const [chat, setChat] = useState(null);           // { name, messages, people }
  const [me, setMe] = useState("");
  const [range, setRange] = useState("3m");
  const [busy, setBusy] = useState(null);           // { n, of }
  const [res, setRes] = useState(null);             // { name, me, items, ledger, unanswered, stats, at }
  const [tab, setTab] = useState("money");
  const [err, setErr] = useState("");
  const [paste, setPaste] = useState("");
  const [q, setQ] = useState(""); const [ans, setAns] = useState(null); const [asking, setAsking] = useState(false);
  const [saved, setSaved] = useState(loadSaved);
  const run = useRef(0);
  const fileRef = useRef(null);
  const fmtD = (t) => new Date(t).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" });
  const money = (v, c) => Math.abs(v).toLocaleString("en-US", { maximumFractionDigits: 2 }) + " " + (c || "");
  useSubBack(!!res || !!chat, () => { if (res) setRes(null); else { setChat(null); setPaste(""); } });

  const load = (text, name) => {
    const p = CX.parseExport(text);
    if (p.messages.length < 2) { setErr(tr("That doesn't look like an exported WhatsApp chat. In WhatsApp: open the chat → ⋮ → More → Export chat → Without media → Attune.")); return; }
    setErr(""); setRes(null); setAns(null);
    setChat({ name: name || tr("Chat with {p}", { p: p.people.filter(Boolean).slice(0, 2).join(" & ") }), messages: p.messages, people: p.people });
    setMe((prev) => (p.people.includes(prev) ? prev : p.people[1] || p.people[0]));   // usually the owner writes less in business chats; they pick
  };
  useEffect(() => { if (incoming && incoming.text) { load(incoming.text, incoming.name); clearIncoming && clearIncoming(); } }, [incoming]);

  const analyse = async () => {
    if (!chat || !me) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    const today = new Date().toISOString().slice(0, 10);
    if (!pro && saved.some((s) => s.day === today)) { flash && flash(tr("Free includes 1 chat X-ray a day — Pro is unlimited")); openPlan && openPlan(); return; }
    const me0 = me, id = ++run.current;
    const days = RANGES.find((r) => r[0] === range)[2];
    const since = days ? Date.now() - days * 86400000 : 0;
    const cands = CX.candidates(chat.messages, since);
    const chunks = CX.chunksOf(cands);
    const byIndex = new Map(chat.messages.map((m) => [m.i, m]));
    setErr(""); setBusy({ n: 0, of: chunks.length });
    const items = [];
    try {
      for (let k = 0; k < chunks.length; k++) {
        if (run.current !== id) return;
        setBusy({ n: k + 1, of: chunks.length });
        try { items.push(...CX.parseItems(await llm(CX.extractMessages(chunks[k], me0, chat.people), { json: true, maxTokens: 700, temperature: 0 }), byIndex, chat.people)); }
        catch (e) { if (String(e && e.message) === "Stopped") return; }
      }
      if (run.current !== id) return;
      const recent = chat.messages.filter((m) => m.t >= since);
      const out = { id: Date.now().toString(36), day: today, at: Date.now(), name: chat.name, me: me0,
        items: items.sort((a, b) => a.t - b.t), ledger: CX.ledgerOf(items, me0), unanswered: CX.unanswered(recent, me0), stats: CX.statsOf(recent), range };
      setRes(out); setTab("money");
      const s2 = [out, ...saved.filter((x) => x.name !== out.name)].slice(0, 6); setSaved(s2); saveSaved(s2);
    } finally { if (run.current === id) setBusy(null); }
  };

  const ask = async () => {
    if (!q.trim() || !chat) return;
    if (!modelReady) { openEngine && openEngine(); return; }
    setAsking(true); setAns(null);
    const hits = CX.searchChat(chat.messages, q);
    try { const a = await llm(CX.askMessages(q, hits, me), { maxTokens: 500, temperature: 0.2 }); setAns({ text: String(a || "").trim(), hits }); }
    catch (e) { setErr(tr(String((e && e.message) || e))); }
    setAsking(false);
  };

  const remind = (it) => {
    if (!scheduleReminder || !it.due) return;
    const d = new Date(it.due + "T09:00:00"); let at = d.getTime();
    if (at < Date.now()) at = Date.now() + 3600000;
    const r = scheduleReminder({ id: "xray-" + it.msg + "-" + it.t, at, title: (it.what || tr("Promise")) + " — " + it.from, body: it.quote.slice(0, 140), repeat: "none" });
    flash && flash(r && r.ok === false ? tr("Couldn't set the reminder") : tr("Reminder set for {d}", { d: fmtD(at) }));
  };

  const tabBtn = (id, label, Icon, n) => (
    <button key={id} onClick={() => setTab(id)} data-testid={"xray-tab-" + id}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[12.5px] border ${tab === id ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-800 text-slate-400"}`}>
      <Icon size={14} />{tr(label)}{n != null ? <span className="text-[11px] opacity-70">{n}</span> : null}</button>
  );
  const quote = (x) => (
    <p dir="auto" className="text-[12.5px] text-slate-300 mt-1 border-s-2 border-slate-700 ps-2 whitespace-pre-wrap">“{x.quote}”
      <span className="block text-[11px] text-slate-500 mt-0.5">{x.author || x.who} · {fmtD(x.t)} · #{x.msg}</span></p>
  );

  return (
    <div className="space-y-4 max-w-2xl mx-auto" data-testid="xray">
      <div className="px-1">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2"><MessageCircle size={19} className="text-teal-300" />{tr("Chat X-Ray")}</h2>
        <p className="text-[12.5px] text-slate-400 leading-relaxed mt-1">{tr("Who owes whom, what was promised, which dates were agreed and which questions got no answer — read from a WhatsApp chat on your phone. The chat never leaves the phone.")}</p>
      </div>

      {!chat && !res ? (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3">
          <ol className="text-[12.5px] text-slate-300 space-y-1 list-decimal ps-5">
            <li>{tr("In WhatsApp, open the chat → ⋮ → More → Export chat → Without media.")}</li>
            <li>{tr("Pick Attune in the share list — or save the file and choose it here.")}</li>
          </ol>
          <input ref={fileRef} type="file" accept=".txt,text/plain" className="hidden" data-testid="xray-file"
            onChange={async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return; try { load(await f.text(), f.name.replace(/\.txt$/i, "").replace(/^WhatsApp Chat with /i, "")); } catch (x) { setErr(tr("Couldn't read that file")); } }} />
          <button onClick={() => fileRef.current && fileRef.current.click()} className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm flex items-center justify-center gap-2"><FileText size={16} />{tr("Choose the exported chat (.txt)")}</button>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} dir="auto" data-testid="xray-paste"
            placeholder={tr("…or paste the chat text here")} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-[13px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500" />
          {paste.trim() ? <button onClick={() => load(paste)} className="w-full py-2 rounded-xl border border-slate-700 text-slate-200 text-sm" data-testid="xray-paste-go">{tr("Read the pasted chat")}</button> : null}
          {saved.length ? (
            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between"><p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Earlier X-rays")}</p>
                <button onClick={() => { setSaved([]); saveSaved([]); }} aria-label={tr("Clear")} className="p-1.5 text-slate-500"><Trash2 size={14} /></button></div>
              {saved.map((s) => <button key={s.id} onClick={() => { setRes(s); setTab("money"); }} className="w-full text-start py-2 text-[13px] text-slate-200 border-b border-slate-800 last:border-0">{s.name} <span className="text-slate-500 text-[11px]">· {fmtD(s.at)}</span></button>)}
            </div>
          ) : null}
        </section>
      ) : null}

      {chat && !res ? (
        <section className="bg-slate-900 rounded-2xl border border-slate-800 p-4 space-y-3" data-testid="xray-setup">
          <p className="text-[13px] text-slate-200">{chat.name} · {tr("{n} messages", { n: chat.messages.length.toLocaleString("en-US") })}</p>
          <div>
            <p className="text-[12px] text-slate-400 mb-1.5">{tr("Which one is you?")}</p>
            <div className="flex flex-wrap gap-1.5">{chat.people.slice(0, 12).map((p) => (
              <button key={p} onClick={() => setMe(p)} data-testid="xray-me" className={`px-3 py-1.5 rounded-full text-[12.5px] border ${me === p ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-700 text-slate-300"}`}>{p}</button>))}</div>
          </div>
          <div>
            <p className="text-[12px] text-slate-400 mb-1.5">{tr("Read")}</p>
            <div className="flex flex-wrap gap-1.5">{RANGES.map(([id, label]) => (
              <button key={id} onClick={() => setRange(id)} className={`px-3 py-1.5 rounded-full text-[12.5px] border ${range === id ? "border-teal-600 bg-teal-500/10 text-teal-200" : "border-slate-700 text-slate-300"}`}>{tr(label)}</button>))}</div>
          </div>
          {busy ? (
            <div className="flex items-center justify-between gap-2 text-[12.5px] text-teal-200" data-testid="xray-progress">
              <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" />{tr("Reading part {n} of {t}…", { n: busy.n, t: busy.of })}</span>
              <button onClick={() => { run.current++; setBusy(null); }} className="px-3 py-1.5 rounded-lg border border-rose-800 text-rose-200 flex items-center gap-1"><X size={13} />{tr("Stop")}</button>
            </div>
          ) : (
            <button onClick={analyse} disabled={!me} data-testid="xray-go" className="w-full py-2.5 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm disabled:opacity-40">{tr("X-ray this chat")}</button>
          )}
          {err ? <p className="text-[12.5px] text-rose-300">{err}</p> : null}
        </section>
      ) : null}
      {!chat && !res && err ? <p className="text-[12.5px] text-rose-300 px-1">{err}</p> : null}

      {res ? (
        <section className="space-y-3" data-testid="xray-result">
          <div className="grid grid-cols-2 gap-2">
            {(() => { const owed = res.ledger.filter((r) => r.net > 0), owe = res.ledger.filter((r) => r.net < 0);
              const sum = (rows) => { const m = new Map(); for (const r of rows) m.set(r.currency, (m.get(r.currency) || 0) + Math.abs(r.net)); return [...m.entries()].map(([c, v]) => money(v, c)).join(" · ") || "—"; };
              return <>
                <div className="rounded-2xl border border-emerald-800/70 bg-emerald-500/10 p-3"><p className="text-[11px] text-emerald-300">{tr("Owed to you")}</p><p className="text-[15px] font-semibold text-emerald-100 mt-0.5" data-testid="xray-owed">{sum(owed)}</p></div>
                <div className="rounded-2xl border border-amber-800/70 bg-amber-500/10 p-3"><p className="text-[11px] text-amber-300">{tr("You owe")}</p><p className="text-[15px] font-semibold text-amber-100 mt-0.5">{sum(owe)}</p></div>
              </>; })()}
          </div>
          <div className="att-hscroll flex gap-1.5 overflow-x-auto pb-1">
            {tabBtn("money", "Money", Wallet, res.ledger.length)}
            {tabBtn("promises", "Promises & dates", Clock, res.items.filter((x) => ["promise", "deadline", "order"].includes(x.type)).length)}
            {tabBtn("unanswered", "Unanswered", AlertTriangle, res.unanswered.length)}
            {chat ? tabBtn("ask", "Ask this chat", Search) : null}
            {tabBtn("stats", "Stats", BarChart3)}
          </div>

          {tab === "money" ? (
            <div className="space-y-2" data-testid="xray-money">
              {res.ledger.length ? res.ledger.map((r) => (
                <details key={r.person + r.currency} className="bg-slate-900 rounded-2xl border border-slate-800 p-3">
                  <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                    <span className="text-[14px] text-slate-100 truncate">{r.person}</span>
                    <span className={`text-[14px] font-semibold shrink-0 ${r.net > 0 ? "text-emerald-300" : r.net < 0 ? "text-amber-300" : "text-slate-400"}`}>
                      {r.net > 0 ? tr("owes you {v}", { v: money(r.net, r.currency) }) : r.net < 0 ? tr("you owe {v}", { v: money(r.net, r.currency) }) : tr("settled")}</span>
                  </summary>
                  <div className="mt-2 space-y-2">{r.entries.map((e, i) => <div key={i}><p className="text-[12px] text-slate-400">{e.type === "paid" ? tr("paid") : tr("owed")} · {money(e.amount, e.currency)}{e.what ? " · " + e.what : ""}</p>{quote(e)}</div>)}</div>
                </details>
              )) : <p className="text-[13px] text-slate-400 px-1">{tr("No money owed or paid was found in this part of the chat.")}</p>}
              <p className="text-[11px] text-slate-500 px-1">{tr("Totals are added up by the phone from the messages quoted — check them before asking anyone to pay.")}</p>
            </div>
          ) : null}

          {tab === "promises" ? (
            <div className="space-y-2" data-testid="xray-promises">
              {res.items.filter((x) => ["promise", "deadline", "order"].includes(x.type)).sort((a, b) => (a.due || "9") < (b.due || "9") ? -1 : 1).map((it, i) => (
                <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13.5px] text-slate-100">{it.from}{it.what ? ": " + it.what : ""}</p>
                    {it.due ? <span className="text-[11px] px-2 py-0.5 rounded-md border border-sky-800 text-sky-200 shrink-0">{fmtD(it.due + "T12:00:00")}</span> : null}
                  </div>
                  {quote(it)}
                  {it.due && scheduleReminder ? <button onClick={() => remind(it)} className="mt-2 text-[12px] px-3 py-1.5 rounded-lg border border-slate-700 text-slate-200 flex items-center gap-1.5" data-testid="xray-remind"><Bell size={13} />{tr("Remind me")}</button> : null}
                </div>
              ))}
              {!res.items.some((x) => ["promise", "deadline", "order"].includes(x.type)) ? <p className="text-[13px] text-slate-400 px-1">{tr("No promises or dates were found.")}</p> : null}
            </div>
          ) : null}

          {tab === "unanswered" ? (
            <div className="space-y-2" data-testid="xray-unanswered">
              {res.unanswered.length ? res.unanswered.map((u, i) => <div key={i} className="bg-slate-900 rounded-2xl border border-slate-800 p-3">{quote(u)}</div>)
                : <p className="text-[13px] text-slate-400 px-1">{tr("Every question to you got an answer. 👍")}</p>}
            </div>
          ) : null}

          {tab === "ask" && chat ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} dir="auto" data-testid="xray-q"
                  placeholder={tr("e.g. What price did we agree for the 50 t crane?")} className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-[13.5px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500" />
                <button onClick={ask} disabled={asking || !q.trim()} className="px-4 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm disabled:opacity-40" data-testid="xray-ask">{asking ? <Loader2 size={15} className="animate-spin" /> : tr("Ask")}</button>
              </div>
              {ans ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3" data-testid="xray-answer">
                  <p dir="auto" className="text-[14px] text-slate-100 whitespace-pre-wrap leading-relaxed">{ans.text}</p>
                  <details className="mt-2"><summary className="text-[12px] text-slate-400 cursor-pointer">{tr("The messages it read ({n})", { n: ans.hits.length })}</summary>
                    <div className="mt-2 space-y-1.5">{ans.hits.map((m) => <p key={m.i} dir="auto" className="text-[12px] text-slate-300"><span className="text-slate-500">#{m.i} {fmtD(m.t)} {m.who}:</span> {m.text.slice(0, 200)}</p>)}</div></details>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "stats" ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 space-y-1.5 text-[13px]" data-testid="xray-stats">
              <p className="text-slate-300">{tr("{n} messages", { n: res.stats.total.toLocaleString("en-US") })}{res.stats.first ? " · " + fmtD(res.stats.first) + " – " + fmtD(res.stats.last) : ""}</p>
              {res.stats.per.slice(0, 8).map(([p, n]) => {
                const w = Math.round((n / Math.max(1, res.stats.per[0][1])) * 100);
                return <div key={p}><div className="flex justify-between text-[12px] text-slate-400"><span className="truncate">{p}</span><span>{n}</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-teal-500/60" style={{ width: w + "%" }} /></div></div>;
              })}
              <p className="text-slate-400 text-[12px] pt-1">{tr("Busiest day: {d}", { d: new Date(2023, 0, 1 + res.stats.busiestDay).toLocaleDateString(dateLocale(), { weekday: "long" }) })}</p>
            </div>
          ) : null}
          <button onClick={() => { setRes(null); if (!chat) setChat(null); }} className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-200 text-sm" data-testid="xray-new">{chat ? tr("Back to this chat") : tr("X-ray another chat")}</button>
        </section>
      ) : null}
    </div>
  );
}
