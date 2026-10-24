"""v6.24 — Attune on a computer, laid out like Claude / ChatGPT (Ali, 12 Oct 2026): a sidebar with New chat,
search, the main places, every tool and the recent chats; no bottom bar; the chat in a centred column.
  PYTHONPATH=tests/pwshim:tests python3 tests/e2e_v724desktop.py
"""
import json
from playwright.sync_api import sync_playwright
from harness import Env, new_page, check, real_errors, finish
env = Env(); errors = []
CH = [{"id": "c1", "title": "Lynk & Co 900 price", "updated": 1760250000000, "messages": [{"id": "m1", "role": "user", "text": "Lynk & Co 900 price"}, {"id": "m2", "role": "assistant", "text": "About EGP 3.2M."}]},
      {"id": "c2", "title": "Turkish lesson 3", "updated": 1760100000000, "messages": [{"id": "m3", "role": "user", "text": "merhaba"}, {"id": "m4", "role": "assistant", "text": "Merhaba!"}]}]
INIT = "try{if(!localStorage.getItem('attune:chats:v1'))localStorage.setItem('attune:chats:v1', %s)}catch(e){}" % json.dumps(json.dumps(CH))
def box(page, sel): return page.locator(sel).first.bounding_box()
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx, page = new_page(br, env, errors, desktop=(1366, 820), extra_init=INIT)
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(500)
    check(page.locator("nav").first.is_hidden(), "a computer has no bottom bar")
    sb = box(page, "[data-testid=side]")
    check(sb["x"] == 0 and sb["width"] > 200, "the sidebar sits on the left (%s)" % sb)
    check(page.locator("[data-testid=side-chat]").count() == 2, "the recent chats are listed")
    # v6.25 (Ali picked A + C): a computer opens on Home; the sidebar is short (places + pinned tools)
    check(page.locator("[data-testid=desk-home]").count() == 1 and page.locator("[data-testid=home-ask]").count() == 1, "a computer opens on Home with an ask box")
    check(page.locator("[data-testid=side-pins] [data-testid=side-go-convert]").count() == 1 and page.locator("[data-testid^=side-go-]").count() <= 14, "the sidebar holds the places, How to use, Privacy and the pinned tools, not all 33")
    page.locator("[data-testid=side-new]").first.click(); page.wait_for_timeout(300); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    c = box(page, "[data-testid=composer]")
    check(c["x"] >= sb["width"] - 1, "the message box sits beside the sidebar, not under it (x=%d)" % c["x"])
    page.locator("[data-testid=side-open-chat]").nth(1).click(); page.wait_for_timeout(400)
    check("merhaba" in page.locator("body").inner_text().lower(), "a chat opens from the sidebar")
    # rename and delete from the sidebar
    page.locator("[data-testid=side-chat]").nth(1).hover(); page.locator("[data-testid=side-chat]").nth(1).locator("button[title=Rename]").click()
    page.fill("[data-testid=side-rename]", "Turkish with Ali"); page.keyboard.press("Enter"); page.wait_for_timeout(500)
    check("Turkish with Ali" in page.locator("[data-testid=side-chats]").inner_text(), "rename from the sidebar")
    page.locator("[data-testid=side-chat]").nth(1).hover(); page.locator("[data-testid=side-chat]").nth(1).locator("[data-testid=side-del]").click()
    page.locator("[data-testid=side-del-yes]").click(); page.wait_for_timeout(600)
    st = json.loads(page.evaluate("localStorage.getItem('attune:chats:v1')"))
    check(page.locator("[data-testid=side-chat]").count() == 1 and [x["title"] for x in st] == ["Lynk & Co 900 price"], "delete from the sidebar removes the chat: %s" % [x["title"] for x in st])
    # a new chat, then a tool found by search
    page.locator("[data-testid=side-new]").click(); page.wait_for_timeout(300); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    check(page.locator("[data-testid=composer] textarea").input_value() == "" and "About EGP" not in page.locator("body").inner_text(), "New chat starts an empty chat")
    page.fill("[data-testid=side-search]", "fit"); page.wait_for_timeout(200)
    check(page.locator("[data-testid=side-tool-hits] [data-testid=side-go-fit]").count() == 1, "searching the sidebar finds a tool")
    page.locator("[data-testid=side-tool-hits] [data-testid=side-go-fit]").click(); page.wait_for_timeout(600)
    page.fill("[data-testid=side-search]", "")
    check(page.locator("[data-testid=side]").is_visible(), "the sidebar stays while a tool is open")
    page.locator("[data-testid=side-go-money]").click(); page.wait_for_timeout(600)
    m = box(page, "[data-testid=money-desk]")   # v6.27: the Calm computer layout of Money
    check(m and m["x"] >= sb["width"] - 1 and m["width"] > 800, "Money fills the space beside the sidebar (x=%s, w=%s)" % (m and m["x"], m and m["width"]))
    page.locator("[data-testid=side-go-tools]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=tools-page] [data-testid^=tools-open-]").count() >= 30, "the Tools page lists every tool")
    page.locator("[data-testid=tools-pin-video]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=side-pins] [data-testid=side-go-video]").count() == 1, "★ pins a tool to the sidebar")
    page.locator("[data-testid=tools-pin-video]").click(); page.wait_for_timeout(200)
    check(page.locator("[data-testid=side-pins] [data-testid=side-go-video]").count() == 0, "★ again unpins it")
    page.locator("[data-testid=tools-open-map]").click(); page.wait_for_timeout(800)
    mp = page.evaluate("(() => { const e = document.querySelector('.att-shift.fixed.inset-0'); return e ? e.getBoundingClientRect().left : -1; })()")
    check(mp >= sb["width"] - 1, "Maps fills the space beside the sidebar (left=%s)" % mp)
    # Back on a computer (Ali: "there is no back in the app"): the sidebar's ←, Alt+←, the mouse's back button, Esc
    page.locator("[data-testid=side-go-home]").first.click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=side-back]").count() == 1, "v6.28: Home still offers Back — to Maps, the page before (Ali: Back always returns to the previous page)")
    page.locator("[data-testid=side-go-memory]").first.click(); page.wait_for_timeout(400)
    check(page.locator("[data-testid=side-back]").count() == 1, "a Back button appears in a tool")
    page.locator("[data-testid=side-back]").click(); page.wait_for_timeout(400)
    check(page.locator("[data-testid=desk-home]").count() == 1, "← goes back to Home (the page before Mind)")
    page.locator("[data-testid=side-go-memory]").first.click(); page.wait_for_timeout(400)
    page.keyboard.press("Alt+ArrowLeft"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=desk-home]").count() == 1, "Alt+← goes back")
    page.locator("[data-testid=side-go-memory]").first.click(); page.wait_for_timeout(400)
    page.locator("[data-testid=side-engine]").click(); page.wait_for_timeout(400)
    # the mouse's back button, sent twice the way Windows does (a click and a command): one step only
    page.evaluate("() => { window.dispatchEvent(new MouseEvent('mouseup', { button: 3 })); window.dispatchEvent(new Event('attune-back')); }"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=side-back]").count() == 1 and page.locator("[data-testid=desk-home]").count() == 0, "one press of the mouse's back button = one step (the Engine panel closed, still in the tool)")
    page.locator("[data-testid=side-engine]").click(); page.wait_for_timeout(400)
    page.keyboard.press("Escape"); page.wait_for_timeout(400)
    check(page.locator("[data-testid=side-back]").count() == 1 and page.locator("[data-testid=desk-home]").count() == 0, "Esc closes the open panel only")
    page.keyboard.press("Escape"); page.wait_for_timeout(300)
    check(page.locator("[data-testid=desk-home]").count() == 0, "Esc with nothing open does not leave the tool")
    # Home's ask box starts a NEW chat and sends at once
    page.locator("[data-testid=side-go-home]").first.click(); page.wait_for_timeout(300)
    page.evaluate("() => { window.__mock.fakeQueue = ['Paris is the capital.', 'Paris is the capital.']; }")
    page.fill("[data-testid=home-ask]", "Capital of France?"); page.keyboard.press("Enter"); page.wait_for_timeout(2500)
    st = json.loads(page.evaluate("localStorage.getItem('attune:chats:v1')"))
    asked = len(st) == 2 and st[0]["messages"][0]["text"] == "Capital of France?"
    kept = page.locator("[data-testid=composer] textarea").input_value() == "Capital of France?"   # no model loaded here: the question waits in the box
    check(page.locator("[data-testid=composer]").count() == 1 and (asked or kept), "Home's ask box opens a new chat and asks — or keeps the question when no model is loaded (%s)" % [c["title"] for c in st])
    page.keyboard.press("Escape"); page.wait_for_timeout(200)
    # the tool's own title is not repeated by a bar above it
    page.locator("[data-testid=side-go-convert]").first.click(); page.wait_for_timeout(400)
    check(page.locator("header:not(.hidden)").count() == 0, "File Converter: one title, not two")
    # close and reopen the sidebar
    page.locator("[data-testid=side-new]").first.click(); page.wait_for_timeout(300); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    page.locator("[data-testid=side-close]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=side]").count() == 0 and box(page, "[data-testid=composer]")["x"] < 20, "closing the sidebar gives the chat the whole window")
    page.locator("[data-testid=side-open]").click(); page.wait_for_timeout(300)
    check(page.locator("[data-testid=side]").count() == 1, "the sidebar button opens it again")
    # a window made narrow behaves like the phone
    page.set_viewport_size({"width": 700, "height": 820}); page.wait_for_timeout(400)
    check(page.locator("[data-testid=side]").count() == 0 and page.locator("nav").first.is_visible(), "a narrow window has the phone layout")
    check(real_errors(errors) == [], "no errors: %s" % real_errors(errors)[:3])
    ctx.close()
    # Arabic: the sidebar is on the right
    errors2 = []
    ctx, page = new_page(br, env, errors2, desktop=(1366, 820), extra_init=INIT + "try{localStorage.setItem('attune:ui:lang','ar')}catch(e){}")
    page.goto(env.url); page.wait_for_selector("[data-testid=side]", timeout=15000); page.wait_for_timeout(400)
    check(page.locator("[data-testid=desk-home]").count() == 1, "Arabic: Home first too")
    page.locator("[data-testid=side-new]").first.click(); page.wait_for_timeout(300); page.evaluate("window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:'chat'}}))"); page.wait_for_timeout(500)
    sb = box(page, "[data-testid=side]"); c = box(page, "[data-testid=composer]")
    check(sb["x"] > 1000 and c["x"] + c["width"] <= sb["x"] + 1, "in Arabic the sidebar is on the right and the message box beside it (%d, %d)" % (sb["x"], c["x"] + c["width"]))
    check(real_errors(errors2) == [], "no errors (Arabic): %s" % real_errors(errors2)[:3])
    ctx.close(); br.close()
env.close()
finish()
