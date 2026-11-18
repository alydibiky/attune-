// v10.6 — Ali, 18 Nov: "I asked where is my wife and it should have gone to notifications as we agreed before … it knows who my wife
// is". Home's box answered "I don't know where the wife right now is yet" (the where-things-are reader). Now a person — a role or a
// saved name — is answered from the newest location notification, from Home's box and from Chat; a thing or a place never is.
import * as NT from "../../web-src/noteteach.js";
import { route, whoLines } from "../../web-src/cmdrun.js";
import { run } from "../whereperson/gen.mjs";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.now(), dir = { items: [{ id: "p1", kind: "person", name: "Nada", role: "wife" }] };
const notes = [{ id: "n1", app: "Life360", pkg: "com.life360.android.safetymapd", title: "Nada", text: "Arrived at Home", ts: now - 6e5 }];
const api = { whereIs: (x) => NT.whereIs(x, notes, dir), records: () => [] };
const said = (q) => { const o = route(q, { api }); return o && o.type === "lines" ? o.lines[0].en : o && o.type; };
ok(/^Nada — Life360 .*Arrived at Home/.test(said("where is my wife right now")), "his words: “where is my wife right now” → Nada — Life360 … Arrived at Home: " + said("where is my wife right now"));
for (const q of ["مراتي فين", "where's Nada?", "did my wife get home?", "is my wife home", "Her phone is off. Where is my wife?"]) ok(/^Nada — Life360/.test(said(q)), q + " → " + said(q));
for (const q of ["where is my charger", "where did my wife put the keys", "where is my wife's car", "بيت مراتي فين"]) ok(!/Life360/.test(String(said(q))), "not a person: " + q + " → " + said(q));
const un = route("where is my wife", { api: { whereIs: (x) => NT.whereIs(x, notes, { items: [] }), records: () => [] } });
ok(un.type === "lines" && un.lines.some((l) => /Nada — Arrived at Home/.test(l.en)) && /Nada is my wife/.test(un.lines[un.lines.length - 1].en), "wife not taught yet: the location app's people + “tell me once”");
ok(/No location notification about Nada/.test(whoLines({ person: { name: "Nada" }, note: null })[0].en), "no Life360 note: says what is needed");
const r = run(2500, 9, { quiet: true });
ok(r.right / r.total >= 0.995 && r.share >= 0.6, `where-is-a-person 2,500 sample ${r.right}/${r.total}, shapes ${(100 * r.share).toFixed(1)} %`);
console.log(fail ? `FAIL ${fail}/${n}` : `PASS ${n}/${n}`);
