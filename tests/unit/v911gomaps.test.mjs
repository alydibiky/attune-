// v9.1 (Ali, 4 Nov: offline Maps archived — places open Google Maps): the links, and "take me to X" in English and Egyptian Arabic.
import { mapsUrl, directionsOf } from "../../web-src/gomaps.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
ok(mapsUrl("City Stars") === "https://www.google.com/maps/search/?api=1&query=City%20Stars", "a place → a Google Maps search");
ok(mapsUrl("City Stars", { directions: true, mode: "walking" }) === "https://www.google.com/maps/dir/?api=1&destination=City%20Stars&travelmode=walking", "directions, walking");
let r = directionsOf("take me to City Stars"); ok(r && r.place === "City Stars" && r.mode === "", "take me to City Stars: " + JSON.stringify(r));
r = directionsOf("how do I get to the Egyptian Museum walking?"); ok(r && r.place === "the Egyptian Museum" && r.mode === "walking", "how do I get to … walking");
r = directionsOf("وديني سيتي ستارز"); ok(r && r.place === "سيتي ستارز", "Egyptian: «وديني سيتي ستارز»");
r = directionsOf("ازاي اروح المعادي"); ok(r && r.place === "المعادي", "Egyptian: «ازاي اروح المعادي»");
for (const t of ["metro from Maadi to Dokki", "take me to the metro", "what is City Stars?", "remind me to go to the bank"]) ok(directionsOf(t) === null, "not directions: " + t);
console.log(bad ? bad + " FAILED" : "PASS v911gomaps: places open Google Maps; 'take me to X' starts its directions (English and Egyptian Arabic)");
