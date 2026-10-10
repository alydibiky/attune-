"""v5.38 — Video Downloader: paste / share a link → pick the quality → Android downloads it.
YouTube & co. are refused by name; a web page's versions, archive.org, a direct link, progress, Play.

  python3 tests/e2e_v538.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

env = Env(); errors = []

PAGE = """<html><head><meta property="og:title" content="Tower crane assembly"></head><body><video>
<source src="/m/tower_1080p.mp4" type="video/mp4"><source src="/m/tower_720p.mp4" type="video/mp4"></video><a href="/m/talk.mp3">audio</a></body></html>"""
META = {"metadata": {"title": "Old crane film"}, "files": [{"name": "crane.mp4", "format": "h.264", "size": "50000000", "height": "480"}, {"name": "crane.mp3", "format": "VBR MP3", "size": "9000000"}]}

NATIVE = """((page, meta) => { const N = window.AttuneNative, S = window.__mock;
  const R = (id, v) => setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify(v)), 20);
  S.vcalls = []; S.vstat = {};
  N.videoProbe = (id, arg) => { const a = JSON.parse(arg); S.vcalls.push(['probe', a.url]);
    if (/\\.mp4$/.test(a.url)) R(id, { url: a.url, type: 'video/mp4', size: /1080/.test(a.url) ? 300000000 : /720/.test(a.url) ? 150000000 : 42000000, name: '' });
    else if (/\\.mp3$/.test(a.url)) R(id, { url: a.url, type: 'audio/mpeg', size: 8000000, name: '' });
    else R(id, { url: a.url, type: 'text/html', size: 0, name: '' }); };
  N.videoGet = (id, arg) => { const a = JSON.parse(arg); S.vcalls.push(['get', a.url]);
    R(id, { url: a.url, type: 'text/html', text: /archive\\.org\\/metadata/.test(a.url) ? JSON.stringify(meta) : page }); };
  N.videoDownload = (id, arg) => { const a = JSON.parse(arg); S.vcalls.push(['download', a]); const n = 100 + S.vcalls.length; S.vstat[n] = 0;
    R(id, { id: n, where: 'Movies/Attune/' + a.name, name: a.name }); };
  N.videoStatus = (id, arg) => { const a = JSON.parse(arg);
    R(id, { items: a.ids.map((i) => { S.vstat[i] = (S.vstat[i] || 0) + 1; const k = S.vstat[i]; return { id: i, status: k >= 3 ? 'done' : 'running', done: k >= 3 ? 150000000 : 75000000, total: 150000000 }; }) }); };
  N.videoOpen = (id, arg) => { S.vcalls.push(['open', JSON.parse(arg).id]); R(id, { ok: true }); };
  N.videoCancel = (id, arg) => R(id, { ok: true });
  N.clipboardText = (id) => R(id, { text: 'Look at this 👉 https://files.example.com/lift_demo.mp4' });
})"""

def open_tool(page, label="Video Downloader"):
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('%s')" % label).first.click()
    page.wait_for_selector("[data-testid=video]", timeout=5000)

def find(page, url):
    page.fill("[data-testid=video-link]", url); page.locator("[data-testid=video-find]").click()

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate(NATIVE + "(%s, %s)" % (json.dumps(PAGE), json.dumps(META)))
    open_tool(page)

    # ---- 1. YouTube is refused by name, nothing is fetched ----
    find(page, "https://youtu.be/dQw4w9WgXcQ")
    e = page.locator("[data-testid=video-error]").inner_text()
    check("YouTube doesn't allow" in e and "Google Drive" in e and page.evaluate("window.__mock.vcalls.length") == 0, "a YouTube link: a clear refusal naming YouTube and what works instead")

    # ---- 2. a web page: every version, best first, with sizes ----
    find(page, "https://news.example.com/story/7")
    page.wait_for_selector("[data-testid=video-found]", timeout=8000)
    rows = [page.locator("[data-testid=video-q-%d]" % i).inner_text().replace("\n", " ") for i in range(page.locator("[data-testid^=video-q-]").count())]
    check(len(rows) == 3 and rows[0].startswith("1080p") and "300 MB" in rows[0] and rows[1].startswith("720p") and rows[2].startswith("Audio only"), "the page's versions: 1080p 300 MB, 720p, audio only (%s)" % rows)
    check(page.locator("[data-testid=video-title]").inner_text() == "Tower crane assembly", "the video's title")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=video-found]").count() == 0, "Back closes the list of versions")
    page.locator("[data-testid=video-find]").click(); page.wait_for_selector("[data-testid=video-found]", timeout=8000)
    page.locator("[data-testid=video-q-1]").click(); page.locator("[data-testid=video-download]").click()
    page.wait_for_selector("[data-testid=video-item]", timeout=5000)
    d = page.evaluate("window.__mock.vcalls.filter(c => c[0] === 'download').pop()[1]")
    check(d["url"] == "https://news.example.com/m/tower_720p.mp4" and d["name"] == "Tower crane assembly 720p.mp4" and d["audio"] is False, "the 720p file is handed to Android as 'Tower crane assembly 720p.mp4'")
    page.wait_for_selector("text=50%", timeout=5000)
    check("50%" in page.locator("[data-testid=video-progress]").inner_text(), "progress is shown (50% · 75 MB / 150 MB)")
    page.wait_for_selector("[data-testid=video-open]", timeout=8000)
    page.locator("[data-testid=video-open]").click(); page.wait_for_timeout(150)
    check(page.evaluate("window.__mock.vcalls.some(c => c[0] === 'open')"), "when it's done, Play opens the video")

    # ---- 3. archive.org ----
    find(page, "https://archive.org/details/old_crane_film")
    page.wait_for_selector("[data-testid=video-found]", timeout=8000)
    check(page.locator("[data-testid=video-title]").inner_text() == "Old crane film" and page.locator("[data-testid^=video-q-]").count() == 2, "archive.org: the film's video and audio versions")
    page.locator("[data-testid=video-q-1]").click(); page.locator("[data-testid=video-download]").click(); page.wait_for_timeout(200)
    d = page.evaluate("window.__mock.vcalls.filter(c => c[0] === 'download').pop()[1]")
    check(d["audio"] is True and d["name"] == "Old crane film.mp3", "audio only is saved as an .mp3 (to Music)")

    # ---- 4. Paste: the link is taken out of the copied text and found at once ----
    page.locator("[data-testid=video-paste]").click()
    page.wait_for_selector("[data-testid=video-found]", timeout=8000)
    check(page.input_value("[data-testid=video-link]").endswith("lift_demo.mp4") and "42 MB" in page.locator("[data-testid=video-found]").inner_text(), "Paste finds the link in the copied text and the file's size")

    # ---- 5. free limit: 3 a day ----
    page.evaluate("localStorage.setItem('attune:testing-pro', 'off')")
    page.locator("[data-testid=video-download]").click(); page.wait_for_timeout(300)
    check(page.evaluate("window.__mock.vcalls.filter(c => c[0] === 'download').length") == 3, "a third download goes through (free: 3 a day)")

    # ---- 6. a video link shared to Attune opens the downloader ----
    page.locator("nav button").first.click(); page.wait_for_timeout(200)
    page.evaluate("window.dispatchEvent(new MessageEvent('attune-share', { data: { kind: 'share', text: 'https://cdn.example.org/clips/boom_720p.mp4' } }))")
    page.wait_for_selector("[data-testid=video-found]", timeout=8000)
    check("720p" in page.locator("[data-testid=video-q-0]").inner_text(), "a shared video link opens the downloader with its quality")

    # ---- 7. Arabic ----
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    page.evaluate(NATIVE + "(%s, %s)" % (json.dumps(PAGE), json.dumps(META)))
    open_tool(page, "تنزيل الفيديوهات")
    find(page, "https://www.tiktok.com/@a/video/1")
    check("لا يسمح" in page.locator("[data-testid=video-error]").inner_text(), "the refusal in Arabic")
    check(len(page.locator("[data-testid=video-item]").all()) >= 2, "the downloads list is kept")
    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
