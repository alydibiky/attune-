"""v7.8 — Tools from Gemini's mock-up "Area 6: Tools" (Ali sent it 24 Oct 2026): the Tools hub (jobs this week, made today, the five
families with what they made, recent outputs, "See all → Tools Report"), Writing (compact target chips with More targets, before /
after, the Writing Report), the Converter's recent files and report, Instant's report, Studio's report. Every number from the
on-device tool log. Phone + computer, dark + light, Arabic 360 px.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v810tools.py     (SHOTS=dir for screenshots)
"""
import os, json, time
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
now = int(time.time() * 1000); D = 86400000; H = 3600000
def e(t, fam, mode, title, **k): return {"t": t, "fam": fam, "mode": mode, "title": title, "detail": k.get("detail", ""), "kind": k.get("kind", ""), "target": k.get("target", ""), "before": k.get("before", 0), "after": k.get("after", 0), "mb": k.get("mb", 0), "secs": k.get("secs", 0)}
LOG = [e(now - 14 * 60000, "files", "convert", "GIU_Embedded_Lab4_Report.pdf → Word", kind="docx", mb=1.8, secs=1.9),
       e(now - H, "writing", "improve", "Wholesale flour supplier negotiation prompt", target="claude", kind="ai", before=40, after=26),
       e(now - 3 * H, "studio", "studio", "Cairo Nile felucca at sunset", kind="picture", secs=6.2),
       e(now - 5 * H, "instant", "instant", "Summarise · Supplier WhatsApp", kind="Summarise"),
       e(now - D, "writing", "compress", "Thesis abstract", kind="trim", before=300, after=180),
       e(now - 2 * D, "instant", "instant", "Translate · email", kind="Translate"),
       e(now - 2 * D, "files", "convert", "Nour_Bakery_Receipts (6 photos) → PDF", kind="pdf", mb=14.2, secs=3.1),
       e(now - 9 * D, "writing", "improve", "older", target="chatgpt")]
INIT = "try{localStorage.setItem('attune:toollog:v1', %s)}catch(e){}" % json.dumps(json.dumps(LOG))
LIGHT = ";try{localStorage.setItem('attune:theme:v1', JSON.stringify({accent:'teal',bg:'light'}))}catch(e){}"
AR = ";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}"
def shot(page, name, full=False):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(env.url); page.wait_for_timeout(1200)
        tag = "[phone %s] " % theme
        go(page, "tools", "[data-testid=tools-hub]")
        check("7" in page.locator("[data-testid=tools-kpi-week]").inner_text(), tag + "Tools: 7 jobs this week: %s" % page.locator("[data-testid=tools-kpi-week]").inner_text().replace("\n", " · "))
        cards = page.evaluate("[...document.querySelectorAll('[data-testid=tools-families] [data-testid^=tools-page-]')].map(b => b.dataset.testid.slice(11))")
        check(cards == ["improve", "convert", "instant", "studio", "video"], tag + "the five families: %s" % cards)
        check("2 this week" in page.locator("[data-testid=tools-page-improve]").inner_text().replace("\u2066", "").replace("\u2069", ""), tag + "…each with what it made this week")
        check("GIU_Embedded" in page.locator("[data-testid=tools-recent]").inner_text(), tag + "…recent outputs, newest first")
        shot(page, "tools-hub-phone-" + theme, True)
        page.click("[data-testid=tools-open-report]"); page.wait_for_selector("[data-testid=tools-report]")
        check(page.locator("[data-testid=tools-rep-bars] rect").count() == 5, tag + "the Tools Report: jobs by family")
        shot(page, "tools-report-phone-" + theme, True)
        go(page, "improve", "[data-testid=improve-targets]")
        check(page.locator("[data-testid=improve-targets] [data-testid^=target-]").count() == 5 and page.locator("[data-testid=improve-all-targets]").count() == 0, tag + "Writing: five target chips, the rest folded")
        page.click("[data-testid=improve-more-targets]"); page.wait_for_timeout(150)
        check(page.locator("[data-testid=improve-all-targets]").count() == 1, tag + "…More targets opens the full list")
        page.fill("textarea >> nth=0", "i need to compare embedded systems boards for my GIU graduation project under 4,500 EGP in Cairo")
        page.locator("button:has-text('Structure')").first.click(); page.wait_for_timeout(300)
        check(page.locator("[data-testid=improve-before]").count() == 1 and page.locator("[data-testid=improve-after]").count() == 1, tag + "…before (struck through) and after")
        shot(page, "writing-phone-" + theme, True)
        page.click("[data-testid=open-report-writing]"); page.wait_for_selector("[data-testid=report-writing]")
        check("3" in page.locator("[data-testid=fam-rep-week]").inner_text(), tag + "…the Writing Report counts the new one too")
        shot(page, "writing-report-phone-" + theme, True)
        go(page, "convert", "[data-testid=convert-recent]")
        check("Nour_Bakery" in page.locator("[data-testid=convert-recent]").inner_text(), tag + "Converter: recent files and results")
        page.click("[data-testid=open-report-files]"); page.wait_for_selector("[data-testid=report-files]")
        check("16" in page.locator("[data-testid=fam-rep-mb]").inner_text(), tag + "…its report: 16 MB processed, never uploaded")
        shot(page, "convert-report-phone-" + theme, True)
        go(page, "instant", "[data-testid=open-report-instant]")
        page.click("[data-testid=open-report-instant]"); page.wait_for_selector("[data-testid=report-instant]")
        check("Summarise" in page.locator("[data-testid=fam-rep-kinds]").inner_text(), tag + "Instant Report: jobs by kind")
        go(page, "studio", "[data-testid=open-report-studio]")
        page.click("[data-testid=open-report-studio]"); page.wait_for_selector("[data-testid=report-studio]")
        check("6.2" in page.locator("[data-testid=fam-rep-secs]").inner_text(), tag + "Studio Report: 6.2 s a picture")
        ctx.close()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT + AR)
    page.set_viewport_size({"width": 360, "height": 800})
    page.goto(env.url); page.wait_for_timeout(1200)
    go(page, "tools", "[data-testid=tools-hub]")
    over = page.evaluate("() => [...document.querySelectorAll('[data-testid=tools-page] *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).map(e => (e.dataset.testid || e.tagName)).slice(0, 5)")
    check(not over, "[phone ar 360] the Tools hub fits, right to left %s" % over)
    shot(page, "tools-hub-phone-ar", True)
    ctx.close()
    for theme in ["dark", "light"]:
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1440, 900), extra_init=INIT + (LIGHT if theme == "light" else ""))
        page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(500)
        tag = "[computer %s] " % theme
        go(page, "tools", "[data-testid=tools-hub]")
        f, r = page.locator("[data-testid=tools-families]").bounding_box(), page.locator("[data-testid=tools-recent]").bounding_box()
        check(r["x"] > f["x"] + f["width"] - 4, tag + "Tools: the families on the left, recent outputs on the right")
        shot(page, "tools-hub-desktop-" + theme)
        go(page, "improve", "[data-testid=improve-targets]"); shot(page, "writing-desktop-" + theme)
        ctx.close()
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
