// v9.3 (Ali picked D4: "make A and B and users choose") — one account / budget (A) or all of Money (B), as a family-code file.
import * as M from "../../web-src/moneyshare.js";
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) process.exitCode = 1; };
const L = { accounts: [{ id: "house", name: "House", emoji: "🏠", currency: "EGP", start: 5000, kind: "cash" }, { id: "me", name: "My CIB", currency: "EGP", start: 40000, kind: "bank" }],
  txns: [{ id: "t1", type: "expense", amount: 1240, account: "house", cat: "food", date: "2026-11-05", note: "Carrefour", created: 1 },
    { id: "t2", type: "expense", amount: 600, account: "me", cat: "transport", date: "2026-11-05", note: "Fuel", created: 2 },
    { id: "t3", type: "transfer", amount: 3000, account: "me", toAccount: "house", date: "2026-11-01", created: 3 },
    { id: "t4", type: "expense", amount: 90, account: "house", cat: "zakat", date: "2026-11-01", created: 4 },
    { id: "t5", type: "expense", amount: 310, account: "house", cat: "health", date: "2026-11-04", note: "Pharmacy", by: "Mariam", created: 5 }] };
const a = M.shareData(L, { kind: "accounts", ids: ["house"] }, { id: "ms-x", me: "Ali", lastIds: ["t1", "t9"] });
ok(a.accounts.map((x) => x.id).join() === "house" && a.txns.map((t) => t.id).join() === "t1,t5", "A: only the House account and its entries — not my own card, not the transfer from it, never zakat");
ok(a.txns[0].by === "Ali" && a.txns[1].by === "Mariam", "…each entry says who added it (mine = my name; Mariam's stays hers)");
ok(a.gone.join() === "t9", "…an entry that was in the last update and is gone now travels as deleted");
const b = M.shareData(L, { kind: "all" }, { id: "ms-x", me: "Ali" });
ok(b.accounts.length === 2 && b.txns.map((t) => t.id).join() === "t1,t2,t3,t5" && b.scope.kind === "all", "B: all of Money (still never a zakat entry)");
ok(M.initial("mariam") === "M" && /^ms-[a-z0-9]+-[a-z0-9]+$/.test(M.newShareId()), "the circle shows the first letter; a share has its own id");
const text = await M.packShare(a, "Our-family-2026", { iterations: 1000 });
ok(!text.includes("Carrefour") && !text.includes("House"), "the file is locked: no name or note can be read inside it");
const back = await M.readShare(text, "Our-family-2026");
ok(back.id === "ms-x" && back.txns.length === 2 && back.from === "Ali", "the other phone opens it with the family code");
let err = ""; try { await M.readShare(text, "wrong-code-1"); } catch (e) { err = e.message; }
ok(/Wrong family code/.test(err), "a wrong code → “Wrong family code — nothing was changed.”");
