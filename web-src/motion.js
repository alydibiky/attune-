/* ---- v10.7 lively motion (Ali OK'd OK-AN: "AN2 — also make to-do lists editable easily"; docs/mockups/motion-writing-fold-combined.html).
   One place for the motion the whole app uses:
     tickOut(el, then, { leave })  a tick: the box pops, a few sparks fly, then (leave) the row slides away and the rest close the gap —
                                   `then` (the save) runs when the motion ends, so nothing jumps
     pageIn(el, dir, wide)         a page slides in from the side it came from (back = the other way); its cards then appear one by one
   Everything follows the phone's "remove animations" (prefers-reduced-motion): no motion, the save at once. The computer is calmer
   (shorter, smaller). CSS for buttons pressing in and sheets sliding up: build/tw.css (v10.7). */
import { useEffect, useState } from "react";
/** v10.8 (launch, opening < 1 s): true once the first screen is drawn and the phone has a quiet moment — heavy cards (Autopilot,
 *  "Attune noticed") are worked out then, instead of holding up the first screen. */
export function useAfterFirstPaint(maxWait = 700) {
  const [go, setGo] = useState(false);
  useEffect(() => { let id = 0; const done = () => setGo(true);
    const raf = requestAnimationFrame(() => { id = typeof requestIdleCallback === "function" ? requestIdleCallback(done, { timeout: maxWait }) : setTimeout(done, 60); });
    return () => { cancelAnimationFrame(raf); try { typeof cancelIdleCallback === "function" ? cancelIdleCallback(id) : clearTimeout(id); } catch (e) {} }; }, []);
  return go;
}
export const calm = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const SPARK = ["var(--c-acc)", "#e39ab3", "#f2b84b", "var(--c-acc)", "#7fdca4", "#e39ab3"];

/** A tick with its motion. el = the tapped element (or an element inside the row); the row is its closest [data-tickrow]. */
export function tickOut(el, then, { leave = true } = {}) {
  const run = () => { try { then && then(); } catch (e) {} };
  if (!el || calm() || typeof el.animate !== "function") return run();
  const row = (el.closest && el.closest("[data-tickrow]")) || el;
  const box = row.querySelector("[data-tickbox]") || el;
  try { box.animate([{ transform: "scale(.4)" }, { transform: "scale(1.22)" }, { transform: "scale(1)" }], { duration: 340, easing: "cubic-bezier(.2,1.6,.4,1)" }); } catch (e) {}
  try {
    const r = box.getBoundingClientRect();
    for (let i = 0; i < 6; i++) {
      const s = document.createElement("i"), a = (i / 6) * Math.PI * 2 + 0.4;
      s.setAttribute("aria-hidden", "true");
      Object.assign(s.style, { position: "fixed", left: r.left + r.width / 2 - 3 + "px", top: r.top + r.height / 2 - 3 + "px", width: "6px", height: "6px", borderRadius: "50%", background: SPARK[i], pointerEvents: "none", zIndex: 400 });
      document.body.appendChild(s);
      const an = s.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(a) * 26}px,${Math.sin(a) * 20}px) scale(.2)`, opacity: 0 }], { duration: 560, easing: "cubic-bezier(.1,.7,.3,1)" });
      an.onfinish = () => s.remove(); setTimeout(() => s.remove(), 900);
    }
  } catch (e) {}
  if (!leave) { setTimeout(run, 180); return; }
  const h = row.offsetHeight;
  try {
    const an = row.animate([{ transform: "translateX(0)", opacity: 1, maxHeight: h + "px" }, { transform: "translateX(0)", opacity: 1, maxHeight: h + "px", offset: 0.4 },
      { transform: "translateX(40%)", opacity: 0, maxHeight: h + "px", offset: 0.75 }, { transform: "translateX(55%)", opacity: 0, maxHeight: "0px", marginTop: "0px", marginBottom: "0px", paddingTop: "0px", paddingBottom: "0px" }],
      { duration: 820, easing: "cubic-bezier(.5,0,.4,1)", fill: "forwards" });
    let done = false; const fin = () => { if (done) return; done = true; run(); try { an.cancel(); } catch (e) {} };
    an.onfinish = fin; setTimeout(fin, 1000);
  } catch (e) { run(); }
}

/** A page coming in: from the right going forward, from the left going back; then its cards one after another. */
export function pageIn(el, dir = "fwd", wide = false) {
  if (!el || calm() || typeof el.animate !== "function") return;
  const dx = (dir === "back" ? -1 : 1) * (wide ? 18 : 36);
  try { el.animate([{ transform: `translateX(${dx}px)`, opacity: 0.4 }, { transform: "translateX(0)", opacity: 1 }], { duration: wide ? 200 : 280, easing: "cubic-bezier(.2,.8,.2,1)" }); } catch (e) {}
  try {
    const cards = [...el.querySelectorAll(".c-card, [data-anim-card]")].filter((c) => { const r = c.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }).slice(0, 8);
    cards.forEach((c, i) => c.animate([{ transform: "translateY(10px)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }], { duration: 300, delay: 60 + i * 45, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  } catch (e) {}
}
