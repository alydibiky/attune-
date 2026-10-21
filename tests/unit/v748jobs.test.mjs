// v6.48 Jobs (CHAT_RUNS_APP.md S2): one heavy (AI) job at a time, light jobs at once, progress, results, failures, restarts.
const J = await import("../../web-src/jobs.js");
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } else console.log("ok  ", m); };
const mem = () => ({ _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } });
const tick = () => new Promise((r) => setTimeout(r, 5));

let l = [];
const a = J.makeJob({ kind: "humanize", title: "a", heavy: true, now: 1 }), b = J.makeJob({ kind: "translate", title: "b", heavy: true, now: 2 }), c = J.makeJob({ kind: "convert", title: "c", now: 3 });
l = J.addJob(J.addJob(J.addJob(l, a), b), c);
ok(J.startable(l).map((x) => x.title).join() === "c,a", "light jobs start at once, and only the oldest heavy one");
l = J.patchJob(l, a.id, { status: "run" });
ok(J.startable(l).map((x) => x.title).join() === "c", "while a heavy job works, the next heavy one waits");
ok(J.shown(l)[0].title === "a", "Home shows the working job first");
const st = J.toStore([{ ...a, status: "done", result: { b64: "x".repeat(2e6) }, input: { file: {}, text: "hi" } }]);
ok(st[0].result.gone && st[0].result.b64 === null && st[0].input.text === "hi" && !("file" in st[0].input), "kept on the phone without big files or File objects");
ok(J.fromStore([{ ...a, status: "run" }])[0].status === "fail", "a job working when the app closed comes back as failed (Retry)");

// the runner
const store = mem(); let release;
const gate = new Promise((r) => (release = r));
const order = [];
const runner = J.createJobs({ store, runners: {
  humanize: async (job, ctx) => { order.push("h:" + job.title); ctx.progress(40, "Rewriting…"); await gate; return { text: job.input.text.toUpperCase() }; },
  translate: async (job) => { order.push("t:" + job.title); return { text: "bonjour" }; },
  convert: async () => { throw Object.assign(new Error("Pick a PDF"), { need: "file" }); },
} });
let seen = 0; runner.subscribe(() => seen++);
const h = runner.add({ kind: "humanize", title: "email", heavy: true, input: { text: "hi" } });
const t = runner.add({ kind: "translate", title: "note", heavy: true, input: { text: "hello" } });
const cv = runner.add({ kind: "convert", title: "file", input: { text: "" } });
await tick();
ok(order.join() === "h:email", "the second heavy job waits for the first: " + order.join());
const hj = runner.list().find((x) => x.id === h.id);
ok(hj.status === "run" && hj.pct === 40 && hj.note === "Rewriting…", "progress and its note show on the card");
const cj = runner.list().find((x) => x.id === cv.id);
ok(cj.status === "fail" && cj.error === "Pick a PDF" && cj.need === "file", "a failure keeps its reason");
release(); await tick(); await tick();
ok(runner.list().find((x) => x.id === h.id).result.text === "HI" && runner.list().find((x) => x.id === t.id).status === "done", "the first finishes, then the next heavy job runs");
ok(order.join() === "h:email,t:note" && seen > 3, "in order");
ok(J.loadJobs(store).length === 3, "kept on the phone");
runner.dismiss(h.id); ok(runner.list().length === 2, "dismissed jobs disappear");
const slow = J.createJobs({ store: mem(), runners: { humanize: async (job, ctx) => { await tick(); ctx.progress(50); return { text: "x" }; } } });
const s1 = slow.add({ kind: "humanize", heavy: true, input: { text: "x" } }); slow.cancel(s1.id); await tick(); await tick();
ok(!slow.list().length, "a cancelled job never comes back");
console.log(fails ? fails + " FAILED" : "ALL PASSED"); process.exit(fails ? 1 : 0);
