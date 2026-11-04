// v9.1 design D (Ali, 4 Nov 2026): a project keeps a due date, who answers and its repeats; saved artifacts carry the project.
import { strict as assert } from "assert";
const store = {}; globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.window = { dispatchEvent() {} }; globalThis.CustomEvent = class { constructor(t) { this.type = t; } };
const S = await import("../../web-src/spaces.js");
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

const p = S.upsertProject({ name: "Port Said tender", due: "2030-11-05", assistantId: "a-writer",
  repeats: [{ text: "What is still open?", every: "week" }, { text: "", every: "day" }, { text: "Daily check", every: "hourly" }] });
ok(p.due === "2030-11-05" && p.assistantId === "a-writer", "due date and assistant are kept");
ok(p.repeats.length === 2 && p.repeats[1].every === "", "empty repeats dropped; an unknown rhythm becomes 'only when I tap'");
ok(S.upsertProject({ name: "x", due: "next week" }).due === "", "a due date that is not YYYY-MM-DD is dropped");

const day = 864e5, now = new Date(2030, 5, 15, 10).getTime();
ok(S.repeatDue({ every: "week", last: 0 }, now), "never run → due");
ok(!S.repeatDue({ every: "", last: 0 }, now), "'only when I tap' is never due");
ok(!S.repeatDue({ every: "day", last: now - 3600e3 }, now) && S.repeatDue({ every: "day", last: now - day }, now), "daily: due the next day");
ok(!S.repeatDue({ every: "week", last: now - 6 * day }, now) && S.repeatDue({ every: "week", last: now - 7 * day }, now), "weekly: due after 7 days");
ok(!S.repeatDue({ every: "month", last: new Date(2030, 5, 1).getTime() }, now) && S.repeatDue({ every: "month", last: new Date(2030, 4, 10).getTime() }, now), "monthly: due a month later");
ok(S.dueRepeats(p, now).length === 1, "dueRepeats lists the due ones");
const marked = S.markRepeatRun(p.id, p.repeats[0].id, now);
ok(marked.repeats[0].last === now && S.dueRepeats(marked, now).length === 0, "running a repeat marks it");

ok(S.daysToDue("2030-06-20", now) === 5 && S.daysToDue("2030-06-14", now) === -1 && S.daysToDue("", now) === null, "days to the due date");

const a = S.saveArtifact({ kind: "doc", lang: "markdown", title: "Bid letter", content: "# Bid", projectId: p.id });
S.saveArtifact({ kind: "doc", lang: "markdown", title: "Other", content: "# Other" });
ok(a.projectId === p.id && S.artifactsFor(p.id).length === 1 && S.artifactsFor("").length === 0, "a saved artifact belongs to its project");
const v2 = S.saveArtifact({ id: a.id, kind: "doc", lang: "markdown", title: "Bid letter", content: "# Bid v2" });
ok(v2.projectId === p.id && v2.versions.length === 2, "a new version keeps the project");
console.log("v912projects: " + n + " passed");
