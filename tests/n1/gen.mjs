// v9.9.23 B5 N1 the person page: exactly 10,000 records (payments, follow-ups, notes, to-dos, dates, reminders, messages) written
// about people — Latin + Arabic names, «لأحمد» prefixes, nicknames, two cards with the same first name — each with the ONE card it
// belongs to (or "either Ahmed" when only the shared first name is written). Checked on every card's page:
//   1. a record shows on its owner's page, in the right section (Money / Promises / Dates / Notes / Messages), unless it is a
//      done promise or a paid debt (then it shows nowhere);   2. its line opens ITS original (the page + that exact id);
//   3. it never shows on another person's page — except "either Ahmed", which shows on both as "maybe", never as sure.
const P = await import(process.env.N1 || "../../web-src/personpage.js");
function rng(seed) { let s = (seed + 7919 * +(process.env.SEED_SHIFT || 0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const FIRST = [["Ahmed", "أحمد"], ["Mona", "منى"], ["Karim", "كريم"], ["Sara", "سارة"], ["Youssef", "يوسف"], ["Nadia", "نادية"], ["Omar", "عمر"], ["Laila", "ليلى"], ["Hassan", "حسن"], ["Dina", "دينا"],
  ["Tarek", "طارق"], ["Heba", "هبة"], ["Maged", "ماجد"], ["Rania", "رانيا"], ["Samir", "سمير"], ["Yasmin", "ياسمين"], ["Walid", "وليد"], ["Noha", "نهى"], ["Khaled", "خالد"], ["Salma", "سلمى"]];
const LAST = [["Samir", "سمير"], ["Kamal", "كمال"], ["Fawzy", "فوزي"], ["Hamdy", "حمدي"], ["Lotfy", "لطفي"], ["Ragab", "رجب"], ["Shawky", "شوقي"], ["Zaki", "زكي"]];
const NICK = ["Abu Ali", "Sheikh", "Doc", "Captain", "Teta", "Uncle Fathy"];
const DAY = 864e5, NOW = Date.parse("2026-11-12T12:00:00");
const iso = (t) => new Date(t).toISOString().slice(0, 10);
export function scenario(k) {
  const r = rng(k * 2654435761 + 7), pick = (a) => a[Math.floor(r() * a.length)];
  const n = 3 + Math.floor(r() * 4), used = new Set(), people = [];
  const twin = r() < 0.4;   // two cards with the same first name (Ahmed Samir / Ahmed Kamal)
  for (let i = 0; i < n; i++) {
    let f; do { f = pick(FIRST); } while (used.has(f[0]) && !(twin && i === 1)); if (twin && i === 1) f = people[0].f;
    used.add(f[0]); let l; do { l = pick(LAST); } while (l[0] === f[0] || people.some((q) => q.f[0] === f[0] && q.l[0] === l[0]));
    const ar = twin && i === 1 ? people[0].ar : r() < 0.35, nick = !twin && r() < 0.25 ? pick(NICK) : "";
    const name = ar ? f[1] + " " + l[1] : f[0] + " " + l[0];
    people.push({ id: "p" + k + "_" + i, kind: "person", name, aliases: nick && !people.some((q) => q.aliases.includes(nick)) ? [nick] : [], role: "", f, l, ar });
  }
  const dir = { v: 1, items: people.map(({ id, kind, name, aliases, role }) => ({ id, kind, name, aliases, role })), skip: [] };
  const st = { ledger: { currency: "EGP", txns: [] }, life: { items: [] }, memory: [], notes: [], reminders: [], radar: { items: [] } }, recs = [];
  for (let j = 0; j < 5; j++) {
    const who = pick(people), sameFirst = people.filter((q) => q.f[0] === who.f[0]).length > 1;
    // how the person is written: full name, first name only (unique → sure; shared → either), a nickname, Arabic «ل» prefix
    const form = pick(sameFirst ? ["full", "full", "first"] : ["full", "first", "nick", "prefix"]);
    let ref = form === "first" ? (who.ar ? who.f[1] : who.f[0]) : form === "nick" && who.aliases[0] ? who.aliases[0] : who.name;
    if (form === "prefix" && who.ar) ref = "ل" + who.f[1];
    const owner = form === "first" && sameFirst ? "either:" + who.f[0] : who.id;
    const id = "r" + k + "_" + j, ts = NOW - Math.floor(r() * 400) * DAY, kind = pick(["money", "money", "debt", "promise", "note", "todo", "date", "reminder", "message"]);
    let want, gone = false;   // (paid back / kept = its one payment / time ticked, as the app marks it)
    if (kind === "money") { const inc = r() < 0.3; st.ledger.txns.push({ id, type: inc ? "income" : "expense", amount: 100 + Math.floor(r() * 5000), date: iso(ts), note: (who.ar ? (inc ? "من " : "دفعت ") : inc ? "From " : "Paid ") + ref + (who.ar ? " فلوس الشغل" : " for the work"), cat: "" }); want = ["money", "money", "tx:" + id]; }
    else if (kind === "debt") { gone = r() < 0.25; st.life.items.push({ id, kind: "debt", person: ref, dir: r() < 0.5 ? "in" : "out", amount: 500, total: 500, count: 1, start: iso(ts), paid: gone ? [0] : [], created: ts }); want = ["money", "life", id]; }
    else if (kind === "promise") { gone = r() < 0.25; st.life.items.push({ id, kind: "person", person: ref, title: who.ar ? "يبعت الورق" : "send the papers", count: 1, start: iso(ts), paid: gone ? [0] : [], created: ts }); want = ["promises", "life", id]; }
    else if (kind === "note") { st.memory.push({ id, kind: "note", ts, title: (who.ar ? "ملاحظة عن " : "About ") + ref, text: who.ar ? "بيشتغل في البنك" : "works at the bank", meta: {} }); want = ["notes", "memory", id]; }
    else if (kind === "todo") { st.memory.push({ id, kind: "todo", ts, title: (who.ar ? "أكلم " : "Call ") + ref, text: "", meta: {} }); want = ["promises", "memory", id]; }
    else if (kind === "date") { st.radar.items.push({ id, title: (who.ar ? "رخصة " : "Licence of ") + ref, date: iso(ts + 300 * DAY), status: "active" }); want = ["dates", "radar", id]; }
    else if (kind === "reminder") { st.reminders.push({ id, at: ts + 30 * DAY, title: (who.ar ? "أفكر " : "Remind ") + ref, repeat: "none" }); want = ["promises", "reminders", id]; }
    else { st.notes.push({ id, ts, app: "WhatsApp", pkg: "com.whatsapp", title: ref, text: who.ar ? "تمام هبعتها بكرة" : "ok I'll send it tomorrow" }); want = ["messages", "recall", id]; }
    recs.push({ id, owner, gone, sec: want[0], mode: want[1], openId: want[2], first: who.f[0], form, ref });
  }
  return { dir, st, recs, people };
}
export function run(N = 10000, from = 0) {
  let pass = 0, total = 0; const bad = [];
  for (let k = from; total < N; k++) {
    const { dir, st, recs } = scenario(k);
    const pages = Object.fromEntries(dir.items.map((p) => [p.id, P.personSections(p, st, dir)]));
    const lineOn = (pid, rid) => { for (const s of pages[pid].sections) for (const x of s.items) if (x.id.endsWith(":" + rid)) return { sec: s.key, x }; return null; };
    for (const rc of recs) { if (total >= N) break; total++;
      let ok = true, why = "";
      for (const p of dir.items) {
        const L = lineOn(p.id, rc.id), either = rc.owner.startsWith("either:"), mine = either ? dir.items.find((q) => q.id === p.id) && p.name.split(" ")[0] && (p.name.startsWith(rc.first) || p.name.startsWith(FIRST.find((f) => f[0] === rc.first)[1])) : rc.owner === p.id;
        if (rc.gone) { if (L) { ok = false; why = "a done / paid one is still listed on " + p.name; } continue; }
        if (mine) {
          if (!L) { ok = false; why = "missing on its owner " + p.name; break; }
          if (L.sec !== rc.sec) { ok = false; why = "section " + L.sec + " ≠ " + rc.sec; break; }
          const t = L.x.target, want = rc.mode === "money" ? "tx:" + rc.id : rc.id;
          if (t.mode !== rc.mode || String(t.id) !== want) { ok = false; why = "opens " + t.mode + "/" + t.id + " not " + rc.mode + "/" + want; break; }
          if (either !== !!L.x.maybe) { ok = false; why = either ? "an 'either Ahmed' line shown as sure" : "a sure line shown as maybe"; break; }
        } else if (L && !L.x.maybe) { ok = false; why = "shown as sure on someone else: " + p.name; break; }
        else if (L && !either) { ok = false; why = "shown on someone else as maybe: " + p.name; break; }
      }
      if (ok) pass++; else if (bad.length < 6) bad.push({ k, rec: rc.id, form: rc.form, ref: rc.ref, why });
    }
  }
  return { pass, N: total, rate: pass / total, bad };
}
if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) console.log(JSON.stringify(run(+(process.argv[2] || 10000), +(process.argv[3] || 0))));
