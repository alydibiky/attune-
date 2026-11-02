// v9.0 (Ali: "at least 99 percent accurate — always testing and fixing"): the sentence bank — every sentence in tests/bank/*.json
// (English, Egyptian Arabic, Franco, other languages), read by the same readers Chat uses (tests/bank/route.mjs), must land where it
// belongs: by code, or — for a sentence only the phone's model can settle — with the right kind among the model's choices.
// Scoreboard per area: node tools/accuracy.mjs --show. Every sentence Ali shows that went wrong is added to the bank.
import fs from "fs";
import { route, grade } from "../bank/route.mjs";
let bad = 0, n = 0, model = 0;
const DIR = new URL("../bank/", import.meta.url).pathname;
for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
  for (const [want, list] of Object.entries(JSON.parse(fs.readFileSync(DIR + f, "utf8")))) for (const t of list) {
    n++; const r = route(t), g = grade(r, want); if (g === "model") model++;
    if (g === "wrong") { bad++; console.log(`FAIL ${f} "${t}" should be ${want}, got ${JSON.stringify(r)}`); }
  }
}
console.log(bad ? bad + " FAILED" : `PASS v908bank: ${n} real sentences land where they belong (${n - model} by code, ${model} left to the phone's model)`);
