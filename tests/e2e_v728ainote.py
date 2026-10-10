"""v6.16c (Ali: "like any AI, write in a small font that AI can make mistakes") — the line under Chat's box, in English and Arabic.
  python3 tests/e2e_v728ainote.py [screenshot dir]
"""
import sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
shots = sys.argv[1] if len(sys.argv) > 1 else None
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang, want in (("en", "Attune is AI and can make mistakes. Check important info."), ("ar", "Attune ذكاء اصطناعي وقد يخطئ، فتحقّق من المعلومات المهمة.")):
        ctx, page = new_page(br, env, errors, extra_init=("localStorage.setItem('attune:ui:lang','ar');" if lang == "ar" else ""))
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        page.wait_for_selector("[data-testid=chat-input]", timeout=10000)
        note = page.locator("[data-testid=ai-note]").first
        check(note.is_visible() and note.inner_text().strip() == want, f"{lang}: the AI-mistakes line is under the chat box: {note.inner_text()!r}")
        fs = page.evaluate("() => parseFloat(getComputedStyle(document.querySelector('[data-testid=ai-note]')).fontSize)")
        box, inp = note.bounding_box(), page.locator("[data-testid=chat-input]").bounding_box()
        check(fs <= 11 and box["y"] > inp["y"], f"{lang}: small ({fs}px) and below the box")
        if shots: page.screenshot(path=f"{shots}/ainote-{lang}.png")
        ctx.close()
    br.close()
check(not real_errors(errors), "no page errors: " + "; ".join(real_errors(errors))[:300])
env.close(); finish()
