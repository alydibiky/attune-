/* ---- v9.9.25 B7 travel screens (Ali's picks: TR1 B "ask first, then add", TR2 A+B "notifications AND the flight-day card that ticks along",
   TR3 A "Money · Papers tabs"). Logic: bookings.js, flightday.js, tripmoney.js. Trip = travel.js's trip (attune:trip:v1) + bookings, budget,
   spent, people / costs, travelMin, checkedIn, papers. */
import React, { useMemo, useState } from "react";
import { tr, dateLocale } from "./i18n.js";
import { readBooking, applyBooking } from "./bookings.js";
import { flightDay, COUNTRY_OF } from "./flightday.js";
import { budget, settle, papers } from "./tripmoney.js";
import { btnP, btnS, inp, label, chip } from "./ui-kit.jsx";
const day = (s) => { try { return s ? new Date(s + "T12:00:00").toLocaleDateString(dateLocale() || "en-GB", { weekday: "short", day: "numeric", month: "short" }) : ""; } catch (e) { return s; } };
const n2 = (v) => (+v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
function kept() { try { const N = window.AttuneNative; return N && N.recallNotes ? JSON.parse(N.recallNotes() || "[]") : []; } catch (e) { return []; } }
const line = (b) => b.kind === "flight" ? b.no + " · " + [b.from, b.to].filter(Boolean).join(" → ") + " · " + [day(b.date), b.time].filter(Boolean).join(" · ") : b.kind === "stay" ? [b.name || tr("Stay"), day(b.checkin) + (b.checkout ? " – " + day(b.checkout) : ""), b.nights ? tr("{n} nights", { n: b.nights }) : ""].filter(Boolean).join(" · ") : b.code;
/** TR1: found bookings (ask first) + the trip's bookings in time order. */
export function TripBookings({ trip, setTrip, flash }) {
  const [paste, setPaste] = useState(""), [found, setFound] = useState(null);
  const seen = trip.seenMsgs || [];
  const fresh = useMemo(() => kept().filter((n) => !seen.includes(String(n.id || n.ts))).map((n) => ({ n, b: readBooking((n.title || "") + " " + (n.text || "")) })).filter((x) => x.b), [seen.length]);
  const items = [...(trip.bookings || [])].sort((a, b) => String(a.date || a.checkin).localeCompare(String(b.date || b.checkin)));
  const [open, setOpen] = useState("");
  const decide = (x, add) => { const res = add ? applyBooking(trip.bookings || [], x.b) : { items: trip.bookings || [], did: "" };
    // v9.9.29 (Ali: "I don't even know what I added to the trip"): each booking keeps the words it was read from and where they came from
    if (add && res.did === "added") res.items = res.items.map((y, k) => (k === res.items.length - 1 ? { ...y, msg: String(x.b.src || "").slice(0, 300), via: x.n ? (x.n.app || x.n.title || "") : "" } : y));
    setTrip({ bookings: res.items, seenMsgs: [...seen, ...(x.n ? [String(x.n.id || x.n.ts)] : [])].slice(-300) }); setFound(null); setPaste("");
    if (add) flash && flash(res.did === "removed" ? tr("Removed from the trip — it was cancelled") : res.did === "replaced" ? tr("Updated — the new time replaces the old one") : res.did === "same" ? tr("Already in the trip") : tr("Added to the trip")); };
  const ask = found || fresh[0] || null;
  return <div className="space-y-2" data-testid="trip-bookings">
    {ask ? <div className="rounded-[16px] p-3 space-y-2" style={{ background: "var(--c-amber, #FBF0DC)" }} data-testid="trip-found" data-status={ask.b.status}>
      <p className="m-0 text-[13px] font-bold">{ask.b.status === "cancelled" ? tr("A booking was cancelled") : ask.b.status === "changed" ? tr("A booking changed") : ask.b.kind === "flight" ? tr("I found a flight") : tr("I found a stay")}{ask.n ? " · " + (ask.n.app || ask.n.title || "") : ""}</p>
      <p className="m-0 text-[14px] font-extrabold" dir="auto" data-testid="trip-found-line">{line(ask.b)}{ask.b.code ? " · " + ask.b.code : ""}</p>
      {ask.b.src ? <p className="m-0 text-[12.5px] c-sub line-clamp-3" dir="auto" data-testid="trip-found-msg">“{ask.b.src}”</p> : null}
      <div className="flex flex-wrap gap-2"><button className={btnP} onClick={() => decide(ask, true)} data-testid="trip-found-add">{ask.b.status === "cancelled" ? tr("Remove it") : ask.b.status === "changed" ? tr("Update it") : tr("Add to the trip")}</button>
        <button className={btnS} onClick={() => decide(ask, false)} data-testid="trip-found-no">{tr("Not mine")}</button></div></div> : null}
    <div className="flex gap-2"><input value={paste} onChange={(e) => setPaste(e.target.value)} dir="auto" placeholder={tr("Paste a booking message (flight, hotel)…")} className={inp} data-testid="trip-paste" />
      <button className={btnS} disabled={!paste.trim()} onClick={() => { const b = readBooking(paste); if (!b) { flash && flash(tr("No booking found in it")); return; } setFound({ b, n: null }); }} data-testid="trip-paste-read">{tr("Read")}</button></div>
    {items.length ? <div className="rounded-[16px] border p-3" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="trip-items">
      {items.map((b) => <div key={b.id} className="border-t border-[var(--c-ln)] first:border-t-0" data-testid="trip-item">
        <button type="button" onClick={() => setOpen(open === b.id ? "" : b.id)} className="w-full flex items-center gap-2 min-h-[44px] text-start" aria-expanded={open === b.id} data-testid="trip-item-open">
          <span className="text-[16px]">{b.kind === "flight" ? "✈" : "🏨"}</span><span className="flex-1 min-w-0 text-[13.5px] font-semibold" dir="auto">{line(b)}</span>
          <span className="text-[11.5px] c-sub" dir="ltr">{b.code}</span><span className="c-sub text-[12px]">{open === b.id ? "▴" : "▾"}</span></button>
        {open === b.id ? <div className="pb-2 space-y-1 text-[13px]" data-testid="trip-item-detail">
          {(b.kind === "flight" ? [["Flight", [b.airline, b.no].filter(Boolean).join(" ")], ["From", b.from], ["To", b.to], ["Date", day(b.date)], ["Time", b.time]]
            : [["Hotel", b.name], ["Check-in", day(b.checkin)], ["Check-out", day(b.checkout)], ["Nights", b.nights ? String(b.nights) : ""]]).concat([["Booking code", b.code]])
            .map(([k, v]) => <div key={k} className="flex gap-2"><span className="c-sub w-28 shrink-0">{tr(k)}</span><b className="flex-1 min-w-0" dir="auto">{v || "—"}</b></div>)}
          {b.msg ? <p className="m-0 text-[12.5px] c-sub rounded-[10px] p-2" style={{ background: "var(--c-soft)" }} dir="auto" data-testid="trip-item-msg">{b.via ? tr("From {app}:", { app: b.via }) + " " : ""}“{b.msg}”</p> : null}
          <button type="button" className="text-[13px] font-bold min-h-[40px]" style={{ color: "var(--c-warn, #B42318)" }} onClick={() => { setTrip({ bookings: (trip.bookings || []).filter((y) => y.id !== b.id) }); setOpen(""); flash && flash(tr("Removed from the trip")); }} data-testid="trip-item-remove">{tr("Remove from the trip")}</button>
        </div> : null}</div>)}</div> : null}
  </div>;
}
/** TR2: the flight-day card (Home on the day + the Trip tab). */
export function FlightDayCard({ trip, setTrip, now = Date.now() }) {
  const f = nextFlight(trip, now); if (!f) return null;
  const d = flightDay(f, { now, travelMin: trip.travelMin || 60, messages: kept().map((n) => ({ from: n.app || n.title || "", ts: n.ts || 0, text: (n.title || "") + " " + (n.text || "") })), checkedIn: !!(trip.checkedIn || {})[f.no] });
  const L = { checkin: d.steps[0].done ? tr("Checked in") : tr("Check-in opens {t}", { t: day(new Date(d.steps[0].at).toISOString().slice(0, 10)) + " " + hm(d.steps[0].at) }),
    leave: tr("Leave home {t}", { t: hm(d.steps[1].at) }), boarding: (d.gate ? tr("Gate {g}", { g: d.gate }) + " · " : "") + tr("boarding {t}", { t: d.boarding }), takeoff: tr("Take off {t}", { t: hm(d.departAt) }) };
  return <div className="rounded-[16px] p-3 space-y-1" style={{ background: "var(--c-soft)" }} data-testid="flight-day">
    <p className={label + " m-0"}>{tr("Flight day")} · {f.no}{d.delayMin > 0 ? " · " + tr("{n} min late", { n: d.delayMin }) : ""}</p>
    {d.steps.map((s) => <div key={s.key} className="flex items-center gap-2 min-h-[36px]" data-testid="flight-step" data-key={s.key} data-done={s.done ? "1" : ""}>
      <span className="w-5 h-5 rounded-full grid place-items-center text-[11px] shrink-0" style={{ background: s.done ? "var(--c-acc)" : "transparent", color: "var(--c-on-acc, #fff)", border: "1.5px solid var(--c-acc)" }}>{s.done ? "✓" : ""}</span>
      <span className="flex-1 text-[13.5px] font-semibold">{L[s.key]}</span>
      {s.key === "checkin" && !s.done ? <button className="text-[12px] font-bold c-acc min-h-[36px]" onClick={() => setTrip && setTrip({ checkedIn: { ...(trip.checkedIn || {}), [f.no]: true } })} data-testid="flight-checked-in">{tr("I checked in")}</button> : null}</div>)}
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c-surf)" }}><div className="h-full" style={{ width: Math.round(d.progress * 100) + "%", background: "var(--c-acc)" }} /></div>
    {setTrip ? <label className="flex items-center gap-2 text-[12.5px] c-sub pt-1">{tr("Minutes from home to the airport")}<input inputMode="numeric" value={trip.travelMin || 60} onChange={(e) => setTrip({ travelMin: +e.target.value || 0 })} className={inp + " w-20! h-9! min-h-[36px]!"} data-testid="flight-travel-min" /></label> : null}
  </div>;
}
/** The next flight that hasn't taken off (within the next 2 days for Home). */
export function nextFlight(trip, now = Date.now(), withinDays = 400) {
  return [...((trip && trip.bookings) || [])].filter((b) => b.kind === "flight" && b.date && b.time).map((b) => ({ ...b, t: Date.parse(b.date + "T" + b.time + ":00") }))
    .filter((b) => b.t > now - 36e5 * 2 && b.t - now <= withinDays * 864e5).sort((a, b) => a.t - b.t)[0] || null;
}
/** The flight-day notifications to schedule (syncToPhone keeps them in step). */
export function flightAlerts(trip, now = Date.now()) {
  const f = nextFlight(trip, now, 3); if (!f) return [];
  const d = flightDay(f, { now, travelMin: trip.travelMin || 60, messages: kept().map((n) => ({ from: n.app || n.title || "", ts: n.ts || 0, text: (n.title || "") + " " + (n.text || "") })), checkedIn: !!(trip.checkedIn || {})[f.no] });
  const T = { checkin: [tr("Check-in is open — {f}", { f: f.no }), tr("Check in now and pick your seat.")], leave: [tr("Leave for the airport now — {f}", { f: f.no }), tr("Take off {t}", { t: hm(d.departAt) })],
    gate: [tr("Gate {g} — {f}", { g: d.gate, f: f.no }), tr("boarding {t}", { t: d.boarding })], delay: [tr("{f} is {n} min late", { f: f.no, n: d.delayMin }), tr("Take off {t}", { t: d.depart })] };
  return d.alerts.filter((a) => a.at > now - 6e4).map((a) => ({ id: a.id, at: a.at, title: T[a.key][0], body: T[a.key][1] }));
}
/** TR3: Money tab. */
export function TripMoney({ trip, setTrip, cur = "", tripCur = "" }) {
  const B = trip.budget || { home: 0, rate: 1 }, b = budget(B, trip.spent || []), [amt, setAmt] = useState(""), [inTrip, setInTrip] = useState(true);
  const people = trip.people || [], st = settle(people, trip.costs || []), [who, setWho] = useState(people[0] || ""), [cost, setCost] = useState(""), [nm, setNm] = useState("");
  return <div className="space-y-2" data-testid="trip-money">
    <div className="rounded-[16px] border p-3 space-y-2" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }}>
      <p className={label + " m-0"}>{tr("Budget")}</p>
      <div className="flex gap-2"><input inputMode="decimal" value={B.home || ""} onChange={(e) => setTrip({ budget: { ...B, home: +e.target.value || 0 } })} placeholder={tr("Budget") + " " + cur} className={inp} data-testid="trip-budget" />
        <input inputMode="decimal" value={B.rate || ""} onChange={(e) => setTrip({ budget: { ...B, rate: +e.target.value || 1 } })} placeholder={"1 " + cur + " = ? " + tripCur} className={inp + " w-32!"} data-testid="trip-rate" /></div>
      <p className="m-0 text-[14px] font-extrabold" data-testid="trip-budget-line">{n2(b.home)} {cur} ≈ {n2(b.trip)} {tripCur} · {tr("spent {a}", { a: n2(b.spentHome) + " " + cur })} · {tr("left {a}", { a: n2(b.leftHome) + " " + cur + " ≈ " + n2(b.leftTrip) + " " + tripCur })}</p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--c-soft)" }}><div className="h-full" style={{ width: Math.round(b.share * 100) + "%", background: b.over ? "var(--c-warn)" : "var(--c-acc)" }} /></div>
      <div className="flex gap-2 items-center"><input inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={tr("Spent")} className={inp} data-testid="trip-spent" />
        <button className={chip(inTrip)} onClick={() => setInTrip(!inTrip)} data-testid="trip-spent-cur">{inTrip ? tripCur || "€" : cur}</button>
        <button className={btnS} disabled={!(+amt > 0)} onClick={() => { setTrip({ spent: [...(trip.spent || []), { amount: +amt, cur: inTrip ? "trip" : "home" }] }); setAmt(""); }} data-testid="trip-spent-add">{tr("Add")}</button></div>
    </div>
    <div className="rounded-[16px] border p-3 space-y-2" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }} data-testid="trip-split">
      <p className={label + " m-0"}>{tr("Shared costs")}</p>
      <div className="flex gap-2"><input value={nm} onChange={(e) => setNm(e.target.value)} placeholder={tr("Add a person")} className={inp} dir="auto" data-testid="trip-person" />
        <button className={btnS} disabled={!nm.trim()} onClick={() => { setTrip({ people: [...new Set([...people, nm.trim()])] }); setNm(""); if (!who) setWho(nm.trim()); }} data-testid="trip-person-add">{tr("Add")}</button></div>
      {people.length >= 2 ? <div className="flex gap-2 flex-wrap items-center"><select value={who} onChange={(e) => setWho(e.target.value)} className={inp + " w-auto!"} data-testid="trip-cost-who">{people.map((p) => <option key={p}>{p}</option>)}</select>
        <span className="text-[13px] c-sub">{tr("paid")}</span><input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} className={inp + " w-28!"} data-testid="trip-cost" />
        <button className={btnS} disabled={!(+cost > 0)} onClick={() => { setTrip({ costs: [...(trip.costs || []), { who: who || people[0], amount: +cost, for: [] }] }); setCost(""); }} data-testid="trip-cost-add">{tr("Split between everyone")}</button></div> : null}
      {st.transfers.map((t, i) => <p key={i} className="m-0 text-[14px] font-bold" dir="auto" data-testid="trip-transfer">{tr("{a} pays {b} {n}", { a: t.from, b: t.to, n: n2(t.amount) })}</p>)}
      {people.length >= 2 && !st.transfers.length ? <p className="m-0 text-[13px] c-sub">{tr("Everyone is even.")}</p> : null}
    </div>
  </div>;
}
/** TR3: Papers tab. */
export function TripPapers({ trip, setTrip, passport = "", country = "" }) {
  const fl = (trip.bookings || []).filter((b) => b.kind === "flight").sort((a, b) => a.date.localeCompare(b.date));
  const to = country || (fl[0] && COUNTRY_OF[fl[0].to] ? COUNTRY_OF[fl[0].to].toLowerCase() : "");
  const arrive = (fl[0] && fl[0].date) || trip.depart || "", leave = (fl.length > 1 && fl[fl.length - 1].date) || trip.ret || arrive, P = trip.papers || {};
  const p = papers({ to, arrive, leave, passport, visa: P.visaNeeded ? !!P.visa : null, insurance: !!P.insurance });
  const pp = p.items[0];
  return <div className="space-y-2" data-testid="trip-papers">
    <div className="rounded-[16px] p-3" style={{ background: pp.ok ? "var(--c-soft)" : "var(--c-amber, #FBF0DC)" }} data-testid="trip-passport" data-ok={pp.ok ? "1" : ""}>
      <b className="block text-[14px]">{!passport ? tr("Add your passport in Dates — Attune checks it against the trip") : pp.ok ? tr("Passport OK for this trip") : tr("Renew your passport before the trip")}</b>
      {passport ? <span className="block text-[12.5px] c-sub">{tr("It ends {d}; it must last until {m}", { d: day(passport), m: day(pp.mustLast) })} — {pp.months ? (pp.from === "arrive" ? tr("{n} months from arrival", { n: pp.months }) : tr("{n} months after you leave", { n: pp.months })) : tr("valid for the whole stay")}</span> : null}
      <span className="block text-[11.5px] c-sub mt-1">{tr("Rules change — check the official portal before you travel.")}</span></div>
    <div className="rounded-[16px] border p-3" style={{ borderColor: "var(--c-ln)", background: "var(--c-surf)" }}>
      {[["visaNeeded", "A visa is needed"], ["visa", "Visa approved"], ["insurance", "Travel insurance"]].filter(([k]) => k !== "visa" || P.visaNeeded).map(([k, l]) =>
        <label key={k} className="flex items-center gap-2 min-h-[44px] text-[14px]"><input type="checkbox" checked={!!P[k]} onChange={(e) => setTrip({ papers: { ...P, [k]: e.target.checked } })} className="w-5 h-5 accent-[var(--c-acc)]" data-testid={"trip-paper-" + k} />{tr(l)}</label>)}</div>
  </div>;
}
