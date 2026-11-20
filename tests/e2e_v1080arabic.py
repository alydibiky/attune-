"""v10.8 (launch, Ali: "read every Arabic screen"): every page in Egyptian Arabic, at a phone and a computer — no English left on
screen except names (apps, AI names, file types), the person's own data, keyboard hints and the travel guides' own text (country
packs — listed, not failed: their Arabic is a separate content job, see NEXT_CHAT).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v1080arabic.py
"""
import json, re, os
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
exec("\n".join(open(os.path.join(os.path.dirname(__file__), "e2e_v1060layout.py")).read().splitlines()[13:21]), globals())
env = Env(); errors = []
OK = set("""Attune Google WhatsApp Gmail CIB EGP USD PDF Word Excel AI Life360 Talabat YouTube Instagram Facebook Chrome Android iPhone Wi-Fi
OK GPS SMS API Play Store App Pro Free Claude ChatGPT Gemini Grok DeepSeek Qwen Mistral Kimi Copilot Perplexity Microsoft Chat Le Llama Gemma
Phi PNG JPG MB GB KB Bluetooth Instapay InstaPay Fawry Vodafone Cash Uber Careem Amazon Noon Jumia Booking Airbnb Shein Netflix Spotify
PowerPoint Zoom Teams Outlook Telegram Signal Huawei Samsung Xiaomi Honor Galaxy Fold Health Connect Fitbit Garmin Strava Yazio Scout
Mind Hijri QR VAT ID AM PM km kg cm min Alt CSV Takeout Mail Export mbox Zenith Everest Core Sense Blaze Flash Usd Cib Opening balance
Bread Eggs Milk Tomatoes Salsa Foul Lettuce Cucumber CARREFOUR MAADI CAI""".split())
src = open(os.path.join(os.path.dirname(__file__), "..", "web-src", "attune.jsx"), encoding="utf-8").read()
packs = src[src.index("const COUNTRY_PACKS = {"):]
packs = packs[:packs.index("\n};\n")]
SEED2 = SEED + "try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
bad, known = {}, set()
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, desk in ((412, False), (1366, True)):
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(w, 860) if desk else None, extra_init=SEED2)
        if not desk: page.set_viewport_size({"width": w, "height": 860})
        page.goto(env.url); page.wait_for_timeout(2200)
        for m in MODES:
            page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(800)
            txt = page.evaluate("""() => { const out = []; const tw = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT); let n;
              while ((n = tw.nextNode())) { const el = n.parentElement; if (!el || el.closest('textarea,input,code,pre,svg,[translate=no]')) continue; if (!el.getBoundingClientRect().width) continue;
                const s = n.textContent.trim(); if (s) out.push(s); }
              for (const e of document.querySelectorAll('#root [placeholder],#root [aria-label]')) for (const a of ['placeholder','aria-label']) { const v = e.getAttribute(a); if (v) out.push(v); }
              return out; }""")
            for s in txt:
                words = [x for x in re.findall(r"[A-Za-z][A-Za-z'’\-]{2,}", s) if x not in OK and x.capitalize() not in OK and x.upper() not in OK]
                if not words or re.search(r"https?://|@|\.com", s): continue
                if s in packs or s.strip("“”\"") in packs or re.sub(r"\s+\d{4}$", "", s) in packs or any(s in v for v in [packs]): known.add(s[:80]); continue
                bad.setdefault(m, set()).add(s[:90])
            page.keyboard.press("Escape")
        ctx.close()
    for m, v in bad.items(): print("  " + m + ": " + " | ".join(sorted(v)[:5]))
    if known: print("  (travel guides' own English, a separate content job: %d lines, e.g. %s)" % (len(known), " | ".join(sorted(known)[:3])))
    check(not bad, "every page reads in Arabic (%d pages × phone + computer): %d pages with English left" % (len(MODES), len(bad)))
    errs = real_errors(errors); check(not errs, "no JavaScript errors: %s" % errs[:2])
    br.close()
env.close(); finish()
