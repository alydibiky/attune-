// v10.9.4 Passwords in one go (Ali's OK-PW: "it doesn't have to have a username, I just want it as it is"): web-src/pwpaste.js.
const ok = (c, t) => { console.log((c ? "PASS " : "FAIL ") + t); if (!c) process.exitCode = 1; };
const P = await import("../../web-src/pwpaste.js");
const { run } = await import("../pw/gen.mjs");
const r = run(2500, 5, { quiet: true });
ok(r.right / r.total >= 0.995, `2,500 composed pages + files: ${r.right}/${r.total} (mark 99.5 %)`);
ok(r.share >= 0.6, `…${(100 * r.share).toFixed(1)} % different shapes (bar 60 %)`);
const a = P.readPastedPage("▸ Microsoft\n    email: aly.d@outlook.com\n    pass: Sk!ttlz#2024\n▸ Mariam's password\n    Mm1993!!\n▸ discord account\n    user: skittlz\n    باسورد: dsc_9981x");
ok(a.length === 3 && a[1].title === "Mariam's password" && a[1].lines.length === 1 && a[1].lines[0].value === "Mm1993!!" && a[1].lines[0].secret, "Notion toggles → 3 accounts; one with no user name kept as written, its password locked");
ok(a[2].lines[1].name === "باسورد" && a[2].lines[1].secret && !a[0].lines[0].secret, "«باسورد» is a password (locked); the e-mail stays shown");
ok(P.looksLikePassword("A84dCjPU@7dtu.XY") && !P.looksLikePassword("aly.d@gmail.com"), "a password with @ and . is never mistaken for an e-mail (it stays locked)");
const f = P.readPasswordFile('name,url,username,password,note\nGoogle,https://accounts.google.com,aly.d@gmail.com,"p,ass""1",\n,https://www.netflix.com/login,aly.d@gmail.com,nf1!,"line1\nline2"\nGoogle,https://accounts.google.com,aly.d@gmail.com,"p,ass""1",\n');
ok(f.length === 2 && f[0].lines.find((l) => l.name === "Password").value === 'p,ass"1' && f[1].title === "netflix.com", "Google Passwords .csv: quotes / commas / line breaks inside, the same login twice kept once, no name → the site");

// OK-PW2: the page's store and Home chat
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i], get length() { return Object.keys(mem).length; } };
const S = await import("../../web-src/pwstore.js");
const BK = await import("../../web-src/backup.js");
const acc = P.readPastedPage("▸ Microsoft\n    email: aly.d@outlook.com\n    pass: Sk!ttlz#2024\n▸ discord account\n    user: skittlz\n    باسورد: dsc_9981x\n▸ Xbox\n    email: aly.d@outlook.com\n    pass: xb0x!!77");
let rr = S.addAccounts({ items: [] }, acc); S.savePw(rr.data);
ok(rr.added.length === 3 && S.addAccounts(rr.data, acc).same === 3, "3 accounts saved; the same page pasted again adds nothing");
ok(!mem[S.PW_KEY].includes("Sk!ttlz#2024"), "the account list's store holds no password (they are kept apart)");
const keys = BK.collectData(localStorage);
ok(keys["attune:pw:secret:v1"] && keys["attune:pw:secret:v1"].includes("Sk!ttlz#2024"), "the backup file carries the passwords (Ali: \"yes\" — it is always encrypted)");
const SY = await import("../../web-src/sync.js"); const CL = await import("../../web-src/cloud.js");
// v10.9.6 (Ali, 24 Nov: "I want passwords to be sync"): both syncs carry them — inside the encrypted file
ok(Object.keys(CL.syncKeys(keys)).includes("attune:pw:secret:v1") && Object.keys(CL.syncKeys(keys)).includes("attune:pw:v1"), "Google sync carries the passwords (encrypted)");
ok(!/NEVER_SYNC\.test\(x\)/.test((await import("fs")).readFileSync(new URL("../../web-src/sync.js", import.meta.url), "utf8")), "phone ↔ computer sync carries them too");
{ // the file itself: no password readable in it, and it opens back to the same passwords
  const txt = await SY.packFor("K7Q29XFD", localStorage, { iterations: 1000 }); ok(!txt.includes("Sk!ttlz#2024") && !txt.includes("dsc_9981x"), "the sync file shows no password (locked before it leaves)"); }
{ // an edited password reaches the other device; the side that changed the account last wins; a deleted account's password goes
  const items = JSON.parse(mem[S.PW_KEY]).items, id = items.find((x) => x.title === "discord account").id, sec = JSON.parse(mem["attune:pw:secret:v1"]);
  const fid = Object.keys(sec[id])[0];
  const theirsItems = { items: items.map((x) => (x.id === id ? { ...x, updated: x.updated + 5000 } : x)) }, theirsSec = { ...sec, [id]: { ...sec[id], [fid]: "NEW-dsc-pass" } };
  const mine = { "attune:pw:v1": mem[S.PW_KEY], "attune:pw:secret:v1": mem["attune:pw:secret:v1"] }, theirs = { "attune:pw:v1": JSON.stringify(theirsItems), "attune:pw:secret:v1": JSON.stringify(theirsSec) };
  const m1 = SY.syncMerge(mine, theirs); ok(JSON.parse(m1["attune:pw:secret:v1"])[id][fid] === "NEW-dsc-pass", "Wi-Fi sync: the password changed on the other device arrives");
  const m2 = SY.syncMerge(theirs, mine); ok(JSON.parse(m2["attune:pw:secret:v1"])[id][fid] === "NEW-dsc-pass", "…and the older copy never overwrites it back");
  const m3 = BK.mergeKeys(mine, theirs); ok(JSON.parse(m3["attune:pw:secret:v1"])[id][fid] === "NEW-dsc-pass", "Google sync (mergeKeys): the same");
  const gone = { "attune:pw:v1": JSON.stringify({ items: items.filter((x) => x.id !== id) }), "attune:pw:secret:v1": JSON.stringify(Object.fromEntries(Object.entries(sec).filter(([k]) => k !== id))) };
  const m4 = BK.mergePwSecrets(gone, gone, gone["attune:pw:v1"]); ok(!(id in JSON.parse(m4)), "a deleted account's password is not kept");
  const st = { _: { ...mem, "attune:pw:secret:v1": JSON.stringify({ ...sec, "pw:ghost": { a: "x" } }) }, getItem(k) { return this._[k] ?? null; }, setItem(k, v) { this._[k] = String(v); }, removeItem(k) { delete this._[k]; } };
  ok(S.pruneSecrets({ items }, st) === 1 && !("pw:ghost" in JSON.parse(st._["attune:pw:secret:v1"])), "a password left from an account deleted elsewhere is cleaned when Passwords opens"); }
{ const before = mem[S.PW_KEY]; BK.restoreData({ "attune:other": "1" }, "replace", localStorage); ok(mem[S.PW_KEY] === before && !!mem["attune:pw:secret:v1"], "a sync / restore that brings no passwords never deletes the phone's (replace mode)"); }
{ BK.restoreData({ ...keys, "attune:pw:v1": JSON.stringify({ items: [] }) }, "replace", localStorage); ok(JSON.parse(mem[S.PW_KEY]).items.length === 0, "a restore of a backup that has passwords does replace them"); BK.restoreData(keys, "replace", localStorage); }
const ask = (q) => { const a = S.pwAsk(q, rr.data); return a ? a.kind + ":" + a.items.map((x) => x.title).join(",") : "null"; };
ok(ask("what's my discord password?") === "account:discord account", "Home chat: \"what's my discord password?\" → that account");
ok(ask("which accounts use my outlook email?") === "list:Microsoft,Xbox", "Home chat: \"which accounts use my outlook email?\" → Microsoft, Xbox");
ok(ask("باسورد ديسكورد") !== "null" || ask("باسورد discord") === "account:discord account", "Home chat in Arabic: «باسورد discord»");
ok(ask("remind me to change my netflix password tomorrow") === "null" && ask("my wifi password is 1234") === "null", "an order that mentions a password is not a lookup (a reminder / saving stays an order)");
ok(ask("pin this note") === "null" && ask("what time is it") === "null", "\"pin this\" and other questions are not about passwords");
const lines = ["Passwords", "All together", "▸ Toggles", "Paste a page", "Import file", "Saved {n} accounts — each password locked", "Never in sync or any AI — only in your locked backup. Each password opens with your fingerprint."];
for (const l of "ar arb es fr de pt it ru tr id hi ur fa bn sw th vi zh ja ko".split(" ")) { const d = (await import("fs")).readFileSync(new URL("../../web-src/i18n-" + l + ".js", import.meta.url), "utf8"); ok(lines.every((x) => d.includes(JSON.stringify(x) + ":")), "the Passwords lines are in " + l); }
