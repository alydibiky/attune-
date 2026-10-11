// v6.21 (Ali: "the Lynk & Co answer is lame — as strong as Gemini, find a loophole", phone-only): the facts sheet, built by
// code from every page in full, carries what Gemini always shows about a car — powertrain, drive, launch — and the trims table.
const F = await import("../../web-src/factsheet.js");
let fail = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
const page = { url: "https://a.com/lynk-900", text: "## Lynk & Co 900\nThe Lynk & Co 900 is a plug-in hybrid SUV launched in April 2025. It uses AWD.\nPower | 680 kW\nElectric range | 220 km\nBattery | 52.9 kWh\nTrim | Power | Price\nPHEV Pro | 449 kW | 309,900 yuan\nPHEV Max | 680 kW | 359,900 yuan\nPHEV Ultra | 680 kW | 389,900 yuan" };
const other = { url: "https://b.com/900", text: "Lynk & Co 900 price starts at 309,900 yuan. Power: 680 kW." };
const r = F.factSheet("Lynk and co 900", [page, other]);
const row = (id) => (r.rows.find((x) => x.id === id) || {}).cell || "";
ok(/plug-in hybrid/.test(row("powertrain")) && !/km/.test(row("powertrain")), "powertrain: plug-in hybrid (not the range number next to «electric»)");
ok(/AWD/.test(row("drive")), "drive: AWD, from a sentence with no number in it");
ok(/April 2025/.test(row("launch")), "launch: April 2025");
ok(/680 kW ✓/.test(row("power")), "a figure on two sites is marked ✓");
ok(r.tables.length === 1 && r.tables[0].versions && /PHEV Ultra/.test(r.md), "the trims and prices table is copied as written, first");
const ar = F.factSheet("لينك اند كو 900", [page], true);
ok(/نوع المحرك/.test(ar.md) && /الدفع/.test(ar.md), "Arabic labels");
console.log(fail ? `${fail} FAILED` : "ALL PASSED");
