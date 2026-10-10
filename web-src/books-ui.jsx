/* ---- v6.10: Business → Books (shop & trading): the owner's own accounting on the phone ----------------
   Home (today's numbers + big action buttons) and five fixed modules: Sales, Purchases, Stock, Money, Reports,
   plus Settings (company letterhead, tax, backup). All maths is in books.js / books-ops.js; saved in IndexedDB.
   Clean accounting look; English / Arabic on screen, both on printed documents.                           */
import React, { useState, useEffect, useMemo, useRef, createContext, useContext, useCallback } from "react";
import { LayoutGrid, FileText, Package, Layers, Wallet, BarChart3, Plus, AlertTriangle, ChevronRight, Building2, Download, Upload, Users } from "lucide-react";
import * as B from "./books.js";
import * as O from "./books-ops.js";
import { loadBooks, saveBooks, exportBooks, parseBackup, replaceBooks } from "./books-store.js";
import * as ETA from "./books-eta.js";
import { BooksCtx, useBooks, L, isAr, ThemeCtx, themeFor, useTheme, Card, Stat, Section, Money, Badge, Empty, Field, Input, Select, Sheet, BTN, btnPrimary, today, monthStart, fmtDate } from "./books-kit.jsx";
import { SalesModule } from "./books-sales.jsx";
import { PurchasesModule } from "./books-purchases.jsx";
import { StockModule } from "./books-stock.jsx";
import { MoneyModule } from "./books-money.jsx";
import { ReportsModule } from "./books-reports.jsx";
import { useSubBack } from "./backstack.js";
import { EtaSettings, VaultSection, UsersSection, CurrencySection, PriceListSection, UserLock, autoSnapshot, actorCan } from "./books-extras.jsx";


const THEME_KEY = "attune:books:theme";
const TABS = [
  ["home", LayoutGrid, "Home", "الرئيسية"], ["sales", FileText, "Sales", "المبيعات"], ["buy", Package, "Purchases", "المشتريات"],
  ["stock", Layers, "Stock", "المخزون"], ["money", Wallet, "Money", "الخزينة"], ["reports", BarChart3, "Reports", "التقارير"],
];

export function BooksApp({ flash, saveFile, share, onBack, openPlan, goCustom }) {
  const [s, setS] = useState(null);                       // the books
  const [tab, setTab] = useState("home");
  const [themeName, setThemeName] = useState(() => { try { return localStorage.getItem(THEME_KEY) || "light"; } catch (e) { return "light"; } });
  const [settings, setSettings] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const ref = useRef(null);
  const hasUsers = (x) => !!(x && x.users && x.users.length);
  useEffect(() => { let on = true; O.setActor(null); loadBooks().then((x) => { if (on) { ref.current = x; setUnlocked(!O.hasPin(x) && !hasUsers(x)); setS(x); } }); return () => { on = false; }; }, []);
  // automatic encrypted snapshot, once per opening, keyed by the PIN that opened the books (never stored)
  const opened = useCallback((pin, who) => {
    setUnlocked(true);
    setTimeout(() => { autoSnapshot(ref.current, pin, who).then((r) => { if (r.took) flash && flash(L("Encrypted backup saved on this phone", "حُفظت نسخة مشفّرة على الهاتف")); }).catch(() => {}); }, 300);
  }, [flash]);
  useSubBack(true, onBack);

  /** Run an operation on the books. fn(state) → newState | { state, ...result }. Errors from the books are shown in plain words. */
  const run = useCallback(async (fn, okMsg) => {
    try {
      const out = fn(ref.current);
      const next = out && out.state ? out.state : out;
      ref.current = next; setS(next);
      const saved = await saveBooks(next);
      if (!saved) flash && flash(L("Could not save to the phone's storage — free some space", "مقدرتش أحفظ على تخزين التليفون — فضّي مساحة"));
      else if (okMsg) flash && flash(okMsg);
      if (out && out.warnings && out.warnings.length) flash && flash("⚠ " + out.warnings.join(" · "));
      return out && out.state ? out : { state: next };
    } catch (e) {
      if (e instanceof O.BooksError) { flash && flash(e.message); return null; }
      console.error(e); flash && flash(L("Something went wrong — nothing was changed", "حدثت مشكلة — لم يتغيّر شيء")); return null;
    }
  }, [flash]);
  const th = themeFor(themeName);
  const setTheme = (n) => { setThemeName(n); try { localStorage.setItem(THEME_KEY, n); } catch (e) {} };

  if (s && hasUsers(s) && !unlocked) return <ThemeCtx.Provider value={th}><UserLock s={s} onOk={(pin, u) => opened(pin, u.name)} onBack={onBack} /></ThemeCtx.Provider>;
  if (s && O.hasPin(s) && !unlocked) return <ThemeCtx.Provider value={th}><PinLock s={s} onOk={(pin) => opened(pin, "")} onBack={onBack} /></ThemeCtx.Provider>;
  if (!s) return <div className="p-6 text-center text-sm text-slate-500" data-testid="books-loading">{L("Opening your books…", "بفتح دفاترك…")}</div>;
  const ctx = { s, run, flash, saveFile, share, themeName, setTheme, today: today(), goTab: setTab, openSettings: () => setSettings(true) };
  return (
    <ThemeCtx.Provider value={th}>
      <BooksCtx.Provider value={ctx}>
        <div className={`fixed inset-0 z-[60] flex flex-col ${th.page}`} data-testid="books-app" dir={isAr() ? "rtl" : "ltr"}>
          <div className={`flex items-center gap-2 px-3 py-2.5 border-b ${th.bar}`}>
            <button onClick={onBack} className="p-1.5 -ms-1 rounded-lg" aria-label={L("Back", "رجوع")}><ChevronRight size={20} className="rotate-180 rtl:rotate-0" /></button>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold truncate">{(isAr() ? s.company.nameAr : s.company.name) || s.company.name || s.company.nameAr || L("My business", "شغلي")}</p>
              <p className={`text-[11px] ${th.sub}`}>{L("Books", "الدفاتر")} · {s.currency}{O.getActor() ? " · " + O.getActor().name : ""}</p>
            </div>
            <button onClick={() => setSettings(true)} className="p-2 rounded-lg" aria-label={L("Settings", "الإعدادات")} data-testid="books-settings-open"><Building2 size={18} /></button>
          </div>
          <div className="flex-1 overflow-auto pb-2">
            <div className="max-w-2xl mx-auto px-3 pt-3">
              {tab === "home" ? <Home /> : tab === "sales" ? <SalesModule /> : tab === "buy" ? <PurchasesModule /> : tab === "stock" ? <StockModule /> : tab === "money" ? <MoneyModule /> : <ReportsModule />}
            </div>
          </div>
          <nav className={`grid grid-cols-6 border-t ${th.bar}`} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
            {TABS.map(([k, Icon, en, ar]) => (
              <button key={k} onClick={() => setTab(k)} data-testid={"books-tab-" + k} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${tab === k ? th.brand + " font-semibold" : th.sub}`}>
                <Icon size={19} />{L(en, ar)}</button>))}
          </nav>
          {settings ? <Settings onClose={() => setSettings(false)} goCustom={goCustom} /> : null}
        </div>
      </BooksCtx.Provider>
    </ThemeCtx.Provider>
  );
}

// ---- Home: today's numbers + the five things people do all day -----------------------------------------
function Home() {
  const { s, goTab, today: td } = useBooks();
  const th = useTheme();
  const d = useMemo(() => O.dashboard(s, td), [s, td]);
  const empty = !s.customers.length && !s.items.length && !s.docs.length;
  const { run } = useBooks();
  const go = (tab, what) => { try { sessionStorage.setItem("books:new", what); } catch (e) {} goTab(tab); };
  return (
    <div data-testid="books-home">
      {empty ? (
        <Card className="p-4 mb-4">
          <p className="text-[14px] font-semibold">{L("Welcome — set up your shop in 3 steps", "أهلاً — جهّز محلك في ٣ خطوات")}</p>
          <ol className={`mt-2 text-[13px] space-y-1 ${th.sub} list-decimal ps-5`}>
            <li>{L("Open Settings (the building icon) and add your company name, tax number and logo — they print on every invoice.", "افتح الإعدادات (أيقونة المبنى) وأدخل اسم الشركة والرقم الضريبي والشعار — تُطبع على كل فاتورة.")}</li>
            <li>{L("Add your items (Stock) and customers (Sales).", "ضيف أصنافك (المخزون) وعملاءك (المبيعات).")}</li>
            <li>{L("Create your first invoice from the button below.", "اعمل أول فاتورة من الزرار تحت.")}</li>
          </ol>
          <button onClick={() => run((st) => O.sampleShop(st, td), L("Sample shop loaded — look around, then restore a backup or clear it in Settings", "حُمّل متجر تجريبي — تصفّحه، ثم احذفه من الإعدادات"))} className={`${BTN} border ${th.line} mt-3 w-full`} data-testid="books-sample">{L("Try it with a sample shop", "جرّبه بمحل تجريبي")}</button>
        </Card>
      ) : null}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat testid="stat-cash" label={L("Cash & bank", "النقدية والبنك")} value={<Money v={d.cash.total} />} sub={`${L("Cash", "خزنة")} ${B.fmt(d.cash.cash)} · ${L("Bank", "بنك")} ${B.fmt(d.cash.bank)}`} onClick={() => goTab("money")} />
        <Stat testid="stat-receivable" label={L("Customers owe you", "العملاء عليهم لك")} value={<Money v={d.receivable} />} tone={d.overdue ? "warn" : undefined} sub={d.overdueCount ? `${d.overdueCount} ${L("overdue", "متأخرة")} · ${B.fmt(d.overdue)}` : L("nothing overdue", "لا توجد متأخرات")} onClick={() => goTab("money")} />
        <Stat testid="stat-payable" label={L("You owe suppliers", "عليك للموردين")} value={<Money v={d.payable} />} onClick={() => goTab("buy")} />
        {actorCan("profit") ? <Stat testid="stat-profit" label={L("This month's profit", "ربح هذا الشهر")} value={<Money v={d.month.netProfit} />} tone={d.month.netProfit < 0 ? "bad" : "good"} sub={`${L("Sales", "مبيعات")} ${B.fmt(d.month.revenue)}`} onClick={() => goTab("reports")} /> : null}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-4" data-testid="books-actions">
        {[["sales", "invoice", "+ Invoice", "+ فاتورة"], ["money", "receipt", "+ Receipt", "+ قبض"], ["buy", "bill", "+ Bill", "+ مشتريات"], ["money", "expense", "+ Expense", "+ مصروف"]].map(([tab, what, en, ar]) => (
          <button key={what} onClick={() => go(tab, what)} data-testid={"act-" + what} className={`${BTN} bg-teal-700 text-white text-center`}>{L(en, ar)}</button>))}
      </div>
      {d.low.length ? (
        <Section title={L("Low stock", "مخزون ناقص")}>
          <Card className="divide-y" testid="home-low">{d.low.slice(0, 5).map((x) => (
            <button key={x.id} onClick={() => goTab("stock")} className="w-full flex items-center justify-between px-3 py-2.5 text-[13px]"><span className="flex items-center gap-2"><AlertTriangle size={14} className="text-amber-600" />{x.name}</span><span className={th.sub}>{x.onHand} / {x.reorder}</span></button>))}</Card>
        </Section>) : null}
      {d.debtors.length ? (
        <Section title={L("Who owes you the most", "أكثر العملاء مديونية")}>
          <Card className="divide-y" testid="home-debtors">{d.debtors.map((x) => {
            const c = s.customers.find((y) => y.id === x.customer);
            return <div key={x.customer} className="flex items-center justify-between px-3 py-2.5 text-[13px]"><span>{c ? c.name : x.customer}{x.overdue ? <span className="ms-2"><Badge tone="red">{L("overdue", "متأخر")}</Badge></span> : null}</span><Money v={x.owed} bold /></div>;
          })}</Card>
        </Section>) : null}
      <Section title={L("VAT this month", "ضريبة القيمة المضافة هذا الشهر")}>
        <Card className="p-3 text-[13px]" testid="home-vat">
          <div className="flex justify-between"><span>{L("On your sales", "على المبيعات")}</span><Money v={d.vat.output} /></div>
          <div className="flex justify-between"><span>{L("On your purchases", "على المشتريات")}</span><Money v={d.vat.input} /></div>
          <div className={`flex justify-between font-semibold border-t pt-1.5 mt-1.5 ${th.line}`}><span>{d.vat.payable >= 0 ? L("To pay", "مستحق السداد") : L("To recover", "مستحق الاسترداد")}</span><Money v={Math.abs(d.vat.payable)} /></div>
        </Card>
      </Section>
      <p className={`text-[11px] ${th.sub} pb-4`}>{L("Stock value", "قيمة المخزون")}: <Money v={d.stockValue} /> · {L("Figures come only from your posted documents.", "الأرقام مأخوذة من مستنداتك المرحّلة فقط.")}</p>
    </div>
  );
}

// ---- Settings: the company letterhead, tax, appearance, backup ---------------------------------------------
function Settings({ onClose, goCustom }) {
  const { s, run, flash, saveFile, themeName, setTheme } = useBooks();
  const th = useTheme();
  const [c, setC] = useState(s.company);
  const [days, setDays] = useState(String(s.creditDays));
  const [vat, setVat] = useState(String(s.tax.vatCodes.S.bp / 100));
  const [pinIn, setPinIn] = useState("");
  const [eta, setEta] = useState(() => ({ activityCode: "", branchID: "0", governate: "", regionCity: "", street: "", buildingNumber: "", ...ETA.etaSettings(s) }));
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v }));
  const logoRef = useRef(null);
  const pickLogo = (file) => {
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => { const k = Math.min(1, 400 / Math.max(img.width, img.height)); const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); set("logo")(cv.toDataURL("image/png")); };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  };
  const save = async () => {
    const bp = Math.round(Number(vat) * 100);
    if (!(bp >= 0 && bp <= 10000)) return flash(L("VAT must be between 0 and 100", "الضريبة لازم تبقى بين ٠ و ١٠٠"));
    await run((st) => {
      const next = O.setCompany(st, c);
      next.eta = { ...eta };
      next.creditDays = Math.max(0, Math.round(Number(days) || 0));
      next.tax = { ...next.tax, asOf: today(), vatCodes: { ...next.tax.vatCodes, S: { ...next.tax.vatCodes.S, bp, label: `Standard ${Number(vat)}% · عادية ${Number(vat)}٪` } } };
      return next;
    }, L("Saved", "حُفظ"));
    onClose();
  };
  const backup = () => { if (!actorCan("export")) return flash(L("Your role cannot export", "دورك لا يسمح بالتصدير")); const text = exportBooks(s); saveFile ? saveFile(`books-backup-${today()}.json`, text, "application/json") : flash(L("Saving files works in the Android app", "حفظ الملفات متاح في تطبيق أندرويد")); };
  const restoreRef = useRef(null);
  const restore = async (file) => {
    if (!file) return;
    if (!actorCan("restore")) return flash(L("Only the owner can restore", "المالك وحده يمكنه الاسترجاع"));
    try {
      const st = parseBackup(await file.text());
      if (!window.confirm(L("Replace ALL your current books with this backup?", "تستبدل كل دفاترك الحالية بالنسخة دي؟"))) return;
      await replaceBooks(st); run(() => st, L("Backup restored", "تم استرجاع النسخة")); onClose();
    } catch (e) { flash(e.message); }
  };
  const audit = O.verifyAudit(s);
  return (
    <Sheet title={L("Settings", "الإعدادات")} onClose={onClose} testid="books-settings" footer={<button onClick={save} className={`${btnPrimary} w-full`} data-testid="books-settings-save">{L("Save", "حفظ")}</button>}>
      <Section title={L("Company (printed on every document)", "الشركة (تُطبع على كل مستند)")}>
        <div className="space-y-2.5">
          <Field label={L("Company name (English)", "اسم الشركة (إنجليزي)")}><Input value={c.name} onChange={set("name")} data-testid="co-name" /></Field>
          <Field label={L("Company name (Arabic)", "اسم الشركة (عربي)")}><Input value={c.nameAr} onChange={set("nameAr")} dir="rtl" data-testid="co-name-ar" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L("Tax registration no.", "الرقم الضريبي")}><Input value={c.taxId} onChange={set("taxId")} inputMode="numeric" /></Field>
            <Field label={L("Commercial register", "السجل التجاري")}><Input value={c.regNo} onChange={set("regNo")} /></Field>
          </div>
          <Field label={L("Address", "العنوان")}><Input value={c.address} onChange={set("address")} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={L("Phone", "التليفون")}><Input value={c.phone} onChange={set("phone")} inputMode="tel" /></Field>
            <Field label={L("Email", "الإيميل")}><Input value={c.email} onChange={set("email")} inputMode="email" /></Field>
          </div>
          <Field label={L("Bank details (shown on invoices)", "بيانات البنك (تظهر على الفواتير)")}><Input value={c.bank} onChange={set("bank")} /></Field>
          <Field label={L("Footer line", "سطر أسفل المستند")}><Input value={c.footer} onChange={set("footer")} /></Field>
          <div className="flex items-center gap-3">
            {c.logo ? <img src={c.logo} alt="" className="h-12 max-w-[120px] object-contain border rounded" /> : <div className={`h-12 w-12 rounded border ${th.line} grid place-items-center text-[10px] ${th.sub}`}>{L("logo", "لوجو")}</div>}
            <button onClick={() => logoRef.current && logoRef.current.click()} className={`${BTN} border ${th.line}`}>{c.logo ? L("Change logo", "غيّر اللوجو") : L("Add logo", "ضيف لوجو")}</button>
            {c.logo ? <button onClick={() => set("logo")("")} className={`${BTN} ${th.sub}`}>{L("Remove", "إزالة")}</button> : null}
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickLogo(e.target.files && e.target.files[0])} />
          </div>
        </div>
      </Section>
      <Section title={L("Tax & credit", "الضريبة والائتمان")}>
        <div className="grid grid-cols-2 gap-2">
          <Field label={L("Standard VAT %", "ضريبة القيمة المضافة %")} hint={L("Egypt's standard rate is 14%. Check the current rate with your accountant.", "النسبة العامة في مصر 14٪. تأكّد من النسبة الحالية مع محاسبك.")}><Input value={vat} onChange={setVat} inputMode="decimal" data-testid="co-vat" /></Field>
          <Field label={L("Days customers have to pay", "أيام السداد للعملاء")}><Input value={days} onChange={setDays} inputMode="numeric" /></Field>
        </div>
      </Section>
      <Section title={L("Appearance", "المظهر")}>
        <div className="flex gap-2">{[["light", "Light", "فاتح"], ["dark", "Dark", "داكن"]].map(([k, en, ar]) => (
          <button key={k} onClick={() => setTheme(k)} className={`${BTN} border ${themeName === k ? "bg-teal-700 text-white border-teal-700" : th.line}`}>{L(en, ar)}</button>))}</div>
      </Section>
      <Section title={L("PIN lock", "قفل بالرقم السري")}>
        <p className={`text-[12px] mb-2 ${th.sub}`}>{L("Asks for a 4–6 digit PIN when the books are opened. It keeps casual eyes out on a shared phone; it is not encryption.", "يطلب رقمًا سريًا من 4 إلى 6 أرقام عند فتح الدفاتر. يمنع التطفّل على هاتف مشترك؛ وليس تشفيرًا.")}</p>
        <div className="flex gap-2"><div className="flex-1"><Input value={pinIn} onChange={(v) => setPinIn(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder={O.hasPin(s) ? L("New PIN", "رقم سري جديد") : L("Choose a PIN", "اختار رقم سري")} data-testid="books-pin-set" /></div>
          <button onClick={() => run((st) => O.setPin(st, pinIn), L("PIN saved", "حُفظ الرقم السري")).then(() => setPinIn(""))} className={`${BTN} border ${th.line}`} disabled={pinIn.length < 4}>{L("Save", "حفظ")}</button>
          {O.hasPin(s) ? <button onClick={() => run((st) => O.setPin(st, ""), L("PIN removed", "أُزيل الرقم السري"))} className={`${BTN} border ${th.line} text-red-600`}>{L("Remove", "إزالة")}</button> : null}</div>
      </Section>
      <EtaSettings eta={eta} setEta={setEta} />
      <CurrencySection />
      <PriceListSection />
      <UsersSection />
      <Section title={L("Backup", "النسخ الاحتياطي")}>
        <p className={`text-[12px] mb-2 ${th.sub}`}>{L("Your books live only on this phone. Save a backup file regularly (to Drive, WhatsApp or a computer).", "دفاترك على هذا الهاتف فقط. احفظ نسخة احتياطية بانتظام (على Drive أو واتساب أو حاسوب).")}</p>
        <div className="flex gap-2">
          <button onClick={backup} className={`${BTN} border ${th.line} flex items-center gap-1.5`} data-testid="books-backup"><Download size={14} />{L("Save backup", "احفظ نسخة")}</button>
          <button onClick={() => restoreRef.current && restoreRef.current.click()} className={`${BTN} border ${th.line} flex items-center gap-1.5`}><Upload size={14} />{L("Restore", "استرجاع")}</button>
          <input ref={restoreRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => restore(e.target.files && e.target.files[0])} />
        </div>
        <p className={`text-[11px] mt-2 ${audit.ok ? "text-emerald-600" : "text-red-600"}`} data-testid="books-audit">{audit.ok ? L(`Audit log intact (${audit.count} entries)`, `سجل المراجعة سليم (${audit.count} حركة)`) : L(`Audit log changed at entry ${audit.brokenAt}`, `تغيّر سجل المراجعة عند الحركة ${audit.brokenAt}`)}</p>
      </Section>
      <VaultSection onClose={onClose} />
      {actorCan("users") ? <Section title={L("Danger zone", "منطقة الخطر")}>
        <button onClick={async () => { if (!window.confirm(L("Erase ALL your books on this phone? Save a backup first — this cannot be undone.", "حذف كل دفاترك من هذا الهاتف؟ احفظ نسخة احتياطية أولًا — لا يمكن التراجع."))) return; await replaceBooks(O.EMPTY()); run(() => O.EMPTY(), L("All books erased", "حُذفت كل الدفاتر")); onClose(); }} className={`${BTN} border border-red-300 text-red-600`} data-testid="books-erase">{L("Erase all books", "احذف كل الدفاتر")}</button>
      </Section> : null}
      {goCustom ? <Section title={L("More", "المزيد")}><button onClick={() => { onClose(); goCustom(); }} className={`${BTN} border ${th.line} flex items-center gap-1.5`}><Users size={14} />{L("Custom tables (build your own system)", "جداول مخصصة (ابنِ نظامك بنفسك)")}</button></Section> : null}
    </Sheet>
  );
}

function PinLock({ s, onOk, onBack }) {
  const th = useTheme();
  const [pin, setPin] = useState(""); const [bad, setBad] = useState(0);
  const tryPin = (v) => { if (O.checkPin(s, v)) onOk(v); else { setBad((b) => b + 1); setPin(""); } };
  return (
    <div className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-6 ${th.page}`} data-testid="books-lock" dir={isAr() ? "rtl" : "ltr"}>
      <Building2 size={32} className={th.brand} />
      <p className="text-[15px] font-semibold">{L("Enter your PIN to open the books", "اكتب الرقم السري لفتح الدفاتر")}</p>
      <input value={pin} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); if (v.length >= 4 && O.checkPin(s, v)) onOk(v); }} type="password" inputMode="numeric" autoFocus data-testid="books-pin"
        className={`w-40 text-center tracking-[0.5em] text-xl rounded-lg border px-3 py-2 ${th.input}`} />
      {bad ? <p className="text-[12px] text-red-600">{L("Wrong PIN", "الرقم خطأ")}{bad >= 5 ? " · " + L("take a breath and try again", "انتظر قليلًا ثم حاول مرة أخرى") : ""}</p> : null}
      <button onClick={() => tryPin(pin)} className={btnPrimary} disabled={pin.length < 4}>{L("Open", "فتح")}</button>
      <button onClick={onBack} className={`text-[12px] ${th.sub}`}>{L("Back", "رجوع")}</button>
    </div>
  );
}
