// v9.5 (Ali, 5 Nov): "I still get the notification from Fit & Food to log my dinner" — the old Fit reminders are dropped
import assert from "node:assert/strict";
const LS = {}; globalThis.localStorage = { getItem: (k) => LS[k] ?? null, setItem: (k, v) => { LS[k] = String(v); }, removeItem: (k) => delete LS[k] };
const A = await import("../../web-src/actions.js");
LS["attune:reminders:v1"] = JSON.stringify([{ id: "fit-dinner", title: "Log your dinner", at: 1 }, { id: "x1", title: "سجّل عشاك", at: 2 },
  { id: "r1", title: "Call Ahmed", at: 3 }, { id: "fit-water", title: "Drink a glass of water", at: 4 }, { id: "r2", title: "Log your dinner receipt in Money", at: 5 }]);
const ids = A.loadReminders().map((r) => r.id);
assert.deepEqual(ids, ["r1", "r2"], "only the old Fit ones go; a reminder of the person's own stays");
console.log("ALL PASSED v950misc (1 check)");
