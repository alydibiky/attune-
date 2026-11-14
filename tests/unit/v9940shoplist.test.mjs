// v9.9.40 AP-4 (Ali's wish with K3): "I bought the shopping list" said any way, and the items of a Talabat message — 2,500 samples
// of the generator and its held-out set, plus the mock-up's exact examples.
import { execFileSync } from "child_process";
const S = await import("../../web-src/shoplist.js");
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../shoplist/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })) || [0, 0])[1]);
const a = run(), h = run({ HELDOUT: "1" });
ok(a === 100, "10,000 sentences, 2,500 sample: " + a + "%"); ok(h >= 99, "held-out, 2,500 sample: " + h + "% (the mark: 99%)");
const list = ["Tortilla", "Chicken strips", "Bread", "Milk", "Eggs", "Dish soap"];
const k3 = S.applyBought(S.boughtOf("جبت الطلبات كلها ما عدا اللبن", ["تورتيا", "عيش", "لبن", "بيض", "صابون", "جبنة"]), ["تورتيا", "عيش", "لبن", "بيض", "صابون", "جبنة"]);
ok(k3.done.length === 5 && k3.left.join() === "لبن", "K3: «جبت الطلبات كلها ما عدا اللبن» → 5 off, milk stays");
const two = S.applyBought(S.boughtOf("got the tortilla and bread", list), list);
ok(two.done.join() === "Tortilla,Bread" && two.left.length === 4, "K3: “got the tortilla and bread” → 2 off, 4 stay");
ok(S.boughtOf("I bought the shopping list", list).all === true, "“I bought the shopping list” → all");
ok(S.boughtOf("did you buy the milk?", list) === null && S.boughtOf("got it", list) === null, "a question or “got it” clears nothing");
ok(S.itemsOf("عيش وجبنة").join() === "عيش,جبنة" && S.itemsOf("milk, eggs and bread").join() === "milk,eggs,bread", "items from a message: «عيش وجبنة», “milk, eggs and bread”");
ok(S.itemsOf("اللبن خلص").join() === "اللبن", "«اللبن خلص» (the milk ran out) → milk");
ok(S.itemsOf("where are you?").length === 0 && S.itemsOf("ok").length === 0, "not items: a question, “ok”");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
