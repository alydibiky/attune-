/* ---- v6.37 Sync — inside Backup ("Backup & sync"). Two ways, the same encrypted file (sync.js):
   Wi-Fi: "Show a code on this device" (host) on one, "Connect to the other device" (address + code) on the other.
   Google: a passphrase once on each device, then "Sync with Google Drive" — the file in your own Drive's hidden app folder.
   Fleet's IndexedDB records travel too (time-sheet photos don't, yet). Afterwards the page reloads so every screen
   shows the merged data. */
import React, { useEffect, useRef, useState } from "react";
import { Wifi, Cloud, Loader2, CheckCircle2, AlertTriangle, Copy } from "lucide-react";
import { tr } from "./i18n.js";
import * as Y from "./sync.js";
import { fleetSyncExtra } from "./fleet-store.js";

// v6.44: Fleet's state and its photos (fleet-store.js)
const extra = fleetSyncExtra;
const call = (m, a) => (window.__attuneNativeCall ? window.__attuneNativeCall(m, a) : Promise.reject(new Error("Only available in the Attune app")));

function useLocalNet(N) {
  const [ok, setOk] = useState(() => { try { return !N || !N.localNetAllowed || N.localNetAllowed(); } catch (e) { return true; } });
  useEffect(() => { const on = (e) => setOk(!!(e && e.detail)); window.addEventListener("attune-localnet", on); return () => window.removeEventListener("attune-localnet", on); }, []);
  return [ok, () => { try { N && N.askLocalNetwork && N.askLocalNetwork(); } catch (e) {} }];
}

export function SyncPanel({ native: N, flash }) {
  const [way, setWay] = useState("wifi");
  const [busy, setBusy] = useState(""), [err, setErr] = useState(""), [done, setDone] = useState("");
  const [host, setHost] = useState(null);          // { code, ip, port } while hosting
  const [addr, setAddr] = useState(""), [code, setCode] = useState(""), [replace, setReplace] = useState(false);
  const [cfg, setCfg] = useState(() => Y.loadSync());
  const [pass, setPass] = useState("");
  const [netOk, askNet] = useLocalNet(N);
  const timer = useRef(null);
  useEffect(() => () => { clearInterval(timer.current); try { N && N.syncHostStop && N.syncHostStop(); } catch (e) {} }, []);
  const finish = (r, how) => { const s = Y.saveSync({ ...Y.loadSync(), last: Date.now(), lastHow: how }); setCfg(s); setBusy("");
    setDone(tr("Synced — {a} new, {c} updated. Reopening…", { a: r.added, c: r.changed })); setTimeout(() => location.reload(), 1200); };
  const fail = (e) => { setBusy(""); setErr(tr(String((e && e.message) || e))); };

  // ---- Wi-Fi: this device hosts
  const startHost = async () => {
    setErr(""); setDone("");
    if (!netOk) { askNet(); return; }
    // the phone answers at once; the computer's server starts asynchronously (a slow call)
    let info; try { info = N.syncHostStart ? JSON.parse(N.syncHostStart()) : await call("syncHostBegin", {}); } catch (e) { return fail(e); }
    if (!info.ok) return fail(info.error || "Could not start");
    const c = Y.makeCode(); setHost({ code: c, ip: info.ip, port: info.port }); setBusy(tr("Waiting for the other device…"));
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const t = N.syncHostTake(); if (!t) return;
      clearInterval(timer.current); setBusy(tr("Merging…"));
      try {
        const r = await Y.takeIn(t, c, localStorage, "merge", extra);
        N.syncHostAnswer(await Y.packFor(c, localStorage, { extra }));   // the other device gets everything, merged
        setTimeout(() => { try { N.syncHostStop(); } catch (e) {} }, 8000); setHost(null); finish(r, "wifi");
      } catch (e) { N.syncHostAnswer("ERR"); try { N.syncHostStop(); } catch (x) {} setHost(null); fail(e); }
    }, 700);
  };
  // ---- Wi-Fi: this device connects to the one hosting
  const connect = async () => {
    setErr(""); setDone("");
    if (!netOk) { askNet(); return; }
    const m = addr.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{2,5})$/);
    if (!m) return setErr(tr("Type the address shown on the other device, like 192.168.1.20:41873"));
    if (!Y.codeOk(code)) return setErr(tr("The code has 8 letters and numbers"));
    const c = Y.cleanCode(code);
    try {
      setBusy(tr("Locking and sending…"));
      const r = await call("syncExchange", { host: m[1], port: +m[2], body: await Y.packFor(c, localStorage, { extra }) });
      setBusy(tr("Merging…"));
      finish(await Y.takeIn(r.text, c, localStorage, replace ? "replace" : "merge", extra), "wifi");
    } catch (e) { fail(e); }
  };
  // ---- Google Drive
  const savePass = () => { const p = Y.passphraseProblem(pass); if (p) return setErr(tr(p)); setCfg(Y.saveSync({ ...Y.loadSync(), pass })); setPass(""); setErr(""); };
  const drive = async () => {
    setErr(""); setDone("");
    const p = cfg.pass; if (!p) return setErr(tr("Set your sync passphrase first — the same on every device."));
    try {
      setBusy(tr("Signing in to Google…"));
      const got = await call("driveSync", { op: "get" });
      let r = { added: 0, changed: 0 };
      if (got && got.text) { setBusy(tr("Merging…")); r = await Y.takeIn(got.text, p, localStorage, "merge", extra); }
      setBusy(tr("Locking and uploading…"));
      await call("driveSync", { op: "put", id: (got && got.id) || "", text: await Y.packFor(p, localStorage, { extra }) });
      finish(r, "drive");
    } catch (e) { fail(e); }
  };

  const tab = (id, I, label) => <button onClick={() => { setWay(id); setErr(""); }} data-testid={"sync-way-" + id}
    className={`flex-1 py-2 rounded-lg text-sm flex items-center justify-center gap-1.5 ${way === id ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400"}`}><I size={15} />{label}</button>;
  const box = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-[14px] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-teal-500";
  return (
    <div className="space-y-3" data-testid="sync-panel">
      <p className="text-[12px] text-slate-400">{tr("Keep your phone and computer (or two phones) the same. The data is locked before it leaves this device; what you delete on one is deleted on the other, nothing else is lost.")}</p>
      <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1">{tab("wifi", Wifi, tr("Wi-Fi"))}{tab("google", Cloud, tr("Google Drive"))}</div>
      {way === "wifi" ? (
        <div className="space-y-3">
          {!netOk ? <button onClick={askNet} className="w-full rounded-xl border border-amber-700/60 bg-amber-500/10 text-amber-200 text-[12.5px] p-2.5 text-start" data-testid="sync-allow-net">{tr("Allow Attune to find your other device on this Wi-Fi (Android asks once).")}</button> : null}
          {host ? (
            <div className="rounded-xl border border-teal-800 bg-teal-500/5 p-3 space-y-1.5 text-center" data-testid="sync-host">
              <p className="text-[12px] text-slate-400">{tr("On the other device: Backup → Sync → Wi-Fi → Connect, and type:")}</p>
              <p className="text-[13px] text-slate-300">{tr("Address")} <b className="text-white tabular-nums" dir="ltr" data-testid="sync-addr">{host.ip ? host.ip + ":" + host.port : tr("not on Wi-Fi")}</b></p>
              <p className="text-[26px] font-bold tracking-[0.15em] text-teal-300 tabular-nums" dir="ltr" data-testid="sync-code">{Y.showCode(host.code)}</p>
            </div>
          ) : <button onClick={startHost} disabled={!!busy} className="w-full rounded-xl border border-slate-700 text-slate-200 py-2.5 text-sm" data-testid="sync-host-start">{tr("Show a code on this device")}</button>}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{tr("Or connect to the other device")}</p>
            <input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="192.168.1.20:41873" dir="ltr" inputMode="decimal" className={box} data-testid="sync-addr-in" />
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={tr("Code")} dir="ltr" autoCapitalize="characters" className={box + " tracking-widest"} data-testid="sync-code-in" />
            <label className="flex items-center gap-2 text-[12px] text-slate-400"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} data-testid="sync-replace" />{tr("Make this device exactly like the other one (removes what the other doesn't have)")}</label>
            <button onClick={connect} disabled={!!busy} className="w-full bg-teal-500 disabled:opacity-60 text-slate-950 font-semibold rounded-xl py-2.5 text-sm" data-testid="sync-connect">{tr("Connect and sync")}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {N && N.desktop && (!N.driveSync || (N.driveReady && !N.driveReady())) ? <p className="text-[12px] text-amber-200 rounded-lg border border-amber-700/50 bg-amber-500/10 p-2.5" data-testid="sync-drive-desktop">{tr("Google sync on the computer needs one setup step by Attune's owner (its Google client) — use Wi-Fi with your phone until then.")}</p>
            : N && N.desktop ? <p className="text-[12px] text-slate-400" data-testid="sync-drive-desktop-how">{tr("The first time, Google's sign-in page opens in your browser; after that the computer stays signed in.")}</p> : null}
          <p className="text-[12px] text-slate-400">{tr("One file in your own Google Drive, in a hidden folder only Attune can open. It is locked with your sync passphrase on this device, so Google only stores noise.")}</p>
          {cfg.pass ? <p className="text-[12px] text-emerald-300 flex items-center gap-1.5" data-testid="sync-pass-set"><CheckCircle2 size={14} />{tr("Sync passphrase set on this device.")} <button className="underline text-slate-400" onClick={() => setCfg(Y.saveSync({ ...Y.loadSync(), pass: "" }))}>{tr("Change")}</button></p> : (
            <div className="space-y-2">
              <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder={tr("Sync passphrase (10+ characters, the same on every device)")} className={box} data-testid="sync-pass" />
              <button onClick={savePass} className="w-full rounded-xl border border-slate-700 text-slate-200 py-2 text-sm" data-testid="sync-pass-save">{tr("Save passphrase")}</button>
            </div>)}
          <button onClick={drive} disabled={!!busy || !cfg.pass} className="w-full bg-teal-500 disabled:opacity-60 text-slate-950 font-semibold rounded-xl py-2.5 text-sm" data-testid="sync-drive">{tr("Sync with Google Drive")}</button>
          {cfg.last && cfg.lastHow === "drive" ? <p className="text-[11px] text-slate-500">{tr("Last synced: {d}", { d: new Date(cfg.last).toLocaleString() })}</p> : null}
        </div>
      )}
      {busy ? <p className="text-[12.5px] text-slate-300 flex items-center gap-2" data-testid="sync-busy"><Loader2 size={14} className="animate-spin" />{busy}</p> : null}
      {err ? <p className="text-[12.5px] text-rose-300 flex items-start gap-2" data-testid="sync-err"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{err}</p> : null}
      {done ? <p className="text-[12.5px] text-emerald-300 flex items-center gap-2" data-testid="sync-done"><CheckCircle2 size={14} />{done}</p> : null}
    </div>);
}
