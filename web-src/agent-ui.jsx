/* ---- v6.27 "Do it for me": the parts the person sees — the Chat card's text, opening a link/app/in-app browser, and the
   "Booking details" the in-app browser may fill (kept on the phone only: localStorage "attune:agent:profile").
   No page of its own: the agent lives in Chat, Travel, Maps and the Radar (Ali: "don't make the app cluttered").   */
import React, { useState } from "react";
import { tr } from "./i18n.js";
import { planTask, cityName } from "./agent.js";
import { regionOf } from "./locale.js";
import { cardPad, inp, muted } from "./ui-kit.jsx";

export const AGENT_PROFILE_KEY = "attune:agent:profile";
export const loadBooking = () => { try { return JSON.parse(localStorage.getItem(AGENT_PROFILE_KEY) || "{}") || {}; } catch (e) { return {}; } };
const saveBooking = (p) => { try { localStorage.setItem(AGENT_PROFILE_KEY, JSON.stringify(p)); } catch (e) {} };
// the main airport of the person's country — only a starting point, always shown on the card so a wrong one is seen
const CAPITAL_AIRPORT = { EG: "CAI", SA: "RUH", AE: "DXB", KW: "KWI", QA: "DOH", BH: "BAH", OM: "MCT", JO: "AMM", LB: "BEY", IQ: "BGW", MA: "CMN", TN: "TUN", DZ: "ALG", TR: "IST",
  GB: "LHR", IE: "DUB", FR: "CDG", DE: "FRA", NL: "AMS", BE: "BRU", CH: "ZRH", AT: "VIE", IT: "FCO", ES: "MAD", PT: "LIS", GR: "ATH", SE: "ARN", NO: "OSL", DK: "CPH", FI: "HEL",
  PL: "WAW", CZ: "PRG", HU: "BUD", RO: "OTP", RU: "SVO", UA: "KBP", US: "JFK", CA: "YYZ", MX: "MEX", BR: "GRU", AR: "EZE", CL: "SCL", CO: "BOG", PE: "LIM", IN: "DEL", PK: "KHI",
  BD: "DAC", LK: "CMB", NP: "KTM", TH: "BKK", MY: "KUL", SG: "SIN", ID: "CGK", PH: "MNL", VN: "SGN", HK: "HKG", CN: "PEK", TW: "TPE", KR: "ICN", JP: "NRT", AU: "SYD", NZ: "AKL",
  ZA: "JNB", NG: "LOS", KE: "NBO", ET: "ADD", GH: "ACC" };
export const myCountry = () => { try { return regionOf((navigator.languages && navigator.languages[0]) || navigator.language || ""); } catch (e) { return ""; } };
const DAYFMT = (iso) => { try { return new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); } catch (e) { return iso; } };

/** A request typed in Chat → the card { title, detail, actions, links } or null. */
export function agentCard(text, { now = Date.now(), order = "dmy", inApp = false } = {}) {
  const b = loadBooking(), country = b.country || myCountry();
  const home = (b.homeAirport || "").toUpperCase() || CAPITAL_AIRPORT[country] || "";
  const p = planTask(text, { now, order, country, homeAirport: home });
  if (!p) return null;
  const TITLES = { flight: "Do it for me — a flight", hotel: "Do it for me — a hotel", food: "Do it for me — food", ride: "Do it for me — a ride", shop: "Do it for me — shopping" };
  const f = p.fields;
  if (p.missing.length) return { plan: p, card: { tone: "emerald", title: TITLES[p.task], detail: p.missing.map((m) => "• " + (typeof m === "string" ? tr(m) : tr(m.t, m.v))).join("\n") + "\n" + tr("Say it again with this, and I'll open it filled in."), actions: [["Just answer", "answer"]] } };
  const sum = p.task === "flight" ? `${cityName(f.from)} (${f.from}) → ${cityName(f.to)} (${f.to}) · ${DAYFMT(f.depart)}${f.ret ? " → " + DAYFMT(f.ret) : ""} · ${f.adults} ${tr(f.adults === 1 ? "adult" : "adults")}${f.cabin !== "economy" ? " · " + tr(f.cabin) : ""}${[f.cheapest ? tr("cheapest") : "", f.direct ? tr("direct") : "", f.time ? tr(f.time) : ""].filter(Boolean).map((x) => " · " + x).join("")}${!b.homeAirport && f.from === home ? "\n" + tr("From {c} — your country's main airport. Set yours in Profile → Booking details.", { c: cityName(home) }) : ""}`
    : p.task === "hotel" ? `${f.city} · ${DAYFMT(f.checkin)} → ${DAYFMT(f.checkout)} · ${f.adults} ${tr("guests")}`
    : p.task === "food" ? `${f.what}${f.from ? " · " + f.from : ""}` : p.task === "ride" ? `→ ${f.to}` : f.what;
  const actions = [];
  // level 2 first: inside Attune (Best offer / Fill my details), on the phone
  const inIdx = p.links.findIndex((l) => /skyscanner|booking\.com|ubereats|doordash|amazon|noon|kayak/.test(l.url));
  if (inApp && inIdx >= 0 && (p.task === "flight" || p.task === "hotel" || p.task === "shop")) actions.push([tr("Do it here") + " · " + p.links[inIdx].label, "agent-in:" + inIdx]);
  p.links.forEach((l, i) => actions.push([l.label, "agent:" + i]));
  actions.push(["Just answer", "answer"]);
  return { plan: p, card: { tone: "emerald", title: TITLES[p.task], detail: sum + "\n" + tr("I open it filled in; you choose and pay. Attune never pays."), actions } };
}

/** The labels the in-app browser shows (translated here, where tr() lives). */
export const agentLabels = () => ({ best: tr("Best offer"), fill: tr("Fill my details"), done: tr("Done"), hint: tr("Attune marks the best offer and fills your details. You choose and pay."),
  noProfile: tr("Add your details first: Profile → Booking details."), noOffers: tr("No offers found on this page yet — search on the site, then tap Best offer."),
  marked: tr("Marked the best of {n}: {price}. Check it and tap it."), filled: tr("Filled {n} fields — check them. Card and password fields are yours."), paying: tr("Payment — your turn. Attune never pays or reads card details.") });

/** v8.2 (Ali, 26 Oct: "expand on Booking details — where the app takes the user's info to help in any booking or anything in the
    app, for more useful answers, while explicitly saying it stays private"): the person's own details in three parts. The trip and
    daily-life parts make answers and agents fit them (bookingLine → Chat's prompts; agents.js defaults); the ID part is only ever
    typed into a booking site by "Fill my details". Nothing leaves the phone. */
const YOU = [["first", "First name"], ["last", "Last name"], ["birth", "Date of birth", "date"], ["nationality", "Nationality"], ["city", "City"],
  ["country", "Country (2 letters, e.g. EG)"], ["homeAirport", "Home airport (e.g. CAI)"], ["email", "Email", "email"], ["phone", "Phone (with country code)", "tel"],
  ["passport", "Passport number"], ["passportExpiry", "Passport expiry", "date"]];
const TRIPS = [["hotelStars", "Hotels: at least", "sel", [["", "Any stars"], ["3", "3 stars"], ["4", "4 stars"], ["5", "5 stars"]]], ["nearCentre", "Close to the main sight / centre", "check"],
  ["budgetNight", "Budget per night (your currency)", "number"], ["adults", "Adults travelling", "number"], ["children", "Children's ages (e.g. 4, 9)"],
  ["beds", "Beds", "sel", [["", "Any"], ["double", "One double bed"], ["twin", "Two beds"]]], ["seat", "Plane seat", "sel", [["", "Any"], ["window", "Window"], ["aisle", "Aisle"]]],
  ["cabin", "Cabin", "sel", [["", "Economy"], ["premium", "Premium economy"], ["business", "Business"]]], ["meal", "Meals (e.g. halal, vegetarian)"], ["loyalty", "Airline / hotel cards"]];
const LIFE = [["diet", "How you eat (e.g. halal, no pork, vegetarian)"], ["allergies", "Allergies"], ["car", "Your car (make, model, year)"], ["work", "Your work (e.g. crane company owner)"],
  ["home", "Your area (for places and delivery)"]];
/** The parts that make answers fit the person — never the passport, phone, email or full date of birth. "" when off or empty. */
export function bookingLine(b = loadBooking(), now = Date.now()) {
  if (!b || b.useInAnswers === false) return "";
  const bits = [];
  const age = b.birth ? Math.floor((now - Date.parse(b.birth + "T12:00:00")) / (365.25 * 864e5)) : 0;
  if (age > 0 && age < 120) bits.push("is about " + age + " years old");
  if (b.city || b.country) bits.push("lives in " + [b.city, b.country].filter(Boolean).join(", "));
  if (b.nationality) bits.push("nationality " + b.nationality);
  if (b.work) bits.push("work: " + b.work);
  if (b.car) bits.push("drives " + b.car);
  if (b.home) bits.push("area: " + b.home);
  if (b.diet) bits.push("eats: " + b.diet);
  if (b.allergies) bits.push("allergies: " + b.allergies);
  const trip = [b.hotelStars ? b.hotelStars + "+ star hotels" : "", b.nearCentre ? "close to the centre / main sight" : "", b.budgetNight ? "up to " + b.budgetNight + " a night" : "",
    b.adults ? b.adults + " adult" + (+b.adults === 1 ? "" : "s") : "", b.children ? "children aged " + b.children : "", b.beds === "twin" ? "two beds" : b.beds === "double" ? "a double bed" : "",
    b.seat ? b.seat + " seat" : "", b.cabin ? b.cabin + " cabin" : "", b.meal ? b.meal + " meals" : "", b.homeAirport ? "flies from " + b.homeAirport : ""].filter(Boolean);
  if (trip.length) bits.push("when travelling prefers " + trip.join(", "));
  return bits.length ? "The user's own details, kept private on their phone (use them so answers fit them; never repeat them back unless asked): " + bits.join("; ") + "." : "";
}
export function BookingDetails() {
  const [p, setP] = useState(loadBooking);
  const [open, setOpen] = useState(false);
  const set = (k, v) => setP((x) => { const n = { ...x, [k]: v }; saveBooking(n); return n; });
  const F = ([k, label, type, opts]) => type === "check" ? (
    <label key={k} className="col-span-2 flex items-center gap-2 min-h-[44px] text-[13.5px] text-[var(--c-ink)]"><input type="checkbox" checked={!!p[k]} onChange={(e) => set(k, e.target.checked)} className="w-5 h-5" data-testid={"booking-" + k} />{tr(label)}</label>
  ) : type === "sel" ? (
    <label key={k} className="block space-y-1"><span className={"block text-[12px] font-bold " + muted}>{tr(label)}</span>
      <select value={p[k] || ""} onChange={(e) => set(k, e.target.value)} className={inp} data-testid={"booking-" + k}>{opts.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}</select></label>
  ) : (
    <label key={k} className="block space-y-1"><span className={"block text-[12px] font-bold " + muted}>{tr(label)}</span>
      <input type={type || "text"} value={p[k] || ""} onChange={(e) => set(k, k === "homeAirport" ? e.target.value.toUpperCase().slice(0, 3) : e.target.value)} dir="auto"
        className={inp} data-testid={"booking-" + k} /></label>);
  const part = (title, sub, list, id) => <div className="mt-4" data-testid={"booking-part-" + id}><p className="m-0 text-[13.5px] font-extrabold text-[var(--c-ink)]">{tr(title)}</p><p className={"m-0 text-[12px] " + muted}>{tr(sub)}</p>
    <div className="grid grid-cols-2 gap-3 mt-2">{list.map(F)}</div></div>;
  return (
    <div className={"calm mt-4 " + cardPad + " bg-[var(--c-surf)]!"} data-testid="booking-details">
      <button onClick={() => setOpen((v) => !v)} className="w-full min-h-[44px] text-start text-[15px] text-[var(--c-ink)] font-extrabold flex items-center justify-between gap-2">{tr("Your details — bookings and better answers")}<span className="text-[var(--c-acc)] text-[13px] font-bold">{open ? tr("Hide") : tr("Edit")}</span></button>
      <p className="text-[12.5px] mt-1 m-0 rounded-[12px] bg-[var(--c-soft)] px-3 py-2 text-[var(--c-ink)]" data-testid="booking-private">🔒 {tr("Private: everything here stays on this phone — Attune never uploads it, and its AI runs on the phone. Answers and agents use only your trip and daily-life details (never your passport, phone or email). A booking site gets your name, passport and phone only when you tap “Fill my details”.")}</p>
      {open ? (<>
        <label className="flex items-center gap-2 min-h-[44px] mt-2 text-[13.5px] font-bold text-[var(--c-ink)]"><input type="checkbox" checked={p.useInAnswers !== false} onChange={(e) => set("useInAnswers", e.target.checked)} className="w-5 h-5" data-testid="booking-use" />{tr("Use my details to make answers and agents fit me")}</label>
        {part("Trips and hotels", "Agents use these when your sentence doesn't say — e.g. a hotel watch looks for your stars by itself.", TRIPS, "trips")}
        {part("Daily life", "So Chat's answers fit you: food, health, your car, your work.", LIFE, "life")}
        {part("For booking forms", "Typed into a booking site only when you tap “Fill my details”. Never used in answers.", YOU, "you")}
      </>) : null}
    </div>);
}
