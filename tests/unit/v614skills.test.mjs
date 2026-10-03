// v6.10 — your own Skills: text recipes matched by a /command or by their description; nothing runs.
const mem = {}; globalThis.localStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => delete mem[k] };
const S = await import("../../web-src/userskills.js");
let fail = 0;
const ok = (c, what) => { console.log((c ? "PASS " : "FAIL ") + what); if (!c) fail++; };
const throws = (fn, part) => { try { fn(); return false; } catch (e) { return !part || String(e.message).includes(part); } };

const quote = S.makeSkill(S.CATALOGUE.find((c) => c.id === "crane-quote"), { source: "catalogue" });
const turk = S.makeSkill(S.CATALOGUE.find((c) => c.id === "turkish"), { source: "catalogue" });
const mail = S.makeSkill(S.CATALOGUE.find((c) => c.id === "formal-email"));
const all = [quote, turk, mail];

ok(quote.command === "/quote" && quote.on && quote.source === "catalogue", "a catalogue skill becomes a clean skill with its command");
ok(throws(() => S.makeSkill({ name: "", instructions: "x".repeat(40) }), "name"), "a skill needs a name");
ok(throws(() => S.makeSkill({ name: "A", instructions: "short" }), "sentence"), "…and real instructions");
ok(throws(() => S.makeSkill({ name: "A", command: "/a b", instructions: "x".repeat(40) }), "command"), "a bad command is refused");
ok(S.normCommand("/Quote") === "/quote" && S.normCommand("q") === "" && S.normCommand("quote!") === "", "commands are normalised");
ok(S.makeSkill({ name: "N", instructions: "y".repeat(9000) }).instructions.length === S.LIMITS.instructions, "instructions are capped");

// ---- matching
const c1 = S.matchSkills("/quote 50 t crane for 3 days at Ain Sokhna", all);
ok(c1.via === "command" && c1.matches[0].id === quote.id && c1.stripped === "50 t crane for 3 days at Ain Sokhna", "/quote picks the skill and is cut out of the question");
ok(S.matchSkills("/nothing hello", all) === null, "an unknown command matches nothing");
const a1 = S.matchSkills("I need a price offer for a crane rental job next week", all);
ok(a1 && a1.via === "auto" && a1.matches[0].id === quote.id, "auto: a price offer for crane rental → the quote skill");
const a2 = S.matchSkills("اكتبلي عرض سعر تأجير ونش ٥٠ طن", all);
ok(a2 && a2.matches[0].id === quote.id, "auto, Arabic: عرض سعر تأجير ونش → the quote skill");
ok(S.matchSkills("what is the capital of France", all) === null, "an unrelated question matches no skill");
ok(S.matchSkills("write a formal email to the bank", all).matches[0].id === mail.id, "auto: formal email → the email skill");
const off = all.map((s) => (s.id === quote.id ? { ...s, on: false } : s));
ok(S.matchSkills("/quote hi", off) === null && !(S.matchSkills("price offer for crane rental", off) || { matches: [] }).matches.some((s) => s.id === quote.id), "a switched-off skill is never used");
ok(S.matchSkills("x".repeat(1500) + " price offer crane rental", all) === null, "a pasted document is not matched automatically");

// ---- the text added to the question
const b = S.skillBlock([quote]);
ok(b.startsWith("\n\n(Your saved skills") && b.includes("Crane rental quote") && b.length < S.LIMITS.blockChars + 200, "the block names the skill and stays short");
ok(S.skillBlock([]) === "" && S.skillBlock(null) === "", "no skill, no block");

// ---- sharing
const f = S.toFile(quote);
ok(f.startsWith("---\nname: Crane rental quote\ncommand: /quote"), "a skill exports as a small readable file");
const back = S.fromFile(f);
ok(back.name === quote.name && back.command === "/quote" && back.instructions === quote.instructions && back.source === "imported", "…and imports back the same (marked imported)");
ok(S.fromFile(JSON.stringify({ name: "J", instructions: "Do the thing well and briefly." })).name === "J", "JSON skills import too");
ok(throws(() => S.fromFile("hello"), "not a skill"), "random text is not a skill");
ok(throws(() => S.fromFile("x".repeat(30000)), "too big"), "a huge file is refused");
const withEx = S.fromFile("---\nname: E\n---\nAnswer briefly in two lines.\n\n## Example\nShort and sweet.");
ok(withEx.example === "Short and sweet." && withEx.instructions === "Answer briefly in two lines.", "an example section is read");

// ---- draft from the model
const d = S.parseDraft('blah {"name":"Rental terms","when":"explain rental terms","instructions":"Explain each term in one line.","example":""} end');
ok(d.name === "Rental terms" && d.instructions.startsWith("Explain"), "a model's JSON draft is read");
ok(throws(() => S.parseDraft("no json here"), "did not return"), "a draft without JSON is reported");
ok(S.CATALOGUE.length >= 10 && S.CATALOGUE.every((c) => { try { S.makeSkill(c); return true; } catch (e) { return false; } }), "every catalogue skill is valid");
ok(new Set(S.CATALOGUE.map((c) => c.command)).size === S.CATALOGUE.length, "catalogue commands are unique");

// ---- storage
S.save([quote]); ok(S.load().length === 1 && S.load()[0].name === "Crane rental quote", "skills are kept on the phone");

if (fail) { console.log(`\n${fail} FAILED`); process.exit(1); } else console.log("\nALL PASSED");

// ---- v6.18: skills v2 — checklist, reference, script, SKILL.md ----
{
  const file = `---
name: Crane quote pro
command: /cq
description: price offer quotation crane rental
---
Write a quotation with the crane, days, rate and total.

## Checklist
- the total is days x rate
- VAT 14% shown separately

## Reference
Rates: 50 t crane costs 9000 EGP per day.

Mobilisation to Ain Sokhna is 4000 EGP one way.

Operators are billed 800 EGP per day.

## Script
\`\`\`python
import re
n = [int(x) for x in re.findall(r"\\d+", INPUT)]
print("days x rate =", n[0] * n[1])
\`\`\`

## Example
Quote: 3 days x 9000 = 27000.
`;
  const sk = S.fromFile(file);
  ok(sk.when.includes("quotation") && sk.checklist.includes("VAT 14%") && sk.reference.includes("Mobilisation") && sk.script && sk.script.lang === "python" && sk.example.startsWith("Quote"), "a SKILL.md with description, checklist, reference, script and example imports");
  ok(!sk.instructions.includes("## "), "the sections are cut out of the instructions");
  const again = S.fromFile(S.toFile(sk));
  ok(again.checklist === sk.checklist && again.reference === sk.reference && again.script.code === sk.script.code, "…and exports and imports back the same");
  const ref = S.relevantReference({ reference: sk.reference.repeat(30) }, "how much is mobilisation to Ain Sokhna", 300);
  ok(ref.includes("Mobilisation") && ref.length <= 300, "only the paragraphs that fit the question are used");
  const blk = S.skillBlock([sk], "mobilisation price", { [sk.id]: "days x rate = 27000" });
  ok(blk.includes("27000") && blk.includes("Before you finish, check") && blk.includes("VAT 14% shown separately"), "the block carries the program's result and the checklist");
  const sc = S.scriptsOf([sk])[0];
  ok(S.scriptCode(sc, "3 9000").startsWith('INPUT = "3 9000"'), "the program gets the question as INPUT");
}
