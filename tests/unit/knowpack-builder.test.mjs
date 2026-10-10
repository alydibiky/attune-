// The public-pack builder (tools/build_know_pack.py): no Wikipedia source anywhere (Ali's rule), and the two builders' passage
// makers work on small fixtures (a Factbook country, an Egyptian law) with no network.
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const root = new URL("../../", import.meta.url).pathname;
const src = fs.readFileSync(root + "tools/build_know_pack.py", "utf8"), wf = fs.readFileSync(root + ".github/workflows/know-pack.yml", "utf8");
ok(!/wikipedia|wikimedia/i.test(src.replace(/^.*No Wikipedia.*$/gim, "")), "the builder reads no Wikipedia source");
ok(!/wikipedia|wikimedia/i.test(wf.replace(/^#.*$/gm, "")), "the workflow has no Wikipedia source");
ok(/confirm == 'yes'/.test(wf) && /workflow_dispatch/.test(wf) && !/\bschedule:|\bpush:/.test(wf), "the workflow only runs by hand with confirm = yes");

const py = `
import json, sys; sys.path.insert(0, "${root}tools"); import build_know_pack as B
eg = {"Introduction": {"Background": {"text": "Egypt is in North Africa. The Nile flows north."}},
      "Geography": {"Area": {"total": {"text": "1,001,450 sq km"}, "land": {"text": "995,450 sq km"}}},
      "Government": {"Country name": {"conventional short form": {"text": "Egypt"}}, "Capital": {"name": {"text": "Cairo"}}}}
name, rows = B.country_rows("africa", "eg", eg)
law = B.law_rows("قانون_الإيجار_4_لسنة_1996", "قانون الإيجار مادة 1 تسري احكام القانون المدني على الاماكن. مادة 2 مدة العقد هي المدة المتفق عليها.")
print(json.dumps({"name": name, "rows": rows, "law": law, "skip": [bool(B.SKIP_NAME.search(x)) for x in ["دستور واحد وسبعين", "قانون العمل السعودي", "القانون المدني"]]}, ensure_ascii=False))`;
const out = JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" }));
ok(out.name === "Egypt" && out.rows.length === 4, "a Factbook country → one passage per subsection");
ok(out.rows.every((r) => r.x.startsWith("Egypt — ") && r.t.startsWith("Egypt — ") && r.u.includes("factbook.json")), "every passage names its country and links its source");
ok(out.rows.some((r) => /Area: total: 1,001,450 sq km; land: 995,450 sq km/.test(r.x)), "nested values keep their labels");
ok(out.law.length === 2 && out.law[0].t === "قانون الإيجار 4 لسنة 1996 — مادة 1" && out.law[1].t.endsWith("مادة 2"), "a law is cut at each article; the title keeps the law, number, year and article");
ok(out.skip.join() === "true,true,false", "the repealed 1971 constitution and other countries' laws are left out; the civil code is kept");
ok(out.rows.concat(out.law).every((r) => !/wiki/i.test(r.u)), "no passage links to Wikipedia");
console.log(`knowpack-builder: ${n} checks passed`);
