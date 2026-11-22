"""v10.8 store screenshots (Ali picked ST1 English first + SS1: the real screen with one line above it).
Makes docs/store/<en|ar>/1-home.png … 6-people.png at 1080 × 1920 and docs/store/<lang>/computer.png at 1920 × 1080, from the real
app with Ali-like examples (no real bank numbers).
  PYTHONPATH=tests/pwshim:tests python3 tests/store/shots.py
"""
import json, os, base64, datetime, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from playwright.sync_api import sync_playwright
from harness import Env, new_page
env = Env(); errors = []
ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "store")
# a fixed morning (8:30 today) in the data AND the browser's clock — run at 3 am, the to-dos read «4:00 ص» (v10.8)
now = datetime.datetime.now().replace(hour=8, minute=30, second=0, microsecond=0); ms = lambda d=0, h=0, m=0: int((now.replace(minute=0, second=0, microsecond=0) + datetime.timedelta(days=d, hours=h + 1, minutes=m)).timestamp() * 1000)   # later than now: never "late"
iso = lambda d=0: (now + datetime.timedelta(days=d)).date().isoformat()
LEDGER = {"accounts": [{"id": "a1", "name": "CIB", "currency": "EGP"}, {"id": "a2", "name": "Cash", "currency": "EGP"}],
  "txns": [{"id": "t1", "type": "income", "amount": 32000, "cat": "salary", "account": "a1", "date": iso(-19), "note": "Salary"},
           {"id": "t2", "type": "expense", "amount": 350, "cat": "groceries", "account": "a1", "date": iso(0), "note": "Carrefour Maadi"},
           {"id": "t3", "type": "expense", "amount": 120, "cat": "transport", "account": "a1", "date": iso(-1), "note": "Uber"},
           {"id": "t4", "type": "expense", "amount": 285, "cat": "food", "account": "a1", "date": iso(-1), "note": "Talabat"},
           {"id": "t5", "type": "expense", "amount": 700, "cat": "home", "account": "a2", "date": iso(-3), "note": "The maid"},
           {"id": "t6", "type": "income", "amount": 2500, "cat": "other", "account": "a2", "date": iso(-2), "note": "Sheikh paid back"}], "recurring": []}
TX = {"en": ["Call the crane yard", "Pay the maid 700", "Renew the car licence", "Electricity bill", "Nada's mother's birthday", "Salary", "Carrefour Maadi", "Uber", "Talabat", "The maid", "Sheikh paid back",
              ["Milk", "Eggs", "Foul", "Tomatoes", "Bread", "Cucumber", "Cheese"], "Before the trip", ["Passports", "Chargers", "Umrah clothes"], "Mama",
              "write me a short message to the crane rental company asking for a 50 ton crane next Sunday in New Cairo, price and availability"],
      "ar": ["كلّم ورشة الونش", "ادفع للبنت ٧٠٠", "جدّد رخصة العربية", "فاتورة الكهربا", "عيد ميلاد مامة ندى", "المرتب", "كارفور المعادي", "أوبر", "طلبات", "البنت", "الشيخ رجّع الفلوس",
              ["لبن", "بيض", "فول", "طماطم", "عيش", "خيار", "جبنة"], "قبل السفر", ["الجوازات", "الشواحن", "هدوم العمرة"], "ماما",
              "اكتبلي رسالة قصيرة لشركة تأجير الأوناش أسأل فيها عن ونش ٥٠ طن يوم الحد الجاي في التجمع، السعر والمعاد المتاح"]}
def data(lang):
    t = TX[lang]
    rem = [{"id": "r1", "title": t[0], "at": ms(0, 0), "repeat": "none", "created": ms(-1)}, {"id": "r2", "title": t[1], "at": ms(0, 2), "repeat": "week", "created": ms(-7)},
           {"id": "r3", "title": t[2], "at": ms(3), "repeat": "none", "created": ms(-2)}, {"id": "r4", "title": t[3], "at": ms(5), "repeat": "month", "created": ms(-30)},
           {"id": "r5", "title": t[4], "at": ms(6), "repeat": "year", "created": ms(-40)}]
    led = json.loads(json.dumps(LEDGER)); led["currency"] = "EGP"
    if lang == "ar": led["accounts"][1]["name"] = "كاش"   # the first account takes the app's language (v10.8)
    for x, nm in zip(led["txns"], t[5:11]): x["note"] = nm
    lists = {"lists": [{"id": "l1", "name": "Talabat" if lang == "en" else "طلبات", "emoji": "🛒", "items": [{"id": "i%d" % i, "text": x, "done": i < 2} for i, x in enumerate(t[11])], "repeat": {"every": "once"}, "created": 0},
                       {"id": "l2", "name": t[12], "emoji": "✈", "items": [{"id": "j%d" % i, "text": x, "done": False} for i, x in enumerate(t[13])], "repeat": {"every": "once"}, "created": 0}]}
    d = json.loads(json.dumps(DIR)); d["items"][3]["name"] = t[14]
    if lang == "ar": d["items"][0]["name"] = "ندى"; d["items"][1]["name"] = "أسامة"; d["items"][2]["name"] = "الشيخ محمود"
    w = dict(WRITING); w["text"] = t[15]
    return led, rem, lists, d, w
LISTS = {"lists": [{"id": "l1", "name": "Talabat", "emoji": "🛒", "items": [{"id": "i%d" % i, "text": t, "done": i < 2} for i, t in enumerate(["Milk", "Eggs", "Foul", "Tomatoes", "Bread", "Cucumber", "Cheese"])], "repeat": {"every": "once"}, "created": 0},
                   {"id": "l2", "name": "Before the trip", "emoji": "✈", "items": [{"id": "j%d" % i, "text": t, "done": False} for i, t in enumerate(["Passports", "Chargers", "Umrah clothes"])], "repeat": {"every": "once"}, "created": 0}]}
DIR = {"items": [{"id": "p1", "kind": "person", "name": "Nada", "role": "wife"}, {"id": "p2", "kind": "person", "name": "Osama", "role": "friend"},
                 {"id": "p3", "kind": "person", "name": "Sheikh Mahmoud", "role": "client"}, {"id": "p4", "kind": "person", "name": "Mama", "role": "mother"}], "skip": []}
WRITING = {"text": "write me a short message to the crane rental company asking for a 50 ton crane next Sunday in New Cairo, price and availability", "versions": [], "tab": "improve", "target": "chatgpt"}
SHOTS = [("1-home", "home", "Your whole day on one screen", "يومك كله في شاشة واحدة"),
         ("2-money", "money", "Money from your bank messages", "فلوسك من رسايل البنك"),
         ("3-followups", "timeline", "Every date in one list", "كل المواعيد في ليستة واحدة"),
         ("4-lists", "lists", "Tick your lists, change any to-do", "علّم على قوايمك وغيّر أي مهمة"),
         ("5-writing", "write", "Better prompts for any AI", "برومبتات أحسن لأي ذكاء اصطناعي"),
         ("6-people", "people", "A card for everyone in your life", "كارت لكل حد في حياتك")]
def init(lang):
    j = lambda x: json.dumps(json.dumps(x)); LEDGER_, REM_, LISTS_, DIR_, WRITING_ = data(lang)
    return ("try{localStorage.setItem('attune:country','eg')}catch(e){};" + "try{localStorage.setItem('attune:start','home');localStorage.setItem('attune:coach:v1',JSON.stringify({seen:['*']}));localStorage.setItem('attune:name','Ali');"
            "localStorage.setItem('ledger.v3',%s);localStorage.setItem('attune:reminders:v1',%s);localStorage.setItem('attune:lists:v1',%s);localStorage.setItem('attune:people:v1',%s);"
            "localStorage.setItem('attune:writing:v1',%s);localStorage.setItem('attune:ui:lang','%s');}catch(e){}") % (j(LEDGER_), j(REM_), j(LISTS_), j(DIR_), j(WRITING_), lang)
FRAME = """<html><body style="margin:0;width:%dpx;height:%dpx;background:linear-gradient(170deg,#7a2a45,#3b1424);display:flex;flex-direction:column;align-items:center;font-family:'Nunito','Cairo',system-ui,sans-serif" dir="%s">
<div style="color:#fff;font-weight:900;font-size:%dpx;line-height:1.15;text-align:center;padding:%dpx 70px 0;height:%dpx;box-sizing:border-box;display:flex;align-items:center">%s</div>
<img src="data:image/png;base64,%s" style="width:%dpx;border-radius:44px;box-shadow:0 20px 60px rgba(0,0,0,.45);margin-top:10px"></body></html>"""
with sync_playwright() as p:
    br = p.chromium.launch()
    for lang in ("en", "ar"):
        out = os.path.join(ROOT, lang); os.makedirs(out, exist_ok=True)
        ctx, page = new_page(br, env, errors, legacy_nav=False, extra_init=init(lang))
        page.set_viewport_size({"width": 412, "height": 640})
        page.clock.install(time=now); page.goto(env.url); page.wait_for_timeout(2500)
        for name, mode, en, ar in SHOTS:
            page.evaluate("(m) => window.dispatchEvent(new CustomEvent('attune-open',{detail:{mode:m}}))", mode); page.wait_for_timeout(1600)
            shot = base64.b64encode(page.screenshot()).decode()
            fp = br.new_page(viewport={"width": 1080, "height": 1920})
            fp.set_content(FRAME % (1080, 1920, "rtl" if lang == "ar" else "ltr", 76, 60, 330, ar if lang == "ar" else en, shot, 930)); fp.wait_for_timeout(300)
            fp.screenshot(path=os.path.join(out, name + ".png")); fp.close()
        ctx.close()
        # the computer: the week calendar, for the large-screen slot
        ctx, page = new_page(br, env, errors, legacy_nav=False, desktop=(1366, 768), extra_init=init(lang))
        page.clock.install(time=now); page.goto(env.url); page.wait_for_timeout(2800)
        shot = base64.b64encode(page.screenshot()).decode()
        fp = br.new_page(viewport={"width": 1920, "height": 1080})
        fp.set_content((FRAME % (1920, 1080, "rtl" if lang == "ar" else "ltr", 60, 20, 150, "كل أسبوعك على الكمبيوتر" if lang == "ar" else "Your week on the computer", shot, 1600)).replace("border-radius:44px", "border-radius:18px")); fp.wait_for_timeout(300)
        fp.screenshot(path=os.path.join(out, "computer.png")); fp.close(); ctx.close()
    br.close()
env.close()
print("done", sorted(os.listdir(os.path.join(ROOT, "en"))))
