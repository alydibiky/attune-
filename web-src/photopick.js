/* ---- v9.9.22 (Ali: "make me also upload photos from gallery"): every photo button asks Camera or Gallery. A file input with
   capture="environment" opens only the camera on Android, so the same input is opened with or without it. Plain DOM (works on
   every page, even ones that aren't React-rendered); the sheet closes on choice, on the backdrop, or on Escape. */
import { tr } from "./i18n.js";
export function choosePhoto(input) {
  if (!input) return;
  const old = document.getElementById("attune-photo-pick"); if (old) old.remove();
  const wrap = document.createElement("div");
  wrap.id = "attune-photo-pick"; wrap.setAttribute("data-testid", "photo-pick");
  wrap.style.cssText = "position:fixed;inset:0;z-index:80;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center";
  const box = document.createElement("div");
  box.style.cssText = "width:100%;max-width:520px;border-radius:24px 24px 0 0;padding:16px;display:grid;gap:8px;background:var(--c-surf,#fff);color:var(--c-ink,#111)";
  const mk = (label, test, fn, primary) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.setAttribute("data-testid", test);
    b.style.cssText = "min-height:48px;border-radius:14px;font-weight:800;font-size:15px;border:1px solid var(--c-ln,#ddd);" + (primary ? "background:var(--c-acc,#7a1f3d);color:var(--c-on-acc,#fff);border:0" : "background:var(--c-surf,#fff);color:inherit");
    b.onclick = (e) => { e.stopPropagation(); close(); fn && fn(); }; return b; };
  const close = () => { wrap.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") close(); };
  box.append(
    mk(tr("Take a photo"), "photo-pick-camera", () => { input.setAttribute("capture", "environment"); input.click(); }, true),
    mk(tr("Choose from gallery"), "photo-pick-gallery", () => { input.removeAttribute("capture"); input.click(); }),
    mk(tr("Cancel"), "photo-pick-cancel", null));
  wrap.appendChild(box); wrap.onclick = close; document.addEventListener("keydown", esc); document.body.appendChild(wrap);
}
