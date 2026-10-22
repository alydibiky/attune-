/* ---- v6.32: Private vault — the lock screen in front of a locked page, and its settings on the Privacy page (vault.js) -------- */
import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { tr } from "./i18n.js";
import * as U from "./ui-kit.jsx";
import { VAULT_AREAS, VAULT_LABEL, loadVault, saveVault, withPin, pinOk, validPin, unlockWay } from "./vault.js";

const N = () => (typeof window !== "undefined" && window.AttuneNative) || null;
export function vaultAvail() { try { const n = N(); return n && n.vaultAvailable ? JSON.parse(n.vaultAvailable()) : null; } catch (e) { return null; } }
const field = U.inp.replace("text-[15px]", "text-[18px]") + " text-center tracking-[0.4em] tabular-nums";
const st = undefined;

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
    <div className={U.page + " rounded-[22px] p-6 flex flex-col items-center justify-center gap-4 text-center"} style={{ minHeight: "60vh" }} data-testid="vault-gate">
      <span className="w-14 h-14 rounded-[18px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)]"><Lock size={24} /></span>
      <h2 className={U.h1}>{tr("Locked")}</h2>
      <p className={"m-0 max-w-[36ch] text-[13.5px] " + U.muted}>{way === "bio" ? tr("Use your fingerprint, face or screen lock to open it.") : tr("Enter your vault PIN.")}</p>
      {way === "bio" ? <button className={U.btnP} onClick={ask} data-testid="vault-unlock">{tr("Unlock")}</button> : (
        <div className="w-48 space-y-2">
          <input type="password" inputMode="numeric" autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") tryPin(); }} className={field} style={st} data-testid="vault-pin" aria-label={tr("PIN")} />
          <button className={U.btnP + " w-full"} onClick={tryPin} disabled={pin.length < 4} data-testid="vault-pin-go">{tr("Unlock")}</button>
        </div>)}
      {err ? <p className="m-0 text-[13px] font-bold text-[var(--c-neg)]" data-testid="vault-err">{err}</p> : null}
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
    <section className={U.cardPad + " space-y-3"} data-testid="vault-settings">
      <div className="flex items-center gap-3"><span className="w-10 h-10 rounded-[14px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><Lock size={17} /></span>
        <div className="flex-1 min-w-0"><b className="block font-extrabold text-[14.5px]">{tr("Private vault")}</b><span className={"text-[12.5px] " + U.muted}>{way === "bio" ? tr("Opens with your fingerprint, face or screen lock") : tr("Opens with a PIN on this device")}</span></div>
        <button role="switch" aria-checked={v.on} onClick={toggle} className={v.on ? U.btnP : U.btnS + " h-12 min-h-[48px] px-5"} data-testid="vault-toggle">{v.on ? tr("On") : tr("Off")}</button></div>
      <div className="flex flex-wrap gap-2">{Object.keys(VAULT_AREAS).map((a) => {
        const on = (v.areas || []).includes(a);
        return <button key={a} onClick={() => put({ ...v, areas: on ? v.areas.filter((x) => x !== a) : [...(v.areas || []), a] })} aria-pressed={on} data-testid={"vault-area-" + a}
          className={U.chip(on)}>{tr(VAULT_LABEL[a])}</button>; })}</div>
      {way === "pin" ? (
        <div className="flex gap-2 items-center">
          <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder={v.pin ? tr("New PIN") : tr("PIN (4–6 digits)")} className={U.inp + " flex-1"} data-testid="vault-new-pin" />
          <button className={U.btnP} disabled={!validPin(pin)} onClick={() => { put(withPin(v, pin)); setPin(""); flash && flash(tr("PIN saved")); }} data-testid="vault-save-pin">{tr("Save")}</button></div>) : null}
    </section>);
}
