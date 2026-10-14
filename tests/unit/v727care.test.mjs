// v6.27 Family Health Keeper (care.js): prescriptions read by code (nothing invented — missing is asked), doses and reminders,
// interactions ONLY when an official label names the other medicine (quoted), lab values flagged ONLY by the report's range.
import * as H from "../../web-src/care.js";
let bad = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) bad++; };
const rx = (line, exp) => { const r = H.readRxLine(line) || {}; const miss = Object.entries(exp).filter(([k, v]) => JSON.stringify(r[k]) !== JSON.stringify(v)); ok(!miss.length, `«${line}» → ${JSON.stringify({ name: r.name, strength: r.strength, dose: r.dose, freq: r.freq, times: r.times, days: r.days, food: r.food, prn: r.prn, missing: r.missing })}`); };
rx("Amoxicillin 500 mg caps — 1 cap 3 times daily for 7 days after food", { name: "Amoxicillin", strength: "500 mg", dose: "1 cap", freq: "3 times a day", times: ["08:00", "14:00", "20:00"], days: 7, food: "after food", missing: [] });
rx("Metformin 850mg 1 tab BID with meals", { name: "Metformin", strength: "850 mg", dose: "1 tab", freq: "twice a day", times: ["09:00", "21:00"], food: "with food" });
rx("Panadol 500 mg 2 tablets q6h prn", { name: "Panadol", dose: "2 tablets", prn: true, times: [] });
rx("Augmentin 1g tab 1 x 2 for 1 week", { name: "Augmentin", strength: "1 g", dose: "1 tab", freq: "twice a day", days: 7 });
rx("Atorvastatin 20 mg 1 tab at bedtime", { name: "Atorvastatin", strength: "20 mg", times: ["22:00"] });
rx("Omeprazole 20 mg 1 cap OD before breakfast for 2 weeks", { name: "Omeprazole", freq: "once a day", days: 14, food: "before food" });
rx("بروفين ٤٠٠ مجم قرص ٣ مرات يوميا بعد الأكل لمدة ٥ أيام", { name: "بروفين", strength: "400 mg", freq: "3 times a day", days: 5, food: "after food" });
rx("Vitamin D 50,000 IU", { name: "Vitamin D", missing: ["How much each time?", "How often?"] });
rx("Ciprofloxacin 500mg every 12 hours", { times: ["08:00", "20:00"], missing: ["How much each time?"] });
rx("Insulin glargine 10 units at night", { name: "Insulin glargine", dose: "10 units", times: ["22:00"] });
rx("Salbutamol inhaler 2 puffs every 4 hours as needed", { dose: "2 puffs", prn: true, times: [] });
rx("Vitamin D3 50,000 IU 1 cap once a week for 8 weeks", { strength: "50,000 iu", freq: "once a week", times: [], days: 56 });
const taper = H.readRxLine("Prednisolone 5 mg 2 tabs once daily for 5 days then 1 tab daily for 5 days");
ok(taper.missing.some((m) => /changes during the course/.test(m)), "a tapering dose is flagged for the person to check, never simplified");
ok(H.readRxLine("12/10/2026") === null && H.readRxLine("") === null, "a date line is not a medicine");
const P = H.readPrescription("Dr. Ahmed Hassan — Clinic\nDate: 12/10/2026\nPatient: Aly\n1) Amoxicillin 500 mg caps\n1 cap 3 times daily for 7 days\n2) Panadol 500mg 1 tab q6h prn");
ok(P.length === 2 && P[0].name === "Amoxicillin" && P[0].dose === "1 cap" && P[0].days === 7 && P[1].prn, "a prescription page: doctor/date/patient skipped, an instruction on the next line joined: " + JSON.stringify(P.map((x) => [x.name, x.dose, x.freq])));
// doses and reminders
const now = new Date("2026-10-14T14:45:00").getTime();
let D = { members: [], meds: [], labs: [], taken: {} };
let r = H.addMember(D, { name: "Mum" }); D = r.data; const mum = r.item;
r = H.addMed(D, { ...H.readRxLine("Amoxicillin 500 mg 1 cap 3 times daily for 7 days"), member: mum.id, start: "2026-10-14" }, now); D = r.data; const amox = r.item;
const doses = H.dosesOn(D, now);
ok(doses.length === 3 && doses[0].late && !doses[1].late && doses[0].member.name === "Mum", "today: 3 doses; the 08:00 one is late at 14:45, 14:00 isn't an hour late yet");
D = H.markTaken(D, doses[0].key, now);
ok(H.dosesOn(D, now)[0].taken && !H.dosesOn(D, now)[0].late, "ticked → taken, not late");
const rem = H.medReminders(amox, mum, now);
ok(rem.length === 3 && rem[0].repeat === "daily" && rem[0].id === `med-${amox.id}-0800` && /Mum · Amoxicillin 500 mg/.test(rem[0].title) && new Date(rem[0].at).getDate() === 15, "a daily reminder per time (08:00 is tomorrow's)");
ok(!H.activeOn(amox, "2026-10-21") && H.activeOn(amox, "2026-10-20") && H.ended(D, new Date("2026-10-22T09:00").getTime()).length === 1, "a 7-day course ends after the 20th; its reminders are then removed");
// interactions — only from the label, quoted
const passages = {
  w: [{ title: "Medicine — WARFARIN SODIUM (warfarin) — oral — Interactions", text: "Drugs that increase bleeding risk: Concomitant use of aspirin, NSAIDs such as ibuprofen, or clopidogrel increases the risk of bleeding. Monitor INR.", url: "https://dailymed.nlm.nih.gov/x" },
       { title: "Medicine — WARFARIN SODIUM (warfarin) — oral — Uses", text: "warfarin (brands: Coumadin, Jantoven), oral — Uses: …", url: "" }],
  i: [{ title: "Medicine — IBUPROFEN (ibuprofen) — oral — Uses", text: "ibuprofen (brands: Advil, Motrin, Brufen), oral — Uses: pain", url: "" }],
  a: [{ title: "Medicine — AMOXICILLIN (amoxicillin) — oral — Interactions", text: "Probenecid decreases renal tubular secretion of amoxicillin.", url: "" }],
};
const meds = [{ id: "w", name: "Coumadin" }, { id: "i", name: "Brufen" }, { id: "a", name: "Amoxicillin" }];
const W = H.interactions(meds, passages);
ok(W.length === 1 && W[0].a === "Coumadin" && W[0].b === "Brufen" && /ibuprofen/.test(W[0].quote) && /bleeding/.test(W[0].quote), "Coumadin (warfarin) + Brufen (ibuprofen): the label's own sentence: " + JSON.stringify(W.map((x) => [x.a, x.b, x.quote.slice(0, 60)])));
ok(!W.some((x) => /Amoxicillin/.test(x.a + x.b)), "no label names it → no warning (never guessed)");
// labs
const L = H.readLabs("CBC\nHaemoglobin 11.2 g/dL 13.5 - 17.5\nWBC 6.4 x10^3/uL (4.0-11.0)\nPlatelets 250\nHbA1c 7.2 % < 5.7\nTSH 2.1 mIU/L 0.4-4.0\nسكر صائم ١٢٦ مجم/دل ٧٠ - ١٠٠");
const g = (t) => L.find((x) => x.test === t) || {};
ok(g("Haemoglobin").value === 11.2 && g("Haemoglobin").flag === "low" && g("Haemoglobin").unit === "g/dL", "Haemoglobin 11.2 below 13.5–17.5 → low");
ok(g("WBC").flag === "in range" && g("TSH").flag === "in range", "WBC and TSH in range");
ok(g("Platelets").value === 250 && g("Platelets").flag === "", "Platelets with no range printed → no judgement");
ok(g("HbA1c").flag === "high" && g("HbA1c").high === 5.7, "HbA1c 7.2 with '< 5.7' → high");
ok(g("Fasting glucose").value === 126 && g("Fasting glucose").flag === "high", "Arabic: سكر صائم ١٢٦ (٧٠–١٠٠) → high");
D = H.addLabs(D, mum.id, "2026-06-01", [{ test: "HbA1c", value: 7.9, unit: "%" }]); D = H.addLabs(D, mum.id, "2026-10-01", [{ test: "HbA1c", value: 7.2, unit: "%" }]); D = H.addLabs(D, mum.id, "2026-08-01", [{ test: "HbA1c", value: 53, unit: "mmol/mol" }]);
ok(H.trendOf(D.labs, "HbA1c").map((x) => x.value).join() === "7.9,7.2", "the trend keeps one unit (the mmol/mol one is left out, not mixed)");
console.log(bad ? bad + " FAILED" : "v727care ok");
