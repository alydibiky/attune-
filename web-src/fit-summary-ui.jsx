/* ---- v7.9 (Ali picked design B + A's slice buttons, 24 Oct 2026): the top of a meal read from a photo — the photo, the dish's
   name and a calorie ring, the ½ · 1 · 1½ · 2 portion buttons (every part scaled together), carbs / protein / fat. The parts it saw
   are the rows under it (each with its own "Change"). Numbers: fit-summary.js. */
import { tr } from "./i18n.js";
import React from "react";
import { mealTitle, portionWord, portionOn, portionLabel, PORTIONS } from "./fit-summary.js";

export function PhotoSummary({ url, items, food, goal, L, ar, onScale }) {
  const t = mealTitle(items), w = portionWord(items.length === 1 ? food : null), on = portionOn(items);
  const sum = items.reduce((a, x) => ({ kcal: a.kcal + (x.kcal || 0), c: a.c + (x.c || 0), p: a.p + (x.p || 0), f: a.f + (x.f || 0), g: a.g + (x.grams || 0) }), { kcal: 0, c: 0, p: 0, f: 0, g: 0 });
  const pct = goal > 0 ? Math.min(100, Math.round((sum.kcal / goal) * 100)) : 0;
  return (
    <div className="space-y-3" data-testid="fit-photo-summary">
      <div className="flex items-center gap-3">
        {url ? <img src={url} alt="" className="w-[120px] h-[120px] rounded-[20px] object-cover shrink-0" /> : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-[21px] font-black leading-tight text-[var(--c-ink)] m-0" dir="auto" data-testid="fit-photo-dish">{ar ? t.ar : tr(t.en)}</h2>
          <p className="m-0 text-[13px] text-[var(--c-mut)] tabular-nums">{(on != null ? portionLabel(on) + " " + (ar ? w[1] : tr(w[0])) + " · " : "") + Math.round(sum.g) + (ar ? " جم" : " g")}</p>
          <div className="mt-2 w-[84px] h-[84px] rounded-full grid place-items-center" style={{ background: `conic-gradient(var(--c-acc) 0 ${pct}%, var(--c-ln) ${pct}% 100%)` }} title={goal ? L(`${pct}% of today's target`, `${pct}% من هدف النهارده`) : ""}>
            <div className="w-[66px] h-[66px] rounded-full grid place-items-center bg-[var(--c-surf)] text-center leading-none">
              <span><b className="block text-[18px] font-black tabular-nums text-[var(--c-ink)]" data-testid="fit-photo-kcal">{Math.round(sum.kcal)}</b><span className="text-[10.5px] font-bold text-[var(--c-mut)]">{L("kcal", "سعرة")}</span></span></div></div>
        </div>
      </div>
      {/* four equal buttons on one row at 360 px: the number big, the word under it */}
      <div className="grid grid-cols-4 gap-2" data-testid="fit-photo-portions">
        {PORTIONS.map((k) => <button key={k} onClick={() => onScale(k)} data-testid={"fit-photo-portion-" + k}
          className={"min-h-[52px] min-w-0 rounded-[20px] border flex flex-col items-center justify-center leading-tight " + (on === k ? "bg-[var(--c-soft)] border-[var(--c-acc)] text-[var(--c-acc)]" : "bg-[var(--c-surf)] border-[var(--c-ln)] text-[var(--c-ink)]")}>
          <b className="text-[16px] font-black tabular-nums">{portionLabel(k)}</b><span className="text-[11px] font-bold truncate max-w-full px-1">{ar ? w[1] : k > 1 ? w[0] + "s" : w[0]}</span></button>)}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center" data-testid="fit-draft-totals">
        {[[Math.round(sum.c) + (ar ? " جم" : " g"), L("Carbs", "كارب")], [Math.round(sum.p) + (ar ? " جم" : " g"), L("Protein", "بروتين")], [Math.round(sum.f) + (ar ? " جم" : " g"), L("Fat", "دهون")]].map(([v, lb]) =>
          <div key={lb} className="rounded-[20px] bg-[var(--c-surf)] border border-[var(--c-ln)] py-2.5 px-1"><b className="block text-[17px] font-black tabular-nums text-[var(--c-ink)]">{v}</b><span className="text-[11.5px] font-bold text-[var(--c-mut)]">{lb}</span></div>)}
      </div>
      <p className="m-0 text-[12px] font-extrabold tracking-[0.06em] uppercase text-[var(--c-mut)]">{L("What I saw", "اللي شفته")}</p>
    </div>);
}
