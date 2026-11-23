"""v10.9.1 — Ali's phone, 23 Nov 2026: "there is always something wrong with the themes and word overlapping … I am extremely tired"
+ "same goes with look and background colours, most of them don't work" + the Mind page (words under the top bar showed through it)
+ the Autopilot sheet (its words lay on the card's words).

Every page the app opens (features.js), in Glass and Plain, dark and light, at a phone (390) and a computer (1366) size:
  1. after a scroll, every bar stuck on top is SOLID (nothing shows through it) — the Mind bug;
  2. no two pieces of text sit on top of each other (leaf text boxes that overlap by > 35 % of the smaller one);
  3. each background colour draws a DIFFERENT ground (Midnight / Black / Graphite / Warm / Light) in Glass and in Plain;
  4. the page never scrolls sideways.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1091themes.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

PAGES = ["home", "habits", "countdowns", "braindump", "missions", "recall", "lists", "weekplan", "tables", "money", "planner", "salary",
         "automations", "timeline", "life", "reminders", "radar", "errands", "guardian", "agents", "booklib", "people", "memory", "projects",
         "travel", "translate", "convert", "write", "shelf", "pdfchat", "setup", "brain", "privacy", "guide"]
OVERLAP_JS = r"""() => {
  const vw = innerWidth, vh = innerHeight, out = [];
  const els = [...document.querySelectorAll('body *')].filter((e) => {
    if (!e.childNodes.length || [...e.childNodes].every((n) => n.nodeType !== 3 || !n.textContent.trim())) return false;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false;
    if (e.closest('[aria-hidden=true], .sr-only, input, textarea, select, svg')) return false;
    const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  }).slice(0, 400);
  // what is really on top at a point: an element hidden under a solid bar / sheet doesn't count
  const onTop = (e, r) => { const x = Math.min(vw - 1, Math.max(0, r.left + r.width / 2)), y = Math.min(vh - 1, Math.max(0, r.top + r.height / 2)); const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t) || t.contains(e)); };
  const R = els.map((e) => [e, e.getBoundingClientRect()]).filter(([e, r]) => onTop(e, r));
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const [a, ra] = R[i], [b, rb] = R[j]; if (a.contains(b) || b.contains(a)) continue;
    const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (w <= 2 || h <= 2) continue;
    const small = Math.min(ra.width * ra.height, rb.width * rb.height);
    if (w * h > 0.35 * small) out.push(a.textContent.trim().slice(0, 30) + ' ⟂ ' + b.textContent.trim().slice(0, 30));
  }
  return out.slice(0, 4);
}"""
BARS_JS = r"""() => {
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 1; const p = m[1].split(/[ ,\/]+/).filter(Boolean); return p.length > 3 ? +p[3] : 1; };
  const bad = [];
  for (const e of document.querySelectorAll('body *')) {
    const s = getComputedStyle(e); if (s.position !== 'sticky' && s.position !== 'fixed') continue;
    const r = e.getBoundingClientRect(); if (r.top > 4 || r.height < 30 || r.height > 160 || r.width < innerWidth * 0.6) continue;
    if (!e.textContent.trim()) continue;
    // its own colour, or the first coloured box under it inside it
    let a = alpha(s.backgroundColor);
    const blur = (s.backdropFilter && s.backdropFilter !== 'none') || (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none');   // (the computer's frosted bar)
    if (a < 0.95 && s.backgroundImage === 'none' && !(blur && a >= 0.8)) bad.push((e.className || e.tagName).toString().slice(0, 60) + ' bg=' + s.backgroundColor);
  }
  return bad.slice(0, 3);
}"""
GROUND_JS = r"""() => { const s = getComputedStyle(document.body), h = getComputedStyle(document.documentElement);
  return [s.backgroundImage !== 'none' ? s.backgroundImage.slice(0, 120) : s.backgroundColor, h.backgroundColor, getComputedStyle(document.querySelector('.calm') || document.body).getPropertyValue('--c-surf')].join(' | '); }"""

env = Env(); errors = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for w in (390, 1366):
        for th in ({"accent": "rose", "bg": "zinc", "look": "glass"}, {"accent": "burgundy", "bg": "light", "look": "glass"},
                   {"accent": "teal", "bg": "black", "look": "plain"}, {"accent": "violet", "bg": "light", "look": "plain"}):
            tag = "%d · %s %s" % (w, th["look"], th["bg"])
            init = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
                    "localStorage.setItem('attune:theme:v1',JSON.stringify(Object.assign({a43:1,v87:1,v95:1},%s)))}catch(e){}") % json.dumps(th)
            ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
            page.set_viewport_size({"width": w, "height": 844}); page.goto(env.url); page.wait_for_timeout(1500)
            bars, laps, wide = [], [], []
            for pg in PAGES:
                page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open', { detail: { mode: m } }))", pg); page.wait_for_timeout(450)
                page.evaluate("() => { const s = document.scrollingElement; s.scrollTop = 260; document.querySelectorAll('.att-scroll, main, [data-scroll]').forEach((e) => { try { e.scrollTop = 260; } catch (x) {} }); }")
                page.wait_for_timeout(150)
                b = page.evaluate(BARS_JS)
                if b: bars.append(pg + ": " + "; ".join(b))
                o = page.evaluate(OVERLAP_JS)
                if o: laps.append(pg + ": " + " | ".join(o))
                if page.evaluate("() => document.scrollingElement.scrollWidth > innerWidth + 2"): wide.append(pg)
            check(not bars, tag + ": every bar stuck on top is solid after a scroll — %s" % bars[:4])
            check(not laps, tag + ": no words on top of other words — %s" % laps[:6])
            check(not wide, tag + ": no page scrolls sideways — %s" % wide)
            ctx.close()
        # 3. each background is its own ground, in glass and in plain
        for look in ("glass", "plain"):
            grounds = {}
            for bg in ("slate", "black", "zinc", "stone", "light"):
                th = {"accent": "burgundy", "bg": bg, "look": look}
                init = ("try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));"
                        "localStorage.setItem('attune:theme:v1',JSON.stringify(Object.assign({a43:1,v87:1,v95:1},%s)))}catch(e){}") % json.dumps(th)
                ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
                page.set_viewport_size({"width": w, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
                grounds[bg] = page.evaluate(GROUND_JS); ctx.close()
            check(len(set(grounds.values())) == 5, "%d · %s: Midnight, Black, Graphite, Warm and Light are 5 different grounds (%d) %s" % (w, look, len(set(grounds.values())), "" if len(set(grounds.values())) == 5 else grounds))
    br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
