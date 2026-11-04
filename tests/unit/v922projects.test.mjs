// v9.2 (Ali picked 6 = A + B "in a smart and organised way"): a project's tasks as a board, starters, "add X to <project>"
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const S = await import("../../web-src/spaces.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
let p = S.upsertProject({ name: "Flat renovation", emoji: "🏠", tasks: [{ text: "Get 3 quotes" }, { text: "Electrician", col: "doing" }] });
ok(p.tasks.length === 2 && p.tasks[0].col === "todo" && p.tasks[1].col === "doing", "tasks are kept with their column");
p = S.addTasks(p, "Buy tiles, Painting");
ok(p.tasks.length === 4 && p.tasks.slice(2).every((t) => t.col === "todo"), "several tasks at once (commas) land in To do");
p = S.moveTask(p, p.tasks[0].id, 1); p = S.moveTask(p, p.tasks[0].id, 1); p = S.moveTask(p, p.tasks[0].id, 1);
ok(p.tasks[0].col === "done", "‹ › moves a card To do → Doing → Done (and no further)");
ok(JSON.stringify(S.taskProgress(p)) === '{"done":1,"of":4,"left":3}', "progress: 1 of 4 done, 3 left");
p = S.removeTask(p, p.tasks[1].id); ok(p.tasks.length === 3, "× removes a task");
S.upsertProject(p);
const pt = S.parseProjectTask("add buy tiles to the renovation");
ok(pt && pt.project.name === "Flat renovation" && pt.text === "buy tiles", "“add buy tiles to the renovation” → that project's board: " + JSON.stringify(pt && { n: pt.project.name, t: pt.text }));
ok(S.parseProjectTask("add milk to my to-do list") === null && S.parseProjectTask("add bread to the shopping list") === null, "the to-do list and a project that doesn't exist are not project tasks");
ok(S.STARTERS.length === 4 && S.STARTERS.every((s) => s.tasks.length >= 3 && s.instructions), "4 starters, each with its instructions and first tasks");
