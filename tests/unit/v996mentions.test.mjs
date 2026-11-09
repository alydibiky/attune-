// v9.9.6 N3 (Ali OK'd): @ links to people and things in notes; "he'll pay Thursday" → a follow-up offered
import assert from "node:assert/strict";
import * as M from "../../web-src/mentions.js";
import { emptyDir, addCard } from "../../web-src/entities.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log("PASS " + m); };
let dir = emptyDir();
dir = addCard(dir, { name: "Sheikh", role: "client" }).dir;
dir = addCard(dir, { kind: "thing", name: "Grove GMK" }).dir;
dir = addCard(dir, { name: "Sara" }).dir;
dir = addCard(dir, { name: "نادا", role: "wife" }).dir;
const t = "Called @She";
const at = M.atQuery(t, t.length);
ok(at && at.q === "She", "typing “@She” → it asks for names starting with “She”");
ok(M.suggest("She", dir).map((p) => p.name).join() === "Sheikh", "→ Sheikh");
ok(M.suggest("gr", dir)[0].name === "Grove GMK", "“@gr” → Grove GMK (a thing)");
ok(M.atQuery("email a@b.com", 13) === null, "an email address is not an @ link");
const r = M.insertAt(t, t.length, at, "Sheikh");
ok(r.text === "Called @Sheikh " && r.caret === r.text.length, "picked → “Called @Sheikh ”");
const note = "Called @Sheikh about the @Grove GMK rental, he'll pay Thursday. Ask @نادا about dinner";
ok(M.linksIn(note, dir).map((p) => p.name).sort().join() === ["Grove GMK", "Sheikh", "نادا"].sort().join(), "linked: Sheikh, Grove GMK (two words), نادا (Arabic)");
ok(M.linksIn("Sheikh called", dir).length === 0, "a name without @ is not a link (the note is yours to write)");
const NOW = Date.parse("2026-11-10T12:00:00");   // a Tuesday
const pr = M.promisesIn(note, dir, NOW);
ok(pr.length === 1 && pr[0].who === "Sheikh" && new Date(pr[0].at).getDay() === 4 && new Date(pr[0].at).getHours() === 9, "“he'll pay Thursday” → a follow-up on Sheikh, Thursday 9:00 (offered, not made)");
ok(M.promisesIn("@Sheikh هيدفع بكرة", dir, NOW)[0].at === Date.parse("2026-11-11T09:00:00"), "«@Sheikh هيدفع بكرة» → tomorrow 9:00");
ok(M.promisesIn("@Sheikh is nice, Thursday", dir, NOW).length === 0, "no promise words → nothing offered");
const recs = [{ id: "1", kind: "note", title: "Crane", text: "@Sheikh owes the rental", ts: 2 }, { id: "2", kind: "note", title: "x", text: "Sheikh without at", ts: 3 }];
ok(M.notesAbout(recs, dir.items[0]).map((r) => r.id).join() === "1", "Sheikh's page lists the notes that @-mention him");
console.log("ALL PASSED v996mentions (" + n + " checks)");
