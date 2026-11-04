// Unit tests for v5.18: junk-loop guard, website topic check, Business app export/import.
import { detectDegenerate } from "../../web-src/quality.js";
import { onTopic, topicWords, writeMessages } from "../../web-src/code.js";
import { buildApp, readApp } from "../../web-src/erp-app.js";
import * as E from "../../web-src/erp.js";
const fails = [];
function eq(got, want, what) { const ok = JSON.stringify(got) === JSON.stringify(want); console.log((ok ? "PASS " : "FAIL ") + what + (ok ? "" : `  → got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)); if (!ok) fails.push(what); }

// ---- the column of "." lines (Ali's website screenshot) ----
const code = "function showNotification(\n```\n```html\n" + Array.from({ length: 60 }, (_, i) => (i % 3 ? "        ." : ".")).join("\n");
const d = detectDegenerate(code);
eq(d.loop, true, "a column of '.' lines is caught even in code");
eq(code.slice(0, d.cut).trim().endsWith("```html"), true, "…and cut where the junk starts");
const css = Array.from({ length: 40 }, (_, i) => `  .c${i} { color: red; }\n  }`).join("\n");
eq(detectDegenerate(css).loop, false, "real code with many short '}' lines is not junk");
const json = '{"tables":[' + Array.from({ length: 12 }, (_, i) => `{"name":"T${i}","fields":[\n{"name":"Name","type":"text"},\n{"name":"Phone","type":"phone"},\n{"name":"Notes","type":"longtext"}]}`).join(",\n") + "]}";
eq(detectDegenerate(json).loop, false, "JSON with repeated fields is not junk");
eq(detectDegenerate(Array.from({ length: 40 }, () => "<div class=\"spacer\"></div>").join("\n")).loop, true, "the same long line 40 times is");

// ---- a website about what was asked ----
eq(topicWords("make a website for a clothing brand called skittlz").named, ["skittlz"], "the brand name is found");
eq([onTopic("make a website for a clothing brand called skittlz", "<title>ZenFlow: Focus Timer</title>"), onTopic("make a website for a clothing brand called skittlz", "<h1>SKITTLZ</h1>")], [false, true], "ZenFlow is off topic, Skittlz is on");
eq(writeMessages("a website for a clothing brand called skittlz", "html")[1].content.includes('use the name "skittlz"'), true, "the request pins the name");

// ---- Business app: out and back with its data ----
let sys = E.systemFromSpec(E.TEMPLATES[0].spec);
const cust = sys.tables[0];
sys = E.addRow(sys, cust.id, { [cust.fields.find((f) => f.type === "text").id]: "Orascom" }).sys;
const html = buildApp(sys, { freeRows: 30 });
eq(/^<!doctype html>/.test(html) && html.includes("<title>") && !/<\/script>[\s\S]*"attuneErp"/.test(html.split('id="attune-erp">')[0]), true, "the app is one html file with the system inside");
const back = readApp(html);
eq([back.id, back.tables.length, back.rows[cust.id].length], [sys.id, sys.tables.length, 1], "reading the app back gives the same system with its records");
eq(back.freeRows, undefined, "the trial marker is not kept as a field");
eq(readApp("<html>hello</html>"), null, "any other file is refused");
const evil = { ...sys, name: "</script><script>alert(1)</script>" };
const h2 = buildApp(evil);
eq(h2.split("</script>").length - 1, 2, "a name with </script> can't break out of the data (only the 2 real closing tags)");
eq(readApp(h2).name, evil.name, "…and still reads back exactly");

console.log(fails.length ? fails.length + " FAILED" : "ALL PASSED");
if (fails.length) process.exit(1);
