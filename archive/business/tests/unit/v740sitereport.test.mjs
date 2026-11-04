// v6.37 W3: site report photos stamped with time and place; one printable report.
import { stampLine, reportHtml, stampTime } from "../../web-src/sitereport.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const at = new Date(2026, 9, 18, 14, 5).getTime();
ok(stampTime(at) === "18/10/2026 14:05", "the time stamp");
ok(stampLine({ at, lat: 30.044420, lon: 31.235712, note: "crack near the outrigger" }, 1) === "Photo 2 · 18/10/2026 14:05 · 30.04442, 31.23571 · crack near the outrigger", "photo line with place and note");
ok(stampLine({ at }, 0, "ar") === "صورة 1 · 18/10/2026 14:05", "no GPS → no place, Arabic label");
const h = reportHtml({ title: "Incident report", text: "ونش 3 فيه تسريب هيدروليك", by: "Sayed", photos: [{ url: "data:image/jpeg;base64,AA", at, lat: 30, lon: 31 }], now: at });
ok(/dir="rtl"/.test(h) && /<img src="data:image\/jpeg;base64,AA"/.test(h) && /maps\.google\.com\/\?q=30,31/.test(h) && /كتبه: Sayed/.test(h), "Arabic report: right to left, the photo, a map link, who filed it");
ok(!/<h2>/.test(reportHtml({ title: "x", text: "y" })), "no photos → no photo section");
ok(!/<script/.test(reportHtml({ title: "<script>", text: "<script>alert(1)</script>" })), "text is escaped");
console.log(process.exitCode ? "FAILED" : "ALL PASSED");
