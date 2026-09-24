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
    const words = (t.match(/[A-Za-z]{3,}/g) || []).filter((w) => !/^(Attune|Pro|Qwen|Gemma|GGUF|InstaPay|Yusr|ChatGPT|Claude|Gemini|English|Brave|DuckDuckGo|KV|SHA|CPU|GPU|NPU|NEON|dotprod|KleidiAI|int8|matmul|Test|Phone|SM8650|imatrix|MoE|mmap|INT4|Vulkan|EGP|USD|Adreno|OpenCL|QUALCOMM)$/.test(w));
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


def fake(o):
    base = {"action": "none", "title": "", "time_text": "", "when": "", "repeat": "none", "minutes": 0, "contact": "", "phone": "", "message": "", "place": ""}
    base.update(o); return base

def sec_actions(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    page.evaluate("window.__attuneBack()"); page.wait_for_timeout(200)
    comp = page.locator("textarea[placeholder='Message Attune']")
    def send(t):
        comp.fill(t); page.locator("button[title='Send']").click()
    card = lambda: page.locator("[data-testid=action-card]").last

    # A. the real engine, with the grammar
    send("remind me tomorrow at 9 to call Ahmed")
    page.wait_for_selector("[data-testid=action-card] >> text=read by the model", timeout=60000)
    gb = page.evaluate("window.__mock.grammarBodies")
    check(gb and "root ::=" in gb[-1]["grammar"] and gb[-1]["chat_template_kwargs"]["enable_thinking"] is False,
          "the request carries a GBNF grammar (and no thinking)")
    check("read by the model" in page.locator("[data-testid=action-card]").last.inner_text(), "the real tiny model answered through the grammar and the app could read its JSON")
    card().locator("[data-testid=act-cancel]").click()
    check("nothing was set" in card().inner_text(), "Cancel sets nothing")
    check(len(page.evaluate("window.__mock.notes")) == 0, "…and nothing was scheduled")

    # B. a reminder, read by the model, time worked out by the app
    page.evaluate("(o) => { window.__mock.fakeJson = o; }", fake({"action": "reminder", "title": "Call Ahmed", "time_text": "tomorrow at 9", "contact": "Ahmed"}))
    send("remind me tomorrow at 9 to call Ahmed")
    page.wait_for_selector("[data-testid=act-when-text]", timeout=15000)
    wt = card().locator("[data-testid=act-when-text]").inner_text()
    check("Tomorrow" in wt and "9:00" in wt, "the card spells out the time: " + wt)
    check(card().locator("[data-testid=act-title]").input_value() == "Call Ahmed", "…and the title")
    card().locator("[data-testid=act-confirm]").click()
    page.wait_for_selector("[data-testid=action-done]", timeout=5000)
    notes = page.evaluate("window.__mock.notes")
    exp = page.evaluate("(() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d.getTime(); })()")
    check(len(notes) == 1 and notes[0]["at"] == exp and notes[0]["title"] == "Call Ahmed", "Set reminder hands it to the phone at exactly tomorrow 09:00")
    check(page.evaluate("JSON.parse(localStorage.getItem('attune:reminders:v1')).length") == 1, "…and it is kept in the page's list (so it's in backups)")

    # C. an alarm in Egyptian Arabic → the Clock app
    page.evaluate("(o) => { window.__mock.fakeJson = o; }", fake({"action": "alarm", "title": "صحيان", "time_text": "الساعة 6 الصبح"}))
    send("صحيني الساعة 6 الصبح")
    page.wait_for_selector("[data-testid=act-confirm]", timeout=15000)
    card().locator("[data-testid=act-confirm]").click(); page.wait_for_timeout(300)
    it = page.evaluate("window.__mock.intents")[-1]
    check(it["kind"] == "alarm" and it["hour"] == 6 and it["minute"] == 0, "صحيني الساعة 6 الصبح → Clock app alarm at 06:00")

    # D. WhatsApp with an Egyptian number
    page.evaluate("(o) => { window.__mock.fakeJson = o; }", fake({"action": "whatsapp", "title": "Mahmoud", "contact": "محمود", "phone": "01001234567", "message": "هتأخر نص ساعة"}))
    send("ابعت لمحمود على الواتساب 01001234567 إني هتأخر نص ساعة")
    page.wait_for_selector("[data-testid=act-phone]", timeout=15000)
    card().locator("[data-testid=act-confirm]").click(); page.wait_for_timeout(300)
    it = page.evaluate("window.__mock.intents")[-1]
    check(it["kind"] == "whatsapp" and it["phone"] == "201001234567" and it["message"] == "هتأخر نص ساعة", "WhatsApp opens for +20 100 123 4567 with the message typed")

    # E. an impossible date from the model is caught
    page.evaluate("(o) => { window.__mock.fakeJson = o; }", fake({"action": "reminder", "title": "The thing", "when": "4888-66-58T98:84"}))
    send("remind me about the thing")
    page.wait_for_selector("[data-testid=act-when]", timeout=15000)
    check(card().locator("[data-testid=act-confirm]").is_disabled(), "a nonsense date from the model can't be confirmed…")
    check("When?" in card().inner_text(), "…and the card asks when")
    card().locator("[data-testid=act-when]").fill(page.evaluate("(() => { const d = new Date(Date.now() + 2*86400000); const p = (n) => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T10:30`; })()"))
    check(not card().locator("[data-testid=act-confirm]").is_disabled(), "picking a date enables it")
    card().locator("[data-testid=act-cancel]").click()

    # F. a timer, and "Just answer"
    page.evaluate("(o) => { window.__mock.fakeJson = o; }", fake({"action": "timer", "title": "Tea", "minutes": 4}))
    send("set a timer for 4 minutes for the tea")
    page.wait_for_selector("[data-testid=act-confirm]", timeout=15000)
    card().locator("[data-testid=act-confirm]").click(); page.wait_for_timeout(300)
    check(page.evaluate("window.__mock.intents")[-1]["seconds"] == 240, "timer: 4 minutes → Clock timer of 240 s")
    page.evaluate("window.__mock.fakeJson = null; window.__mock.fake = 'An alarm clock rings at a set time.'")
    n0 = page.evaluate("window.__mock.chats || 0")
    send("set an alarm")
    page.wait_for_selector("[data-testid=act-cancel]", timeout=30000)
    card().locator("button:has-text('Just answer')").click()
    page.wait_for_selector("text=An alarm clock rings", timeout=20000)
    check(True, "“Just answer” turns it back into a normal chat answer")

    # G. a normal question is not an action
    k = page.locator("[data-testid=action-card]").count()
    page.evaluate("window.__mock.fake = 'About 100 t at minimum radius.'")
    send("What is the capacity of an LTM 1100?")
    page.wait_for_selector("text=About 100 t", timeout=20000)
    check(page.locator("[data-testid=action-card]").count() == k, "an ordinary question gets an answer, not an action card")

    # H. the Reminders screen
    open_more(page)
    page.locator(".rounded-t-2xl button:has-text('Reminders')").click()
    page.wait_for_selector("[data-testid=reminders-panel]", timeout=5000)
    check(page.locator("[data-testid=rem-item]").count() == 1 and "Call Ahmed" in page.locator("[data-testid=rem-item]").inner_text(), "Reminders lists the one set from chat")
    page.fill("[data-testid=rem-title]", "Pay the crane insurance")
    page.locator("[data-testid=rem-add]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=rem-item]").count() == 2 and len(page.evaluate("window.__mock.notes")) == 2, "a reminder added by hand is scheduled on the phone")
    page.locator("[data-testid=rem-item]").filter(has_text="insurance").locator("button").click(); page.wait_for_timeout(200)
    check(len(page.evaluate("window.__mock.notes")) == 1, "deleting it cancels it on the phone")
    page.evaluate("window.__mock.inexact = true"); page.evaluate("window.__attuneBack()"); open_more(page)
    page.locator(".rounded-t-2xl button:has-text('Reminders')").click(); page.wait_for_timeout(200)
    page.locator("[data-testid=ask-exact]").click()
    check(page.evaluate("window.__mock.askedExact") is True, "without “Alarms & reminders” it says so and opens the setting")
    page.screenshot(path=HERE + "/v5-reminders.png")
    # I. after a reload (or a restore), the page re-sends its reminders to the phone
    page.reload(); page.wait_for_selector("nav", timeout=15000); page.wait_for_timeout(500)
    check(len(page.evaluate("window.__mock.notes")) == 1, "on start the page re-schedules its reminders on the phone")
    ctx.close()


def sec_speed(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    page.locator("header button:has-text('No model')").click()
    page.locator("text=Recommended for this device").locator("xpath=..").get_by_role("button", name="Install").first.click()
    page.wait_for_selector("text=Running now", timeout=10000)
    sp = page.locator("[data-testid=speed-panel]")
    check(sp.count() == 1, "Engine has a Speed section")
    # CPU speed test through the real engine
    page.locator("[data-testid=bench-run]").click()
    page.wait_for_selector("[data-testid=bench-results]", timeout=60000)
    body = page.evaluate("window.__mock.lastBody")
    check(body["max_tokens"] == 128 and body["temperature"] == 0 and body["messages"][-1]["content"].startswith("["),
          "the speed test is a fixed task (128 tokens, temperature 0, fresh prompt so nothing is cached)")
    r0 = page.locator("[data-testid=bench-results]").inner_text()
    check("CPU" in r0 and "writes" in r0 and "reads" in r0, "result shows reading and writing speed on CPU: " + r0.splitlines()[0])
    # GPU on
    sp.locator("button:has-text('Use the GPU')").click()
    page.wait_for_selector("text=Running on QUALCOMM Adreno", timeout=5000)
    check(page.evaluate("window.__mock.setSpeedCalls")[-1] == {"gpu": True}, "turning GPU on restarts the engine with gpu=true")
    page.locator("[data-testid=bench-run]").click(); page.wait_for_timeout(300)
    page.wait_for_function("document.querySelectorAll('[data-testid=bench-results] .text-\\\\[11px\\\\]').length >= 2 || document.querySelector('[data-testid=bench-results]').innerText.includes('GPU')", timeout=60000)
    txt = page.locator("[data-testid=bench-results]").inner_text()
    check("GPU" in txt and "CPU" in txt and "Fastest here so far" in txt, "CPU and GPU results sit side by side, with the fastest named")
    # draft model
    page.locator("[data-testid=draft-install]").click()
    page.wait_for_selector("text=guesses ahead", timeout=5000)
    di = page.evaluate("window.__mock.draftInstall")
    check(di["draft"] is True and "0.8B" in di["repo"] and di["vision"] is False, "the draft is Qwen 3.5 0.8B, installed as a helper (not switched to)")
    # GPU fails → back to CPU, said plainly
    sp.locator("button:has-text('Use the GPU')").click(); page.wait_for_timeout(300)   # off
    page.evaluate("window.__mock.gpuFails = true")
    sp.locator("button:has-text('Use the GPU')").click()
    page.wait_for_selector("[data-testid=gpu-note]", timeout=5000)
    check("switched back to the CPU" in page.locator("[data-testid=gpu-note]").inner_text(), "if the GPU fails it goes back to the CPU and says why")
    page.screenshot(path=HERE + "/v5-speed.png", full_page=True)
    ctx.close()


CHART = "m\t12\t20\t30\n3\t60\t45\t-\n5\t42\t38\t30\n10\t20\t19\t17\n20\t-\t6.5\t6"

def sec_crane(br):
    ctx, page = new_page(br, env, errors)
    page.goto(env.url); page.wait_for_selector("nav", timeout=15000)
    open_more(page)
    page.locator(".rounded-t-2xl button:has-text('Crane toolkit')").click()
    page.wait_for_selector("[data-testid=crane-toolkit]", timeout=5000)
    check("Planning aid only" in page.locator("[data-testid=crane-toolkit]").inner_text(), "the toolkit says plainly it is a planning aid")
    # add a chart
    page.click("[data-testid=ctab-charts]")
    page.fill("[data-testid=ch-name]", "Liebherr LTM 1100 · unit 3")
    page.fill("[data-testid=ch-config]", "22 t counterweight · 7×7 m")
    page.fill("[data-testid=ch-text]", CHART)
    check(page.locator("[data-testid=ch-preview] tr").count() == 5, "a pasted chart is shown as a table to check against the print")
    page.click("[data-testid=ch-add]")
    check(page.locator("[data-testid=crane-item]").count() == 1, "the chart is saved")
    page.locator("[data-testid=crane-item] button").first.click()
    # lift check
    page.fill("[data-testid=lift-radius]", "7"); page.fill("[data-testid=lift-boom]", "25")
    ct = page.locator("[data-testid=lift-chart]").inner_text()
    check("17 t" in ct and "lowest surrounding" in ct, "7 m / 25 m boom (between chart points) reads 17 t, the lowest around it: " + ct.splitlines()[0])
    page.fill("[data-testid=lift-load]", "14"); page.fill("[data-testid=lift-hook]", "0.8"); page.fill("[data-testid=lift-rig]", "0.3")
    v = page.locator("[data-testid=lift-verdict]").inner_text()
    check("15.1 t of 17 t" in v and "88.8%" in v and "Critical lift" in v, "15.1 t on 17 t = 88.8 % → critical lift, needs a plan")
    page.fill("[data-testid=lift-load]", "16.5")
    check("OVER THE CHART" in page.locator("[data-testid=lift-verdict]").inner_text(), "17.6 t on 17 t → over the chart")
    page.fill("[data-testid=lift-radius]", "25")
    check("not permitted" in page.locator("[data-testid=lift-chart]").inner_text(), "beyond the chart's radius → not permitted")
    page.fill("[data-testid=lift-radius]", "7")
    # ground
    page.click("[data-testid=ctab-ground]")
    check(page.locator("[data-testid=g-gross]").input_value() == "17.6", "the lift's gross load carries over to Ground")
    page.fill("[data-testid=g-mass]", "48"); page.fill("[data-testid=g-cw]", "22")
    page.select_option("[data-testid=g-soil]", "soft_clay")
    g = page.locator("[data-testid=g-verdict]").inner_text()
    check("65.7 t" in g and "Estimated" in g and "Mat needed" in g, "no force given: estimated 65.7 t; on soft clay it says how big a mat is needed")
    page.fill("[data-testid=g-force]", "40"); page.fill("[data-testid=g-custom]", "250"); page.fill("[data-testid=g-L]", "2"); page.fill("[data-testid=g-W]", "2")
    g = page.locator("[data-testid=g-verdict]").inner_text()
    check("98 kN/m²" in g, "40 t on a 2×2 m mat → 98 kN/m² (allowed 250)")
    # slings
    page.click("[data-testid=ctab-slings]")
    page.click("[data-testid=s-legs-2]")
    sv = page.locator("[data-testid=s-verdict]").inner_text()
    check("10.16 t" in sv, "17.6 t on 2 legs at 30° → 10.16 t per leg")
    page.click("[data-testid=s-legs-4]")
    check("10.16 t" in page.locator("[data-testid=s-verdict]").inner_text() and "only 2 legs" in page.locator("[data-testid=s-verdict]").inner_text(),
          "4 legs are rated as 2 (same 10.16 t), and it says why")
    # wind
    page.click("[data-testid=ctab-wind]")
    page.fill("[data-testid=w-mass]", "5"); page.fill("[data-testid=w-area]", "20"); page.fill("[data-testid=w-vnow]", "6")
    w = page.locator("[data-testid=w-verdict]").inner_text()
    check("4.9 m/s" in w and "TOO WINDY" in w, "a 5 t panel of 20 m²: limit drops to 4.9 m/s, 6 m/s is too windy")
    page.fill("[data-testid=w-vnow]", "4"); page.fill("[data-testid=w-htip]", "50")
    check("TOO WINDY" in page.locator("[data-testid=w-verdict]").inner_text(), "4 m/s at 10 m becomes ~5 m/s at a 50 m tip — still too windy")
    # checklist
    page.click("[data-testid=ctab-check]")
    page.locator("[data-testid=chk]").nth(0).check(); page.locator("[data-testid=chk]").nth(1).check()
    check("2 of 20 checked" in page.locator("[data-testid=check-tab]").inner_text(), "checklist counts what is ticked")
    page.click("[data-testid=chk-share]")
    sh = page.evaluate("window.__mock.shared") or ""
    check("☑" in sh and "☐" in sh and "Liebherr LTM 1100" in sh and "17.6 t" in sh, "Share sends the ticked list with the crane and load")
    page.screenshot(path=HERE + "/v5-crane.png", full_page=True)
    page.reload(); page.wait_for_selector("nav", timeout=15000)
    check("Liebherr LTM 1100" in (page.evaluate("localStorage.getItem('attune:crane:v1')") or ""), "charts are kept (and so go into backups)")
    # the same screens in Arabic
    page.evaluate("localStorage.setItem('attune:ui:lang','ar')"); page.reload(); page.wait_for_selector("nav", timeout=15000)
    open_more(page); page.locator(".rounded-t-2xl button:has-text('أدوات الأوناش')").click()
    page.wait_for_selector("[data-testid=crane-toolkit]", timeout=5000)
    bad = []
    for t in ["lift", "ground", "slings", "wind", "check", "charts"]:
        page.click("[data-testid=ctab-%s]" % t); page.wait_for_timeout(100)
        bad += page.evaluate(LATIN)
    bad = [b for b in bad if not any(x in b for x in ["LMI", "WLL", "Liebherr", "LTM", "PDF", "kN", "22 t counterweight"])]
    check(len(bad) == 0, "every toolkit tab is in Arabic: %s" % bad[:4])
    page.click("[data-testid=ctab-lift]"); page.wait_for_timeout(100)
    page.screenshot(path=HERE + "/v5-crane-ar.png")
    ctx.close()

SECTION_FUNCS = {"backup": sec_backup, "arabic": sec_arabic, "actions": sec_actions, "speed": sec_speed, "crane": sec_crane}

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
