"""v6.17 — Knowledge packs (Ali: "the knowledge packs does not get downloaded it keeps loading only"; "it is not professional
to tell them the exact sources for each pack").
  - a download that stops moving is stopped (Stop sent to the phone) and says so on its card — no endless bar;
  - a download that moves shows % and MB, then the pack is ready;
  - the cards describe what a pack does, without naming providers; the credits the licences ask for are in one list.
  python3 tests/e2e_v732packdl.py
"""
import re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish

env = Env(); errors = []
INIT = r"""
(() => { window.__attuneStallMs = 2500; const S = window.__kp = { installed: [], calls: [], cancels: [] };
  const go = () => { const N = window.AttuneNative; if (!N) return setTimeout(go, 0);
    N.knowPacks = () => JSON.stringify({ packs: S.installed });
    N.knowRemote = (id, a) => setTimeout(() => window.__attuneNative.reject(id, "offline"), 10);
    N.cancel = (id) => S.cancels.push(id);
    N.knowInstall = (id, a) => { const p = JSON.parse(a).id; S.calls.push([id, p]);
      if (p === "math") return;                               // the phone never answers: the stalled line
      [[10, "1.0 / 10.0 MB"], [60, "6.0 / 10.0 MB"]].forEach(([pct, d], i) => setTimeout(() => window.__attuneNative.progress(id, pct, p + ".sqlite.gz", d), 200 * (i + 1)));
      setTimeout(() => { S.installed.push({ id: p, built: "2026-10-11", size: 30e6, installed: true }); window.__attuneNative.resolve(id, JSON.stringify({ id: p, installed: true })); }, 900);
    };
  }; go(); })();"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("nav button").last.click(); page.wait_for_timeout(250)
    page.locator(".rounded-t-2xl button:has-text('Knowledge')").first.click()
    page.wait_for_selector("[data-testid=kn-pack-math]", timeout=6000)

    # ---- the cards: what each pack does, no providers; the credits once, at the bottom
    cards = " ".join(page.locator("[data-testid^=kn-pack-]").all_inner_texts())
    named = [w for w in ["OpenStax", "GeoNames", "World Bank", "openFDA", "MedlinePlus", "OSHA", "MDN", "WordNet", "Tanzil", "CIA", "Wikidata", "Licence"] if w in cards]
    check(not named, "the pack cards name no providers (%s)" % named)
    cr = page.locator("[data-testid=kn-credits]")
    check(cr.count() == 1 and not cr.evaluate("e => e.open"), "one «Sources & licences» list, closed")
    cr.locator("summary").click()
    check("OpenStax" in cr.inner_text() and "CC BY" in cr.inner_text(), "the credits the licences ask for are still there")

    # ---- a stalled download stops and says so
    page.locator("[data-testid=kn-pack-get-math]").click()
    page.wait_for_selector("[data-testid=kn-pack-progress-math]", timeout=2000)
    check("Connecting" in page.locator("[data-testid=kn-pack-progress-math]").inner_text(), "the bar says «Connecting…» before the first bytes")
    page.wait_for_selector("[data-testid=kn-pack-err-math]", timeout=8000)
    check("stopped moving" in page.locator("[data-testid=kn-pack-err-math]").inner_text() and page.locator("[data-testid=kn-pack-progress-math]").count() == 0,
          "after the stall limit the bar goes and the card says the download stopped (no endless loading)")
    calls = page.evaluate("window.__kp.calls"); cancels = page.evaluate("window.__kp.cancels")
    check(calls and calls[0][0] in cancels, "Stop is sent to the phone for that download (%s)" % cancels)
    check(page.locator("[data-testid=kn-pack-get-math]").count() == 1, "Download is offered again (it continues where it stopped)")

    # ---- a moving download: % and MB, then ready
    page.locator("[data-testid=kn-pack-get-physics]").click()
    page.wait_for_function("() => (document.querySelector('[data-testid=kn-pack-progress-physics]') || {}).innerText?.includes('MB')", timeout=3000)
    check("6.0 / 10.0 MB" in page.locator("[data-testid=kn-pack-progress-physics]").inner_text() or "1.0 / 10.0 MB" in page.locator("[data-testid=kn-pack-progress-physics]").inner_text(), "the bar shows % and MB as it moves")
    page.wait_for_selector("[data-testid=kn-pack-rm-physics]", timeout=4000)
    check("ready" in page.locator("[data-testid=kn-pack-physics]").inner_text(), "the pack is ready")

    # ---- a pack the app downloaded by itself shows up as ready while the page is open
    page.evaluate("window.__kp.installed.push({ id: 'history', built: '2026-10-11', size: 8e6, installed: true })")
    page.wait_for_selector("[data-testid=kn-pack-rm-history]", timeout=7000)
    check(True, "a pack downloaded in the background appears as ready without leaving the page")

    check(not real_errors(errors), "no errors (%s)" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
