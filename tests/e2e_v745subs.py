"""v6.45 (W6) Video: subtitles for a saved video — Subtitles → Spoken in Arabic → the phone listens (progress) → an .srt
is saved and shown; a phone that can't (no Android 13 / no offline recogniser) shows no Subtitles button. Arabic too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v745subs.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LIST = [{"id": 101, "name": "Site talk.mp4", "where": "Movies/Attune/Site talk.mp4", "status": "done", "done": 150000000, "total": 150000000}]
INIT = "try{localStorage.setItem('attune:video:v1', %s)}catch(e){}" % json.dumps(json.dumps(LIST))
def native(can):
    return """(() => { const N = window.AttuneNative, S = window.__mock; S.subs = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 20);
  N.videoStatus = (id) => R(id, { items: [] });
  N.subtitlesAvailable = () => %s;
  N.videoSubtitles = (id, arg) => { S.subs.push(JSON.parse(arg)); let k = 0; (function tick() { window.__attuneNative.progress(id, k * 50, 'listening', k + ' / 2');
    if (++k < 2) return setTimeout(tick, 40); R(id, { cues: [{ start: 1200, end: 4800, text: 'السلام عليكم يا جماعة' }, { start: 6000, end: 9500, text: 'النهارده هنرفع الحمولة بالونش الكبير' }] }); })(); };
})()""" % ("true" if can else "false")
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ["en", "ar"]:
        init = INIT + (";try{localStorage.setItem('attune:ui:lang','ar')}catch(e){};window.__trMiss=new Set()" if lang == "ar" else "")
        ctx, page = new_page(br, env, errors, extra_init=init)
        page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
        page.evaluate(native(True))
        page.locator("nav button").last.click(); page.wait_for_timeout(250)
        page.locator(".rounded-t-2xl button:has-text('%s')" % ("Video Downloader" if lang == "en" else "تنزيل الفيديو")).first.click()
        page.wait_for_selector("[data-testid=video-subs-open]", timeout=6000)
        page.click("[data-testid=video-subs-open]"); page.wait_for_selector("[data-testid=video-subs]")
        if lang == "en":
            page.select_option("[data-testid=video-subs-lang]", "ar"); page.click("[data-testid=video-subs-go]")
            page.wait_for_function("window.__mock.lastSaved && /\\.srt$/.test(window.__mock.lastSaved.name)", timeout=6000)
            a = page.evaluate("window.__mock.subs[0]")
            check(a["id"] == 101 and a["lang"] == "ar-EG", "the phone listens to download 101 in Egyptian Arabic: %s" % a)
            s = page.evaluate("window.__mock.lastSaved")
            check(s["name"] == "Site talk.ar.srt" and s["text"].startswith("1\n00:00:01,200 --> 00:00:04,800\nالسلام عليكم يا جماعة"), "saved Site talk.ar.srt in the .srt format")
            check("النهارده" in page.inner_text("[data-testid=video-subs-text]"), "the subtitles are shown too")
        else:
            miss = [m for m in page.evaluate("[...window.__trMiss]")]
            check(not [m for m in miss if "subtitle" in m.lower() or "Spoken" in m or "srt" in m or "speech" in m.lower()], "Arabic: the subtitles panel is in Arabic: %s" % miss[:6])
        ctx.close()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000); page.evaluate(native(False))
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Video Downloader')").first.click(); page.wait_for_selector("[data-testid=video-cut]", timeout=6000)
    check(page.locator("[data-testid=video-subs-open]").count() == 0, "a phone without an offline recogniser: no Subtitles button")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
