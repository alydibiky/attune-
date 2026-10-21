// v6.47 country packs (VISION phase 4): holidays by code — fixed, Easter-based (Western + Orthodox), nth-weekday and Islamic
// (Umm al-Qura) — working days, the phone's guess, emergency numbers, and Home's holiday line.
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
const C = await import("../../web-src/country.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const has = (code, y, date, name) => C.holidays(code, y).some((h) => h.date === date && h.name.includes(name));

ok(Object.keys(C.COUNTRIES).length >= 30, Object.keys(C.COUNTRIES).length + " countries");
ok(Object.values(C.COUNTRIES).every((c) => c.name && /^[A-Z]{3}$/.test(c.cur) && Array.isArray(c.weekend) && c.tel && (c.vat === null || typeof c.vat === "number")), "every country has currency, weekend, numbers, VAT");
ok(C.iso(C.easter(2026)) === "2026-04-05" && C.iso(C.easter(2027)) === "2027-03-28" && C.iso(C.easter(2025)) === "2025-04-20", "Western Easter 2025–2027");
ok(C.iso(C.orthodoxEaster(2026)) === "2026-04-12" && C.iso(C.orthodoxEaster(2025)) === "2025-04-20" && C.iso(C.orthodoxEaster(2027)) === "2027-05-02", "Orthodox Easter 2025–2027");
ok(has("eg", 2026, "2026-04-13", "Sham el-Nessim") && has("eg", 2026, "2026-01-07", "Coptic Christmas") && has("eg", 2026, "2026-10-06", "Armed Forces"), "Egypt: Sham el-Nessim the Monday after Coptic Easter, 7 Jan, 6 Oct");
ok(has("eg", 2026, "2026-03-20", "Eid al-Fitr") && has("eg", 2026, "2026-05-27", "Eid al-Adha") && has("eg", 2026, "2026-05-26", "Arafat"), "Egypt 2026: Eid al-Fitr 20 Mar, Arafat 26 May, Eid al-Adha 27 May (Umm al-Qura)");
ok(C.holidays("eg", 2026).filter((h) => h.name === "Eid al-Adha").length === 3 && C.holidays("eg", 2026).every((h) => !/Eid/.test(h.name) || h.lunar), "Eid al-Adha is 3 days, marked lunar");
ok(has("us", 2026, "2026-11-26", "Thanksgiving") && has("us", 2026, "2026-05-25", "Memorial") && has("us", 2026, "2026-01-19", "Martin Luther King"), "US: Thanksgiving 26 Nov, Memorial Day 25 May, MLK 19 Jan");
ok(has("gb", 2026, "2026-04-03", "Good Friday") && has("gb", 2026, "2026-08-31", "Summer bank") && has("de", 2026, "2026-05-14", "Ascension"), "UK and Germany: Easter-based days");
ok(has("ca", 2026, "2026-05-18", "Victoria") && has("ca", 2027, "2027-05-24", "Victoria"), "Canada: Victoria Day = the Monday before 25 May");
ok(has("za", 2026, "2026-08-10", "observed"), "South Africa: a holiday on Sunday moves to Monday (9 Aug 2026)");
ok(C.isWorkingDay("eg", "2026-10-20") && !C.isWorkingDay("eg", "2026-10-23") && !C.isWorkingDay("eg", "2026-10-06"), "Egypt: Tuesday works, Friday off, 6 October off");
ok(C.nextWorkingDay("eg", "2026-05-27") === "2026-05-31", "a cheque due on Eid al-Adha clears on Sunday 31 May");
ok(C.nextWorkingDay("ae", "2026-10-24") === "2026-10-26" && C.nextWorkingDay("us", "2026-07-04") === "2026-07-06", "UAE weekend Sat–Sun; US 4 July (a Saturday) → Monday");
ok(C.guessCountry({ languages: ["ar-EG"] }, "") === "eg" && C.guessCountry({ languages: ["en"] }, "Africa/Cairo") === "eg" && C.guessCountry({ languages: ["en-UK"] }, "") === "gb" && C.guessCountry({ languages: ["en"] }, "America/Chicago") === "us" && C.guessCountry({ languages: ["en"] }, "Asia/Tokyo") === null, "the phone's region or time zone → the country");
C.setCountry("sa"); ok(C.myCountry() === "sa", "the choice is kept");
ok(C.emergencyLines("eg").join() === "Police 122,Ambulance 123,Fire 180" && C.emergencyLines("de").join() === "Emergency 112", "emergency numbers");
const n = C.holidayNote("eg", new Date(2026, 4, 26, 9).getTime());
ok(n && n.days === 0 && /Arafat/.test(n.title) && n.lunar, "Home on 26 May 2026 (Egypt): Today: Arafat Day — " + (n && n.title));
const t = C.holidayNote("eg", new Date(2026, 9, 5, 9).getTime());
ok(t && t.days === 1 && /Tomorrow: Armed Forces Day/.test(t.title) && /banks/.test(t.sub), "the day before: Tomorrow: Armed Forces Day — banks closed");
ok(C.holidayNote("eg", new Date(2026, 9, 20, 9).getTime()) === null, "a normal week: nothing");
ok(C.upcoming("eg", "2026-12-20", 2).every((h) => h.date >= "2026-12-20") && C.upcoming("eg", "2026-12-20", 2)[0].date.startsWith("2027"), "upcoming crosses into next year");
const hj = C.hijriOf(new Date(2026, 4, 27, 12)); ok(hj && hj.m === 12 && hj.d === 10 && hj.y === 1447, "Hijri date: 27 May 2026 = 10 Dhu al-Hijjah 1447");
// a cheque due on a bank holiday (Fleet) → Home's Right now says when it really clears
const { nowCard } = await import("../../web-src/home-now.js");
const { heal } = await import("../../web-src/fleet.js");
const fleet = heal({ cheques: [{ id: "q1", no: "55", dir: "in", amount: 30000, due: "2026-10-06", status: "pending", client: "c1" }], clients: [{ id: "c1", name: "Orascom" }], cranes: [], jobs: [], settings: { currency: "EGP", chequeDays: 7 } });
const card = nowCard({ fleet, country: "eg", now: new Date(2026, 9, 6, 9).getTime() });
ok(card && card.kind === "chequeToday" && /Banks are closed today \(Armed Forces Day\) — it clears on 07\/10\/2026/.test(card.sub), "a cheque due on 6 October: banks closed, clears 07/10 — " + (card && card.sub));
const card2 = nowCard({ fleet, country: null, now: new Date(2026, 9, 6, 9).getTime() });
ok(card2 && card2.sub === "Fleet & rentals", "no country chosen: as before");
const { todayLine } = await import("../../web-src/home.js");
const tl = todayLine({ country: "eg", now: new Date(2026, 9, 5, 10).getTime() }).line;
ok(tl.some((x) => x.app === "country" && /Tomorrow: Armed Forces Day/.test(x.title)), "Your day: Tomorrow: Armed Forces Day");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
