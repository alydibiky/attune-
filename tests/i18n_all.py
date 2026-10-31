"""v8.8 (Ali: "prepare all languages … test them good — right and accurate in everything"): opens every page of the app in each
interface language and lists any English still showing — lines passed to tr() with no translation (`missing`) and visible text
that never went through tr() at all (`raw`). Writes tests/i18n-report/<lang>.json and prints a one-line summary per language.

  PYTHONPATH=tests/pwshim:tests python3 tests/i18n_all.py            # all 20 non-English languages
  PYTHONPATH=tests/pwshim:tests python3 tests/i18n_all.py fr es       # some
"""
import json, os, re, sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page

LANGS = sys.argv[1:] or ["ar", "arb", "fr", "es", "tr", "pt", "hi", "id", "ur", "de", "it", "ru", "zh", "ja", "ko", "fa", "bn", "vi", "th", "sw"]
MODES = ["home", "money", "planner", "deal", "timeline", "life", "family", "reminders", "radar", "guardian", "health", "fit", "care", "cycle", "learn", "news",
         "travel", "scout", "map", "metro", "shelf", "booklib", "pdfchat", "remember", "people", "memory", "recall", "business", "fleet", "field", "guide", "privacy",
         "tools", "convert", "write", "improve", "compress", "humanize", "copilot", "library", "video", "assistants", "skills", "artifacts", "code", "projects",
         "missions", "automations", "chat", "coach", "slides", "cv", "agents", "groups"]
OUT = os.path.join(os.path.dirname(__file__), "i18n-report"); os.makedirs(OUT, exist_ok=True)
# words that are fine in any language: brands, codes, units, the app's name
OK = re.compile(r"^(Attune|Pro|PDF|Word|Excel|WhatsApp|Gmail|Google|Android|AI|SMS|OK|EGP|USD|EUR|kg|kcal|km|GB|MB|CV|HbA1c|Wi-?Fi|Booking\.com|Talabat|Uber|Instagram|YouTube|Huawei|Franco|[A-Z]{2,5}|[\d\W]+)$")
VISIBLE = r"""() => { const out = new Set(); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (!t || !/[A-Za-z]{3}/.test(t)) continue;
    const el = n.parentElement; if (!el || el.closest('script,style,textarea,input,[data-i18n-skip],[dir=ltr] code,pre')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; out.add(t); }
  return [...out]; }"""
summary = []
MASTER = set(json.load(open(os.path.join(os.path.dirname(__file__), "..", "web-src", "i18n-master.json")))) if os.path.exists(os.path.join(os.path.dirname(__file__), "..", "web-src", "i18n-master.json")) else set()
# the language names in the switch, AI product names: shown as they are in every language
NAMES = set("English العربية Français Español Türkçe Português Deutsch Italiano Русский Kiswahili Nederlands Polski Indonesia ChatGPT Claude Cursor DeepSeek Gemini Grok Kimi Llama Perplexity NotebookLM Copilot".split()) | {"GitHub Copilot", "Mistral / Le Chat", "Bahasa Indonesia", "Tiếng Việt"}
env = Env()
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in LANGS:
        errors, missing, raw = [], set(), set()
        init = "window.__trMiss = new Set(); try{localStorage.setItem('attune:ui:lang','%s');localStorage.setItem('attune:start','home')}catch(e){}" % lang
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init)
        page.set_viewport_size({"width": 390, "height": 900})
        page.goto(env.url); page.wait_for_timeout(1800)
        def grab():
            try:
                missing.update(page.evaluate("[...(window.__trMiss||[])]")); raw.update(page.evaluate(VISIBLE))
            except Exception: pass
        grab()
        for m in MODES:
            try:
                page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", m); page.wait_for_timeout(450); grab()
                # the page's own tabs / parts, once each
                for sel in ["[data-testid^=hub-part-]", "[data-testid^=hub-tab-]"]:
                    for i in range(min(page.locator(sel).count(), 8)):
                        try: page.locator(sel).nth(i).click(timeout=800); page.wait_for_timeout(250); grab()
                        except Exception: pass
            except Exception: pass
        ctx.close()
        # visible English: a line of the app's own English shown as-is, or (non-Latin languages) a sentence that is mostly Latin letters
        latin = lambda t: len(re.findall(r"[A-Za-z]", t)); other = lambda t: len(re.findall(r"[^\x00-\x7F\u00C0-\u024F\s\d\W]", t))
        NONLATIN = lang in ("ar", "arb", "ur", "fa", "hi", "bn", "ru", "zh", "ja", "ko", "th")
        raw_bad = sorted(t for t in raw if not OK.match(t) and t not in missing and (t in MASTER or (NONLATIN and len(t.split()) >= 3 and latin(t) > 3 * max(1, other(t)))))
        miss_bad = sorted(t for t in missing if not OK.match(t) and t not in NAMES)
        rep = {"missing": miss_bad, "raw": raw_bad, "errors": [e for e in errors][:20]}
        json.dump(rep, open(os.path.join(OUT, lang + ".json"), "w"), ensure_ascii=False, indent=1)
        line = f"{lang}: {len(miss_bad)} lines without a translation, {len(raw_bad)} visible English texts, {len(errors)} page errors"
        print(line, flush=True); summary.append(line)
    br.close()
env.close()
