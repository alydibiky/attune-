"""v8.5 — Ali (27 Oct): "why not get all the information from reputable sites … or YouTube videos — quality, not quantity".
"Lynk & Co 900 specs" → the trusted sites are asked first (site:auto-data.net …), a YouTube review's transcript is read, and under
the answer code writes one column per version (copied from the spec pages) and the Egyptian prices (from the price site).
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v850trusted.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def spec(hp, acc, top):
    return {"title": "Lynk & Co 900 2.0T EM-P (%d Hp) Plug-in Hybrid AWD | Technical specs, data, fuel consumption" % hp, "url": "https://www.auto-data.net/en/lynk-co-900-%d" % hp,
            "text": "Lynk & Co 900 specs\nPowertrain Architecture | Plug-in hybrid\nAcceleration 0 - 100 km/h | %s sec\nMaximum speed | %d km/h\nSystem power | %d Hp\nSystem torque | 1000 Nm\nGross battery capacity | 52.3 kWh\nLength | 5240 mm\nWidth | 1999 mm\nHeight | 1810 mm\nWheelbase | 3160 mm\nSeats | 6\nDrive wheel | All wheel drive (4x4)" % (acc, top, hp)}
PRICE = {"title": "Lynk & Co 900 2026 prices in Egypt", "url": "https://eg.hatla2ee.com/en/new-car/lynk-co/900", "text": "Lynk & Co 900 prices\nTrim | Price\nLynk & Co 900 Halo | EGP 3,250,000\nLynk & Co 900 Ultra | EGP 3,650,000"}
VID = [{"title": "Lynk & Co 900 review: the best PHEV SUV? - YouTube", "url": "https://www.youtube.com/watch?v=abcdefghijk", "source": "youtube",
        "text": "The Lynk & Co 900 is huge inside. The third row fits adults. The ride is soft but the steering is light. " * 6}]
SEARCH = """(() => { const N = window.AttuneNative; const S = window.__s = { log: [], vids: [] };
  const all = %s, price = %s, vid = %s;
  N.search = (id, arg) => { const a = JSON.parse(arg); S.log.push(a.q);
    const hits = /site:auto-data/.test(a.q) ? all : /site:hatla2ee/.test(a.q) ? [price] : /site:/.test(a.q) ? [] : [{ title: "Lynk & Co 900 news", url: "https://news.example.com/lynk-co-900", text: "Lynk & Co 900 is a big Chinese SUV made by Geely. It is sold in China and Europe." }];
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ via: "duckduckgo", why: "", hits })), 30); };
  N.videoReviews = (id, arg) => { S.vids.push(JSON.parse(arg).q); setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ hits: vid })), 30); };
})();""" % (json.dumps([spec(884, "4.3", 240), spec(734, "4.6", 240)]), json.dumps(PRICE), json.dumps(VID))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    page.evaluate(SEARCH)
    page.locator("button:has-text('Web')").first.click()
    page.evaluate("() => { const M = window.__mock; M.fakeQueue = ['## Overview\\nThe Lynk & Co 900 is a large Chinese plug-in hybrid SUV by Geely [3].\\n\\n## What reviewers say\\nThe YouTube reviewer says the third row fits adults [5].']; }")
    page.locator("textarea[placeholder='Message Attune']").fill("Lynk & Co 900 specs")
    page.locator("button[title='Send']").first.click()
    page.wait_for_selector("button[title='Regenerate']", timeout=40000)
    log = page.evaluate("window.__s")
    check(log["log"][1].startswith("site:auto-data.net") and any("site:hatla2ee.com" in q for q in log["log"]), "the trusted spec and price sites are asked first: %s" % log["log"][:6])
    check(log["vids"] == ["Lynk & Co 900 review"], "YouTube reviews looked for: %s" % log["vids"])
    sent = page.evaluate("JSON.stringify(window.__mock.lastPrompt || window.__mock.prompts || '')")
    md = page.locator(".att-md").last
    t = md.inner_text()
    check("Specs by version" in t, "a 'Specs by version' table under the answer, built by code")
    tbl = md.locator("table").filter(has_text="Specs by version").first if False else md.locator("table").first
    hdr = tbl.locator("th").all_inner_texts()
    check(len(hdr) == 3 and "884 Hp" in hdr[1] and "734 Hp" in hdr[2], "one column per version: %s" % hdr)
    pw = [r for r in (x.locator("td").all_inner_texts() for x in tbl.locator("tr").all()) if r and r[0] == "Power"][0]
    check(pw[1:] == ["884 Hp", "734 Hp"], "power copied exactly per version: %s" % pw)
    check("Prices in Egypt" in t and "EGP 3,250,000" in t and "hatla2ee" in t, "the Egyptian prices from the price site, copied exactly")
    check("YouTube review" in page.inner_text("body") or "youtube.com" in json.dumps(page.evaluate("JSON.parse(localStorage.getItem('attune:chats:v1')||'[]')")), "the YouTube review is one of the sources")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    br.close()
env.close()
finish()
