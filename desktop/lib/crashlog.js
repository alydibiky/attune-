// v10.8 problem reports on the computer (Ali picked CR3; OK-CR: "I don't want users to see the problem — they just send it").
// The same as the phone (CrashLog.kt): problems are kept quietly (the newest 30) — the app's own errors, the page's window
// crashing, errors on a page. People see only "Attune closed by itself last time" on Home (after a real crash, once) and
// "Send a problem report" in Settings. A computer has no share sheet: Send copies the report to paste into an e-mail or WhatsApp.
"use strict";
const fs = require("fs"), path = require("path"), os = require("os");
module.exports = function crashLog(dir, version) {
  const file = path.join(dir, "crashlog.json");
  const read = () => { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { return { log: [], pending: false, page: "" }; } };
  const write = (s) => { try { fs.writeFileSync(file, JSON.stringify(s)); } catch (e) {} };
  const add = (kind, text, pending = false) => { const s = read(); s.log = [...(s.log || []), { t: Date.now(), kind, page: s.page || "", text: String(text || "").slice(0, 3000) }].slice(-30); if (pending) s.pending = true; write(s); };
  const report = () => { const s = read();
    return ["Attune problem report", `Attune ${version} · ${os.type()} ${os.release()} (${process.arch}) · computer`, "",
      ...[...(s.log || [])].reverse().map((x) => `— ${new Date(x.t).toISOString().slice(0, 16).replace("T", " ")} · ${x.kind}${x.page ? " · on " + x.page : ""}\n${x.text}\n`)].join("\n").slice(0, 60000); };
  return {
    add, report,
    state: () => { const s = read(); return JSON.stringify({ pending: !!s.pending, count: (s.log || []).length }); },
    note: (page, text) => add("page error", text),
    page: (p) => { const s = read(); s.page = String(p || "").slice(0, 40); write(s); },
    dismiss: () => { const s = read(); s.pending = false; write(s); },
  };
};
