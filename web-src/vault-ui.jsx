/* ---- v6.32: Private vault — the lock screen in front of a locked page, and its settings on the Privacy page (vault.js) -------- */
import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { tr } from "./i18n.js";
import { VAULT_AREAS, VAULT_LABEL, loadVault, saveVault, withPin, pinOk, validPin, unlockWay } from "./vault.js";

const N = () => (typeof window !== "undefined" && window.AttuneNative) || null;
export function vaultAvail() { try { const n = N(); return n && n.vaultAvailable ? JSON.parse(n.vaultAvailable()) : null; } catch (e) { return null; } }
const field = "w-full rounded-lg px-3 py-2 text-[16px] border bg-transparent text-center tracking-[0.4em] c-num";
const st = { borderColor: "var(--c-ln)", color: "var(--c-ink)" };

/** In front of a locked page: the fingerprint prompt opens at once (or a PIN box). */
export function VaultGate({ unlock, onOpen }) {
  const cfg = loadVault(), way = unlockWay(vaultAvail());
  const [pin, setPin] = useState(""), [err, setErr] = useState("");
  const ask = async () => {
    setErr("");
    try { await unlock({ title: tr("Unlock Attune"), subtitle: tr("Your private places"), cancel: tr("Cancel") }); onOpen(); } catch (e) { setErr(tr("Not unlocked — try again")); }
  };
  useEffect(() => { if (way === "bio") ask(); }, []);   // eslint-disable-line
  const tryPin = () => { if (pinOk(cfg, pin)) onOpen(); else { setErr(tr("Wrong PIN")); setPin(""); } };
  return (
    <div className="calm rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center" style={{ minHeight: "60vh" }} data-testid="vault-gate">
      <span className="c-ic" style={{ width: 52, height: 52 }}><Lock size={24} /></span>
      <h2 className="text-[20px] font-semibold m-0">{tr("Locked")}</h2>
      <p className="c-sub m-0 max-w-[36ch]">{way === "bio" ? tr("Use your fingerprint, face or screen lock to open it.") : tr("Enter your vault PIN.")}</p>
      {way === "bio" ? <button className="c-btn" onClick={ask} data-testid="vault-unlock">{tr("Unlock")}</button> : (
        <div className="w-48 space-y-2">
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") tryPin(); }} className={field} style={st} data-testid="vault-pin" aria-label={tr("PIN")} />
          <button className="c-btn w-full" onClick={tryPin} disabled={pin.length < 4} data-testid="vault-pin-go">{tr("Unlock")}</button>
        </div>)}
      {err ? <p className="c-sub m-0" style={{ color: "var(--c-neg, #b42318)" }} data-testid="vault-err">{err}</p> : null}
    </div>);
}

/** Privacy page: turn the vault on, pick the places, set a PIN where there is no fingerprint. */
export function VaultSettings({ onChange, flash }) {
  const [v, setV] = useState(() => loadVault());
  const [pin, setPin] = useState("");
  const way = unlockWay(vaultAvail());
  const put = (x) => { setV(saveVault(x)); onChange && onChange(x); };
  const toggle = () => {
    if (!v.on && way === "pin" && !v.pin) { flash && flash(tr("Set a PIN first (4–6 digits)")); return; }
    put({ ...v, on: !v.on });
  };
  return (
    <section className="c-card space-y-3" data-testid="vault-settings">
      <div className="flex items-center gap-3"><span className="c-ic"><Lock size={16} /></span>
        <div className="flex-1"><b className="block">{tr("Private vault")}</b><span className="c-sub">{way === "bio" ? tr("Opens with your fingerprint, face or screen lock") : tr("Opens with a PIN on this device")}</span></div>
        <button role="switch" aria-checked={v.on} onClick={toggle} className="c-btn" style={v.on ? {} : { background: "transparent", color: "var(--c-ink)", border: "1px solid var(--c-ln)" }} data-testid="vault-toggle">{v.on ? tr("On") : tr("Off")}</button></div>
      <div className="flex flex-wrap gap-2">{Object.keys(VAULT_AREAS).map((a) => {
        const on = (v.areas || []).includes(a);
        return <button key={a} onClick={() => put({ ...v, areas: on ? v.areas.filter((x) => x !== a) : [...(v.areas || []), a] })} aria-pressed={on} data-testid={"vault-area-" + a}
          className="c-pill" style={on ? { background: "var(--c-acc)", color: "#fff" } : {}}>{tr(VAULT_LABEL[a])}</button>; })}</div>
      {way === "pin" ? (
        <div className="flex gap-2 items-center">
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={v.pin ? tr("New PIN") : tr("PIN (4–6 digits)")} className="flex-1 rounded-lg px-3 py-2 border bg-transparent" style={st} data-testid="vault-new-pin" />
          <button className="c-btn" disabled={!validPin(pin)} onClick={() => { put(withPin(v, pin)); setPin(""); flash && flash(tr("PIN saved")); }} data-testid="vault-save-pin">{tr("Save")}</button></div>) : null}
    </section>);
}
