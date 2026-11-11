// v9.9.16 (Ali, 11 Nov 2026: "the app is global — every country like Egypt … your code should deal with any type of notification"):
// bank / wallet messages from all 30 countries are read right (direction, amount, currency, a money source), look-alikes are not
// payments, and every country has its pack (banks, wallets, shops, delivery, rides, official sites).
const mem = {}; globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
const { WORLD, NOT_PAYMENTS } = await import("../corpus/world-bank-messages.mjs");
const P = await import("../../web-src/paylog.js");
const CP = await import("../../web-src/countrypack.js");
const { COUNTRIES } = await import("../../web-src/country.js");
const A = await import("../../web-src/agent.js");
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const now = Date.parse("2026-11-10T15:00:00");
const seen = new Set();
WORLD.forEach(([cc, app, title, text, dir, amt, cur], i) => { localStorage.setItem("attune:country", cc); seen.add(cc);
  const e = P.readNotification({ id: "w" + i, app, pkg: app, title, text, ts: now }, { teach: { rules: [] } });
  ok(!!e && e.direction === dir && Math.abs(e.amount - amt) < 0.005 && e.currency === cur && P.fromMoneySource(e), cc + " · " + title + " → " + dir + " " + amt + " " + cur + ": " + (e ? [e.direction, e.amount, e.currency, P.fromMoneySource(e)].join(" ") : "not read")); });
NOT_PAYMENTS.forEach(([cc, app, title, text], i) => { localStorage.setItem("attune:country", cc);
  ok(!P.readNotification({ id: "n" + i, app, pkg: app, title, text, ts: now }, { teach: { rules: [] } }), cc + " · not a payment: " + text.slice(0, 60)); });
ok(Object.keys(COUNTRIES).every((c) => seen.has(c)), "every one of the app's countries has messages in the corpus: " + Object.keys(COUNTRIES).filter((c) => !seen.has(c)).join(" "));
for (const c of Object.keys(COUNTRIES)) { const p = CP.packOf(c) || {};
  ok((p.banks || []).length >= 5 && (p.wallets || []).length >= 2 && (p.shops || []).length >= 2 && (p.food || []).length >= 1 && (p.ride || []).length >= 1 && (p.gov || []).length >= 1
    && p.shops.every((s) => /^https:\/\/.+\{q\}/.test(s[1])) && p.gov.every((g) => /^https?:\/\//.test(g[1])), c + ": banks, wallets, shops (search links), delivery, rides, official sites"); }
ok(A.storeTries("iphone 16", "TR")[0].site === "Trendyol" && /trendyol\.com\/sr\?q=iphone%2016/.test(A.storeTries("iphone 16", "TR")[0].url) && A.storeTries("x", "EG")[0].site === "Amazon", "agents search the country's own shops (Turkey → Trendyol…); Egypt's own list is kept");
ok(CP.WORLD_MONEY_SRC.test("JazzCash") && CP.WORLD_MONEY_SRC.test("Bizum") && CP.WORLD_MONEY_SRC.test("stc pay") && !CP.WORLD_MONEY_SRC.test("WhatsApp") && !CP.WORLD_MONEY_SRC.test("Ahmed Hassan"), "a wallet's name is a money source; a person or a chat app is not");
