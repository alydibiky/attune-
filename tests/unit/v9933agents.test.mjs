// v9.9.33 agents (Ali's screenshot + "check while I am away … much more websites"): the 10,000 generator on a 2,500 sample, Ali's exact
// screenshot, held-out cases written after the fixes, the store lists, and the Kotlin day round wired in.
import { execFileSync } from "child_process";
import fs from "fs";
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const A = await import("../../web-src/agents.js");
const { storeTries } = await import("../../web-src/agent.js");
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const out = execFileSync("node", [new URL("../agents33/gen.mjs", import.meta.url).pathname, "2500"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
ok(/2500 saved agents, 2500 without a fault/.test(out), "2,500 generated saved agents all right: " + out.split("\n")[0]);
// Ali's screenshot, exactly
const ali = { id: "x", kind: "watch", what: "Huawei FreeClip 2", said: "Huawei free clips 2", below: 8400, currency: "EGP", site: "Amazon · noon",
  tries: storeTries("Huawei FreeClip 2", "EG").slice(0, 2).map((l) => ({ url: l.url, site: l.site })), found: { price: 120, at: 5 }, checks: Array.from({ length: 12 }, (_, i) => ({ at: i + 1, blocked: true })) };
const b = A.recheckSaved(ali);
ok(!b.found, "the EGP 120 'found' is dropped");
ok(b.tries.length === 10 && b.tries.map((t) => t.site).join(",") === "Amazon,noon,Jumia,B.TECH,2B,Raya Shop,Dubizzle,Carrefour,Tradeline,Google Shopping", "the agent now searches 10 places: " + b.tries.map((t) => t.site).join(", "));
const chat = A.agentChat(b).map((m) => (m.T ? m.T[0] : m.text));
ok(!chat.some((t) => /Found one under your price/.test(t)), "no 'Found one under your price' line");
ok(!chat.some((t) => /Check now/.test(t)) && chat.some((t) => /next round \(about every 4 hours\)/.test(t)), "the 12 blocked checks say the browser reads them next round, not 'tap Check now'");
// held-out (written after the fixes)
const keep = A.recheckSaved({ kind: "watch", what: "PS5 Slim", below: 30000, currency: "EGP", tries: [{ url: "https://www.amazon.eg/s?k=PS5", site: "Amazon" }], found: { price: 27999, at: 1, name: "PlayStation 5 Slim Console" } });
ok(keep.found && keep.found.price === 27999 && keep.tries.length === 1, "a real PS5 at 27,999 is kept; an agent tied to Amazon keeps only Amazon");
const acc = A.recheckSaved({ kind: "watch", what: "iPhone 16 Pro", below: 70000, currency: "EGP", found: { price: 25000, at: 1, name: "iPhone 16 Pro leather case MagSafe" } });
ok(!acc.found, "a 25,000 'iPhone 16 Pro leather case' is not the phone");
const sa = A.recheckSaved({ kind: "watch", what: "AirPods Pro 2", below: 900, currency: "SAR", tries: storeTries("AirPods Pro 2", "SA").slice(0, 2).map((l) => ({ url: l.url, site: l.site })), found: { price: 799, at: 1, name: "Apple AirPods Pro 2" } });
ok(sa.found && sa.tries.length === storeTries("AirPods Pro 2", "SA").length, "Saudi: the find stays and every Saudi store is searched (" + sa.tries.length + ")");
const hotel = { kind: "watch", what: "", title: "Hotels near the Haram", below: 45000, currency: "EGP", tries: [{ url: "https://www.booking.com/x", site: "Booking", checkin: "2026-12-01" }, { url: "https://www.booking.com/y", site: "Booking", checkin: "2026-12-02" }] };
ok(JSON.stringify(A.recheckSaved(hotel)) === JSON.stringify(hotel), "a hotel window is left exactly as it was");
ok(A.watchPlan({ agents: [b, { ...b, id: "y" }, { ...b, id: "z" }].map((x) => ({ ...x, on: true, url: x.tries[0].url })) }).length === 30, "three 10-store agents all reach the phone's plan (30 pages, the cap is 40)");
// the phone side
const kt = fs.readFileSync(new URL("../../app/src/main/java/com/aldibiki/attune/AgentWatch.kt", import.meta.url), "utf8"), man = fs.readFileSync(new URL("../../app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
ok(/class AgentDayJob/.test(kt) && /setPeriodic\(4 \* 3600_000L/.test(kt) && /setRequiresBatteryNotLow\(true\)/.test(kt) && /\.AgentDayJob"/.test(man), "a day round every ~4 hours (battery not low), declared in the manifest");
ok(/needsBrowser\(w\) && \(if \(night\)/.test(kt) && /what"\)\.isNotEmpty\(\)/.test(kt), "every product watch may be read in the invisible browser, not only hotel sites");
ok(/minOf\(plan\.length\(\), 40\)/.test(kt), "the phone reads up to 40 pages a round");
