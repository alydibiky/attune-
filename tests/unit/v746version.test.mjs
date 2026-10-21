// v6.46 (Ali's log said "Attune 6.42 · app 6.45"): the page's own version must be the app's version, or the log and More
// say the phone shows an old page when it doesn't.
import fs from "fs";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const page = (fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8").match(/const PAGE_VERSION = "([\d.]+)"/) || [])[1];
const app = (fs.readFileSync(new URL("../../app/build.gradle.kts", import.meta.url), "utf8").match(/versionName = "([\d.]+)"/) || [])[1];
ok(page && page === app, `the page version (${page}) is the app version (${app})`);
