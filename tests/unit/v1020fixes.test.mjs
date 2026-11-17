// v10.2 — Ali's 17 Nov list (computer + phone), each kept as a test: the Claude sign-in link email was saved in Dates like a
// subscription; the Home card said "36 tools" and its page showed 3.
import { execFileSync } from "child_process";
import fs from "fs";
import * as D from "../../web-src/deadlines.js";
import * as M from "../../web-src/notifmind.js";
import * as O from "../../web-src/overpay.js";
import * as W from "../../web-src/notifwords.js";
import { shownToolGroups, toolCount } from "../../web-src/hubs.js";
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { console.log("FAIL " + m); fail++; } };
const now = Date.UTC(2026, 10, 17, 0, 45);
const claude = "Secure link to log in to Claude.ai\nClick the link below to log in to Claude.ai. This link will expire in 1 hour and can only be used once.";
const claude2 = "Sign in to Claude\nUse the secure link below to sign in. The link expires on 18 Nov 2026.";
for (const t of [claude, claude2]) {
  ok(D.readDeadlines(t, { now }).length === 0, "a Claude sign-in link is not a date: " + JSON.stringify(D.readDeadlines(t, { now })));
  ok(D.fromNotifications([{ id: 1, app: "Gmail", title: "Anthropic", text: t, ts: now }], [], { now }).length === 0, "…not from the notification either");
  ok(O.readSource({ id: "e1", kind: "email", title: "Claude", text: t, at: now }, { now }).length === 0, "…and not a subscription in the Overpaying check");
  const m = M.comprehend({ app: "Gmail", pkg: "com.google.android.gm", title: "Anthropic", text: t }, { now });
  ok(m.cat === "code" && m.action === "none" && !m.due, "…read as a login code, nothing to do: " + m.cat + "/" + m.action);
}
ok(D.readDeadlines("Your Claude Pro subscription renews on 5 Dec 2026. Sign in to manage it.", { now }).some((x) => x.kind === "renewal"), "a real renewal that says “sign in” is still a date");
ok(M.comprehend({ app: "Gmail", pkg: "com.google.android.gm", title: "Google", text: "New sign-in to your account on Windows. Was this you?" }, { now }).cat !== "code", "“new sign-in — was this you?” stays a security alert");
ok(!W.isSignInMessage("Your passport expires on 3 Dec 2026") && W.isSignInMessage("رابط تسجيل الدخول — الرابط صالح لمدة 15 دقيقة"), "isSignInMessage");
ok(D.dropSignIns({ items: [{ id: "a", source: "notification", note: claude }, { id: "b", source: "typed", note: claude }, { id: "c", source: "notification", note: "Netflix renews on 5 Dec 2026" }] }).items.map((x) => x.id).join() === "b,c", "his old wrong item is taken out of Dates");
// tools: the count on Home = what the page lists
const groups = [["A", ["lists", "money", "crane"]], ["B", ["lists", "fit"]]];
const shown = shownToolGroups(groups, ["lists", "money", "crane", "fit"], (id) => id === "crane");
ok(toolCount(shown) === 3 && JSON.stringify(shown) === JSON.stringify([["A", ["lists", "money"]], ["B", ["fit"]]]), "each tool once, hidden ones out: " + JSON.stringify(shown));
const app = fs.readFileSync(new URL("../../web-src/attune.jsx", import.meta.url), "utf8"), desk = fs.readFileSync(new URL("../../web-src/desk-ui.jsx", import.meta.url), "utf8");
ok(/toolsN=\{toolCount\(groupsShown\)\}/.test(app) && /groups=\{groupsShown\}/.test(app), "Home counts and Tools lists the same groups");
ok(/data-testid="tools-every"/.test(desk), "the Tools page has “Every tool” under the families");
const run = (env = {}) => +((/\(([\d.]+)%\)/.exec(execFileSync("node", [new URL("../signin/gen.mjs", import.meta.url).pathname, "2500"], { env: { ...process.env, ...env }, encoding: "utf8" })) || [])[1] || 0);
const a0 = run(), h0 = run({ HELDOUT: "1" });
ok(a0 === 100, "10,000 sign-in / real-deadline messages, 2,500 sample: " + a0 + "%"); ok(h0 >= 99, "held-out, 2,500 sample: " + h0 + "% (the mark: 99%)");
console.log(fail ? `FAIL ${fail} of ${n}` : `ALL PASSED (${n} checks)`);
process.exit(fail ? 1 : 0);
