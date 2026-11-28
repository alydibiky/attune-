// v10.9.10 (the Android audit of 28 Nov): two features that could never work on a phone, caught by reading the code.
//  1. Place reminders: the proximity alert's PendingIntent was IMMUTABLE → Android could not add KEY_PROXIMITY_ENTERING → PlaceReceiver
//     returned at once, nothing ever rang.
//  2. The agents' invisible browser (HeadlessRead): postDelayed on a WebView never attached to a window waits for the attach → the
//     price reads never ran; and MainActivity's global pauseTimers stopped the site's scripts while Attune was in the background.
import { readFileSync } from "fs";
let fail = 0; const ok = (c, w) => { console.log((c ? "PASS " : "FAIL ") + w); if (!c) fail++; };
const K = (f) => readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/" + f, import.meta.url), "utf8");
const pg = K("PlaceGeo.kt"), hr = K("HeadlessRead.kt");
const piLine = (pg.match(/private fun pi\([\s\S]*?\n    fun arm/) || [""])[0];
ok(/FLAG_MUTABLE/.test(piLine) && !/FLAG_IMMUTABLE/.test(piLine), "the place alert's intent is mutable (Android can say arriving / leaving)");
ok(/KEY_PROXIMITY_ENTERING/.test(pg), "…and the receiver still reads it");
ok(!/\bv\.postDelayed\(/.test(hr) && /Looper\.getMainLooper\(\)\)[\s\S]{0,200}postDelayed/.test(hr), "the hidden reads are timed on the main thread's Handler, never on the detached view");
ok(/resumeTimers\(\)[\s\S]{0,120}loadUrl/.test(hr), "the hidden browser resumes the WebView timers before it loads the page");
console.log(fail ? fail + " FAILED" : "ALL PASSED"); process.exit(fail ? 1 : 0);
