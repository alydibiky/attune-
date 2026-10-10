// Unit tests for Studio "Draft then clear" (web-src/studio.js): the plan, the time estimates and the state machine.
import { draftPlan, passSeconds, flowStep, flowSecondsLeft, flowPercent, DRAFT_SIDE, LAB_SECONDS, speedFactor } from "../../web-src/studio.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

const lab = { cores: 4, bigCores: 4, platform: "linux" };          // speed factor 1.2
const phone = { cores: 8, bigCores: 4, platform: "android" };      // a typical 4+4 phone
eq(DRAFT_SIDE, 384, "the draft is 384 px");
eq(passSeconds("turbo-xl", 384, { cores: 5, bigCores: 5, platform: "android" }), LAB_SECONDS["turbo-xl@384"], "a lab-speed device: Turbo+ draft = the measured 384 px time");
eq(passSeconds("turbo-xl", 768, { cores: 5, bigCores: 5, platform: "android" }), Math.round(18 * 2.25), "an unmeasured size scales with the pixels (768 px = 2.25× 512 px)");
const p = draftPlan("turbo-xl", 512, phone, { on: true });
eq([p.draft, p.best2, p.draftSide, p.finalSide], [true, false, 384, 512], "Turbo+ at 512 px: a 384 px draft first");
eq(p.estTotal, p.estDraft + p.estFinal, "the honest total is draft + final");
eq(p.estDraft < p.estFinal, true, "the draft is quicker than the clear picture");
eq(draftPlan("turbo", 384, phone, {}).draft, false, "a picture drawn at 384 px anyway gets no draft");
eq(draftPlan("klein-4b", 1024, phone, {}).draft, false, "the slow Pro pack gets no draft");
eq(draftPlan("turbo", 512, phone, { on: false }).draft, false, "the draft can be switched off");
eq(draftPlan("turbo", 512, phone, {}, "edit").draft, false, "editing a photo never drafts");
const b = draftPlan("turbo", 512, phone, { best2: true });
eq([b.best2, b.estTotal], [true, 2 * b.estDraft + b.estFinal], "Best of 2: two drafts, then one clear picture");
eq(speedFactor(lab) > speedFactor(phone) * 0.9, true, "a computer core counts more than a phone core");

// state machine: queued → draft → refining → done
let s = flowStep(null, { type: "start", t: 0, plan: p });
eq(s.phase, "queued", "start → queued");
eq(flowStep(s, { type: "keep" }).phase, "queued", "nothing to keep before the draft");
eq(flowStep(s, { type: "stage", stage: "draw" }).phase, "queued", "drawing the draft stays queued");
s = flowStep(s, { type: "draft", pic: { file: "d.png" }, t: 9000 });
eq([s.phase, s.draft.file], ["draft", "d.png"], "draft ready → draft");
const r = flowStep(s, { type: "stage", stage: "draw" });
eq(r.phase, "refining", "the clear picture starts drawing → refining");
eq(flowStep(r, { type: "keep" }).phase, "kept", "Keep draft → kept");
eq(flowStep(r, { type: "stop" }).phase, "stopped", "Stop → stopped");
const d = flowStep(r, { type: "done", pic: { file: "f.png" }, t: 30000 });
eq([d.phase, d.final.file, d.draft.file], ["done", "f.png", "d.png"], "final → done, with both pictures");
eq(flowStep(flowStep(r, { type: "keep" }), { type: "done", pic: {} }).phase, "kept", "a final arriving after Keep draft is ignored");
eq(flowStep(flowStep(s, { type: "stop" }), { type: "done", pic: {} }).phase, "stopped", "…and after Stop");
eq(flowStep(r, { type: "fail", error: "x" }).phase, "kept", "the clear pass fails → the draft is kept");
eq(flowStep(flowStep(null, { type: "start", t: 0, plan: p }), { type: "fail", error: "x" }).phase, "failed", "fails before any draft → failed");
eq(flowStep(flowStep(null, { type: "start", t: 0, plan: p }), { type: "done", pic: { file: "f" }, t: 1 }).phase, "done", "an engine without drafts goes straight to done");
// Best of 2
let q = flowStep(null, { type: "start", t: 0, plan: b });
q = flowStep(q, { type: "drafts", pics: [{ seed: 1 }, { seed: 2 }], t: 5000 });
eq(q.phase, "pick", "two drafts → pick");
eq(flowStep(q, { type: "pick", i: 5 }).phase, "pick", "a pick out of range is ignored");
q = flowStep(q, { type: "pick", i: 1, t: 6000 });
eq([q.phase, q.draft.seed], ["refining", 2], "the picked draft is refined");

// time left and the bar
const st = flowStep(null, { type: "start", t: 0, plan: { estDraft: 10, estFinal: 20, estTotal: 30 } });
eq(flowSecondsLeft(st, 4000), 26, "queued: total minus elapsed");
eq(flowSecondsLeft(st, 99000), 1, "never below 1 s while working");
const sd = flowStep(st, { type: "draft", pic: {}, t: 12000 });
eq(flowSecondsLeft(sd, 17000), 15, "after the draft: the clear pass minus its elapsed time");
eq(flowSecondsLeft(flowStep(sd, { type: "keep" }), 17000), null, "nothing left once kept");
eq([flowPercent(st, 0), flowPercent(st, 15000), flowPercent(st, 99000)], [2, 50, 97], "the bar follows the honest total, never 0 or 100 while working");

if (fails.length) { console.log(fails.length + " FAILED"); process.exit(1); } else console.log("all passed");
