// Skills, second round: the optional checklist pass (check → JSON pass/fail per line → "Fix it") and skills that
// include other skills ({{skill:x}} or /x inside the instructions: 2 levels, no loops, a size cap, clear errors).
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const S = await import("../../web-src/userskills.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };

// ---- (A) second pass
const quote = S.makeSkill(S.CATALOGUE.find((c) => c.id === "crane-quote"));
ok(quote.selfCheck === false, "the checklist pass is off by default");
const qOn = S.makeSkill({ ...quote, selfCheck: true });
ok(qOn.selfCheck === true, "…and can be switched on per skill");
ok(S.selfCheckOf([quote, qOn]).length === 1 && S.selfCheckOf([qOn])[0] === qOn, "only skills with the switch on (and a checklist) are checked");
ok(S.selfCheckOf([S.makeSkill({ name: "N", instructions: "Do it well, always.", selfCheck: true })]).length === 0, "no checklist → nothing to check");
const lines = S.checkLines(qOn);
ok(lines.length === 5 && lines[0].startsWith("crane size"), "checklist lines are read one per line");
const msgs = S.checkMessages(lines, "50 t crane 3 days", "Quote: ...");
ok(msgs.length === 2 && /ONLY a JSON array/.test(msgs[0].content) && msgs[0].content.length < 400, "the check prompt is short and strict");
ok(/1\. crane size/.test(msgs[1].content) && /5\. nothing invented/.test(msgs[1].content), "every checklist line is numbered for the model");
const L = ["a", "b", "c"];
let r = S.parseCheck('[{"n":1,"pass":true,"why":"ok"},{"n":2,"pass":false,"why":"no VAT line"},{"n":3,"pass":true,"why":""}]', L);
ok(r && r[1].pass === false && r[1].why === "no VAT line" && r[0].pass === true, "clean JSON is read");
r = S.parseCheck("```json\n[{n:1, pass:'yes', why:'fine'}, {n:2, pass:'no', why:'missing'},]\n```", L);
ok(r && r[0].pass === true && r[1].pass === false && r[2].pass === null, "repaired: fences, bare keys, single quotes, yes/no, trailing comma; a missing line stays unknown");
r = S.parseCheck('Sure! [{"n":1,"pass":true,"why":"ok"},{"n":2,"pass":false,"why":"cut', L);
ok(r && r[0].pass === true, "a reply cut off mid-way still gives the lines that finished");
r = S.parseCheck('{"results":[{"pass":false,"reason":"x"}]}', L);
ok(r && r[0].pass === false && r[0].why === "x", "an object with results, and 'reason' instead of 'why'");
ok(S.parseCheck("I think it is fine.", L) === null && S.parseCheck("", L) === null, "unreadable → null (the app shows nothing alarming)");
ok(S.parseCheck('[{"n":9,"pass":false}]', L) === null, "a line number that does not exist is ignored");
const fx = S.fixMessages("q", "the answer", [{ line: "VAT 14% shown", why: "no VAT line" }]);
ok(/only the full revised answer/i.test(fx[0].content) && /VAT 14% shown \(no VAT line\)/.test(fx[1].content), "Fix it sends only the failed lines with their reasons");
ok(/selfcheck: on/.test(S.toFile(qOn)) && S.fromFile(S.toFile(qOn)).selfCheck === true && S.fromFile(S.toFile(quote)).selfCheck === false, "the switch survives sharing as a file");

// ---- (B) skills calling skills
const vat = S.makeSkill({ name: "VAT rule", command: "/vat", instructions: "Always add VAT at 14% as its own line." });
const sign = S.makeSkill({ name: "Signature", command: "/sign", instructions: "End with: Ali, Attune Cranes. {{skill:vat}}" });
const offer = S.makeSkill({ name: "Offer", command: "/offer", instructions: "Write a short price offer. {{skill:sign}} Keep it to 10 lines." });
let all = [vat, sign, offer];
let e = S.expandInstructions(offer, all);
ok(e.text.includes("End with: Ali") && e.text.includes("VAT at 14%") && !e.text.includes("{{"), "two levels deep: offer → signature → VAT");
ok(e.errors.length === 0 && e.used.join() === "Signature,VAT rule", "…no errors, and it says which skills it used");
const bare = S.makeSkill({ name: "Bare", instructions: "Write the offer, then follow /vat. Speed in km/h and 24/7 stay as they are; /unknown too." });
e = S.expandInstructions(bare, all);
ok(e.text.includes("VAT at 14%") && e.text.includes("km/h") && e.text.includes("24/7") && e.text.includes("/unknown") && !e.errors.length, "/command form works; ordinary slashes and unknown /words are left alone");
const deep = S.makeSkill({ name: "Deep", instructions: "Top level. {{skill:offer}}" });
e = S.expandInstructions(deep, [...all, deep]);
ok(e.text.includes("price offer") && e.text.includes("End with") && !e.text.includes("VAT at 14%"), "depth limit 2: the third level is not added");
ok(e.errors.some((x) => /too deep/.test(x)), "…and says so plainly");
const a1 = S.makeSkill({ id: "A1", name: "Loop A", command: "/loopa", instructions: "A part. {{skill:loopb}}" });
const b1 = S.makeSkill({ id: "B1", name: "Loop B", command: "/loopb", instructions: "B part. {{skill:loopa}}" });
e = S.expandInstructions(a1, [a1, b1]);
ok(e.text.includes("B part") && (e.text.match(/A part/g) || []).length === 1 && e.errors.some((x) => /loop/.test(x)), "a loop is cut and reported");
const self = S.makeSkill({ id: "S1", name: "Selfie", command: "/self", instructions: "Start your message with /self to use me." });
ok(S.expandInstructions(self, [self]).text.includes("/self") && !S.expandInstructions(self, [self]).errors.length, "a skill mentioning its own command is not an error");
e = S.expandInstructions(S.makeSkill({ name: "M", instructions: "Do it. {{skill:nothere}} Then stop." }), all);
ok(e.errors[0] === "The skill “nothere” that this skill includes was not found" && !e.text.includes("nothere"), "a missing skill: clear error, nothing odd sent to the model");
ok(S.findSkill("signature", all) === sign && S.findSkill("/vat", all) === vat, "found by command or by its name");
const big = S.makeSkill({ name: "Big", command: "/big", instructions: "x ".repeat(2900) });
const big2 = S.makeSkill({ name: "Big2", command: "/big2", instructions: "y ".repeat(2900) + "{{skill:big}}" });
const top = S.makeSkill({ name: "Top", instructions: "z ".repeat(2900) + "{{skill:big2}}" });
e = S.expandInstructions(top, [big, big2, top]);
ok(e.text.length === S.INCLUDE.chars && e.errors.some((x) => /too long/.test(x)), "the size cap holds");
const res = S.resolveSkills([offer], all);
ok(res[0].instructions.includes("VAT at 14%") && offer.instructions.includes("{{skill:sign}}"), "resolveSkills expands for the prompt without changing the saved skill");
ok(S.skillBlock(res, "q").includes("VAT at 14%"), "…and the block the model reads includes it");
ok(S.expandInstructions(quote, all).text === quote.instructions, "a skill with no includes is unchanged");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); }
console.log("\nall passed");
