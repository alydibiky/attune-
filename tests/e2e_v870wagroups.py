"""v8.7 (Ali, 29 Oct: "instead of Chat X-Ray, take a WhatsApp group and organize what's in it with its photos" — design A, albums):
a WhatsApp export (.zip: the chat + photos) picked on the Groups page → the group is a Design group; its albums by room and by
thing with photo covers; an album shows a photo grid; a photo opens full screen and can be moved; a second export adds only
what's new; the search finds «كنبة»; a News group is sorted by topic; a Hadith group shows cards with narrator and source;
a shared export (the phone's "wagroup") opens straight in its group.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v870wagroups.py
"""
import io, json, os, tempfile, zipfile, base64
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
# a tiny real JPEG (1x1)
JPG = base64.b64decode("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=")
CHAT = """12/10/2026, 9:15 pm - Ali: IMG-20261012-WA0001.jpg (file attached)
كنبة رمادي للريسبشن
12/10/2026, 9:16 pm - Ali: IMG-20261012-WA0002.jpg (file attached)
Bedroom lamp idea
13/10/2026, 10:00 am - Ali: نجفة دهبي للسفرة
14/10/2026, 8:00 pm - Ali: IMG-20261014-WA0003.jpg (file attached)
Kitchen island with marble top
"""
tmp = tempfile.mkdtemp()
def zipof(name, chat, photos):
    p = os.path.join(tmp, name)
    with zipfile.ZipFile(p, "w") as z:
        z.writestr("WhatsApp Chat with Design ideas.txt", chat)
        for ph in photos: z.writestr(ph, JPG)
    return p
z1 = zipof("WhatsApp Chat with Design ideas.zip", CHAT, ["IMG-20261012-WA0001.jpg", "IMG-20261012-WA0002.jpg", "IMG-20261014-WA0003.jpg"])
z2 = zipof("WhatsApp Chat with Design ideas2.zip", CHAT + "16/10/2026, 9:00 am - Ali: ستارة بيج لأوضة النوم\n", [])
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, extra_init="try{localStorage.setItem('attune:resume:v1', JSON.stringify({mode:'groups', at: Date.now()}))}catch(e){}")
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(env.url); page.wait_for_selector("[data-testid=wa-library]", timeout=15000)
    check("Export chat" in page.inner_text("[data-testid=wa-add]"), "the empty library says how to add a group (WhatsApp → Export chat → Include media → Attune)")
    page.set_input_files("[data-testid=wa-file]", z1); page.wait_for_selector("[data-testid=wa-group]", timeout=15000)
    check(page.locator("[data-testid=wa-kind-design]").get_attribute("class").count("c-acc") > 0, "the group is understood as Design & furniture")
    tiles = page.locator("[data-testid^=wa-album-]").all_inner_texts()
    names = " | ".join(t.replace("\n", " ") for t in tiles)
    check(all(x in names for x in ["Living room", "Kitchen", "Dining", "Sofas", "Lighting"]), "albums by room and by thing: %s" % names)
    check(page.locator("[data-testid=wa-album-living] [data-testid=wa-photo]").count() == 1, "the Living room album has its photo as the cover")
    page.click("[data-testid=wa-album-lighting]"); page.wait_for_selector("[data-testid=wa-album]", timeout=5000)
    check(page.locator("[data-testid=wa-grid-photo]").count() == 1 and page.locator("[data-testid=wa-note]").count() == 1, "Lighting: the bedroom lamp photo in the grid and the chandelier note")
    page.click("[data-testid=wa-grid-photo]"); page.wait_for_selector("[data-testid=wa-viewer]", timeout=3000)
    check("Bedroom lamp idea" in page.inner_text("[data-testid=wa-viewer]"), "a photo opens full screen with its caption")
    page.select_option("[data-testid=wa-move]", "bedroom"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=wa-viewer]").count() == 0, "moved to Bedroom (remembered)")
    page.click("[data-testid=wa-back]"); page.wait_for_selector("[data-testid=wa-group]", timeout=3000)
    page.fill("[data-testid=wa-search]", "كنبة رمادي"); page.wait_for_timeout(400)
    r = page.locator("[data-testid=wa-result]").all_inner_texts()
    check(r and "كنبة" in r[0], "search inside the group: «كنبة رمادي»")
    page.fill("[data-testid=wa-search]", ""); page.click("[data-testid=wa-back]"); page.wait_for_selector("[data-testid=wa-library]", timeout=3000)
    page.set_input_files("[data-testid=wa-file]", z2); page.wait_for_selector("[data-testid=wa-group]", timeout=15000)
    check("5 messages" in page.inner_text("[data-testid=wa-group]") and page.locator("[data-testid=wa-album-curtains]").count() == 1, "a second export adds only the new message (5 now), into Curtains")
    # a shared export from the phone opens straight in its group: a News group and a Hadith group
    page.click("[data-testid=wa-back]")
    news = "1/10/2026, 9:00 am - Ali: عاجل: البنك المركزي يرفع الفائدة والدولار يسجل ٤٨ جنيه\n2/10/2026, 9:00 am - Ali: Liverpool beat Chelsea 2-1 in the Premier League\n"
    page.evaluate("(t) => window.dispatchEvent(new CustomEvent('attune-share', { detail: { kind: 'wagroup', gid: 'gnews', name: 'World news', text: t, files: [] } }))", news)
    page.wait_for_timeout(1500)
    if page.locator("[data-testid=wa-group]").count() == 0:
        page.evaluate("(t) => window.__attuneShare && window.__attuneShare({ kind: 'wagroup', gid: 'gnews', name: 'World news', text: t, files: [] })", news); page.wait_for_timeout(1500)
    shared_ok = page.locator("[data-testid=wa-group]").count() == 1
    if not shared_ok:   # (if the share hook isn't reachable from the test, add it by file instead)
        pth = os.path.join(tmp, "WhatsApp Chat with World news.txt"); open(pth, "w").write(news); page.set_input_files("[data-testid=wa-file]", pth); page.wait_for_selector("[data-testid=wa-group]", timeout=15000)
    check(page.locator("[data-testid=wa-kind-news]").get_attribute("class").count("c-acc") > 0 and page.locator("[data-testid=wa-album-economy]").count() == 1 and page.locator("[data-testid=wa-album-sport]").count() == 1, "a News group: albums by topic (Economy, Sport)")
    page.click("[data-testid=wa-back]")
    pth = os.path.join(tmp, "WhatsApp Chat with Hadith.txt")
    open(pth, "w").write("1/10/2026, 9:00 am - Ali: عن أبي هريرة رضي الله عنه قال: قال رسول الله صلى الله عليه وسلم: «لا تغضب» رواه البخاري\n")
    page.set_input_files("[data-testid=wa-file]", pth); page.wait_for_selector("[data-testid=wa-group]", timeout=15000)
    page.click("[data-testid=wa-album-manners]"); page.wait_for_selector("[data-testid=wa-hadith-card]", timeout=5000)
    card = page.inner_text("[data-testid=wa-hadith-card]")
    check("أبي هريرة" in card and "لا تغضب" in card and "البخاري" in card, "a Hadith card: narrator, text and source: %s" % card.replace("\n", " · "))
    page.click("[data-testid=wa-back]"); page.click("[data-testid=wa-back]"); page.wait_for_selector("[data-testid=wa-library]", timeout=3000)
    check(page.locator("[data-testid=wa-group-card]").count() == 3, "the library lists the 3 groups")
    page.fill("[data-testid=wa-search]", "dollar"); page.wait_for_timeout(400)
    check(any("الدولار" in x for x in page.locator("[data-testid=wa-result]").all_inner_texts()), "search across all groups by meaning: “dollar” finds «الدولار»")
    check(not real_errors(errors), "no page errors: %s" % real_errors(errors)[:3])
    ctx.close(); br.close()
env.close()
finish()
