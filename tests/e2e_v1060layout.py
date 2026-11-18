"""v10.6 — Ali, 18 Nov: "whats that and why it is not optimized, see all the interface of the app and make sure its optimized everywhere —
I don't want to see this again" (the Tools page's cards squeezed until words broke every few letters; Money's balance "1,127,735.2 EG / P")
+ "I want the app to be optimized for foldable phones". EVERY page, at EVERY width — small phones (280, 320, 360), a foldable's cover
screen (344), a normal phone (412), small tablets and unfolded foldables (600, 673, 768, 884), computers (1024, 1366) — with his real
numbers, is checked for: something past the screen's edge, a WORD broken across lines (the "EG/P" and the squeezed cards), and the page
scrolling sideways.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1060layout.py            (LAYOUT_WIDTHS=360,673 LAYOUT_MODES=money,tools to narrow it)
"""
import json, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
WIDTHS = [int(x) for x in os.environ.get("LAYOUT_WIDTHS", "280,320,344,360,412,600,673,768,884,1024,1366").split(",")]
MODES = os.environ.get("LAYOUT_MODES", "home,chat,money,lists,timeline,life,reminders,radar,care,family,agents,people,memory,projects,travel,translate,convert,write,slides,cv,pdfchat,shelf,remember,news,booklib,tools,setup,recall,guardian,planner,groups").split(",")
LEDGER = {"accounts": [{"id": "a1", "name": "Cib,instapay", "currency": "EGP"}, {"id": "a2", "name": "Usd", "currency": "USD"}, {"id": "a3", "name": "Cash", "currency": "EGP"}],
          "txns": [{"id": "t1", "type": "income", "amount": 1096938.2, "cat": "salary", "account": "a1", "date": "2026-11-01", "note": "Opening balance"},
                   {"id": "t2", "type": "income", "amount": 40.6, "cat": "other", "account": "a2", "date": "2026-11-01", "note": "Opening"},
                   {"id": "t3", "type": "income", "amount": 28800, "cat": "other", "account": "a3", "date": "2026-11-01", "note": "Opening"},
                   {"id": "t4", "type": "expense", "amount": 29977.8, "cat": "shopping", "account": "a1", "date": "2026-11-15", "note": "CARREFOUR MAADI"}], "recurring": []}
SEED = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('ledger.v3',%s);"
        "localStorage.setItem('attune:lists:v1',%s);}catch(e){};") % (json.dumps(json.dumps(LEDGER)), json.dumps(json.dumps({"lists": [{"id": "l1", "name": "Talabat", "emoji": "🛒", "items": [{"id": "i%d" % i, "text": t, "done": i < 4} for i, t in enumerate(["Salsa", "Foul", "Lettuce", "Cucumber", "Tomatoes", "Bread", "Eggs", "Milk"])], "repeat": {"every": "once"}, "created": 0}]})))
PROBE = r"""() => {
  const W = innerWidth, out = [];
  const label = (e) => { let p = e, id = ''; while (p && !id) { id = p.getAttribute && p.getAttribute('data-testid') || ''; p = p.parentElement; } return (id || e.tagName.toLowerCase()) + ': ' + (e.innerText || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40); };
  const hiddenAway = (e) => { for (let p = e; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0 || p.getAttribute('aria-hidden') === 'true' || p.inert) return true;
      if (cs.position === 'fixed' || cs.position === 'absolute') { const r = p.getBoundingClientRect(); if (r.right <= 1 || r.left >= W - 1) return true; } } return false; };
  const scroller = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX) && p.clientWidth < W + 2) return p; } return null; };
  for (const e of document.querySelectorAll('#root *')) {
    const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
    if ((r.right > W + 2 || r.left < -2) && !scroller(e) && !hiddenAway(e)) out.push('past the edge: ' + label(e) + ' [' + Math.round(r.left) + '–' + Math.round(r.right) + ']');
    if (out.length > 12) break;
  }
  // a word broken across lines (squeezed text): every text node, every word of 3+ letters
  const tw = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT); let n, seen = 0;
  while ((n = tw.nextNode()) && seen < 4000) { seen++;
    const s = n.textContent; if (!s || s.trim().length < 3) continue; const el = n.parentElement; if (!el || hiddenAway(el)) continue;
    const cs = getComputedStyle(el); if (cs.whiteSpace === 'nowrap' || cs.textOverflow === 'ellipsis' || el.closest('textarea,input,pre,code,svg')) continue;
    const re = /[\p{L}\p{N}][\p{L}\p{N}.,'’\-]{2,24}/gu; let m;
    while ((m = re.exec(s))) { const w = m[0]; if (/^[\d.,]+$/.test(w) && w.length < 4) continue;
      const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + w.length);
      const rects = [...rg.getClientRects()].filter((x) => x.width > 0.5);
      if (rects.length > 1 && Math.abs(rects[0].top - rects[rects.length - 1].top) > 4 && !/[-‑–]/.test(w)) { out.push('word broken: “' + w + '” in ' + label(el)); break; } }
    if (out.length > 20) break; }
  // text drawn in a see-through colour (v10.6: a toast's words were the glass page's transparent background colour)
  for (const e of document.querySelectorAll('#root *')) { if (!e.childNodes.length || ![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) continue;
    const cs = getComputedStyle(e); if (hiddenAway(e)) continue; const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(cs.color); if ((m && +m[1] < 0.05) || cs.color === 'transparent') { out.push('invisible text: ' + label(e)); break; } }
  if (document.scrollingElement.scrollWidth > W + 2) out.push('the page scrolls sideways: ' + document.scrollingElement.scrollWidth + ' > ' + W);
  return [...new Set(out)];
}"""
bad = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in WIDTHS:
        desk = w >= 1024
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(w, 860) if desk else None, extra_init=SEED)
        if not desk: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_timeout(1800)
        for m in MODES:
            page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(900)
            got = page.evaluate(PROBE)
            if got: bad["%d %s" % (w, m)] = got
            page.keyboard.press("Escape")
        ctx.close()
    for k, v in bad.items(): print("  " + k + ": " + " | ".join(v[:4]))
    check(not bad, "every page fits at every width (%d widths × %d pages): %d problems" % (len(WIDTHS), len(MODES), len(bad)))
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
