// v6.41 D6: one trip pack — flight numbers, the parts and how many are ready, the travel-day reminders.
import * as T from "../../web-src/travel.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
ok(JSON.stringify(T.flightNos("MS 985 on 2 Nov, back TK691 and ms985 again")) === '[{"no":"MS985"},{"no":"TK691"}]', "flight numbers: MS985, TK691 (once each)");
ok(T.flightNos("at 10 AM 9, 20 KG 23, up to 3").length === 0, "times, weights and words are not flights");
ok(T.flightNos("W6 2241 and FZ 142").map((f) => f.no).join() === "W62241,FZ142", "letter+digit airlines (W6, FZ)");
let p = T.tripPack({ trip: { depart: "2026-11-02" }, country: "tr", mapInstalled: false, passport: "ok", entryStatus: "visa" });
ok(p.ready === 3 && p.of === 6 && !p.parts.find((x) => x.key === "map").ok && p.parts.find((x) => x.key === "papers").ok, "3 of 6 ready: phrases, money, papers; map, flights and the watch to do");
p = T.tripPack({ trip: { flights: [{ no: "MS985" }] }, country: "tr", mapInstalled: true, passport: "short", entryStatus: "visa", watchSet: true });
ok(p.ready === 5 && /too soon/.test(p.parts.find((x) => x.key === "papers").note), "a passport that ends too soon is not ready, and says why");
const w = T.watchReminders({ depart: "2026-11-02", ret: "2026-11-09", flights: [{ no: "MS985" }] });
ok(w.length === 2 && w[0].id === "trip-watch-2026-11-02" && new Date(w[0].at).getHours() === 7 && /Owed/.test(w[0].body), "two travel-day reminders at 7:00, pointing to Owed");
ok(T.watchReminders({ depart: "2026-11-02", flights: [] }).length === 0, "no flights → no watch");
console.log(bad ? bad + " FAILED" : "v741trippack ok");
