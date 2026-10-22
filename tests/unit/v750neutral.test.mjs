// v6.50 A neutral app (Ali): the crane built-ins show only to people who use Business → Fleet & rentals.
import { neutral, usesFleet, markFleet, CRANE_ONLY, FLEET_FLAG } from "../../web-src/industry.js";
import { BUILTIN_ASSISTANTS } from "../../web-src/spaces.js";
import { READY_COURSES } from "../../web-src/daily.js";
import { CATALOGUE } from "../../web-src/userskills.js";
let fails = 0; const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const st = mem();
ok(!usesFleet(st), "a new person does not use Fleet");
ok(!neutral(BUILTIN_ASSISTANTS, "assistants", st).some((a) => a.id === "a-crane"), "no Crane expert among the assistants");
ok(neutral(BUILTIN_ASSISTANTS, "assistants", st).length === BUILTIN_ASSISTANTS.length - 1, "…the other assistants all stay");
ok(!neutral(READY_COURSES, "courses", st).some((c) => c.id === "hydraulics"), "no Crane hydraulics course");
ok(!neutral(CATALOGUE, "skills", st).some((c) => CRANE_ONLY.skills.includes(c.id)), "no crane skills in the catalogue");
markFleet(st);
ok(usesFleet(st) && st.getItem(FLEET_FLAG) === "1", "saving cranes in Fleet marks a Fleet user");
ok(neutral(BUILTIN_ASSISTANTS, "assistants", st).some((a) => a.id === "a-crane") && neutral(READY_COURSES, "courses", st).some((c) => c.id === "hydraulics"), "a Fleet user sees the crane built-ins");
for (const [k, ids] of Object.entries(CRANE_ONLY)) {
  const list = k === "assistants" ? BUILTIN_ASSISTANTS : k === "courses" ? READY_COURSES : CATALOGUE;
  ok(ids.every((id) => list.some((x) => x.id === id)), `every crane-only ${k} id exists (${ids.join(", ")})`);
}
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
