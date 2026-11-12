/* ---- v9.9.25 B7 TR2 the flight day (Ali picked A+B combined: the notifications AND a flight-day card on Home that ticks along).
   For one flight { no, airline, from, to, date, time } the day's steps, worked out by code:
     check-in opens  — 24 h before (the common rule); the airline's own "check-in is open" message wins when it comes
     leave home      — departure − time at the airport (3 h international, 2 h within one country) − YOUR travel time to the airport
                       (set once; Maps can't be asked offline)
     boarding        — from the airline's message ("boarding 09:00", «الصعود»), else 40 min before departure
     gate / delay    — ONLY from the airline's own message (its app / SMS sender is the airline, or it names this flight number);
                       a "gate changed" from anyone else is ignored
     take off        — the departure (moved by a delay)
   Each step is "done" once its time passes (or the person ticks "checked in"); the alerts are the notifications to schedule.
   Pure. Tests: tests/tr2/gen.mjs (10,000 flight days) + tests/unit/v9925tr2.test.mjs. */
const latin = (s) => String(s || "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0));
const MIN = 6e4, HOUR = 36e5;
export const COUNTRY_OF = { CAI: "EG", HBE: "EG", HRG: "EG", SSH: "EG", LXR: "EG", ASW: "EG", SPX: "EG", JED: "SA", RUH: "SA", DMM: "SA", MED: "SA", TIF: "SA", AHB: "SA", DXB: "AE", AUH: "AE", SHJ: "AE",
  DOH: "QA", KWI: "KW", BAH: "BH", MCT: "OM", AMM: "JO", BEY: "LB", IST: "TR", SAW: "TR", AYT: "TR", CMN: "MA", TUN: "TN", ADD: "ET", NBO: "KE", LHR: "GB", CDG: "FR", FRA: "DE", KUL: "MY", CGK: "ID", BKK: "TH", DEL: "IN", BOM: "IN", KHI: "PK", LHE: "PK", ISB: "PK", DAC: "BD", IKA: "IR" };
const AIR_AR = { EgyptAir: "مصر للطيران", Saudia: "السعودية", flynas: "ناس", flyadeal: "أديل", "Air Arabia": "العربية للطيران", Emirates: "الإمارات" };
const hm = (t) => { const d = new Date(t); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
/** Is this message the airline's own (its sender is the airline, or it names this exact flight)? */
export function fromAirline(msg, f) {
  const who = String((msg && (msg.from || msg.app || msg.title)) || ""), t = latin((msg && msg.text) || "").replace(/\s+/g, "");
  const air = String(f.airline || ""), ar = AIR_AR[air] || "\u0000";
  return (!!air && (who.toLowerCase().includes(air.toLowerCase()) || who.includes(ar))) || (!!f.no && t.toUpperCase().includes(String(f.no).toUpperCase()));
}
/** What an airline message says: { gate, boarding "HH:MM", depart "HH:MM", checkinOpen, checkedIn, cancelled } */
export function readUpdate(text) {
  const t = latin(text), r = {};
  const g = /\b(?:gate|porte|puerta|kapı)\s*(?:changed?\s*to|is now|now|:)?\s*([A-Z]?\d{1,3}[A-Z]?)\b/i.exec(t) || /(?:البوابة|بوابة|البوابه)\s*(?:رقم)?\s*(?:الجديدة|اتغيرت ل|تغيرت إلى|إلى)?\s*:?\s*([A-Z]?\d{1,3}[A-Z]?)/i.exec(t);
  if (g) r.gate = g[1].toUpperCase();
  const b = /(?:boarding|embarquement|الصعود|الركوب)(?:\s*(?:time|starts?|at|begins|is|will start|:|يبدأ|هيبدأ|الساعة))*\s*([01]?\d|2[0-3])[:.]([0-5]\d)/i.exec(t); if (b) r.boarding = b[1].padStart(2, "0") + ":" + b[2];
  const d = /(?:delayed|new departure(?: time)?|now departs?|rescheduled|departure (?:changed|moved) to|تأخير|تأخرت|التأخير|موعد الإقلاع الجديد|الإقلاع الجديد|هتطلع)[^0-9]{0,30}([01]?\d|2[0-3])[:.]([0-5]\d)/i.exec(t); if (d) r.depart = d[1].padStart(2, "0") + ":" + d[2];
  if (/check-?in (?:is )?(?:now )?open|online check-?in available|تسجيل الوصول متاح|التسجيل مفتوح|يمكنك الآن تسجيل/i.test(t)) r.checkinOpen = true;
  if (/you(?:'re| are) checked in|check-?in (?:is )?complete|boarding pass (?:is )?ready|تم تسجيل الوصول|تم تسجيل دخولك|بطاقة الصعود جاهزة/i.test(t)) r.checkedIn = true;
  if (/\b(?:flight|رحلة)\b[^.]{0,30}\b(?:cancel(?:l)?ed)\b|تم إلغاء الرحلة|الرحلة ملغاة/i.test(t)) r.cancelled = true;
  return r;
}
/** The day: { steps: [{ key, at, done }], gate, boarding, depart, departAt, delayMin, cancelled, alerts: [{ id, at, key, vars }], progress } */
export function flightDay(f, { now = Date.now(), travelMin = 60, messages = [], checkedIn = false } = {}) {
  const dep0 = Date.parse(f.date + "T" + (f.time || "00:00") + ":00");
  const domestic = !!(COUNTRY_OF[f.from] && COUNTRY_OF[f.from] === COUNTRY_OF[f.to]);
  let gate = "", boarding = "", depart = f.time, cancelled = false, ckOpenAt = null, ckIn = !!checkedIn, gateAt = 0, delayAt = 0;
  for (const m of [...(messages || [])].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    if (!fromAirline(m, f)) continue;   // never from anyone but the airline
    const u = readUpdate(m.text);
    if (u.gate) { gate = u.gate; gateAt = m.ts || 0; } if (u.boarding) boarding = u.boarding; if (u.depart) { depart = u.depart; delayAt = m.ts || 0; }
    if (u.checkinOpen && !ckOpenAt) ckOpenAt = m.ts || now; if (u.checkedIn) ckIn = true; if (u.cancelled) cancelled = true;
  }
  let departAt = Date.parse(f.date + "T" + depart + ":00"); if (departAt < dep0 - 6 * HOUR) departAt += 24 * HOUR;   // a delay past midnight
  const delayMin = Math.round((departAt - dep0) / MIN);
  const atAirport = (domestic ? 2 : 3) * HOUR, leave = departAt - atAirport - Math.max(0, travelMin) * MIN;
  const board = boarding ? (() => { let b = Date.parse(f.date + "T" + boarding + ":00"); if (b > departAt) b -= 24 * HOUR; if (b < departAt - 6 * HOUR) b += 24 * HOUR; return b; })() : departAt - 40 * MIN;
  const checkin = ckOpenAt && ckOpenAt < dep0 - 0 ? Math.min(ckOpenAt, dep0 - 24 * HOUR) : dep0 - 24 * HOUR;
  const steps = [
    { key: "checkin", at: checkin, done: ckIn },
    { key: "leave", at: leave, done: now >= leave },
    { key: "boarding", at: board, done: now >= board, gate },
    { key: "takeoff", at: departAt, done: now >= departAt },
  ];
  const alerts = cancelled ? [] : [
    { id: "fd-" + f.no + "-checkin", at: checkin, key: "checkin" },
    { id: "fd-" + f.no + "-leave", at: leave, key: "leave", vars: { t: hm(departAt) } },
    ...(gate ? [{ id: "fd-" + f.no + "-gate-" + gate, at: Math.max(gateAt, now), key: "gate", vars: { g: gate, b: hm(board) } }] : []),
    ...(delayMin > 0 ? [{ id: "fd-" + f.no + "-delay-" + depart, at: Math.max(delayAt, now), key: "delay", vars: { t: depart, n: delayMin } }] : []),
  ].filter((a) => a.at >= now - MIN || a.key === "gate" || a.key === "delay");
  return { steps, gate, boarding: hm(board), depart, departAt, delayMin, cancelled, domestic, leave, alerts,
    progress: steps.filter((s) => s.done).length / steps.length };
}
