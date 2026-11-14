/* ---- v9.9.23 (Ali: "add the photo check everywhere applicable"): one sheet for every screen that reads a paper from a photo — Care
   (prescription, lab result), Read it to me, Translate, Timetable, Money receipts (Dates has its own banner). Before reading, the photo's
   quality is checked (photoquality.js); when it's blurry / dark / glare / too far the sheet says why, with "Take another photo" (opens
   Camera / Gallery on the same input) and "Use this one anyway". After reading, nothing found → askRetake("unread", input).
   Plain DOM, like photopick.js, so it works on every page. Not used for photos that aren't papers (covers, memories, chat pictures). */
import { tr } from "./i18n.js";
import { checkPhoto, ADVICE } from "./photoquality.js";
import { choosePhoto } from "./photopick.js";
import { canUse, noteUse } from "./plan.js";
function sheet(why, input, withAnyway) {
  return new Promise((done) => {
    const old = document.getElementById("attune-photo-retake"); if (old) old.remove();
    const wrap = document.createElement("div"); wrap.id = "attune-photo-retake";
    wrap.setAttribute("data-testid", "photo-retake"); wrap.setAttribute("data-why", why);
    wrap.style.cssText = "position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center";
    const box = document.createElement("div");
    box.style.cssText = "width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:18px 16px 16px;display:grid;gap:10px;background:var(--c-surf,#fff);color:var(--c-ink,#111)";
    const p = document.createElement("p"); p.textContent = tr(ADVICE[why] || ADVICE.unread); p.setAttribute("dir", "auto");
    p.setAttribute("data-testid", "photo-retake-text"); p.style.cssText = "margin:0;font-size:15px;font-weight:800;line-height:1.4";
    let settled = false; const close = (v) => { if (settled) return; settled = true; wrap.remove(); document.removeEventListener("keydown", esc); done(v); };
    const esc = (e) => { if (e.key === "Escape") close(false); };
    const mk = (label, test, fn, primary) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("data-testid", test);
      b.style.cssText = "min-height:48px;border-radius:14px;font-weight:800;font-size:15px;border:1px solid var(--c-ln,#ddd);" + (primary ? "background:var(--c-acc,#7a1f3d);color:var(--c-on-acc,#fff);border:0" : "background:var(--c-surf,#fff);color:inherit");
      b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
    box.append(p, mk(tr("Take another photo"), "photo-retake-again", () => { close(false); if (input) choosePhoto(input); }, true));
    if (withAnyway) box.append(mk(tr("Use this one anyway"), "photo-retake-anyway", () => close(true)));
    box.append(mk(tr("Cancel"), "photo-retake-cancel", () => close(false)));
    box.onclick = (e) => e.stopPropagation(); wrap.onclick = () => close(false);
    document.addEventListener("keydown", esc); wrap.appendChild(box); document.body.appendChild(wrap);
  });
}
/** Before reading: true = go on (the photo is clear, or the person said use it anyway); false = stop (another photo is being taken). */
export async function photoOk(url, input) {
  // v9.9.34 FP-4: Free reads 3 photos a day (receipts, papers); Pro reads as many as you need
  if (!canUse("photo").ok) { proSheet(); return false; }
  let q = { ok: true }; try { q = await checkPhoto(url); } catch (e) {}
  const go = q.ok ? true : await sheet(q.why || "unreadable", input, true);
  if (go) noteUse("photo");
  return go;
}
function proSheet() {
  const old = document.getElementById("attune-photo-pro"); if (old) old.remove();
  const wrap = document.createElement("div"); wrap.id = "attune-photo-pro"; wrap.setAttribute("data-testid", "photo-pro");
  wrap.style.cssText = "position:fixed;inset:0;z-index:85;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center";
  const box = document.createElement("div");
  box.style.cssText = "width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:18px 16px 16px;display:grid;gap:10px;background:var(--c-surf,#fff);color:var(--c-ink,#111)";
  const p = document.createElement("p"); p.textContent = tr("Free includes 3 photo reads a day — Pro is unlimited"); p.setAttribute("dir", "auto");
  p.style.cssText = "margin:0;font-size:15px;font-weight:800;line-height:1.4";
  const close = () => wrap.remove();
  const mk = (label, test, fn, primary) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("data-testid", test);
    b.style.cssText = "min-height:48px;border-radius:14px;font-weight:800;font-size:15px;border:1px solid var(--c-ln,#ddd);" + (primary ? "background:var(--c-acc,#7a1f3d);color:var(--c-on-acc,#fff);border:0" : "background:transparent;color:var(--c-ink,#111)");
    b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
  box.append(p, mk(tr("See Pro"), "photo-pro-see", () => { close(); try { window.dispatchEvent(new CustomEvent("attune-show-plan")); } catch (e) {} }, true), mk(tr("Cancel"), "photo-pro-cancel", close));
  box.onclick = (e) => e.stopPropagation(); wrap.onclick = close; wrap.appendChild(box); document.body.appendChild(wrap);
}
/** After reading found nothing: say so and offer another photo. */
export function askRetake(why, input) { return sheet(why || "unread", input, false); }
