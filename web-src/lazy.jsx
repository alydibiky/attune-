/* ---- v10.2 (Ali, 17 Nov: "I want it really smooth" — "make sure it's improved on both devices"): a rarely used page is its own file
   (build/bundle.mjs SPLIT), so the phone and the computer don't read it at every start. It is fetched the first time the page opens
   — and quietly after the first screen anyway (preloadPages), so opening it later is instant. Same on phone and computer. */
import React from "react";
import { tr } from "./i18n.js";

const loaders = [];
/** lazyPage(() => import("./x-ui.jsx"), "XPage") → a component that shows the page (with a short "Opening…" while its file loads). */
export function lazyPage(load, name) {
  let p = null; const get = () => (p = p || load().catch((e) => { p = null; throw e; }));
  loaders.push(get);
  const L = React.lazy(() => get().then((m) => ({ default: m[name] })));
  const Page = (props) => <React.Suspense fallback={<div className="calm p-6 text-[13px] text-[var(--c-mut)]" data-testid="page-loading">{tr("Opening…")}</div>}><L {...props} /></React.Suspense>;
  Page.displayName = "Lazy(" + name + ")";
  return Page;
}
/** After the first screen, when the device is idle: fetch every page file, one at a time, so later taps are instant. */
export function preloadPages(delay = 6000) {
  if (typeof window === "undefined") return;
  setTimeout(() => {
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 200));
    let i = 0; const next = () => { if (i >= loaders.length) return; const g = loaders[i++]; idle(() => { g().catch(() => {}).finally(next); }, { timeout: 3000 }); };
    next();
  }, delay);
}
