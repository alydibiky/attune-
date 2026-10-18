"""v6.37 (upgrade W6) — Video: cut a part of a saved video, or keep its sound only.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v740clip.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
LIST = [{"id": 101, "name": "Tower crane.mp4", "where": "Movies/Attune/Tower crane.mp4", "status": "done", "done": 150000000, "total": 150000000}]
INIT = "try{localStorage.setItem('attune:video:v1', %s)}catch(e){}" % json.dumps(json.dumps(LIST))
NATIVE = """(() => { const N = window.AttuneNative, S = window.__mock; S.clips = []; S.opened = [];
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 20);
  N.videoStatus = (id) => R(id, { items: [] });
  N.videoClip = (id, arg) => { const a = JSON.parse(arg); S.clips.push(a); R(id, { uri: 'content://media/9', where: 'Music/Attune/' + a.name + ' (sound).m4a', name: a.name + ' (sound).m4a', size: 900000, type: 'audio/mp4' }); };
  N.videoOpen = (id, arg) => { S.opened.push(JSON.parse(arg)); R(id, { ok: true }); };
})()"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate(NATIVE)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Video Downloader')").first.click()
    page.wait_for_selector("[data-testid=video-cut]", timeout=6000)
    page.click("[data-testid=video-cut]")
    page.fill("[data-testid=video-clip-from]", "1:00"); page.fill("[data-testid=video-clip-to]", "0:30"); page.click("[data-testid=video-clip-go]")
    check("after the start" in page.locator("[data-testid=video-clip-err]").inner_text() and page.evaluate("window.__mock.clips.length") == 0, "an end before the start is caught before anything runs")
    page.fill("[data-testid=video-clip-from]", "0:30"); page.fill("[data-testid=video-clip-to]", "1:15"); page.check("[data-testid=video-clip-audio]"); page.click("[data-testid=video-clip-go]")
    page.wait_for_function("window.__mock.clips.length === 1", timeout=5000)
    a = page.evaluate("window.__mock.clips[0]")
    check(a["id"] == 101 and a["start"] == 30000 and a["end"] == 75000 and a["audio"] is True and a["name"] == "Tower crane", "the phone is asked for 0:30 → 1:15, sound only: %s" % a)
    page.wait_for_selector("[data-testid=video-item]:has-text('(sound).m4a')", timeout=4000)
    check(page.locator("[data-testid=video-item]").count() == 2, "the sound file is listed with the downloads")
    page.locator("[data-testid=video-item]").first.locator("[data-testid=video-open]").click()
    page.wait_for_function("window.__mock.opened.length === 1", timeout=4000)
    check(page.evaluate("window.__mock.opened[0].uri") == "content://media/9", "Play opens the new file by its address")
    check(page.locator("[data-testid=video-item]").first.locator("[data-testid=video-cut]").count() == 0, "a cut file has no Cut button of its own")
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
finish()
