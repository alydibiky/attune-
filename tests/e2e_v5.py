"""v5 end-to-end checks, one section per feature, in a phone-sized Chromium.
Run after tests/setup.sh and web-src/build.sh:  python3 tests/e2e_v5.py [section ...]
"""
import json, sys
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish, HERE

SECTIONS = sys.argv[1:] or ["backup", "arabic", "actions", "speed", "crane"]
env = Env()
errors = []

SEED = r"""
if (!localStorage.getItem('seeded')) {
  localStorage.setItem('seeded', '1');
  localStorage.setItem('attune:chats:v1', JSON.stringify([{ id: 'c1', title: 'Liebherr LTM 1100 rental quote', created: Date.now(), updated: Date.now(),
    messages: [{ id: 'u1', role: 'user', text: 'Quote for Liebherr LTM 1100 secret-marker-123' }, { id: 'a1', role: 'assistant', text: 'About 150,000 EGP.' }] }]));
  localStorage.setItem('ledger.v3', JSON.stringify({ txns: [{ id: 't1', amt: 2500, cur: 'EGP', note: 'fuel' }, { id: 't2', amt: 900, cur: 'EGP', note: 'tea' }] }));
  localStorage.setItem('attune:cycle:v1', JSON.stringify({ days: { '2026-09-01': { flow: 'heavy' } }, settings: { cycleLen: 28, periodLen: 5 }, log: [] }));
}
"""

def open_more(page):
    page.locator("nav button").last.click(); page.wait_for_timeout(200)

def sec_backup(br):
    ctx, page = new_page(br, env, errors, extra_init=SEED)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_more(page)
    tile = page.locator("[data-testid=more-backup]")
    check(tile.count() == 1 and "Never" in tile.inner_text(), "More has a Backup tile that says it was never done")
    tile.click()
    panel = page.locator("[data-testid=backup-panel]")
    check(panel.count() == 1, "Backup & restore opens")
    check("1" in panel.inner_text() and "Chats" in panel.inner_text(), "it shows what will be saved (chats, ledger, cycle…)")
    page.fill("[data-testid=bk-pw]", "short"); page.fill("[data-testid=bk-pw2]", "short")
    page.click("[data-testid=bk-save]")
    check("8 characters" in page.locator("[data-testid=bk-err]").inner_text(), "a short password is refused")
    page.fill("[data-testid=bk-pw]", "Crane-Cairo-2026"); page.fill("[data-testid=bk-pw2]", "Crane-Cairo-2025")
    page.click("[data-testid=bk-save]")
    check("match" in page.locator("[data-testid=bk-err]").inner_text(), "mismatched passwords are refused")
    page.fill("[data-testid=bk-pw2]", "Crane-Cairo-2026")
    page.click("[data-testid=bk-save]")
    page.wait_for_selector("[data-testid=bk-done]", timeout=20000)
    saved = page.evaluate("window.__mock.lastSaved")
    check(saved and saved["name"].startswith("Attune-backup-") and saved["name"].endswith(".attune"), "the file is handed to Android's Save picker: " + (saved or {}).get("name", "?"))
    txt = saved["text"]; head = json.loads(txt)
    check(head["format"] == "attune-backup" and head["kdf"]["iter"] >= 600000 and head["cipher"]["name"] == "AES-GCM", "file is AES-256-GCM with PBKDF2 600k")
    check("secret-marker-123" not in txt and "fuel" not in txt, "no readable data inside the file")
    check(head["summary"]["chats"] == 1 and head["summary"]["ledger"] == 2, "the file's readable summary counts chats and ledger entries")
    orig = page.evaluate("localStorage.getItem('attune:chats:v1')")
    orig_ledger = page.evaluate("localStorage.getItem('ledger.v3')")

    # Picker closed without saving
    page.evaluate("window.__mock.cancelSave = true")
    page.fill("[data-testid=bk-pw]", "Crane-Cairo-2026"); page.fill("[data-testid=bk-pw2]", "Crane-Cairo-2026")
    page.click("[data-testid=bk-save]"); page.wait_for_selector("[data-testid=bk-err]", timeout=20000)
    check("closed the picker" in page.locator("[data-testid=bk-err]").inner_text(), "closing the Save picker is reported, not a crash")
    page.evaluate("window.__mock.cancelSave = false")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=backup-panel]").count() == 0, "Back closes the backup screen")
    open_more(page)
    check("today" in page.locator("[data-testid=more-backup]").inner_text(), "the tile now says Backed up today")
    page.locator("[data-testid=more-backup]").click()

    # Lose everything, then restore.
    page.evaluate("""() => { const keep = localStorage.getItem('seeded'); localStorage.clear(); localStorage.setItem('seeded', keep);
      localStorage.setItem('attune:onboarded','1'); localStorage.setItem('attune:chats:v1','[]'); }""")
    page.locator("[data-testid=backup-panel] button:has-text('Restore')").first.click()
    page.set_input_files("[data-testid=bk-file]", files=[{"name": saved["name"], "mimeType": "application/octet-stream", "buffer": txt.encode()}])
    page.wait_for_selector("[data-testid=rs-pw]", timeout=5000)
    check(saved["name"] in panel.inner_text() and "Made on" in panel.inner_text(), "restore shows the file's date and contents before the password")
    page.fill("[data-testid=rs-pw]", "wrong-password")
    page.click("[data-testid=rs-unlock]"); page.wait_for_selector("[data-testid=bk-err]", timeout=20000)
    check("Wrong password" in page.locator("[data-testid=bk-err]").inner_text(), "a wrong password is refused clearly")
    page.fill("[data-testid=rs-pw]", "Crane-Cairo-2026"); page.click("[data-testid=rs-unlock]")
    page.wait_for_selector("[data-testid=rs-restore]", timeout=20000)
    page.click("[data-testid=rs-restore]")
    check(page.locator("[data-testid=rs-confirm]").count() == 1, "restore asks for a second confirmation")
    with page.expect_navigation(timeout=10000):
        page.click("[data-testid=rs-confirm]")
    page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(300)
    check(page.evaluate("localStorage.getItem('attune:chats:v1')") == orig, "chats are back exactly")
    check(page.evaluate("localStorage.getItem('ledger.v3')") == orig_ledger, "the Money ledger is back exactly")
    page.locator("header button[aria-label='Chats']").click(); page.wait_for_timeout(300)
    check(page.locator("text=Liebherr LTM 1100 rental quote").count() >= 1, "the restored chat shows in the history drawer")
    page.evaluate("window.__attuneBack()")

    # Undo
    open_more(page); page.locator("[data-testid=more-backup]").click()
    page.locator("[data-testid=backup-panel] button:has-text('Restore')").first.click()
    check(page.locator("[data-testid=rs-undo]").count() == 1, "an Undo button appears after a restore")
    with page.expect_navigation(timeout=10000):
        page.click("[data-testid=rs-undo]")
    page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("localStorage.getItem('attune:chats:v1')") == "[]", "Undo puts back what was on the phone before the restore")
    ctx.close()

    # Merge mode keeps what the phone has
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.evaluate("""() => { localStorage.setItem('attune:chats:v1', JSON.stringify([{ id: 'c9', title: 'phone-only chat', created: 1, updated: 2, messages: [] }]));
      localStorage.setItem('ledger.v3', JSON.stringify({ txns: [{ id: 'p1', amt: 1, note: 'phone ledger' }] })); }""")
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_more(page); page.locator("[data-testid=more-backup]").click()
    page.locator("[data-testid=backup-panel] button:has-text('Restore')").first.click()
    page.set_input_files("[data-testid=bk-file]", files=[{"name": "b.attune", "mimeType": "application/octet-stream", "buffer": txt.encode()}])
    page.fill("[data-testid=rs-pw]", "Crane-Cairo-2026"); page.click("[data-testid=rs-unlock]")
    page.wait_for_selector("[data-testid=rs-restore]", timeout=20000)
    page.locator("label:has-text('Merge') input").check()
    page.click("[data-testid=rs-restore]")
    with page.expect_navigation(timeout=10000):
        page.click("[data-testid=rs-confirm]")
    page.wait_for_selector("nav", timeout=15000)
    chats = json.loads(page.evaluate("localStorage.getItem('attune:chats:v1')"))
    check(sorted(c["id"] for c in chats) == ["c1", "c9"], "Merge joins the chats: phone's and backup's (%s)" % [c["id"] for c in chats])
    check("phone ledger" in page.evaluate("localStorage.getItem('ledger.v3')"), "Merge never overwrites the phone's own Money ledger")
    # Not-a-backup file
    open_more(page); page.locator("[data-testid=more-backup]").click()
    page.locator("[data-testid=backup-panel] button:has-text('Restore')").first.click()
    page.set_input_files("[data-testid=bk-file]", files=[{"name": "photo.jpg", "mimeType": "image/jpeg", "buffer": b"\xff\xd8\xff garbage"}])
    page.wait_for_selector("[data-testid=bk-err]", timeout=5000)
    check("not an Attune backup" in page.locator("[data-testid=bk-err]").inner_text(), "a wrong file is refused before asking for the password")
    ctx.close()


LATIN = r"""() => { const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); const el = n.parentElement;
    if (!t || !el || el.closest('[data-i18n-skip],textarea,script,style')) continue; const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
    const words = (t.match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^(Attune|Pro|Qwen|Gemma|GGUF|InstaPay|Yusr|ChatGPT|Claude|Gemini|English|Brave|DuckDuckGo|KV|SHA|CPU|GPU|NPU|NEON|dotprod|KleidiAI|int8|matmul|Test|Phone|SM8650|imatrix|MoE|mmap|INT4|Vulkan|EGP|USD)$/.test(w));
    if (words.length) out.push(t.slice(0, 80)); } return out; }"""

def sec_arabic(br):
    ctx, page = new_page(br, env, errors, extra_init="if(!sessionStorage.getItem('l')){sessionStorage.setItem('l',1);localStorage.setItem('ledger.v3', JSON.stringify({lang:'en', txns:[]}));}")
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("document.documentElement.dir") == "ltr", "English is the default, left-to-right")
    open_more(page)
    sw = page.locator("[data-testid=lang-switch]")
    check(sw.count() == 1, "More has the English | العربية switch")
    with page.expect_navigation(timeout=10000):
        sw.locator("button[data-lang=ar]").click()
    page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(300)
    check(page.evaluate("document.documentElement.dir") == "rtl" and page.evaluate("document.documentElement.lang") == "ar", "Arabic turns the whole page right-to-left")
    nav = page.locator("nav button")
    labels = [nav.nth(i).inner_text().strip() for i in range(nav.count())]
    check(labels[0] == "المحادثة" and labels[-1] == "المزيد" and "المال" in labels, "bottom bar is in Arabic: %s" % labels)
    b0 = nav.nth(0).bounding_box(); b4 = nav.nth(nav.count() - 1).bounding_box()
    check(b0["x"] > b4["x"], "and it reads from the right (Chat is on the right)")
    check(page.locator("textarea[placeholder='راسل Attune']").count() == 1, "the message box says راسل Attune")
    check(json.loads(page.evaluate("localStorage.getItem('ledger.v3')"))["lang"] == "ar", "Yusr (Money) switches to Arabic too")
    latin = page.evaluate(LATIN)
    check(len(latin) == 0, "no English left on the home screen: %s" % latin[:5])
    page.screenshot(path=HERE + "/v5-ar-home.png")
    page.locator("header button").filter(has_text="لا يوجد نموذج").first.click(); page.wait_for_timeout(300)
    latin = page.evaluate(LATIN)
    check(len(latin) <= 3, "Engine screen is in Arabic (only model/tech names left): %s" % latin[:6])
    page.screenshot(path=HERE + "/v5-ar-engine.png", full_page=False)
    rec = page.locator("text=المُوصى به لهذا الجهاز").locator("xpath=..")
    rec.get_by_role("button", name="تثبيت").first.click()
    page.wait_for_selector("text=يعمل الآن", timeout=10000)
    check(True, "installing a model works in Arabic")
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    # a chat still works
    page.evaluate("window.__mock.fake = 'الإجمالي **171,000 جنيه**.'")
    page.locator("textarea").last.fill("3 أوناش × 4 أيام × 12,500 + 14% ضريبة؟")
    page.locator("button[title='إرسال']").click()
    page.wait_for_selector("text=171,000 جنيه", timeout=20000)
    page.wait_for_timeout(800); page.screenshot(path=HERE + "/dbg.png")
    check(page.locator("button[title='أعِد التوليد']").count() >= 1, "chatting works in Arabic, with Arabic answer buttons")
    page.screenshot(path=HERE + "/v5-ar-chat.png")
    open_more(page)
    latin = page.evaluate(LATIN)
    check(len(latin) <= 1, "More sheet is in Arabic: %s" % latin[:5])
    page.screenshot(path=HERE + "/v5-ar-more.png")
    page.locator("[data-testid=more-backup]").click(); page.wait_for_timeout(200)
    check("النسخ الاحتياطي والاسترجاع" in page.locator("[data-testid=backup-panel]").inner_text(), "Backup screen is in Arabic")
    page.screenshot(path=HERE + "/v5-ar-backup.png")
    page.evaluate("window.__attuneBack()")
    for i, name in ((1, "instant"), (3, "cycle-or-memory")):
        nav.nth(i).click(); page.wait_for_timeout(400)
        latin = page.evaluate(LATIN)
        check(len(latin) <= 2, "%s screen is in Arabic: %s" % (name, latin[:5]))
    page.screenshot(path=HERE + "/v5-ar-instant.png")
    # back to English
    open_more(page)
    with page.expect_navigation(timeout=10000):
        page.locator("[data-testid=lang-switch] button[data-lang=en]").click()
    page.wait_for_selector("nav", timeout=15000)
    check(page.evaluate("document.documentElement.dir") == "ltr" and page.locator("nav button:has-text('Chat')").count() == 1, "switching back to English restores everything")
    ctx.close()
    # first run offers the language
    ctx, page = new_page(br, env, errors, extra_init="localStorage.removeItem('attune:onboarded')")
    page.goto(env.url); page.wait_for_timeout(1500)
    check(page.locator("[data-testid=lang-switch]").count() >= 1, "the first-run welcome offers English | العربية")
    ctx.close()

SECTION_FUNCS = {"backup": sec_backup, "arabic": sec_arabic}

with sync_playwright() as pw:
    br = pw.chromium.launch()
    for s in SECTIONS:
        f = SECTION_FUNCS.get(s)
        if not f: continue
        print(f"--- {s}", flush=True)
        try: f(br)
        except Exception as e:
            check(False, f"{s} section crashed: {str(e)[:300]}")
    br.close()
env.close()
re_ = real_errors(errors)
for e in re_[:20]: print("   ", e)
check(len(re_) == 0, "no JavaScript errors in the page (%d)" % len(re_))
finish()
