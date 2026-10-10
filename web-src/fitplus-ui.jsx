/* ---- Fit & Food, level 2 screens (v6.2): the parts that put Fit "above Yazio by levels" ----
   Faster logging, food quality, Ramadan mode, the day score, the weekly report, body fat, a week
   plan with one shopping list, reminders. The numbers all come from fitplus.js (code).       */
import React, { useState, useMemo, useEffect } from "react";
import { Plus, Check, Copy, Share2, Star, Timer, Bell, BarChart3, X } from "lucide-react";
import * as F from "./fit.js";
import * as P from "./fitplus.js";
import * as Y from "./fityazio.js";
import * as DB from "./fitdb.js";
import * as FP from "./foodpack.js";
import { nextAt } from "./daily.js";

const r0 = (v) => (v == null ? "—" : Math.round(v));
export const RAMADAN_NAMES = { breakfast: ["Suhoor", "سحور"], lunch: ["Iftar", "فطار"], dinner: ["After Taraweeh", "بعد التراويح"], snacks: ["Snacks", "سناكس"] };
const GRADE_CLS = { A: "bg-emerald-700", B: "bg-lime-600", C: "bg-yellow-500 text-slate-950", D: "bg-orange-500", E: "bg-rose-600" };

/** Nutri-Score letter and NOVA group of a packaged product. */
export function Grades({ x, L }) {
  if (!x || (!x.grade && !x.nova)) return null;
  return (
    <span className="inline-flex items-center gap-1 ms-1 align-middle">
      {x.grade ? <span className={"px-1 rounded text-[10px] font-bold text-white " + (GRADE_CLS[x.grade] || "bg-slate-600")} title="Nutri-Score" data-testid="fit-grade">{x.grade}</span> : null}
      {x.nova ? <span className={"px-1 rounded text-[10px] " + (x.nova === 4 ? "bg-rose-900 text-rose-200" : "bg-slate-700 text-slate-200")} title="NOVA" data-testid="fit-nova">{L(P.NOVA[x.nova].en, P.NOVA[x.nova].ar)}</span> : null}
    </span>
  );
}

/** The day's score (0–100) and sugar / saturated fat / salt against their limits. */
export function DayQuality({ L, day, tg, isToday }) {
  const sc = P.dayScore(day, tg), q = P.qualityTotals(day), lim = P.limits(tg);
  if (!sc) return null;
  // v6.3 details: "0 g sugar" when no food of the day has a label is not zero — it's unknown; and a
  // score before the evening is a score "so far", not a verdict
  const soFar = isToday && new Date().getHours() < 20;
  const bar = (label, v, max) => (
    <div className="min-w-0">
      <div className="flex justify-between text-[11px] text-slate-400"><span>{label}</span><span className={"tabular-nums " + (q.known && v > max ? "text-rose-300" : "")}>{q.known ? `${r0(v)}/${max} g` : "—"}</span></div>
      <div className="h-1.5 rounded-full bg-slate-800 mt-1">{q.known ? <div className={"h-1.5 rounded-full " + (v > max ? "bg-rose-400" : "bg-teal-400")} style={{ width: Math.min(100, (v / max) * 100) + "%" }} /> : null}</div>
    </div>);
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2" data-testid="fit-quality">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-white">{L("Today's score", "درجة اليوم")}{soFar ? <span className="text-[11px] text-slate-400"> · {L("so far", "حتى الآن")}</span> : null}</span>
        <span className={"text-xl font-bold tabular-nums " + (soFar ? "text-slate-200" : sc.score >= 80 ? "text-emerald-300" : sc.score >= 55 ? "text-amber-300" : "text-rose-300")} data-testid="fit-score">{sc.score}<span className="text-[12px] text-slate-500">/100</span></span>
      </div>
      <div className="grid grid-cols-3 gap-3">{bar(L("Sugar", "سكر"), q.sug, lim.sug)}{bar(L("Sat. fat", "دهون مشبعة"), q.sat, lim.sat)}{bar(L("Salt", "ملح"), q.salt, lim.salt)}</div>
      {q.total ? <div className="text-[10.5px] text-slate-500">{q.known ? L(`Sugar, fat and salt from the ${q.known} of ${q.total} foods whose labels give them.`, `السكر والدهون والملح من ${q.known} من ${q.total} أطعمة تذكرها ملصقاتها.`) : L("No sugar / salt data for today's foods — packaged products (barcode or search) carry them.", "لا توجد بيانات سكر وملح لطعام اليوم — تتوفر في المنتجات المعبّأة (بالباركود أو البحث).")}</div> : null}
    </div>
  );
}

/** Ramadan: Fajr and Maghrib for the city, the time to Iftar / the end of Suhoor, the calorie split, water over the night. */
export function RamadanCard({ L, ar, tg, city }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const c = P.CITIES[city] || P.CITIES.cairo, d = new Date(now);
  const tz = P.zoneOffset(d, c.tz);                     // the city's clock, not the phone's (Riyadh picked while in Cairo)
  const t = P.fastTimes(d, c.lat, c.lon, tz), plan = P.ramadanPlan(tg, t);
  const mins = P.cityNowMin(c.tz, d);
  const fasting = t.fajrMin != null && mins >= t.fajrMin && mins < t.maghribMin;
  const left = fasting ? t.maghribMin - mins : ((t.fajrMin - mins + 1440) % 1440);
  const hm = (m) => Math.floor(m / 60) + ":" + String(m % 60).padStart(2, "0");
  return (
    <div className="rounded-2xl border border-violet-800 bg-violet-500/10 p-3 space-y-2" data-testid="fit-ramadan">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-violet-100">🌙 {L("Ramadan", "رمضان")} · {ar ? c.ar : c.en}</span>
        <span className="text-[12px] text-violet-200 tabular-nums" data-testid="fit-ramadan-times">{L("Fajr", "الفجر")} {t.fajr} · {L("Maghrib", "المغرب")} {t.maghrib}</span>
      </div>
      <div className="text-xl font-semibold text-white tabular-nums" data-testid="fit-ramadan-left">{fasting ? L(`Iftar in ${hm(left)}`, `الفطار بعد ${hm(left)}`) : L(`Suhoor ends in ${hm(left)}`, `السحور يخلص بعد ${hm(left)}`)}</div>
      <div className="text-[12px] text-violet-100/90">{L(`Iftar ~${plan.iftar} · after Taraweeh ~${plan.snack} · Suhoor ~${plan.suhoor} kcal · a glass of water every ${plan.everyMin} min from Maghrib to Fajr (${plan.glasses} glasses)`, `الإفطار ~${plan.iftar} · بعد التراويح ~${plan.snack} · السحور ~${plan.suhoor} سعر · كوب ماء كل ${plan.everyMin} دقيقة من المغرب إلى الفجر (${plan.glasses} أكواب)`)}</div>
      {plan.tips.map((x, i) => <div key={i} className="text-[11.5px] text-violet-200/80">• {L(x.en, x.ar)}</div>)}
      <div className="text-[10.5px] text-violet-300/70">{L("Times by the sun's position (Egyptian General Authority angles), ±3 min — follow your local mosque's call.", "المواقيت محسوبة من موقع الشمس (زوايا الهيئة المصرية)، ±3 دقائق — اتّبع أذان المسجد القريب منك.")}</div>
    </div>
  );
}

/** The top of the log sheet: recent foods, yesterday's same meal, my meals, and my own food. */
export function QuickLog({ L, ar, st, upd, adding, dayKey, addToDraft, flash }) {
  const [qa, setQa] = useState(null);   // v6.14: Yazio's "quick add" — calories (and macros) without a food
  const freq = useMemo(() => P.frequentFoods(st.days, { limit: 8 }), [st.days]);
  const y = new Date(dayKey + "T12:00:00"); y.setDate(y.getDate() - 1);
  const yKey = F.today(y), yItems = P.copyMeal(st.days, yKey, adding);
  const mine = st.myMeals || [];
  const [form, setForm] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const saveOwn = () => {
    const fd = P.customFood(form);
    if (fd.error) { flash && flash(L("Fill in the name and the numbers from the label", "اكتب الاسم والأرقام من الملصق")); return; }
    DB.keepFoods([fd]);
    addToDraft([F.itemFromFood(fd, 1, Object.keys(fd.portions).length ? "serving" : "g")]); setForm(null);
  };
  if (form) return (
    <div className="rounded-xl bg-slate-800/60 p-2.5 space-y-2" data-testid="fit-own">
      <div className="text-[13px] text-white">{L("My own food (from its label)", "طعامي الخاص (من الملصق)")}</div>
      <input value={form.name || ""} onChange={(e) => set("name", e.target.value)} placeholder={L("Name", "الاسم")} className="w-full rounded-lg bg-slate-900 px-2 py-1.5 text-[14px] text-white" data-testid="fit-own-name" />
      <div className="flex gap-1.5 text-[12px]">
        {[["100g", L("per 100 g", "لكل ١٠٠ جم")], ["serving", L("per serving", "للحصة")]].map(([k, l]) => <button key={k} onClick={() => set("per", k)} className={"rounded-full px-2.5 py-1 " + ((form.per || "100g") === k ? "bg-emerald-700 text-white" : "bg-slate-900 text-slate-300")}>{l}</button>)}
        <input type="number" value={form.serving || ""} onChange={(e) => set("serving", e.target.value)} placeholder={L("serving g", "الحصة جم")} className="w-24 rounded-lg bg-slate-900 px-2 py-1 text-white" data-testid="fit-own-serving" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {[["kcal", "kcal"], ["p", L("protein", "بروتين")], ["c", L("carbs", "كارب")], ["f", L("fat", "دهون")], ["sug", L("sugar", "سكر")], ["sat", L("sat. fat", "مشبعة")], ["salt", L("salt", "ملح")], ["fib", L("fibre", "ألياف")]].map(([k, l]) => (
          <label key={k} className="text-[10.5px] text-slate-400">{l}<input type="number" inputMode="decimal" value={form[k] ?? ""} onChange={(e) => set(k, e.target.value)} className="w-full rounded bg-slate-900 px-1.5 py-1 text-[13px] text-white" data-testid={"fit-own-" + k} /></label>))}
      </div>
      <div className="flex gap-2"><button onClick={() => setForm(null)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-[12.5px] text-slate-300">{L("Cancel", "إلغاء")}</button>
        <button onClick={saveOwn} className="flex-1 rounded-lg bg-emerald-600 py-1.5 text-[13px] text-white" data-testid="fit-own-save">{L("Save and add", "احفظ وضيف")}</button></div>
    </div>);
  const favs = st.favFoods || [];
  return (
    <div className="space-y-2" data-testid="fit-quick">
      {qa ? <div className="rounded-xl bg-slate-900 border border-slate-700 p-2 grid grid-cols-5 gap-1.5" data-testid="fit-quick">
        {[["kcal", "kcal"], ["p", L("P g", "بروتين")], ["c", L("C g", "كارب")], ["f", L("F g", "دهون")]].map(([k, ph]) => <input key={k} inputMode="decimal" placeholder={ph} value={qa[k] || ""} onChange={(e) => setQa({ ...qa, [k]: e.target.value })} data-testid={"fit-quick-" + k} className="min-w-0 rounded-lg bg-slate-800 px-2 py-1.5 text-[13px] text-white" />)}
        <button onClick={() => { const it = Y.quickItem(qa, ar); if (!it) return; addToDraft([it]); setQa(null); }} className="rounded-lg bg-emerald-600 text-white text-[13px]" data-testid="fit-quick-add">{L("Add", "إضافة")}</button>
      </div> : null}
      {favs.length ? <div className="flex gap-1.5 overflow-x-auto pb-1" data-testid="fit-favs">
        <span className="text-[11px] text-amber-300 self-center shrink-0 flex items-center gap-0.5"><Star size={11} />{L("Favorites:", "المفضلة:")}</span>
        {favs.map((e) => <button key={e.id} onClick={() => addToDraft([{ ...e.item }])} className="shrink-0 rounded-full bg-amber-500/15 border border-amber-700/60 px-2.5 py-1 text-[12px] text-amber-100" data-testid="fit-fav-item">{ar && e.item.ar ? e.item.ar : e.item.name} · {r0(e.item.kcal)}</button>)}
      </div> : null}
      {freq.length ? <div className="flex gap-1.5 overflow-x-auto pb-1" data-testid="fit-recent">
        <span className="text-[11px] text-slate-500 self-center shrink-0">{L("Recent:", "الأخيرة:")}</span>
        {freq.map((e) => <button key={e.key} onClick={() => { const { t, ...x } = e.item; addToDraft([x]); }} className="shrink-0 rounded-full bg-slate-800 px-2.5 py-1 text-[12px] text-slate-200" data-testid="fit-recent-item">{ar && e.item.ar ? e.item.ar : e.item.name} · {r0(e.item.kcal)}</button>)}
      </div> : null}
      <div className="flex flex-wrap gap-1.5">
        {yItems.length ? <button onClick={() => addToDraft(yItems)} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-slate-200 flex items-center gap-1" data-testid="fit-copy-yesterday"><Copy size={12} />{L("Same as yesterday", "مثل أمس")} ({F.sumN(yItems.filter((x) => x.kcal != null)).kcal} kcal)</button> : null}
        {mine.map((m) => <button key={m.id} onClick={() => addToDraft(m.items)} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-amber-200 flex items-center gap-1" data-testid="fit-mymeal"><Star size={12} />{m.name} · {m.kcal}</button>)}
        <button onClick={() => setQa(qa ? null : {})} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-emerald-300 flex items-center gap-1" data-testid="fit-quick-open"><Plus size={12} />{L("Quick add kcal", "إضافة سريعة للسعرات")}</button>
        <button onClick={() => setForm({ per: "100g" })} className="rounded-lg bg-slate-800 px-2.5 py-1 text-[12px] text-sky-300 flex items-center gap-1" data-testid="fit-own-open"><Plus size={12} />{L("My own food", "طعامي الخاص")}</button>
      </div>
    </div>
  );
}

/** "Save as my meal" under the draft. */
export function SaveMyMeal({ L, draft, upd, flash }) {
  const [name, setName] = useState(null);
  if (name == null) return <button onClick={() => setName("")} className="text-[12px] text-amber-300 underline" data-testid="fit-save-mymeal">{L("Save these as “my meal”", "احفظهم كـ «وجبتي»")}</button>;
  return (
    <div className="flex gap-2">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={L("e.g. My usual breakfast", "مثلاً فطاري المعتاد")} className="flex-1 min-w-0 rounded-lg bg-slate-900 px-2 py-1.5 text-[13px] text-white" data-testid="fit-mymeal-name" />
      <button onClick={() => { if (!name.trim()) return; upd((s) => ({ ...s, myMeals: [P.myMeal(name, draft), ...(s.myMeals || [])].slice(0, 20) })); setName(null); flash && flash(L("Saved — one tap next time", "حُفظت — بضغطة واحدة في المرة القادمة")); }}
        className="rounded-lg bg-amber-600 px-3 text-[13px] text-white" data-testid="fit-mymeal-ok"><Check size={14} /></button>
    </div>);
}

/** A week of meals sized to the target, and one shopping list to share. */
export function WeekPlanView({ L, ar, tg, diet, share, close, addToDay }) {
  const week = useMemo(() => P.weekPlan(tg, { diet }), [tg, diet]);
  const list = useMemo(() => P.shoppingList(week), [week]);
  const text = P.shoppingText(list, ar ? "ar" : "en");
  const names = { breakfast: L("Breakfast", "فطار"), lunch: L("Lunch", "غدا"), dinner: L("Dinner", "عشا"), snacks: L("Snack", "سناك") };
  return (
    <div className="space-y-3" data-testid="fit-week">
      <div className="flex items-center justify-between"><h3 className="text-white font-semibold">{L("My week", "أسبوعي")}</h3><button onClick={close} className="text-slate-400"><X size={18} /></button></div>
      {week.map((d) => (
        <div key={d.day} className="rounded-xl bg-slate-900/60 border border-slate-800 p-2.5" data-testid="fit-week-day">
          <div className="flex justify-between text-[12.5px]"><span className="text-white">{new Date(d.day + "T12:00:00").toLocaleDateString(ar ? "ar-EG-u-nu-latn" : undefined, { weekday: "long", day: "numeric", month: "short" })}</span><span className="text-slate-400 tabular-nums">{d.plan.total.kcal} kcal · P {Math.round(d.plan.total.p)}</span></div>
          {Object.entries(d.plan.meals).map(([slot, m]) => <div key={slot} className="text-[12px] text-slate-300 mt-0.5">{names[slot]}: {ar ? m.recipe.ar : m.recipe.en}{m.x !== 1 ? ` ×${m.x}` : ""} · {m.kcal}</div>)}
        </div>))}
      <div className="rounded-xl bg-slate-900/60 border border-emerald-900 p-3 space-y-2" data-testid="fit-shopping">
        <div className="flex items-center justify-between"><span className="text-white font-medium">🛒 {L("Shopping list", "قايمة المشتريات")}</span>
          <span className="flex gap-2">
            <button onClick={() => { try { navigator.clipboard.writeText(text); } catch (e) {} }} className="text-slate-400" title={L("Copy", "انسخ")}><Copy size={16} /></button>
            {share ? <button onClick={() => share(text)} className="text-slate-400" data-testid="fit-shopping-share" title={L("Share", "شارك")}><Share2 size={16} /></button> : null}
          </span></div>
        {list.map((g) => <div key={g.key}><div className="text-[12px] text-emerald-300 mt-1">{ar ? g.ar : g.en}</div>
          {g.items.map((x) => <div key={x.id} className="flex justify-between text-[12.5px] text-slate-200"><span>{ar ? x.ar : x.en}</span><span className="text-slate-400 tabular-nums">{x.grams >= 1000 ? (x.grams / 1000).toFixed(1) + (ar ? " كجم" : " kg") : x.grams + (ar ? " جم" : " g")}</span></div>)}</div>)}
      </div>
    </div>
  );
}

/** The weekly report, by code. */
export function WeekReport({ L, st, tg }) {
  const r = useMemo(() => P.weekReport(st.days, st.weights, tg), [st.days, st.weights, tg]);
  if (!r.logged) return null;
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-sky-900 p-3 space-y-1.5" data-testid="fit-week-report">
      <div className="flex items-center justify-between"><span className="text-[13px] text-white flex items-center gap-1.5"><BarChart3 size={15} className="text-sky-300" />{L("Your week", "أسبوعك")}</span>
        {r.score != null ? <span className="text-[13px] text-sky-200">{L("average score", "متوسط الدرجة")} <b>{r.score}</b></span> : null}</div>
      {r.lines.map((x, i) => <div key={i} className="text-[12.5px] text-slate-300">• {L(x.en, x.ar)}</div>)}
    </div>
  );
}

/** Body fat from a tape measure, and its history. */
export function BodyCard({ L, st, upd }) {
  const pr = st.profile || {};
  const [m, setM] = useState({ waist: "", neck: "", hip: "" });
  const bf = P.bodyFat({ sex: pr.sex, height: pr.cm, ...m });
  const hist = (st.body || []).slice(-6);
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 space-y-2" data-testid="fit-body">
      <div className="text-[13px] text-white">{L("Body fat (tape measure)", "نسبة الدهون (بالمازورة)")}</div>
      <div className="flex gap-2">
        {["waist", "neck", ...(pr.sex === "f" ? ["hip"] : [])].map((k) => (
          <label key={k} className="flex-1 text-[11px] text-slate-400">{L({ waist: "Waist cm", neck: "Neck cm", hip: "Hip cm" }[k], { waist: "الوسط سم", neck: "الرقبة سم", hip: "الأرداف سم" }[k])}
            <input type="number" inputMode="decimal" value={m[k]} onChange={(e) => setM((x) => ({ ...x, [k]: e.target.value }))} className="w-full rounded-lg bg-slate-800 px-2 py-1.5 text-[14px] text-white" data-testid={"fit-body-" + k} /></label>))}
      </div>
      {bf != null ? <div className="flex items-center justify-between"><span className="text-white text-lg font-semibold" data-testid="fit-bodyfat">{bf}% <span className="text-[12px] text-slate-400">{L(P.bodyFatClass(bf, pr.sex).en, P.bodyFatClass(bf, pr.sex).ar)}</span></span>
        <button onClick={() => { upd((s) => ({ ...s, body: [...(s.body || []).filter((x) => x.d !== F.today()), { d: F.today(), ...m, bf }] })); setM({ waist: "", neck: "", hip: "" }); }} className="rounded-lg bg-sky-600 px-3 py-1.5 text-[13px] text-white" data-testid="fit-body-save">{L("Save", "احفظ")}</button></div> : null}
      {hist.length ? <div className="text-[12px] text-slate-400 tabular-nums">{hist.map((x) => `${x.d.slice(5)}: ${x.bf}%`).join(" · ")}</div> : null}
      <div className="text-[10.5px] text-slate-500">{L("US Navy method: waist at the navel (women: narrowest), neck below the Adam's apple — ±3 %. The trend matters more than one number.", "طريقة البحرية الأمريكية: الوسط عند السُرّة (للستات: أضيق مكان)، الرقبة تحت تفاحة آدم — ±٣٪. الاتجاه أهم من رقم واحد.")}</div>
    </div>
  );
}

/** Settings added to "My plan": Ramadan mode with the city, and reminders. */
export function FitSettings({ L, ar, st, upd, native, flash, packText, photoClip, onClip }) {
  const rm = st.ramadan || { on: false, city: "cairo" };
  const setReminders = (on) => {
    upd((s) => ({ ...s, reminders: on }));
    if (!native || !native.schedule) return;
    const now = Date.now(), ids = [];
    const add = (id, time, en, a) => { ids.push(id); if (on) try { native.schedule(JSON.stringify({ id, at: nextAt(time, now), title: ar ? a : en, body: ar ? "افتح الأكل والرياضة" : "Open Fit & Food", repeat: "daily" })); } catch (e) {} };
    for (const r of P.REMINDERS) if (r.time !== "every2h") add("daily-" + r.id, r.time, r.en, r.ar);
    for (const h of ["10:00", "12:00", "16:00", "18:00", "22:00"]) add("daily-fit-water-" + h.slice(0, 2), h, "Drink a glass of water", "اشرب كوب ماء");
    if (!on) for (const id of ids) try { native.unschedule(id); } catch (e) {}
    if (on && native.notifyAllowed && !native.notifyAllowed() && native.askNotifications) native.askNotifications();
    flash && flash(on ? L("Reminders on: meals and water", "التنبيهات شغالة: الوجبات والمية") : L("Reminders off", "التنبيهات مقفولة"));
  };
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2" data-testid="fit-settings">
      {/* v6.10: whose food the app suggests, reads and recognises in photos */}
      <label className="flex flex-wrap items-center gap-2 text-[13px] text-slate-200">🍽 {L("Food from", "أكل بلد")}
        <select value={F.getCountry()} onChange={(e) => { F.setCountry(e.target.value); upd((s) => ({ ...s, country: e.target.value })); }} className="rounded-lg bg-slate-800 px-2 py-1.5 text-[13px] text-white" data-testid="fit-country">
          {Object.entries(F.COUNTRIES).sort((a, b) => (ar ? a[1].ar.localeCompare(b[1].ar, "ar") : a[1].en.localeCompare(b[1].en))).map(([k, c]) => <option key={k} value={k}>{c.flag} {ar ? c.ar : c.en}</option>)}</select></label>
      <p className="text-[11.5px] text-slate-500">{L("Suggestions, food search, typed meals and photos use this country's dishes first.", "تبدأ الاقتراحات والبحث والوجبات المكتوبة والصور بأطعمة هذا البلد.")}</p>
      <label className="flex items-center gap-2 text-[13px] text-slate-200"><input type="checkbox" checked={!!rm.on} onChange={(e) => upd((s) => ({ ...s, ramadan: { ...rm, on: e.target.checked } }))} data-testid="fit-ramadan-on" />🌙 {L("Ramadan mode (Suhoor, Iftar, fasting times)", "وضع رمضان (سحور، فطار، مواعيد الصيام)")}</label>
      {rm.on ? <select value={rm.city} onChange={(e) => upd((s) => ({ ...s, ramadan: { ...rm, city: e.target.value } }))} className="rounded-lg bg-slate-800 px-2 py-1.5 text-[13px] text-white" data-testid="fit-ramadan-city">
        {Object.entries(P.CITIES).map(([k, c]) => <option key={k} value={k}>{ar ? c.ar : c.en}</option>)}</select> : null}
      <FoodPackCard {...{ L, packText, flash }} />
      <FoodClipCard {...{ L, photoClip, flash }} onChange={onClip} />
      <label className="flex items-center gap-2 text-[13px] text-slate-200"><input type="checkbox" checked={!!st.reminders} onChange={(e) => setReminders(e.target.checked)} data-testid="fit-reminders" /><Bell size={14} />{L("Remind me to log meals and drink water", "ذكّرني بتسجيل الوجبات وشرب الماء")}</label>
    </div>
  );
}

/** v6.18 — the offline food pack: 1,000,000+ packaged foods searched on the phone, no signal needed. */
export function FoodPackCard({ L, packText, flash, testPack }) {
  const [info, setInfo] = useState({ count: 0, built: "" });
  const [man, setMan] = useState(null);
  const [busy, setBusy] = useState(null);
  const stop = React.useRef(false);
  const store = () => (testPack || DB.getPackStore());
  const refresh = async () => { const s = store(); if (!s) return; try { const m = await s.getMeta(); setInfo({ count: await s.count(), built: m.built || "" }); } catch (e) {} };
  useEffect(() => { refresh(); }, []);
  const loadManifest = async () => { if (man) return man; const m = JSON.parse(await packText("manifest.json")); setMan(m); return m; };
  const go = async (which) => {
    if (!packText) return;
    stop.current = false; setBusy({ shard: 0, of: 1, count: info.count });
    try {
      const m = await loadManifest();
      const n = which === "starter" ? Math.min(10, m.shards.length) : m.shards.length;
      await FP.installPack({ store: store(), manifest: m, getText: packText, shards: n, isStopped: () => stop.current, onProgress: (p) => setBusy(p) });
      flash && flash(stop.current ? L("Stopped — what was downloaded is kept", "توقف — وحُفظ ما تم تنزيله") : L("The offline food pack is ready", "باقة الأكل بدون إنترنت جاهزة"));
    } catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
    finally { setBusy(null); refresh(); }
  };
  const wipe = async () => { if (!window.confirm(L("Delete the offline food pack from this phone?", "تمسح باقة الأكل من الموبايل؟"))) return; try { await store().clear(); } catch (e) {} refresh(); };
  if (!packText && !info.count && !testPack) return null;
  const n = (v) => (v || 0).toLocaleString("en");
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2" data-testid="fit-foodpack">
      <p className="text-[13px] font-semibold text-slate-100">{L("Offline food pack", "باقة الأكل بدون إنترنت")}</p>
      <p className="text-[12px] text-slate-400">{info.count ? L(`${n(info.count)} packaged foods on this phone${info.built ? " · built " + info.built : ""}. Search and barcodes work without signal.`, `${n(info.count)} منتج على الموبايل${info.built ? " · بتاريخ " + info.built : ""}. البحث والباركود شغالين من غير إنترنت.`)
        : L("Over a million packaged foods from Open Food Facts — Egyptian and Arab products first. Search by name or barcode with no signal.", "أكثر من مليون منتج من Open Food Facts — المنتجات المصرية والعربية أولًا. ابحث بالاسم أو الباركود دون إنترنت.")}</p>
      {busy ? (
        <div className="space-y-1.5"><div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: Math.round((busy.shard / Math.max(1, busy.of)) * 100) + "%" }} /></div>
          <p className="text-[12px] text-slate-400" data-testid="fit-foodpack-progress">{L(`Part ${busy.shard} of ${busy.of} · ${n(busy.count)} foods`, `جزء ${busy.shard} من ${busy.of} · ${n(busy.count)} منتج`)}</p>
          <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12.5px] text-slate-200" onClick={() => { stop.current = true; }}>{L("Stop", "وقّف")}</button></div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white" onClick={() => go("starter")} data-testid="fit-foodpack-starter">{L("Get Egypt + most popular (~240,000, ~30 MB)", "نزّل المصري + الأشهر (~٢٤٠ ألف، ~٣٠ ميجا)")}</button>
          <button className="rounded-lg bg-emerald-800 px-3 py-1.5 text-[12.5px] font-medium text-white" onClick={() => go("all")} data-testid="fit-foodpack-all">{L("Get everything (1,000,000+)", "نزّل الكل (+مليون)")}</button>
          {info.count ? <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12.5px] text-slate-300" onClick={wipe}>{L("Delete", "امسح")}</button> : null}
        </div>)}
    </div>
  );
}

/** v6.10 — the photo fast path's model (fitclip.js): a food photo is recognised in about a second, offline, with no chat model.
 *  Same look as the food pack card. `photoClip` = {status, install(onProgress), stop, remove} from the Android bridge. */
export function FoodClipCard({ L, photoClip, flash, onChange }) {
  const [st, setSt] = useState(() => (photoClip ? photoClip.status() : { installed: false }));
  const [busy, setBusy] = useState(null);
  if (!photoClip) return null;
  const refresh = () => { const s = photoClip.status(); setSt(s); onChange && onChange(!!s.installed); };
  const go = async () => {
    setBusy({ pct: 0, detail: "" });
    try { await photoClip.install((pct, stage, detail) => setBusy({ pct, detail })); flash && flash(L("Photo recognition is ready — a food photo now takes about a second", "التعرّف على الصور جاهز — أصبحت صورة الطعام تستغرق نحو ثانية")); }
    catch (e) { flash && flash(String((e && e.message) || e).slice(0, 160)); }
    finally { setBusy(null); refresh(); }
  };
  const wipe = () => { if (!window.confirm(L("Delete the photo recognition model from this phone?", "تمسح موديل التعرّف على الصور من الموبايل؟"))) return; try { photoClip.remove(); } catch (e) {} refresh(); };
  const mb = Math.round((st.bytes || 0) / 1e6);
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2" data-testid="fit-foodclip">
      <p className="text-[13px] font-semibold text-slate-100">{L("Fast photo recognition", "التعرّف السريع على صور الأكل")}</p>
      <p className="text-[12px] text-slate-400">{st.installed ? L(`On this phone (${mb} MB). A food photo is named in about a second, with no chat model and no internet.`, `موجود على الهاتف (${mb} ميجابايت). يُتعرّف على صورة الطعام في نحو ثانية، دون نموذج محادثة ودون إنترنت.`)
        : L("A small picture model (~100 MB, once) that names the food in a photo in about a second — Egyptian dishes included — offline.", "نموذج صور صغير (~100 ميجابايت، مرة واحدة) يتعرّف على الطعام في الصورة في نحو ثانية — بما فيه الطعام المصري — دون إنترنت.")}</p>
      {busy ? (
        <div className="space-y-1.5"><div className="h-2 rounded bg-slate-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: (busy.pct || 0) + "%" }} /></div>
          <p className="text-[12px] text-slate-400" data-testid="fit-foodclip-progress">{(busy.pct || 0) + "%"}{busy.detail ? " · " + busy.detail.replace(" MB", L(" MB", " ميجا")) : ""}</p>
          <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12.5px] text-slate-200" onClick={() => { try { photoClip.stop(); } catch (e) {} }}>{L("Stop", "وقّف")}</button></div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!st.installed ? <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[12.5px] font-medium text-white" onClick={go} data-testid="fit-foodclip-get">{L("Get it (~100 MB)", "نزّله (~١٠٠ ميجا)")}</button> : null}
          {st.installed || st.bytes ? <button className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12.5px] text-slate-300" onClick={wipe} data-testid="fit-foodclip-delete">{L("Delete", "امسح")}</button> : null}
        </div>)}
    </div>
  );
}

/**
 * v6.4 — Huawei watches (Ali: "I want also Huawei Health connected"). Huawei Health keeps its data to
 * itself — it doesn't share with Health Connect. Health Sync copies it into Health Connect, and from
 * there Attune reads it like any other watch. The steps, with buttons that open the right app.
 */
export const HEALTH_SYNC = "nl.appyhapps.healthsync", HUAWEI_HEALTH = "com.huawei.health";
export const viaHealthSync = (w) => !!(w && (w.sources || []).includes(HEALTH_SYNC));
export function HuaweiGuide({ L, health, status, onDone }) {
  const hs = status && status.healthSync;
  const steps = [
    [hs ? L("Health Sync is installed ✓", "Health Sync متسطّب ✓") : L("Install Health Sync (free trial, then a small one-time payment to its maker — not to us).", "نزّل Health Sync (تجربة مجانية، ثم مبلغ صغير مرة واحدة لمطوّره — وليس لنا)."), HEALTH_SYNC, hs ? L("Open Health Sync", "افتح Health Sync") : L("Get Health Sync", "نزّل Health Sync")],
    [L("In Health Sync: source = Huawei Health → sign in with your Huawei ID and allow it.", "في Health Sync: المصدر = Huawei Health ← ادخل بحساب Huawei ID ووافق."), null],
    [L("Destination = Health Connect → allow steps, calories, distance, heart rate and exercise.", "الوجهة = Health Connect ← وافق على الخطوات والسعرات والمسافة والنبض والتمارين."), null],
    [L("Back here: “Connect my watch”, then Refresh. The first sync can take a few minutes.", "عُد إلى هنا: «ربط ساعتي»، ثم حدّث. قد تستغرق المزامنة الأولى بضع دقائق."), null],
  ];
  return (
    <div className="rounded-xl bg-slate-900/70 border border-rose-900/60 p-2.5 space-y-1.5" data-testid="fit-huawei">
      <div className="text-[12.5px] text-rose-100">{L("Huawei watch: Huawei Health doesn't share with Android's Health Connect by itself — the app Health Sync copies it across (once, then automatically).", "ساعة هواوي: لا يشارك Huawei Health بياناته مع Health Connect في أندرويد تلقائيًا — ينقلها تطبيق Health Sync (تضبطه مرة، ثم يعمل تلقائيًا).")}</div>
      {steps.map(([t, pkg, btn], i) => (
        <div key={i} className="flex items-start gap-2 text-[12px] text-slate-300">
          <span className="shrink-0 w-5 h-5 rounded-full bg-rose-900/70 text-rose-100 text-[11px] flex items-center justify-center">{i + 1}</span>
          <div className="flex-1 min-w-0">{t}{pkg && health && health.openApp ? <button onClick={() => health.openApp(pkg)} className="ms-2 rounded-md bg-rose-700 px-2 py-0.5 text-[11.5px] text-white" data-testid={"fit-huawei-open-" + i}>{btn}</button> : null}</div>
        </div>))}
      {status && status.huawei && health && health.openApp ? <button onClick={() => health.openApp(HUAWEI_HEALTH)} className="text-[11.5px] text-rose-300 underline" data-testid="fit-huawei-app">{L("Open Huawei Health (let it sync the watch first)", "افتح Huawei Health (خليه يعمل مزامنة للساعة الأول)")}</button> : null}
      {onDone ? <button onClick={onDone} className="block text-[11px] text-slate-500 underline">{L("Hide", "اخفي")}</button> : null}
    </div>);
}

/**
 * v6.3 — the watch, through Health Connect (read only): connect once, then today's steps, active
 * calories, distance, heart rate and workouts are read whenever Fit opens or the app comes back.
 * Burned calories use the larger of the watch and the logged workouts, never both.
 */
export function WatchCard({ L, ar, health, st, upd, dayKey, compact }) {
  const [status, setStatus] = useState(() => { try { return health ? health.status() : null; } catch (e) { return null; } });
  const hwKit = health && health.huawei;
  const [hwS, setHwS] = useState(() => { try { return hwKit ? hwKit.status() : null; } catch (e) { return null; } });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [hw, setHw] = useState(false);   // the Huawei steps, opened by hand
  const w = ((st.days[dayKey] || {}).watch) || null;
  // a Huawei Health user whose watch data isn't arriving yet sees the Huawei steps by themselves
  const huaweiNeeded = !!(status && status.huawei && !viaHealthSync(w) && !st.huaweiHide);
  const refresh = async () => {
    if (!health) return;
    const s = health.status(); setStatus(s);
    const h = hwKit ? hwKit.status() : null; setHwS(h);
    const hc = !!(s && s.available === "ready" && s.granted), hw = !!(h && h.configured && h.authorized);
    if (!hc && !hw) return;
    setBusy(true);
    try {
      // v6.5: Health Connect and Huawei Health read side by side; each number is the larger, never the sum
      const [a, b] = await Promise.all([hc ? health.day(dayKey).catch(() => null) : null, hw ? hwKit.day(dayKey).catch(() => null) : null]);
      const d = P.mergeWatch(P.watchHasData(a) ? a : null, P.watchHasData(b) ? b : null);
      if (b && b.empty && !P.watchHasData(a)) setNote(L("Huawei Health sent nothing — open Huawei Health once so the watch syncs, and check Attune is still allowed in Huawei Health → Me → Privacy → Data sharing.", "لم يُرسل Huawei Health شيئًا — افتح Huawei Health مرة لتتزامن الساعة، وتأكد أن Attune ما زال مسموحًا له في Huawei Health ← أنا ← الخصوصية ← مشاركة البيانات."));
      else setNote("");
      if (d && (d.steps != null || d.activeKcal != null || d.workouts)) upd((x) => { const day = x.days[dayKey] || { meals: {}, water: 0, workouts: [] }; return { ...x, watchOn: true, days: { ...x.days, [dayKey]: { ...day, watch: { steps: d.steps || 0, activeKcal: d.activeKcal || 0, totalKcal: d.totalKcal || 0, distanceM: d.distanceM || 0, hrAvg: d.hrAvg || null, hrMax: d.hrMax || null, workouts: d.workouts || [], sources: d.sources || [], at: Date.now() } } } }; });
    } catch (e) {} finally { setBusy(false); }
  };
  useEffect(() => { refresh(); const on = (e) => { if (e && e.detail && e.detail.huawei === false) setNote(e.detail.error ? L(`Huawei sign-in didn't open: ${e.detail.error} — install HMS Core (below) and try again.`, `لم يُفتح تسجيل الدخول إلى هواوي: ${e.detail.error} — نزّل HMS Core (بالأسفل) وحاول مرة أخرى.`) : L("Huawei Health wasn't allowed — tap Connect again and allow steps, calories, distance and heart rate.", "لم يمنح Huawei Health الإذن — اضغط «ربط» مرة أخرى ووافق على الخطوات والسعرات والمسافة والنبض.")); refresh(); }; window.addEventListener("attune-resume", on); window.addEventListener("attune-health-permission", on); return () => { window.removeEventListener("attune-resume", on); window.removeEventListener("attune-health-permission", on); }; }, [dayKey]);
  if (!health) return compact ? null : (
    <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-3 text-[12.5px] text-slate-400" data-testid="fit-watch">⌚ {L("Watch steps and calories work in the Android app.", "تعمل خطوات الساعة وسعراتها في تطبيق أندرويد.")}</div>);
  const ready = status && status.available === "ready";
  const hwDirect = !!(hwS && hwS.configured), hwOn = hwDirect && hwS.authorized;
  const granted = (ready && status.granted > 0) || hwOn;
  // the direct Huawei link, when Attune has its Huawei App ID and this phone has Huawei Health or HMS Core
  const hwOffer = hwDirect && !hwOn && ((status && status.huawei) || hwS.app || hwS.hms);
  const hwButton = hwOffer ? (
    <div className="rounded-xl bg-rose-500/10 border border-rose-800 p-2.5 space-y-1.5" data-testid="fit-huawei-direct">
      <div className="text-[12.5px] text-rose-100">{L("Huawei watch or band: connect Huawei Health directly — steps, calories, distance and heart rate, read only.", "ساعة أو سوار هواوي: اربط Huawei Health مباشرة — الخطوات والسعرات والمسافة والنبض، قراءة فقط.")}</div>
      {hwS.hms ? <button onClick={() => { setNote(""); hwKit.connect(); }} className="w-full rounded-lg bg-rose-600 py-2 text-[13px] font-medium text-white" data-testid="fit-huawei-connect">{L("Connect Huawei Health", "اربط Huawei Health")}</button>
        : <button onClick={() => health.openApp("com.huawei.hwid")} className="w-full rounded-lg bg-rose-700 py-2 text-[13px] text-white" data-testid="fit-huawei-hms">{L("First install HMS Core (Huawei's services — free)", "الأول نزّل HMS Core (خدمات هواوي — ببلاش)")}</button>}
    </div>) : null;
  const noteEl = note ? <div className="text-[11.5px] text-amber-200" data-testid="fit-watch-note">{note}</div> : null;
  if (!granted) {
    if (compact && st.watchSkip) return null;
    return (
      <div className="rounded-2xl border border-teal-800 bg-teal-500/10 p-3 space-y-2" data-testid="fit-watch">
        <div className="text-[13px] text-teal-100">⌚ {L("Connect your watch: steps, calories burned, workouts and heart rate go into your day automatically.", "اربط ساعتك: تُضاف الخطوات والسعرات المحروقة والتمارين ونبض القلب إلى يومك تلقائيًا.")}</div>
        <div className="text-[11.5px] text-teal-200/70">{L("Through Android's Health Connect — works with Samsung Health (Galaxy Watch), Fitbit / Pixel Watch, Garmin Connect, Mi Fitness, Huawei Health (through Health Sync) and others that share to it. Read only; nothing leaves the phone.", "عبر Health Connect في أندرويد — يعمل مع Samsung Health (Galaxy Watch)، وFitbit / Pixel Watch، وGarmin Connect، وMi Fitness، وHuawei Health (عبر Health Sync) وغيرها من التطبيقات المشاركة فيه. قراءة فقط؛ ولا يغادر الهاتفَ أي شيء.")}</div>
        {hwButton}{noteEl}
        {hwDirect ? null : huaweiNeeded || hw ? <HuaweiGuide {...{ L, health, status }} onDone={() => { setHw(false); if (huaweiNeeded) upd((x) => ({ ...x, huaweiHide: true })); }} />
          : <button onClick={() => setHw(true)} className="text-[11.5px] text-rose-300 underline" data-testid="fit-huawei-link">{L("Huawei watch?", "ساعة هواوي؟")}</button>}
        {status && status.available === "none" ? <div className="text-[12px] text-amber-200">{L("This phone doesn't have Health Connect — install it from the Play Store (Android 9–13), or it's built into Settings on Android 14+. Phones without Google services (newer Huawei phones) can't use it.", "لا يحتوي هذا الهاتف على Health Connect — نزّله من Play Store (أندرويد 9–13)، أو تجده في الإعدادات بدءًا من أندرويد 14. ولا يعمل على الهواتف التي بلا خدمات Google (هواتف هواوي الحديثة).")}</div> : (
          <div className="flex gap-2">
            <button onClick={() => { health.connect(); }} className="flex-1 rounded-lg bg-teal-600 py-2 text-[13px] font-medium text-white" data-testid="fit-watch-connect">{status && status.available === "update" ? L("Install Health Connect", "نزّل Health Connect") : L("Connect my watch", "اربط ساعتي")}</button>
            {compact ? <button onClick={() => upd((x) => ({ ...x, watchSkip: true }))} className="rounded-lg bg-slate-800 px-3 text-[12px] text-slate-400">{L("Later", "بعدين")}</button> : null}
          </div>)}
      </div>);
  }
  const km = w && w.distanceM ? (w.distanceM / 1000).toFixed(1) : null;
  return (
    <div className="rounded-2xl bg-slate-900/60 border border-teal-900 p-3 space-y-1.5" data-testid="fit-watch">
      <div className="flex items-center justify-between"><span className="text-[13px] text-white">⌚ {L("From your watch", "من ساعتك")}</span>
        <button onClick={refresh} className="text-[11.5px] text-teal-300 underline" data-testid="fit-watch-refresh">{busy ? L("Reading…", "بقرا…") : L("Refresh", "حدّث")}</button></div>
      {noteEl}{hwButton}
      {w && (w.sources || []).includes(HUAWEI_HEALTH) ? <div className="text-[10.5px] text-rose-300" data-testid="fit-huawei-on">{L("Huawei Health ✓", "Huawei Health ✓")}</div> : null}
      {viaHealthSync(w) ? <div className="text-[10.5px] text-rose-300" data-testid="fit-huawei-on">{L("Huawei Health, through Health Sync ✓", "Huawei Health، عن طريق Health Sync ✓")}</div> : null}
      {hwDirect ? null : !compact && (huaweiNeeded || hw) ? <HuaweiGuide {...{ L, health, status }} onDone={() => { setHw(false); if (huaweiNeeded) upd((x) => ({ ...x, huaweiHide: true })); }} />
        : !compact && !viaHealthSync(w) ? <button onClick={() => setHw(true)} className="text-[11px] text-rose-300 underline" data-testid="fit-huawei-link">{L("Huawei watch?", "ساعة هواوي؟")}</button> : null}
      {w ? <>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><div className="text-lg font-semibold text-white tabular-nums" data-testid="fit-steps">{(w.steps || 0).toLocaleString("en-US")}</div><div className="text-[10.5px] text-slate-400">{L("steps", "خطوة")}</div></div>
          <div><div className="text-lg font-semibold text-white tabular-nums" data-testid="fit-watch-kcal">{w.activeKcal || 0}</div><div className="text-[10.5px] text-slate-400">{L("active kcal", "سعر نشاط")}</div></div>
          <div><div className="text-lg font-semibold text-white tabular-nums">{km ?? "—"}</div><div className="text-[10.5px] text-slate-400">km</div></div>
        </div>
        {w.hrAvg ? <div className="text-[11.5px] text-slate-400">❤ {L(`heart rate ${w.hrAvg} avg · ${w.hrMax} max`, `النبض ${w.hrAvg} متوسط · ${w.hrMax} أقصى`)}</div> : null}
        {(w.workouts || []).length && !compact ? <div className="text-[12px] text-slate-300">{w.workouts.map((x, i) => <div key={i}>• {x.title || L("Workout", "تمرين")} · {x.minutes} {L("min", "د")}</div>)}</div> : null}
        <div className="text-[10.5px] text-slate-500">{L("Burned calories count the watch or your logged workouts — whichever is more, never both.", "تُحسب السعرات المحروقة من الساعة أو من التمارين التي سجّلتها — الأكبر منهما، لا كلاهما.")}</div>
      </> : <div className="text-[12px] text-slate-400">{L("Nothing from the watch today yet — open its app once so it syncs.", "لم يصل شيء من الساعة اليوم بعد — افتح تطبيقها مرة لتتم المزامنة.")}</div>}
    </div>);
}
