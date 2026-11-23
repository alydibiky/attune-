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
