/* ---- v9.3 Money for two (Ali picked D4 — A and B, people choose). The logic is in moneyshare.js; the ledger merges ("merge-share"). */
import React, { useMemo, useRef, useState } from "react";
import { Users, X, Send, Upload } from "lucide-react";
import { tr } from "./i18n.js";
import * as U from "./ui-kit.jsx";
import * as M from "./moneyshare.js";

const ledgerNow = () => { try { return JSON.parse(localStorage.getItem("ledger.v3") || "null") || { accounts: [], txns: [] }; } catch (e) { return { accounts: [], txns: [] }; } };
const scopeIds = (cfg, L) => new Set((L.txns || []).filter((t) => cfg.scope.kind === "all" || (cfg.scope.ids || []).includes(t.account)).map((t) => t.id));

export function MoneyShareSheet({ onClose, runDo, flash }) {
  const [cfg, setCfg] = useState(() => M.loadShare());
  const [how, setHow] = useState(cfg ? "" : "pick");   // pick → start | join
  const [kind, setKind] = useState("accounts"), [ids, setIds] = useState([]), [me, setMe] = useState(""), [code, setCode] = useState(""), [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const L = useMemo(ledgerNow, [cfg]);
  const put = (v) => { setCfg(v ? M.saveShare(v) : null); if (!v) try { localStorage.removeItem(M.SHARE_KEY); } catch (e) {} };
  const ready = me.trim().length >= 2 && code.trim().length >= 6;
  const start = () => { if (!ready || (kind === "accounts" && !ids.length)) return; put({ id: M.newShareId(), scope: kind === "all" ? { kind: "all" } : { kind: "accounts", ids }, me: me.trim(), code: code.trim(), lastIds: [] }); setHow(""); flash && flash(tr("Sharing is set — send the first update")); };
  const send = async () => {
    setBusy(true);
    try {
      const L1 = ledgerNow(), data = M.shareData(L1, cfg.scope, { id: cfg.id, me: cfg.me, lastIds: cfg.lastIds || [] });
      const text = await M.packShare(data, cfg.code), file = "attune-money.attune";
      put({ ...cfg, lastIds: data.txns.map((t) => t.id) });
      const call = typeof window !== "undefined" && window.__attuneNativeCall;
      if (call && window.AttuneNative) await call("shareFile", { name: file, mime: "application/octet-stream", b64: btoa(unescape(encodeURIComponent(text))), text: tr("Our Money in Attune — open it in Attune → Money → More → Share with family") });
      else { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" })); a.download = file; a.click(); }
      flash && flash(tr("Update ready — {n} entries", { n: data.txns.length }));
    } catch (e) { flash && flash(String((e && e.message) || e)); } finally { setBusy(false); }
  };
  const open = async (f) => {
    if (!f) return; setBusy(true);
    try {
      const joining = !cfg, c = joining ? code.trim() : cfg.code;
      const d = await M.readShare(await f.text(), c);
      if (!joining && d.id !== cfg.id) throw new Error("This update is from another share.");
      const r = runDo ? await runDo("merge-share", { share: d }) : { ok: false, error: "Open Money first" };
      if (!r || !r.ok) throw new Error((r && r.error) || "The ledger didn't take it");
      let n = {}; try { n = JSON.parse(r.id || "{}"); } catch (e) {}
      const base = joining ? { id: d.id, scope: d.scope, me: me.trim(), code: c, lastIds: [] } : cfg;
      put({ ...base, lastIds: [...scopeIds(base, ledgerNow())] }); setHow("");
      flash && flash(tr("From {who}: {a} added · {c} changed · {r} removed", { who: d.from || "?", a: n.added || 0, c: n.changed || 0, r: n.removed || 0 }));
    } catch (e) { flash && flash(tr(String((e && e.message) || e))); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const accName = (id) => { const a = (L.accounts || []).find((x) => x.id === id); return a ? (a.emoji ? a.emoji + " " : "") + a.name : id; };
  const opt = (on) => "w-full min-h-[56px] rounded-[16px] border px-3.5 py-2.5 text-start " + (on ? "border-[var(--c-acc)] bg-[var(--c-soft)]" : "border-[var(--c-ln)] bg-[var(--c-surf)]");
  return <div className="calm fixed inset-0 z-[85] bg-black/55 flex flex-col justify-end lg:items-center lg:justify-center" onClick={onClose} data-testid="money-share">
    <div onClick={(e) => e.stopPropagation()} className="bg-[var(--c-surf)] text-[var(--c-ink)] rounded-t-[20px] lg:rounded-[20px] w-full lg:max-w-md p-4 space-y-3 max-h-[90vh] overflow-y-auto" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
      <div className="flex items-center gap-2"><Users size={18} className="c-acc" /><p className="flex-1 text-[17px] font-black m-0">{tr("Share with family")}</p>
        <button onClick={onClose} aria-label={tr("Close")} className="w-10 h-10 rounded-full grid place-items-center c-sub"><X size={18} /></button></div>
      <p className="m-0 text-[12.5px] c-sub">{tr("A file locked with a family code you agree on, sent through WhatsApp or any app. No account, no server — only the people with the code can open it.")}</p>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => open(e.target.files && e.target.files[0])} data-testid="share-file" />
      {cfg && !how ? <>
        <div className={U.cardPad + " space-y-1"} data-testid="share-on">
          <b className="block text-[14.5px]">{cfg.scope.kind === "all" ? tr("Sharing all of Money") : tr("Sharing: {a}", { a: (cfg.scope.ids || []).map(accName).join(" · ") })}</b>
          <span className="block text-[12.5px] c-sub">{tr("You are {me} · family code {c}", { me: cfg.me, c: "•".repeat(Math.max(6, cfg.code.length)) })}</span></div>
        <button onClick={send} disabled={busy} className={U.btnP + " w-full"} data-testid="share-send"><Send size={16} />{tr("Send the update")}</button>
        <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} className={U.btnS + " w-full"} data-testid="share-open"><Upload size={16} />{tr("Open an update I got")}</button>
        <button onClick={() => { if (window.confirm(tr("Stop sharing? What was shared stays in your Money."))) put(null); }} className="w-full min-h-[44px] text-[13px] font-bold c-sub" data-testid="share-stop">{tr("Stop sharing")}</button>
      </> : how === "pick" ? <div className="grid gap-2">
        <button onClick={() => setHow("start")} className={opt(false)} data-testid="share-start"><b className="block text-[14.5px]">{tr("Start sharing")}</b><span className="block text-[12.5px] c-sub">{tr("Choose what to share, then send the first update")}</span></button>
        <button onClick={() => setHow("join")} className={opt(false)} data-testid="share-join"><b className="block text-[14.5px]">{tr("Join a share")}</b><span className="block text-[12.5px] c-sub">{tr("Open the file someone sent you, with your family code")}</span></button>
      </div> : <div className="space-y-3">
        {how === "start" ? <div className="grid gap-2" data-testid="share-kind">
          <button onClick={() => setKind("accounts")} aria-pressed={kind === "accounts"} className={opt(kind === "accounts")} data-testid="share-kind-a"><b className="block text-[14.5px]">{tr("Some accounts (e.g. “House”)")}</b><span className="block text-[12.5px] c-sub">{tr("Only these are shared; everything else stays yours.")}</span></button>
          {kind === "accounts" ? <div className="grid gap-1 ps-1">{(L.accounts || []).map((a) => <label key={a.id} className="flex items-center gap-2.5 min-h-[40px] text-[14px] font-bold">
            <input type="checkbox" checked={ids.includes(a.id)} onChange={(e) => setIds(e.target.checked ? [...ids, a.id] : ids.filter((x) => x !== a.id))} data-testid="share-acc" />{accName(a.id)}</label>)}</div> : null}
          <button onClick={() => setKind("all")} aria-pressed={kind === "all"} className={opt(kind === "all")} data-testid="share-kind-b"><b className="block text-[14.5px]">{tr("All of Money")}</b><span className="block text-[12.5px] c-sub">{tr("Every account and entry, with one person you trust.")}</span></button>
        </div> : null}
        <label className="block text-[13px] font-bold">{tr("Your name")}<input value={me} onChange={(e) => setMe(e.target.value)} dir="auto" className={U.inp + " mt-1"} data-testid="share-me" /></label>
        <label className="block text-[13px] font-bold">{tr("Family code (6 letters or more, the same on both phones)")}<input value={code} onChange={(e) => setCode(e.target.value)} className={U.inp + " mt-1"} autoComplete="off" data-testid="share-code" /></label>
        {how === "start" ? <button onClick={start} disabled={!ready || (kind === "accounts" && !ids.length)} className={U.btnP + " w-full"} data-testid="share-go">{tr("Start sharing")}</button>
          : <button onClick={() => fileRef.current && fileRef.current.click()} disabled={!ready || busy} className={U.btnP + " w-full"} data-testid="share-join-open"><Upload size={16} />{tr("Open the file")}</button>}
        <button onClick={() => setHow(cfg ? "" : "pick")} className="w-full min-h-[44px] text-[13px] font-bold c-sub">{tr("Back")}</button>
      </div>}
    </div></div>;
}
