"""v9.9.18 M3 (Ali picked A — a group with settle-up), his mock-up example: Sahel trip, 4 people — you paid the villa 6,000, Nada the
food 1,800, Omar the fuel 1,200 → 9,000, 2,250 each → 3 payments: Karim pays you 2,250, Omar pays you 1,050, Nada pays you 450.
A dinner 300 shared by Nada and Omar only, paid by Omar → Nada owes 150 more. Share on WhatsApp carries the summary; Settled clears it.
Opens from Money → More. Arabic names with «و» too.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v9918groups.py
"""
import json, urllib.parse
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
INIT = "try{localStorage.setItem('attune:start','home')}catch(e){}"
def add(page, what, amount, payer, shared=None):
    page.click("[data-testid=group-add]"); page.fill("[data-testid=gexp-what]", what); page.fill("[data-testid=gexp-amount]", amount)
    page.locator("[data-testid=gexp-payer] button", has_text=payer).first.click()
    if shared is not None:
        for b in page.locator("[data-testid=gexp-shared] button").all():
            if (b.inner_text() in shared) != (b.get_attribute("aria-pressed") == "true"): b.click()
    page.click("[data-testid=gexp-save]"); page.wait_for_timeout(200)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844}); page.goto(env.url); page.wait_for_timeout(1200)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'money'}}))"); page.wait_for_selector("[data-testid=money-bar]", timeout=10000); page.wait_for_timeout(800)
    page.click("[data-testid=money-more]"); page.click("[data-testid=money-more-split]"); page.wait_for_selector("[data-testid=groups-page]", timeout=6000)
    check(True, "Money → More → Split with anyone opens the groups page")
    page.click("[data-testid=group-new]"); page.fill("[data-testid=group-name]", "Sahel trip"); page.fill("[data-testid=group-people]", "Nada, Omar, Karim"); page.fill("[data-testid=group-cur]", "EGP")
    page.click("[data-testid=group-create]"); page.wait_for_selector("[data-testid=group-page]")
    add(page, "Villa", "6000", "You"); add(page, "Food", "1,800", "Nada"); add(page, "Fuel", "١٢٠٠", "Omar")
    check("4 people · total 9,000 egp" in page.locator("[data-testid=group-expenses]").inner_text().lower(), "4 people · total 9,000 (Arabic digits read too)")
    pays = [x.inner_text().replace("→", "").strip() for x in page.locator("[data-testid=group-pay]").all()]
    check(pays == ["Karim pays you 2,250 EGP", "Omar pays you 1,050 EGP", "Nada pays you 450 EGP"], "3 payments, fewest: " + str(pays))
    add(page, "Dinner", "300", "Omar", shared=["Nada", "Omar"])
    pays = [x.inner_text().replace("→", "").strip() for x in page.locator("[data-testid=group-pay]").all()]
    check("Nada pays you 600 EGP" in pays and "Omar pays you 900 EGP" in pays and "Karim pays you 2,250 EGP" in pays, "a dinner shared by Nada and Omar only, paid by Omar: Nada 600, Omar 900: " + str(pays))
    href = page.get_attribute("[data-testid=group-share]", "href"); txt = urllib.parse.unquote(href.split("text=", 1)[1])
    check(href.startswith("https://wa.me/?text=") and "Sahel trip" in txt and "Karim pays you 2,250" in txt and "Dinner: 300" in txt, "Share on WhatsApp carries the summary")
    page.click("[data-testid=group-settled]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=group-exp]").count() == 0 and "everyone is even" in page.locator("[data-testid=group-settle]").inner_text().lower(), "Settled → the group starts fresh")
    g = page.evaluate("JSON.parse(localStorage.getItem('attune:groups:v1')).groups[0]")
    check(len(g["log"]) == 1 and "Karim" in g["log"][0]["text"], "…and the old summary is kept in the group's history")
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_timeout(1500)
    page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'split'}}))"); page.wait_for_selector("[data-testid=groups-page]")
    page.click("[data-testid=group-new]"); page.fill("[data-testid=group-name]", "الشقة"); page.fill("[data-testid=group-people]", "أحمد و محمود"); page.click("[data-testid=group-create]")
    page.wait_for_selector("[data-testid=group-page]")
    add(page, "إيجار", "9000", "أحمد")
    t = page.locator("[data-testid=group-settle]").inner_text()
    check("3 أشخاص" in page.locator("[data-testid=group-expenses]").inner_text() and "يدفع لـ أحمد" in t and "3,000" in t, "Arabic: «أحمد و محمود» = 2 people + you; you and Mahmoud each pay Ahmed 3,000: " + t.replace("\n", " "))
    check(real_errors(errors) == [], "no page errors: " + str(real_errors(errors)[:3]))
    br.close()
env.close(); finish()
