"""v6.7 — bigger databases: every new AI tool in "Better prompts for other AIs" builds a prompt that
carries the task (and its tool's own shape: camera for video, tests for code, pages for app builders);
the travel packs grew from 31 to 43 countries and the new ones open with their local knowledge.

  python3 tests/e2e_v67b.py
"""
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
NEW = {"Microsoft Copilot": "Task:", "Mistral Le Chat": "Task:", "Qwen": "step by step", "Kimi": "Task:", "Meta AI": "",
       "Cursor": "tests", "Claude Code": "tests", "GitHub Copilot": "minimal", "Lovable": "pages", "Bolt.new": "pages", "Replit Agent": "pages",
       "ChatGPT Images": "Style:", "Ideogram": "quotes", "Leonardo": "Style:", "Sora": "Camera:", "Veo (Gemini)": "Sound:", "Runway": "Camera:", "Kling": "Camera:",
       "Udio": "[Chorus]", "ElevenLabs": "spoken", "Gamma": "slides", "Canva AI": "Format:"}
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator("button:has-text('Improve a prompt')").first.click(); page.wait_for_timeout(300)
    box = page.locator("textarea[placeholder*='compare laptops']").first
    box.fill("a short launch video for our crane rental company in Cairo")
    bad = []
    for label, must in NEW.items():
        b = page.locator(f"button:text-is('{label}')")
        if not b.count(): bad.append(label + ": no button"); continue
        b.first.click(); page.wait_for_timeout(80)
        page.locator("button:has-text('Structure')").first.click(); page.wait_for_timeout(150)
        out = page.locator("pre").last.inner_text()
        if "crane rental" not in out or (must and must not in out): bad.append(f"{label}: {out[:90]!r}")
    check(not bad, "all %d new AI tools build a prompt with the task and their own shape%s" % (len(NEW), ("  ✗ " + "; ".join(bad[:4])) if bad else ""))
    check(page.locator("text=Code & apps").count() >= 1 and page.locator("text=Images & video").count() >= 1, "tools are grouped: chat, agents, code & apps, images & video, music/voice/slides")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.locator("nav button").last.click(); page.wait_for_timeout(200)
    page.locator(".rounded-t-2xl button:has-text('Travel')").first.click(); page.wait_for_timeout(400)
    check(page.locator("[data-testid=travel-packs]").inner_text().find("43") >= 0, "43 country packs (31 before)")
    for name, fact in [("Maldives", "IMUGA"), ("Uzbekistan", "Afrosiyob"), ("Bosnia and Herzegovina", "BH Telecom"), ("United States", "ESTA")]:
        # v6.27 Calm travel: the list opens from "Change country"; a pack's knowledge is spread over five tabs
        if not page.locator("[data-testid=travel-packs]").count(): page.click("[data-testid=travel-change]")
        page.fill("[data-testid=travel-find]", name); page.locator(f"[data-testid=travel-packs] button:has-text('{name}')").first.click(); page.wait_for_timeout(400)
        body = ""
        for t in ["trip", "arrive", "know"]:
            page.click(f"[data-testid=travel-tab-{t}]"); page.wait_for_timeout(100)
            for d in page.locator("details").all(): d.evaluate("e => e.open = true")
            body += page.locator("body").inner_text()
        check(fact.lower() in body.lower(), f"{name} opens with its local knowledge ({fact})")
    errs = real_errors(errors)
    check(not errs, "no JavaScript errors (%d)%s" % (len(errs), (": " + errs[0]) if errs else ""))
    ctx.close(); br.close()
env.close()
finish()
