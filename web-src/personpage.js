/* ---- v9.9.23 B5 N1 the person page (Ali picked A: sections — "and let me open the original things"; combined screen OK'd 12 Nov).
   Everything Attune keeps about ONE person, in sections — Money (payments + what is still owed), Promises (open follow-ups, reminders,
   to-dos), Dates, Notes, Messages — and every line carries where it came from, so a tap opens THAT original (the payment in Money, the
   follow-up, the note in Mind, the date, the message), never a list and never another person's thing. A line that names only "Ahmed"
   when two cards are Ahmed is shown as "maybe" (it could be the other one), never as sure. A paid debt / a done promise isn't listed.
   Pure (stores in). Tests: tests/n1/gen.mjs (10,000 records) + tests/unit/v9923n1.test.mjs. */
import { itemsOf, tagOf } from "./links.js";
export const SECTIONS = [["money", "Money"], ["promises", "Promises"], ["dates", "Dates"], ["notes", "Notes"], ["messages", "Messages"], ["other", "More"]];
const SEC = { money: "money", reminders: "promises", todo: "promises", dates: "dates", mind: "notes", notes: "notes", messages: "messages" };
/** Where an item opens: { mode, key, id } — key = the localStorage key the page reads to open that exact thing. */
export function targetOf(it) {
  const raw = String(it.id || ""), id = raw.slice(raw.indexOf(":") + 1);
  if (it.src === "money") return { mode: "money", key: "attune:money:open", id: "tx:" + id };
  if (it.src === "followups") return { mode: "life", key: "attune:life:open", id, flash: "life:" + id };   // (Follow-ups opens the person's history, then lights it up)
  if (it.src === "mind" || it.src === "notes" || it.src === "todo") return { mode: "memory", key: "attune:mind:open", id: it.rec || id };
  if (it.src === "dates") return { mode: "radar", key: "attune:radar:open", id };
  if (it.src === "reminders") return { mode: "reminders", key: "", id, flash: "rem:" + id };
  if (it.src === "messages") return { mode: "recall", key: "", id, flash: "msg:" + id };
  return { mode: it.open || "", key: "", id };
}
/** p = the person's card; → { sections: [{ key, label, items: [{ id, src, title, ts, amount, sign, left, maybe, target }] }], count } */
export function personSections(p, stores = {}, dir = { items: [] }) {
  if (!p || !p.id) return { sections: [], count: 0 };
  const goals = ((stores.pots && stores.pots.pots) || []).map((x) => x.name).filter(Boolean), by = {};
  for (const it of itemsOf(stores)) {
    const t = tagOf(it, dir, goals), sure = t.people.includes(p.id), maybe = !sure && t.people.includes(p.id + "?");
    if (!sure && !maybe) continue;
    let sec = SEC[it.src] || "other";
    if (it.src === "followups") {
      if (it.done) continue;   // a done promise / a paid-off debt isn't open any more
      const debt = it.kind === "debt" || it.kind === "installment";
      if (debt && it.left != null && it.left <= 0) continue;
      sec = debt ? "money" : "promises";
    }
    (by[sec] = by[sec] || []).push({ id: it.id, src: it.src, title: it.title, ts: it.ts || 0, amount: it.amount || 0, sign: it.sign || 0, left: it.left == null ? null : it.left, kind: it.kind || "", maybe, target: targetOf(it) });
  }
  const sections = SECTIONS.filter(([k]) => by[k] && by[k].length).map(([k, label]) => ({ key: k, label,
    // what is still open first (an owed amount), then the newest; sure before maybe
    items: by[k].sort((a, b) => (a.maybe - b.maybe) || ((b.src === "followups") - (a.src === "followups")) || b.ts - a.ts || String(a.id).localeCompare(String(b.id))) }));
  return { sections, count: sections.reduce((a, s) => a + s.items.length, 0) };
}
/** Open the original: the page reads its key and opens that exact item. */
export function openOriginal(target, navTo) {
  if (!target || !target.mode) return false;
  try { if (target.key) localStorage.setItem(target.key, String(target.id)); } catch (e) {}
  if (navTo) navTo(target.mode); else try { window.dispatchEvent(new CustomEvent("attune-open", { detail: { mode: target.mode } })); } catch (e) {}
  // a line inside a list (a follow-up, a reminder): scroll to it and light it up once the page is there
  if (target.flash && typeof document !== "undefined") { let n = 0; const go = () => { const el = document.querySelector('[data-open-id="' + String(target.flash).replace(/"/g, "") + '"]');
    if (el) { try { el.scrollIntoView({ block: "center" }); } catch (e) {} el.setAttribute("data-opened", "1"); el.style.outline = "2.5px solid var(--c-acc)"; el.style.outlineOffset = "2px";
      setTimeout(() => { el.style.outline = ""; el.removeAttribute("data-opened"); }, 4000); return; }
    if (++n < 40) setTimeout(go, 100); }; setTimeout(go, 60); }
  return true;
}
