(opt) => {
  // the 15 in-page checks of one view (tests/onemillion/partC.py). Returns { fails: [[check, why]], texts: [...] (English run) }
  const W = innerWidth, H = innerHeight, fails = [], add = (c, why) => fails.push([c, String(why).slice(0, 110)]);
  const vis = (el) => { const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > H || r.right < 0 || r.left > W) return null;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) return null; return r; };
  const name = (el) => (el.tagName.toLowerCase() + (el.dataset && el.dataset.testid ? "[" + el.dataset.testid + "]" : "") + " “" + (el.innerText || el.getAttribute("aria-label") || el.value || "").trim().slice(0, 28) + "”");
  const skip = (el) => el.closest("[data-i18n-skip],pre,code,textarea,iframe,svg,.att-hscroll,.att-chips,.overflow-x-auto,table");
  // c01 / c02
  if (document.documentElement.scrollWidth > W + 1) add("c01 page wider than the screen", "scrollWidth " + document.documentElement.scrollWidth + " > " + W);
  let out = 0, outEx = "";
  for (const el of document.querySelectorAll("body *")) { if (skip(el) || (el.parentElement && el.parentElement.closest(".overflow-hidden,[class*=overflow-x]"))) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || r.bottom < 0 || r.top > H) continue;
    const cs = getComputedStyle(el); if (cs.position === "fixed" && r.width >= W - 2) continue;
    if ((r.right > W + 2 || r.left < -2) && cs.visibility !== "hidden") { out++; if (!outEx) outEx = name(el) + " " + Math.round(r.left) + "→" + Math.round(r.right); } }
  if (out) add("c02 element outside the screen", outEx + (out > 1 ? " (+" + (out - 1) + ")" : ""));
  const text = document.body.innerText || "";
  // c03
  if (/Something went wrong on this screen|حدثت مشكلة في هذه الشاشة/.test(text)) add("c03 crash screen", "the screen crashed");
  // c05 / c06 — in what is visible
  const nodes = []; { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(), el = n.parentElement; if (!t || !el || el.closest("script,style,[data-i18n-skip],pre,code,textarea")) continue; if (!vis(el)) continue; nodes.push([t, el]); } }
  for (const [t] of nodes) { if (/\{[a-zA-Z_]{1,12}\}/.test(t)) { add("c05 {placeholder} shown", t.slice(0, 80)); break; } }
  for (const [t] of nodes) { if (/(?:^|[\s:(])(?:undefined|NaN|null|\[object Object\])(?:$|[\s.,)])/.test(t)) { add("c06 undefined/NaN shown", t.slice(0, 80)); break; } }
  // c07 — the same English sentence as on the English screen
  if (opt.lang !== "en" && opt.en && opt.en.length) { const E = new Set(opt.en); let n = 0, ex = "";
    const D = (opt.data || []).map((x) => x.toLowerCase());
    for (const [t, el] of nodes) if (E.has(t) && (t.match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^[A-Z]{2,4}$/.test(w)).length >= 2 && !/^[\d\s.,:%+\-–—/·()A-Z]+$/.test(t) && !el.closest("input,select option") && !D.some((x) => t.toLowerCase().includes(x))) { n++; if (!ex) ex = t.slice(0, 70); }
    if (n) add("c07 English left", "“" + ex + "”" + (n > 1 ? " (+" + (n - 1) + ")" : "")); }
  // c08
  const dir = document.documentElement.dir || getComputedStyle(document.body).direction;
  if (opt.rtl ? dir !== "rtl" : dir === "rtl") add("c08 wrong direction", "dir=" + dir);
  // c09 / c10 / c12 / c15 — the controls
  let noName = "", tiny = "", squeezed = "", covered = "", nN = 0, nT = 0, nC = 0;
  for (const el of document.querySelectorAll("button, a[href], [role=button], input:not([type=hidden]), select, textarea")) {
    const r = vis(el); if (!r || el.closest("[aria-hidden=true]") || el.disabled) continue;
    const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.innerText || el.value || el.getAttribute("placeholder") || (el.labels && el.labels[0] && el.labels[0].innerText) || (el.querySelector("img[alt]") || {}).alt || "").trim();
    if (!label) { nN++; if (!noName) noName = name(el) + " " + Math.round(r.width) + "×" + Math.round(r.height); }
    if ((r.width < 32 || r.height < 32) && /^(BUTTON|A)$/.test(el.tagName) && !el.closest("p,li") && r.width * r.height > 0) { nT++; if (!tiny) tiny = name(el) + " " + Math.round(r.width) + "×" + Math.round(r.height); }
    const cx = Math.min(W - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    if (r.top >= 0 && r.bottom <= H && r.left >= 0 && r.right <= W) { const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el) && !(top.closest && top.closest("label") && top.closest("label").contains(el))) {
        // under a sticky / fixed bar is fine while the screen can still scroll it into view; only a control nobody can reach counts
        let pinned = false; for (let e = top; e; e = e.parentElement) { const p = getComputedStyle(e).position; if (p === "fixed" || p === "sticky") { pinned = true; break; } }
        let sp = el.parentElement; while (sp && !(/(auto|scroll)/.test(getComputedStyle(sp).overflowY) && sp.scrollHeight > sp.clientHeight + 2)) sp = sp.parentElement; sp = sp || document.scrollingElement;
        const lowerHalf = cy > H / 2, canMore = sp.scrollTop + sp.clientHeight < sp.scrollHeight - 2, canLess = sp.scrollTop > 2;
        if (!(pinned && (lowerHalf ? canMore : canLess))) { nC++; if (!covered) covered = name(el) + " under " + name(top); } } }
  }
  if (nN) add("c09 control with no name", noName + (nN > 1 ? " (+" + (nN - 1) + ")" : ""));
  if (nT) add("c10 tap target < 32 px", tiny + (nT > 1 ? " (+" + (nT - 1) + ")" : ""));
  if (nC) add("c15 control covered", covered + (nC > 1 ? " (+" + (nC - 1) + ")" : ""));
  for (const b of document.querySelectorAll("button, a, span, p, label, h1, h2, h3")) { if (!vis(b)) continue;
    for (const n of b.childNodes) { if (n.nodeType !== 3) continue; const t = n.nodeValue.trim(); if (t.length < 3 || /\s/.test(t) || /^[\d.,:%+\-–—/·()]+$/.test(t) || /[぀-ヿ一-鿿฀-๿]/.test(t)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n); const ys = new Set([...rg.getClientRects()].map((q) => Math.round(q.top))); if (ys.size > 1) { squeezed = squeezed || t.slice(0, 24); } } }
  if (squeezed) add("c12 word broken over lines", squeezed);
  // c11 — contrast of every visible text node against what is behind it
  const cv = document.createElement("canvas").getContext("2d"), cache = {};
  cv.canvas.width = cv.canvas.height = 1;
  const rgba = (c) => { if (c in cache) return cache[c]; cv.clearRect(0, 0, 1, 1); cv.fillStyle = "rgba(0,0,0,0)"; cv.fillStyle = c; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data;
    // getImageData gives straight (not premultiplied) colour; a faint tint (alpha 0.15) is read from a full-alpha pixel of the same colour
    const al = d[3] / 255; if (al <= 0) return (cache[c] = [0, 0, 0, 0]);
    cv.clearRect(0, 0, 1, 1); cv.globalAlpha = 1; const solid = String(c).replace(/\/\s*[\d.]+%?\s*\)$/, ")").replace(/^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, "rgb($1,$2,$3)").replace(/^hsla\(([^,]+),([^,]+),([^,]+),[^)]+\)$/, "hsl($1,$2,$3)");
    cv.fillStyle = "rgba(0,0,0,0)"; cv.fillStyle = solid; cv.fillRect(0, 0, 1, 1); const e = cv.getImageData(0, 0, 1, 1).data;
    return (cache[c] = e[3] > 250 ? [e[0], e[1], e[2], al] : [d[0], d[1], d[2], al]); };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== "none" && !/url\(/.test(cs.backgroundImage)) return null;
      const c = rgba(cs.backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 0.99) break; } }
    let base = [255, 255, 255]; const b0 = rgba(getComputedStyle(document.body).backgroundColor); if (b0[3] > 0.99) base = b0.slice(0, 3);
    for (const c of stack.reverse()) base = base.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return base; };
  let low = 0, lowEx = "";
  for (const [t, el] of nodes.slice(0, 400)) { if (t.length < 2 || el.closest("button[disabled],[aria-disabled=true],input,select,option,[contenteditable]")) continue;
    const cs = getComputedStyle(el), fg = rgba(cs.color); if (fg[3] < 0.1) continue; const bg = bgOf(el); if (!bg) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity; if (op < 0.95) continue;   // a faded / disabled part
    const f = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3])); const L1 = lum(f), L2 = lum(bg), ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.6 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 4.5)) { low++; if (!lowEx) lowEx = "“" + t.slice(0, 30) + "” " + ratio.toFixed(2) + " (" + cs.color + " on rgb(" + bg.map(Math.round) + "))"; } }
  if (low) add("c11 low contrast", lowEx + (low > 1 ? " (+" + (low - 1) + ")" : ""));
  // c13 — text cut off (no ellipsis on purpose)
  let cut = "";
  for (const [t, el] of nodes) { const cs = getComputedStyle(el); if (cs.textOverflow === "ellipsis" || /line-clamp|-webkit-box/.test(cs.display + cs.webkitLineClamp) || +cs.webkitLineClamp > 0) continue;
    if ((cs.overflow === "hidden" || cs.overflowX === "hidden") && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && t.length > 3) { cut = "“" + t.slice(0, 40) + "” " + el.scrollWidth + ">" + el.clientWidth; break; } }
  if (cut) add("c13 text cut off", cut);
  // c14
  const noAlt = [...document.querySelectorAll("img")].filter((i) => vis(i) && !i.hasAttribute("alt") && !i.closest("[aria-hidden=true]"));
  if (noAlt.length) add("c14 image with no alt", (noAlt[0].src || "").slice(-40));
  return { fails, texts: opt.lang === "en" ? [...new Set(nodes.map(([t]) => t))].filter((t) => /[A-Za-z]{3,}/.test(t)).slice(0, 2000) : [] };
}
