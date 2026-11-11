// v9.9.18 (Ali, 11 Nov 2026: "the app is global — every country gets its dedicated things like Egypt … accurately"): an errand opens
// the person's OWN country's official page for that kind, Egypt's papers are shown only in Egypt, and a bill with no known portal opens
// a search — never Egypt's portal for someone in another country.
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const E = await import("../../web-src/errands.js");
const { portalFor, PACKS } = await import("../../web-src/countrypack.js");
let bad = 0; const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) bad++; };
ok(E.urlFor("fines", "eg") === "https://traffic.moi.gov.eg/" && E.urlFor("passport", "eg") === E.DIGITAL_EGYPT, "Egypt: fines → the traffic portal, the rest → Digital Egypt (as before)");
ok(E.urlFor("fines", "sa") === "https://www.absher.sa/", "Saudi fines → Absher");
ok(E.urlFor("fines", "ae") === "https://www.dubaipolice.gov.ae/" && E.urlFor("passport", "ae") === "https://icp.gov.ae/" && E.urlFor("bill", "ae") === "https://www.dewa.gov.ae/", "UAE: fines → Dubai Police, passport → ICP, bill → DEWA");
ok(E.urlFor("carLicence", "gb") === "https://www.gov.uk/browse/driving" && E.urlFor("fines", "in") === "https://parivahan.gov.in/" && E.urlFor("fines", "ng") === "https://frsc.gov.ng/", "UK / India / Nigeria: a car paper → DVLA / Parivahan / FRSC");
// never a tax office for a fine, never a government page for a bill by guess
const TAX = /elster|irs\.gov|hmrc|gib\.gov|fbr|sat\.gob|firs|sars|tax|tributaria|entrate|impots|financas|belastingdienst|receita|zatca/i;
for (const cc of Object.keys(PACKS)) { const u = E.urlFor("fines", cc); ok(!TAX.test(u), cc + ": a traffic fine never opens a tax office (" + u + ")"); }
ok(E.urlFor("bill", "sa") === "" && E.urlFor("bill", "de") === "", "a bill with no known portal gets no government page");
{ const e = E.makeErrand({ kind: "bill", label: "electricity" }, Date.parse("2026-11-11T12:00:00"), "sa"); const u = E.openUrlOf(e);
  ok(e.url === "" && /google\.com\/search\?q=Bill%20electricity%20pay%20online/.test(u), "…so a Saudi electricity bill opens a search for paying it online, not Digital Egypt: " + u); }
{ const e = E.makeErrand({ kind: "fines" }, Date.now(), "ae"); ok(e.url === "https://www.dubaipolice.gov.ae/" && e.cc === "ae", "a new errand keeps its country and page"); }
{ const old = { kind: "fines", url: E.DIGITAL_EGYPT }; ok(E.openUrlOf(old, "sa") === E.DIGITAL_EGYPT, "an errand saved before (with its page) keeps that page"); }
ok(E.papersFor("carLicence", "eg").length === 5 && E.papersFor("carLicence", "sa").length === 0 && E.papersFor("passport", "eg", true)[0] === "الجواز القديم", "Egypt's papers only in Egypt (Arabic too)");
ok(portalFor("passport", "zz") === null, "an unknown country has no portal");
console.log(bad ? "FAIL " + bad + " failed" : "ALL PASSED");
if (bad) process.exitCode = 1;
