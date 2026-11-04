// v6.32 Business builder v2: team & roles, currencies, price lists, encrypted backup, export as a real project.
import * as V from "../../web-src/erp-v2.js";
import * as E from "../../web-src/erp.js";
import { sealData, openData, vaultHeader } from "../../web-src/biz-vault.js";
import { unzip } from "../../web-src/convert.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const rejects = async (p, re, m) => { try { await p; ok(false, m + " (did not refuse)"); } catch (e) { ok(!re || re.test(e.message), m + " — «" + e.message + "»"); } };

let sys = E.systemFromSpec({ name: "Parts shop", currency: "EGP", tables: [
  { name: "Products", fields: [{ name: "Product", type: "text" }, { name: "Price", type: "money" }, { name: "Import cost", type: "money" }] },
  { name: "Sales", fields: [{ name: "Product", type: "link", link: "Products" }, { name: "Qty", type: "number" }, { name: "Unit price", type: "money" }] }] });
const [P, S] = sys.tables;
let r = E.addRow(sys, P.id, { Product: "Filter", Price: 100, "Import cost": 2 }); sys = r.sys;
r = E.addRow(sys, P.id, { Product: "Hose", Price: 250, "Import cost": 4 }); sys = r.sys;
const [filter, hose] = sys.rows[P.id];

// ---- team & roles
await rejects(V.setUser(sys, { name: "Sayed", role: "editor", pin: "1111" }), /first person must be an owner/, "the first person must be an owner");
await rejects(V.setUser(sys, { name: "Ali", role: "owner", pin: "12" }), /4 to 8 digits/, "a PIN is 4–8 digits");
let t = await V.setUser(sys, { name: "Ali", role: "owner", pin: "2468" });
t = await V.setUser(t, { name: "Sayed", role: "editor", pin: "1357", tables: [S.id] });
t = await V.setUser(t, { name: "Mona", role: "viewer", pin: "9999" });
ok(V.teamOf(t).length === 3 && V.teamOf(t).every((u) => !("pin" in u) && /^[0-9a-f]{64}$/.test(u.pinHash)), "three people; the PIN itself is never stored");
await rejects(V.setUser(t, { name: "X", role: "viewer", pin: "1357" }), /already uses/, "two people can't share a PIN");
const ali = await V.login(t, "2468"), sayed = await V.login(t, "1357"), mona = await V.login(t, "9999");
ok(ali.role === "owner" && sayed.role === "editor" && mona.role === "viewer" && (await V.login(t, "0000")) === null, "signing in by PIN finds the right person; a wrong PIN finds no one");
const sale = E.addRow(t, S.id, { Product: filter._id, Qty: 2, "Unit price": 100 }).sys;
ok(V.guardChange(t, sale, sayed) === null, "an editor adds a sale (a table they may edit)");
ok(/only look/.test(V.guardChange(t, sale, mona)), "a viewer can't add records");
const prod = E.addRow(t, P.id, { Product: "Belt", Price: 50 }).sys;
ok(/can't change this table/.test(V.guardChange(t, prod, sayed)), "an editor limited to Sales can't change Products");
const design = E.applyOps(t, [{ op: "addField", table: "Sales", name: "Notes", type: "text" }]).sys || E.applyOps(t, [{ op: "addField", table: "Sales", name: "Notes", type: "text" }]);
ok(/design/.test(V.guardChange(t, design.sys || design, sayed) || "") && V.guardChange(t, design.sys || design, ali) === null, "only an owner changes the design");
ok(/team/.test(V.guardChange(t, V.removeUser(t, V.teamOf(t)[2].id), sayed)), "only an owner changes the team");
let threw = false; try { V.removeUser(t, ali.id); } catch (e) { threw = /owner/.test(e.message); }
ok(threw, "the last owner can't be removed");
ok(V.guardChange(sys, sale, null) === null, "a system with no team has no limits");

// ---- currencies
let c = V.setFieldCurrency(sys, P.id, P.fields[2].id, "USD");
ok(V.fieldCurrency(c, c.tables[0].fields[2]) === "USD" && V.fieldCurrency(c, c.tables[0].fields[1]) === "EGP", "a money column can have its own currency");
ok(V.baseTotal(c, P.id).missing.includes("USD"), "without a rate the USD column is flagged, not guessed");
c = V.setRate(c, "usd", "48.5");
const bt = V.baseTotal(c, P.id);
ok(bt.byField[P.fields[2].id] === 291 && bt.byField[P.fields[1].id] === 350, "USD 6 × 48.5 = 291 EGP; EGP stays 350");
ok(V.toBase(c, c.tables[0].fields[2], 2) === 97, "one value converted: 2 USD = 97 EGP");
threw = false; try { V.setRate(c, "EGP", 2); } catch (e) { threw = true; } ok(threw, "the system's own currency has no rate");

// ---- price lists
let pl = V.savePriceList(sys, { name: "Wholesale", tid: P.id, fid: P.fields[1].id, adjust: -10, prices: { [hose._id]: 200 } });
const L = pl.priceLists[0];
ok(V.priceOn(pl, L.id, filter._id) === 90 && V.priceOn(pl, L.id, hose._id) === 200, "list price: 100 − 10% = 90; a fixed price (200) wins");
const tg = V.priceTarget(pl, S.id, L.id);
ok(tg && tg.linkFid === S.fields[0].id && tg.priceFid === S.fields[2].id, "picking a product in Sales fills Unit price from the list");
threw = false; try { V.savePriceList(sys, { name: "Bad", tid: P.id, fid: P.fields[1].id, adjust: -100 }); } catch (e) { threw = true; } ok(threw, "a −100% list is refused");

// ---- encrypted backup
const text = await sealData(t, "crane-2026", { kind: "system", name: t.name, counts: { tables: 2 } });
ok(vaultHeader(text).kind === "system" && !text.includes("Filter"), "the backup is encrypted; its header is readable");
const back = await openData(text, "crane-2026", "system");
ok(back.data.rows[P.id].length === 2 && back.data.team.users.length === 3, "it opens with the right passphrase, everything inside");
await rejects(openData(text, "wrong-pass", "system"), /Wrong passphrase/, "a wrong passphrase is refused");
const j = JSON.parse(text); j.name = "Changed"; await rejects(openData(JSON.stringify(j), "crane-2026"), /Wrong passphrase|changed/, "a changed header is detected");
await rejects(openData(text, "crane-2026", "fleet"), /not a Fleet backup/, "a system backup isn't taken as a Fleet backup");

// ---- export as a real project
const files = V.projectFiles(t, { now: "2026-10-17T10:00:00Z" });
const names = files.map((f) => f.name.split("/").slice(1).join("/"));
ok(["index.html", "manifest.webmanifest", "sw.js", "icon.svg", "data/system.json", "package.json", "main.js", "README.md"].every((n) => names.includes(n)), "the project has the app, a web-app manifest, an offline worker, the data, an Electron wrapper and a README");
const html = files.find((f) => f.name.endsWith("index.html")).data;
ok(/rel="manifest"/.test(html) && /serviceWorker/.test(html) && html.includes("Filter"), "index.html installs as a phone app and carries the records");
ok(!html.includes(V.teamOf(t)[0].pinHash) && !files.find((f) => f.name.endsWith("system.json")).data.includes("pinHash"), "the team's PIN hashes stay inside Attune");
const pkg = JSON.parse(files.find((f) => f.name.endsWith("package.json")).data);
ok(pkg.author && pkg.build.win.signAndEditExecutable === false && pkg.scripts.build.includes("--dir"), "package.json follows the lessons of Ali's desktop apps (author set, --dir, no signing)");
ok(/بالعربية/.test(files.find((f) => f.name.endsWith("README.md")).data), "the README is in English and Arabic");
const z = await unzip(V.projectZip(t));
ok(z.size === 8, "it zips into one file (8 entries)");
console.log(process.exitCode ? "SOME FAILED" : "ALL PASSED");
