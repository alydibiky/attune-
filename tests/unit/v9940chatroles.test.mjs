// v9.9.40 AP-3 (K1, rule 5): what each chat is, from the person's own words and from its messages — 2,500 samples of the generator
// and its held-out set, plus Ali's own chats.
import { execFileSync } from "child_process";
const R = await import("../../web-src/chatroles.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../chatroles/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a = run(), h = run({ HELDOUT: "1" });
ok(a === 100, "10,000 descriptions, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out, 2,500 sample: " + h + "% (the mark: 99%)");
const t = R.readDescription("ده جروب أنا ونودي، بنكتب فيه الحاجات اللي خلصت من البيت");
ok(t.role === "shopping" && t.people.includes("نودي"), "Talabat in Ali's words → a shopping list, with Noudy: " + JSON.stringify(t));
const ae = R.readDescription("جروب السكان، مش مهم غير لو اتكلموا عن الصيانة أو الفلوس أو الجراج");
ok(ae.role === "building" && ae.care.join() === "الصيانة,الفلوس,الجراج", "Address East → building; tell me about maintenance, money, the garage: " + JSON.stringify(ae));
const cr = R.readDescription("work group, tell me only if someone mentions my crane or asks me directly");
ok(cr.role === "work" && cr.care.join() === "crane" && cr.whenMe, "the cranes group → work; my crane; or when someone asks me: " + JSON.stringify(cr));
const jt = R.readDescription("spam unless I actually ordered something");
ok(jt.role === "courier", "J&T “spam unless I ordered something” → courier (not never-important): " + JSON.stringify(jt));
// Attune's own guess (K1: shown with "Right?", never acted on before the person says so)
const msgs = ["tortilla", "chicken strips", "عيش وجبنة", "milk", "eggs and bread", "اللبن خلص"].map((x) => ({ who: "Noudy", text: x }));
const g = R.guessRole({ chat: "Talabat", group: true }, msgs);
ok(g.role === "shopping" && g.sure === false, "Talabat's messages → “a shopping list?” (asked, not sure)");
ok(R.guessRole({ chat: "Address East Owners", group: true }, []).role === "building", "a group called Address East Owners → building (from the name)");
const lines = R.understood({ role: "building", care: ["الصيانة", "الجراج"], whenMe: true, people: [] }, "Address East");
ok(lines.length === 4 && lines[0].t.includes("{c}") && lines[2].v.x === "الصيانة · الجراج", "What I understood: 4 lines with the chat's name and its topics");
ok(R.confirmedRole({ k: { role: "shopping", ok: false } }, "k") === null && R.confirmedRole({ k: { role: "shopping", ok: true } }, "k").role === "shopping", "rule 2: a guess is never acted on — only a role the person said Right to");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
