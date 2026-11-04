// v6.37 W1: a client's WhatsApp message → what is asked, the free cranes, the price, the quote.
import { readOrder, cranesFor, quoteText, quoteHTML } from "../../web-src/fleet-order.js";
import { EMPTY, upsert, addJob } from "../../web-src/fleet.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const today = "2026-10-18";   // a Sunday
let o = readOrder("محتاج ونش 50 طن السبت في 6 أكتوبر يومين", { today });
ok(o.tons === 50 && o.start === "2026-10-24" && o.days === 2 && o.mode === "daily", "50 t, Saturday 24 Oct, two days (" + JSON.stringify(o) + ")");
ok(o.siteText === "6th of October", "«في 6 أكتوبر» with a weekday = the city, not the date");
o = readOrder("need a 100 ton crane from 25/10 for 3 days at New Capital tower", { today });
ok(o.tons === 100 && o.start === "2026-10-25" && o.days === 3 && /New Capital tower/.test(o.siteText), "English: 100 t from 25/10 for 3 days at New Capital (" + o.siteText + ")");
o = readOrder("ونش 250 طن بكرة 8 ساعات في العين السخنة", { today });
ok(o.tons === 250 && o.start === "2026-10-19" && o.mode === "hourly" && o.hours === 8 && /العين السخنة/.test(o.siteText), "250 t tomorrow, 8 hours → by the hour (" + o.siteText + ")");
o = readOrder("عايزين كرين ٥٠ طن يوم ٣/١١ لمدة اسبوع", { today });
ok(o.tons === 50 && o.start === "2026-11-03" && o.days === 7, "Arabic digits, 3/11 for a week");
o = readOrder("محتاجين ونش 50 طن من 25/10 ل 28/10", { today });
ok(o.start === "2026-10-25" && o.days === 4, "a range 25/10 → 28/10 = 4 days");
o = readOrder("ونش 50 طن يوم 6 اكتوبر 2027", { today });
ok(o.start === "2027-10-06" && o.siteText !== "6th of October", "«6 اكتوبر 2027» alone is a date");
// cranes: the smallest free one that fits first; a busy one last
let s = EMPTY();
s = upsert(s, "garages", { name: "Main" });
s = upsert(s, "clients", { name: "Orascom" }); s = upsert(s, "sites", { name: "New Capital tower" });
s = upsert(s, "cranes", { name: "XCMG QY50", tons: 50, hourly: 950, daily: 7500 });
s = upsert(s, "cranes", { name: "Liebherr LTM 1100", tons: 100, hourly: 1800, daily: 14000 });
s = upsert(s, "cranes", { name: "Tadano 60", tons: 60, hourly: 1000, daily: 8000 });
s = addJob(s, { crane: s.cranes[0].id, client: s.clients[0].id, site: s.sites[0].id, mode: "daily", start: "2026-10-20", end: "2026-10-26" });
const list = cranesFor(s, readOrder("ونش 50 طن السبت يومين", { today }));
ok(list[0].crane.name === "Tadano 60" && list[0].price === 16000, "the XCMG is booked Saturday → Tadano 60 first, 2 × 8,000 = 16,000");
ok(list[list.length - 1].crane.name === "XCMG QY50" && list[list.length - 1].busy, "…the booked crane is last, with its job");
ok(!list.some((x) => x.crane.tons < 50), "nothing smaller than asked");
const q = quoteText(readOrder("ونش 50 طن السبت يومين في 6 أكتوبر", { today }), list[0]);
ok(q.includes("Tadano 60") && q.includes("16,000") && q.includes("يومين") && q.includes("24/10/2026"), "the Egyptian reply has the crane, date, days and price");
ok(quoteHTML(readOrder("50 ton tomorrow", { today }), list[0], { client: "Orascom" }).includes("Quotation"), "a printable quote");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
