"""v7.9 — Ali's design round 1 (24 Oct 2026), built: the food photo is design B + A's slice buttons (the dish named "Mango cake" with
a calorie ring, ½ · 1 · 1½ · 2, carbs / protein / fat, the parts under it); Scout is the calm list where ads can be picked and compared
in a table; Automations has ready rules to switch on and takes several of your own at once (one per line).
(Money's tabs: e2e_v790money.py; the guide's life areas: e2e_v731guide.py.)
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v910design.py     (SHOTS=dir for screenshots)
"""
import json, os, subprocess
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
def draw_plate():
    """A drawn plate (eggs on toast, tomato sauce, salad) — the foods sit where the mocked photo reader says."""
    import io
    from PIL import Image, ImageDraw
    im = Image.new("RGB", (800, 600), (122, 98, 80)); d = ImageDraw.Draw(im)
    d.ellipse((130, 30, 670, 570), fill=(244, 243, 239))
    d.rounded_rectangle((220, 170, 420, 340), radius=30, fill=(215, 161, 90), outline=(169, 115, 47), width=10)
    d.rounded_rectangle((380, 140, 570, 310), radius=30, fill=(220, 168, 98), outline=(169, 115, 47), width=10)
    d.ellipse((240, 190, 400, 320), fill=(255, 253, 246)); d.ellipse((295, 230, 345, 280), fill=(242, 178, 42))
    d.ellipse((400, 165, 550, 285), fill=(255, 253, 246)); d.ellipse((450, 200, 500, 250), fill=(242, 178, 42))
    d.ellipse((440, 360, 580, 470), fill=(194, 64, 43))
    for b, c in [((230, 380, 330, 440), (95, 168, 59)), ((290, 410, 390, 470), (62, 138, 44)), ((220, 430, 300, 480), (121, 191, 78))]: d.ellipse(b, fill=c)
    out = io.BytesIO(); im.save(out, "PNG"); return out.getvalue()
PLATE = draw_plate()
PROFILE = json.dumps({"profile": {"sex": "m", "age": 21, "cm": 178, "kg": 92, "activity": "light", "goal": "lose", "rate": 0.5, "goalKg": 80, "diet": "balanced"}, "days": {}, "weights": [], "fast": None, "myRecipes": [], "favs": []})
SHOTS = os.environ.get("SHOTS")
def shot(page, name, full=True):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, name + ".png"), full_page=full)
def go(page, mode, sel):
    page.evaluate("m => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_selector(sel, timeout=8000); page.wait_for_timeout(400)
CAKE = json.dumps({"kind": "meal", "plate": "dessert plate", "items": [{"food": "Cake", "alternatives": ["Mango", "Tres leches cake"], "grams": 80, "confidence": 0.8, "box": [0.3, 0.3, 0.4, 0.3]}], "label": None})
SCOUT = json.loads(subprocess.check_output(["node", "-e", """
import("./web-src/scout.js").then((S) => {
  const g = S.parseGoal("Hyundai Tucson 2022 used");
  const now = Date.now(), ad = (id, title, price, km) => ({ ...S.readAd({ url: "https://www.hatla2ee.com/en/car/details/" + id, title, text: title + " for sale, price " + price + " EGP, 2022, " + km + " km" }, g), lastSeen: now, firstSeen: now });
  const seen = [ad(111, "Hyundai Tucson 2022 GDI", 1450000, "55,000"), ad(222, "Hyundai Tucson 2022 Highline", 1420000, "40,000"), ad(333, "Hyundai Tucson 2022 Turbo", 1550000, "61,000")];
  console.log(JSON.stringify({ goals: [{ id: "g1", text: "Hyundai Tucson 2022 used", g, seen, unseen: [], votes: {}, taste: {}, lastRun: now, on: true }] }));
});"""], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), stderr=subprocess.DEVNULL).decode())
INIT = "try{localStorage.setItem('attune:fit:v1', %s);localStorage.setItem('attune:scout:v1', %s)}catch(e){}" % (json.dumps(PROFILE), json.dumps(json.dumps(SCOUT)))
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init=INIT)
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(250)
    # ---- the food photo: design B + the slice buttons ----
    go(page, "fit", "[data-testid=fit-app]")
    page.evaluate("(a) => { const M = window.__mock; M.bodies = []; M.fakeQueue = [a, JSON.stringify({items: []})]; M.slowQueue = 150; M.codes = []; }", CAKE)
    page.locator("[data-testid=fit-add-breakfast]").click()
    page.set_input_files("[data-testid=fit-photo-input]", {"name": "cake.png", "mimeType": "image/png", "buffer": draw_plate()}); page.wait_for_timeout(300)
    page.locator("[data-testid=fit-read]").click()
    page.wait_for_selector("[data-testid=fit-photo-summary]", timeout=30000); page.wait_for_timeout(400)
    dish = page.locator("[data-testid=fit-photo-dish]").inner_text()
    k1 = int(page.locator("[data-testid=fit-photo-kcal]").inner_text())
    check(dish == "Mango cake" and 250 <= k1 <= 350, "a cake with mango among the guesses is named \"Mango cake\": %s · %d kcal" % (dish, k1))
    check(page.locator("[data-testid=fit-photo-portion-1][class*=acc-2]").count() == 1 and "slice" in page.locator("[data-testid=fit-photo-portions]").inner_text(), "the portion buttons say slices, 1 slice on")
    shot(page, "v910-food-photo")
    page.click("[data-testid=fit-photo-portion-2]"); page.wait_for_timeout(200)
    k2 = int(page.locator("[data-testid=fit-photo-kcal]").inner_text())
    check(abs(k2 - 2 * k1) <= 2 and page.locator("[data-testid=fit-photo-portion-2][class*=acc-2]").count() == 1, "2 slices → twice the calories: %d → %d" % (k1, k2))
    check(page.locator("[data-testid=fit-draft-item]").count() == 1, "…the part it saw is under it, with its own Change")
    # ---- Scout: pick two, compare them in a table ----
    go(page, "scout", "[data-testid=scout-ad]")
    check(page.locator("[data-testid=scout-numbers]").count() == 1 and "1.42M" in page.inner_text("[data-testid=scout-numbers]"), "the goal's numbers: new · cheapest (1.42M) · fair price")
    check(page.locator("[data-testid=scout-checks]").count() == 0, "each ad is one calm row (details on a tap)")
    page.locator("[data-testid=scout-row]").first.click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=scout-checks]").count() == 1 and page.locator("[data-testid=scout-open]").count() == 1, "a tap opens its details and Open the ad")
    page.locator("[data-testid=scout-row]").first.click()
    page.click("[data-testid=scout-select]")
    rows = page.locator("[data-testid=scout-row]"); rows.nth(0).click(); rows.nth(1).click(); page.wait_for_timeout(150)
    check(page.locator("[data-testid=scout-pick]").count() == 3 and page.locator("[data-testid=scout-compare-go]").inner_text().strip().endswith("2"), "Select: tick two ads → Compare 2")
    page.click("[data-testid=scout-compare-go]"); page.wait_for_selector("[data-testid=scout-compare-table]")
    pr = page.locator("[data-testid=scout-cmp-price] td")
    check(pr.count() == 3 and page.locator("[data-testid=scout-cmp-km]").count() == 1, "a table: price, km… side by side")
    check("1,420,000" in page.locator("[data-testid=scout-cmp-price] td.font-black").inner_text(), "…the cheapest marked best")
    shot(page, "v910-scout-compare")
    # ---- Automations: ready rules, and several of your own ----
    go(page, "automations", "[data-testid=auto-page]")
    check(page.locator("[data-testid=auto-ready-rule]").count() == 4, "4 ready rules to switch on")
    page.locator("[data-testid=auto-ready-rule][data-id=salary-save] [data-testid=auto-ready-toggle]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=auto-rule]").count() == 1 and page.locator("[data-testid=auto-ready-rule][data-id=salary-save] [data-testid=auto-ready-toggle]").get_attribute("aria-pressed") == "true", "one tap: Salary → 20% to Savings is on")
    page.fill("[data-testid=auto-text]", "When a bonus arrives, put 50% in Savings\nلما انستاباي يوصل حط 5% في فلوس العربية")
    check(page.locator("[data-testid=auto-draft]").count() == 2 and "2" in page.locator("[data-testid=auto-add]").inner_text(), "two lines → two automations read, Turn on 2")
    page.click("[data-testid=auto-add]"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=auto-rule]").count() == 3, "3 automations on at once")
    shot(page, "v910-automations")
    ctx.close(); br.close()
check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
finish()
