/* ---- v8.8 The connected memory on this phone: the stores read once per question, "Which Ahmed?" answered and remembered.
   Used by Chat (chat.jsx), Home's box (home-ui.jsx) and the voice. The logic is links.js / entities.js (pure, tested). */
import { loadStores } from "./lifeask.js";
import { loadPots } from "./planner.js";
import { loadAgents } from "./agents.js";
import { connect } from "./links.js";
import { loadDir, saveDir, learnPick, touch } from "./entities.js";

export function allStores() {
  let s = {}; try { s = loadStores(); } catch (e) {}
  try { s.pots = loadPots(); } catch (e) {}
  try { s.agents = loadAgents(); } catch (e) {}
  return s;
}
const PICK_KEY = "attune:people:pick";
const norm = (q) => String(q || "").replace(/\s+/g, " ").trim().toLowerCase();
/** "Which Ahmed?" → this one: learnt for next time, and the question asked again with him. */
export function pickPerson(q, id) {
  try { saveDir(learnPick(loadDir(), id, q)); localStorage.setItem(PICK_KEY, JSON.stringify({ q: norm(q), id, at: Date.now() })); } catch (e) {}
}
function pickFor(q) {
  try { const v = JSON.parse(localStorage.getItem(PICK_KEY) || "null"); if (v && v.q === norm(q) && Date.now() - v.at < 10 * 60e3) return v.id; } catch (e) {}
  return null;
}
/** Everything linked to a question (links.js connect), or null. The people it named are marked as just used. */
export function connectNow(q) {
  try {
    const dir = loadDir();
    const r = connect(q, allStores(), dir, { pick: pickFor(q) });
    if (r && r.people && r.people.length) try { saveDir(touch(loadDir(), r.people.map((p) => p.id))); } catch (e) {}
    return r;
  } catch (e) { return null; }
}
