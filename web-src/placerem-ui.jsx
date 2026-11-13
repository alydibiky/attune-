/* ---- v9.9.19 T4 Place reminders (Ali picked A — a place inside the reminder). In the reminder form: When → "A time" or "At a place";
   at a place → pick one of your saved places (or save where you are now, with a name) → "When I arrive" / "When I leave".
   The ringing needs the phone part (a geofence: 150 m in, 200 m out, 2 readings in a row, GPS jumps ignored — b4plan.js placeEvents,
   10,000 traces). Until the Android part ships (it needs Play's background-location declaration + a disclosure screen — Ali decides),
   each place reminder is saved and shown as "Waiting for the phone part", never pretending to ring. */
import React, { useEffect, useState } from "react";
import { tr, getLang } from "./i18n.js";
import { PLACES_KEY } from "./rulestore.js";
export const PR_KEY = "attune:placerem:v1";
const get = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const put = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} return v; };
export const loadPlaces = () => get(PLACES_KEY), loadPlaceReminders = () => get(PR_KEY);
/** The phone ringing place reminders: true only when the Android app says it can (AttuneNative.placeReminders). */
export const placeLive = () => { try { return !!(window.AttuneNative && window.AttuneNative.placeReminders && window.AttuneNative.placeReminders()); } catch (e) { return false; } };
// v9.9.28 (Ali picked P-2): rings in the APK installed by hand; the Play version says "Coming soon" (it doesn't ask for the permission)
export const placeIsPlay = () => { try { return !!(window.AttuneNative && window.AttuneNative.placeIsPlay && window.AttuneNative.placeIsPlay()); } catch (e) { return false; } };
export const placeAllowed = () => { try { return !!(window.AttuneNative && window.AttuneNative.placeAllowed && window.AttuneNative.placeAllowed()); } catch (e) { return false; } };
/** Hand the phone the place reminders, with the words its notification shows (in the person's language). */
export function syncPlaces() {
  try { if (!placeLive()) return; const P = loadPlaces(), name = (id) => (P.find((x) => x.id === id) || {}).name || "";
    window.AttuneNative.setPlaceReminders(JSON.stringify({ lang: getLang(), places: P,
      reminders: loadPlaceReminders().map((r) => ({ ...r, headArrive: tr("You arrived: {p}", { p: name(r.place) }), headLeave: tr("You left: {p}", { p: name(r.place) }) })) })); } catch (e) {}
}
export function addPlaceReminder({ title, place, on }) {
  const r = { id: "p" + Date.now().toString(36), title, place, on, created: Date.now(), done: false };
  put(PR_KEY, [...loadPlaceReminders(), r]); syncPlaces();
  return r;
}
export function removePlaceReminder(id) { put(PR_KEY, loadPlaceReminders().filter((r) => r.id !== id)); syncPlaces(); }
/** The one line under the place part: Coming soon (Play) · Allow all the time (missing) · how it works (ready). */
function PlaceStatus() {
  const [, re] = useState(0); useEffect(() => { const f = () => { syncPlaces(); re((x) => x + 1); }; window.addEventListener("attune-place", f); return () => window.removeEventListener("attune-place", f); }, []);
  if (placeIsPlay()) return <p className="m-0 text-[12.5px] font-bold c-sub" data-testid="rem-place-soon">{tr("Place reminders: coming soon in this version.")}</p>;
  if (!placeLive()) return <p className="m-0 text-[12px] c-sub">{tr("Saved now; it rings once the phone part of place reminders is switched on in an update.")}</p>;
  if (!placeAllowed()) return <div className="space-y-1.5" data-testid="rem-place-need"><p className="m-0 text-[12.5px] c-sub">{tr("To ring with Attune closed, Android needs location “Allow all the time”. It stays on this phone.")}</p>
    <button type="button" className="min-h-[40px] px-3.5 rounded-full bg-[var(--c-acc)] text-[var(--c-on-acc,#fff)] text-[13px] font-bold" onClick={() => { try { window.AttuneNative.placeAsk(); } catch (e) {} }} data-testid="rem-place-allow">{tr("Allow")}</button></div>;
  return <p className="m-0 text-[12px] c-sub" data-testid="rem-place-ready">{tr("Uses your location only near your saved places.")}</p>;
}
const pill = (on) => "min-h-[40px] px-3.5 rounded-full border text-[13px] font-bold " + (on ? "bg-[var(--c-soft)] text-[var(--c-acc)] border-[var(--c-acc)]" : "bg-[var(--c-bg)] border-[var(--c-ln)] text-[var(--c-mut)]");
/** The "At a place" part of the form. value = { place, on }; onChange(value). */
export function PlacePicker({ value, onChange }) {
  const [places, setPlaces] = useState(loadPlaces), [name, setName] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const here = () => {
    if (!name.trim()) return; setBusy(true); setErr("");
    const done = (lat, lng) => { const p = { id: "pl" + Date.now().toString(36), name: name.trim(), lat, lng, r: 150 }; const L = put(PLACES_KEY, [...loadPlaces(), p]); setPlaces(L); onChange({ ...value, place: p.id }); setName(""); setBusy(false); };
    try { navigator.geolocation.getCurrentPosition((g) => done(+g.coords.latitude.toFixed(6), +g.coords.longitude.toFixed(6)), () => { setErr(tr("Couldn't read where you are — allow location for Attune and try again.")); setBusy(false); }, { enableHighAccuracy: true, timeout: 15000 }); }
    catch (e) { setErr(tr("Couldn't read where you are — allow location for Attune and try again.")); setBusy(false); }
  };
  return <div className="space-y-2" data-testid="rem-place">
    {places.length ? <div className="flex flex-wrap gap-1.5">{places.map((p) => <button key={p.id} type="button" onClick={() => onChange({ ...value, place: p.id })} className={pill(value.place === p.id)} data-testid="rem-place-pick" dir="auto">⌖ {p.name}</button>)}</div>
      : <p className="m-0 text-[12.5px] c-sub">{tr("No saved places yet — save the place you are at now.")}</p>}
    <div className="flex gap-2"><input dir="auto" value={name} onChange={(e) => setName(e.target.value)} placeholder={tr("Name this place (e.g. Carrefour Maadi)")} className="flex-1 min-w-0 min-h-[44px] rounded-[12px] bg-[var(--c-bg)] border border-[var(--c-ln)] px-3 text-[14px]" data-testid="rem-place-name" />
      <button type="button" disabled={!name.trim() || busy} onClick={here} className="min-h-[44px] px-3 rounded-[12px] border border-[var(--c-acc)] text-[var(--c-acc)] text-[13px] font-bold disabled:opacity-40" data-testid="rem-place-here">{tr("Save where I am")}</button></div>
    {err ? <p className="m-0 text-[12.5px] text-[var(--c-neg)]">{err}</p> : null}
    <div className="flex gap-1.5">{[["arrive", "When I arrive"], ["leave", "When I leave"]].map(([k, l]) => <button key={k} type="button" onClick={() => onChange({ ...value, on: k })} className={pill(value.on === k)} data-testid={"rem-place-" + k}>{tr(l)}</button>)}</div>
    <PlaceStatus />
  </div>;
}
/** The place reminders, for the Reminders page. */
export function PlaceReminderList({ tick }) {
  const [, setV] = useState(0); const L = loadPlaceReminders(), P = loadPlaces();
  if (!L.length) return null;
  return <div className="space-y-1.5" data-testid="rem-place-list">{L.map((r) => { const p = P.find((x) => x.id === r.place);
    return <div key={r.id} className="flex items-center gap-2 text-[14px] min-h-[44px]" data-testid="rem-place-item">
      <span className="flex-1 min-w-0"><b className="block truncate" dir="auto">{r.title}</b><span className="c-sub text-[12px]" dir="auto">⌖ {p ? p.name : "?"} · {tr(r.on === "leave" ? "When I leave" : "When I arrive")}{placeIsPlay() ? " · " + tr("Coming soon") : placeLive() ? "" : " · " + tr("Waiting for the phone part")}</span></span>
      <button onClick={() => { removePlaceReminder(r.id); setV((x) => x + 1); tick && tick(); }} className="w-9 h-9 c-sub" aria-label={tr("Remove")} data-testid="rem-place-remove">×</button></div>; })}</div>;
}
