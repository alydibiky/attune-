"""v8.2/8.3 — Ali's three picks (26 Oct 2026): 1A Follow-ups = one list by day (People & plans, reminders, dates, Guardian) with chips,
an Add box and a tick for payments; 2A the hotel agent shows its plan and the best 3 offers; 3A the Library — several books, one
question, passages from each book, citations that open the book's own words, follow-ups.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v830.py     (SHOTS=dir for screenshots)
"""
import json, os, re
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
SHOTS = os.environ.get("SHOTS")
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=True)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(300)
AGENT = """(() => { const N = window.AttuneNative; N.agentWatchPlan = () => 'ok'; N.agentWatchTake = () => '{}'; N.appsList = () => '[]';
  let k = 0;
  N.agentOpen = (id, arg) => { const a = JSON.parse(arg); window.__opens = (window.__opens || []).concat([a]); const i = k++;
    const top = [{ price: 41800 + i * 900, currency: 'EGP', name: 'Swissotel Makkah', text: 'Swissotel Makkah 150 m from Masjid al-Haram 9.1' },
                 { price: 43900 + i * 300, currency: 'EGP', name: 'Hilton Suites Makkah', text: 'Hilton Suites Makkah 300 m' },
                 { price: 44600 - i * 10, currency: 'EGP', name: 'Al Safwah Royale Orchid', text: 'Al Safwah Royale Orchid 450 m' }];
    // v8.7: one window reads every start day in turn (rounds) — each offer says which days it was for
    const rs = a.rounds && a.rounds.length ? a.rounds : null;
    const all = rs ? rs.flatMap((r, j) => top.map((o) => ({ ...o, price: o.price + j * 900, checkin: r.checkin, checkout: r.checkout, url: r.url }))) : top;
    setTimeout(() => window.__attuneNative.resolve(id, JSON.stringify({ reason: 'done', offers: 14 * (rs ? rs.length : 1), price: all[0].price, checkin: rs ? rs[0].checkin : undefined, checkout: rs ? rs[0].checkout : undefined, currency: 'EGP', top: all })), 20); };
})();"""
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, legacy_nav=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_timeout(1500)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    page.evaluate(AGENT)

    # ---- 1A Follow-ups: one list by day ----
    page.evaluate("""() => { localStorage.setItem('attune:life:v1', JSON.stringify({ items: [] })); }""")
    go(page, "life", "[data-testid=part-back]")
    page.click("[data-testid=part-back]"); page.wait_for_selector("[data-testid=timeline-page]")
    check(all(page.locator("[data-testid=fu-open-%s]" % x).count() == 1 for x in ["life", "reminders", "radar", "xray", "guardian"]), "Follow-ups (v8.5): its one list opens People & plans · Reminders · Dates · Chat X-Ray · Guardian")
    page.fill("[data-testid=fu-add]", "sheikh owes me 22,000 to be paid in installments monthly for 9 months"); page.click("[data-testid=fu-add-go]"); page.wait_for_timeout(500)
    items = page.locator("[data-testid=timeline-item]")
    check(items.count() >= 1 and "Sheikh" in page.locator("[data-testid=timeline-page]").inner_text(), "one sentence in the Add box → Sheikh's 9 payments are on the list")
    check("2,444" in page.locator("[data-testid=timeline-page]").inner_text(), "each payment is 2,444.44 (22,000 over 9 months)")
    chips = page.locator("[data-testid=fu-chips]").inner_text()
    check(all(w in chips for w in ["All", "Money", "Reminders", "Dates", "Guardian"]), "chips: All · Money · Reminders · Dates · Guardian: " + chips.replace("\n", " "))
    page.click("[data-testid=fu-chip-reminders]"); page.wait_for_timeout(150)
    check(page.locator("[data-testid=timeline-item]").count() == 0, "the Reminders chip hides the payments")
    page.click("[data-testid=fu-chip-all]"); page.wait_for_timeout(150)
    n0 = page.locator("[data-testid=fu-tick]").count()
    page.locator("[data-testid=fu-tick]").first.click(); page.wait_for_selector("[data-testid=life-paybox]")
    check(page.locator("[data-testid=life-pay-amount]").input_value().startswith("2444"), "a tick asks how much Sheikh paid, filled with what was due")
    page.fill("[data-testid=life-pay-amount]", "5000"); page.click("[data-testid=life-pay-go]"); page.wait_for_timeout(300)
    it0 = page.evaluate("JSON.parse(localStorage.getItem('attune:life:v1')).items[0]")
    check(n0 >= 1 and it0["paid"] == [0] and it0.get("got", {}).get("0") == 5000, "paid 5,000 instead of 2,444.44 is kept (%s, %s)" % (it0["paid"], it0.get("got")))
    # People & plans: the entry opens into its schedule, the rest spread again (17,000 over 8 = 2,125)
    page.click("[data-testid=fu-open-life]"); page.wait_for_selector("[data-testid=life-item]")
    page.click("[data-testid=life-open]"); page.wait_for_timeout(150)
    rows = page.locator("[data-testid=life-row]")
    check(rows.count() == 9 and "5,000" in rows.nth(0).inner_text() and "2,125" in rows.nth(1).inner_text() and "17,000" in page.locator("[data-testid=life-item]").inner_text(), "the schedule: payment 1 = 5,000 paid, the 8 left are 2,125 each, 17,000 left")
    check(page.locator("[data-testid=life-moved]").count() == 1, "it says the rest was spread again")
    shot(page, "v830-schedule")
    shot(page, "v830-followups")

    # ---- 2A the hotel agent: its plan, then the best 3 ----
    go(page, "agents", "[data-testid=agents-page]")
    page.fill("[data-testid=agents-input]", "hotel near masjid el haram under 45k for 4 nights from 10 december to january 29, 4 or 5 stars"); page.click("[data-testid=agents-go]"); page.wait_for_timeout(300)
    card = page.locator("[data-testid=agent-watch]")
    clean = lambda t: t.replace("\u2066", "").replace("\u2069", "")
    check(card.count() == 1 and "4 nights between 2026-12-10 and 2027-01-29" in clean(card.inner_text()) and "only 4–5★, within 1 km" in clean(card.inner_text()), "the card says 4 nights between 10 Dec and 29 Jan, only 4–5★ within 1 km: " + card.inner_text()[:160].replace("\n", " · "))
    check("6 start days checked" in clean(page.locator("[data-testid=agent-plan]").inner_text()), "its plan, step by step")
    page.click("[data-testid=agent-check]"); page.wait_for_selector("[data-testid=agent-best3]", timeout=8000)
    opens = page.evaluate("window.__opens")
    rounds = (opens[0].get("rounds") or []) if len(opens) == 1 else []
    check(len(opens) == 1 and len(rounds) == 6 and all("nflt=class%3D4%3Bclass%3D5" in r["url"] for r in rounds) and all(r.get("checkin") for r in rounds), "Check now reads each of the 6 start days with the stars filter, in one window (no flicker)")
    best = page.locator("[data-testid=agent-best]")
    check(best.count() == 3 and "Swissotel" in best.nth(0).inner_text() and "41,800" in best.nth(0).inner_text(), "the best 3, cheapest first, one per hotel with its days: " + best.nth(0).inner_text()[:100].replace("\n", " · "))
    check("offers compared" in page.locator("[data-testid=agent-plan]").inner_text(), "the plan says how many offers were compared")
    best.nth(0).locator("[data-testid=agent-best-skip]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=agent-best]").count() == 2 and "Swissotel" not in page.locator("[data-testid=agent-best3]").inner_text(), "Not this one takes it off")
    shot(page, "v830-agent")

    # ---- 3A the Library ----
    go(page, "booklib", "[data-testid=booklib-page]")
    check("stays" in page.locator("[data-testid=booklib-private]").inner_text() or "never leave" in page.locator("[data-testid=booklib-private]").inner_text(), "it says the books stay on the phone")
    filler = "\n\n".join("The caliphate collected taxes and built roads in the provinces, part %d." % i for i in range(30))
    b1 = filler + "\n\nIn 1260 the Mamluks under Qutuz and Baybars defeated the Mongols at Ain Jalut in Palestine. The Mongol army was about 10,000 men.\n\n" + filler
    b2 = "At Ain Jalut in 1260 the Mamluk sultan Qutuz stopped the Mongol advance; the Mongol force numbered some 20,000.\n\n" + filler
    page.set_input_files("[data-testid=booklib-file]", files=[{"name": "hourani.txt", "mimeType": "text/plain", "buffer": b1.encode()}, {"name": "lapidus.txt", "mimeType": "text/plain", "buffer": b2.encode()}])
    page.wait_for_function("document.querySelectorAll('[data-testid=booklib-book]').length === 2", timeout=10000)
    check(page.locator("[data-testid=booklib-book]").count() == 2, "two books on the shelf, added at once")
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["The Mamluks beat the Mongols at Ain Jalut in 1260 [hourani, p. 2] [lapidus, p. 1].\n\n### Where the books disagree\nhourani: about 10,000 Mongols [hourani, p. 2]; lapidus: about 20,000 [lapidus, p. 1]."])
    page.fill("[data-testid=booklib-input]", "What happened at the Battle of Ain Jalut?"); page.click("[data-testid=booklib-send]")
    page.wait_for_selector("[data-testid=booklib-a]", timeout=20000)
    sent = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => b.messages[b.messages.length - 1].content).join('\\n')")
    pg = re.findall(r"\[(hourani|lapidus), p\. (\d+)\]\n[^\[]*Ain Jalut", sent)
    check({x[0] for x in pg} == {"hourani", "lapidus"}, "the model reads the Ain Jalut page of BOTH books, each labelled [Book, p. N]: %s" % pg)
    check(page.locator("[data-testid=booklib-differ]").count() == 1, "'Where the books disagree' has its own box")
    page.locator("[data-testid=booklib-cite]").nth(1).click(); page.wait_for_timeout(150)
    check("20,000" in page.locator("[data-testid=booklib-quote]").inner_text(), "a citation opens the book's own words")
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["Because Qutuz attacked first [lapidus, p. 1]."])
    page.fill("[data-testid=booklib-input]", "and why did they lose?"); page.click("[data-testid=booklib-send]")
    page.wait_for_function("document.querySelectorAll('[data-testid=booklib-a]').length === 2", timeout=20000)
    sent2 = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => JSON.stringify(b.messages)).join('\\n')")
    check("Ain Jalut" in sent2 and "lapidus" in sent2, "a follow-up keeps the topic (the earlier question and the books' passages go with it)")
    # Read deeper: more pages per book in rounds (notes with citations), then one compared answer
    page.click("[data-testid=booklib-deep]")
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = a; }", ["- 10,000 Mongols [hourani, p. 2]", "- 20,000 Mongols [lapidus, p. 1]", "The books give 10,000 and 20,000 [hourani, p. 2] [lapidus, p. 1]."])
    page.fill("[data-testid=booklib-input]", "How big was the Mongol army at Ain Jalut?"); page.click("[data-testid=booklib-send]")
    page.wait_for_function("document.querySelectorAll('[data-testid=booklib-a]').length === 3", timeout=30000)
    calls = page.evaluate("window.__mock.bodies.filter((b) => b.max_tokens > 2).map((b) => b.messages[0].content.slice(0, 40))")
    check(len(calls) >= 2 and any("take notes" in c for c in calls), "Read deeper reads in rounds (notes), then answers: %d calls" % len(calls))
    shot(page, "v830-library")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
