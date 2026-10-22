/* ---- v6.47 Settings → Your country (country.js). Picked once (the phone's guess is shown first, saved only when the person
   confirms); then the currency, VAT, weekend, emergency numbers and the next holidays come from it. Tests: e2e_v747country.py. */
import React, { useMemo, useState } from "react";
import { tr, getLang, dateLocale } from "./i18n.js";
import * as C from "./country.js";

const DAY = (n) => new Date(2026, 0, 4 + n).toLocaleDateString(dateLocale(), { weekday: "short" });   // 4 Jan 2026 = a Sunday
export const countryLabel = (code) => {
  try { if (getLang() !== "en") { const n = new Intl.DisplayNames([dateLocale() || getLang()], { type: "region" }).of(code.toUpperCase()); if (n) return n; } } catch (e) {}
  return (C.COUNTRIES[code] || {}).name || code;
};

export function CountryRow({ onChange }) {
  const [saved, setSaved] = useState(() => C.savedCountry());
  const [open, setOpen] = useState(false);
  const guess = useMemo(() => (saved ? null : C.guessCountry()), [saved]);
  const code = saved || guess || "";
  const list = useMemo(() => Object.keys(C.COUNTRIES).map((k) => [k, countryLabel(k)]).sort((a, b) => a[1].localeCompare(b[1])), []);
  const c = C.COUNTRIES[code];
  const today = C.iso(new Date());
  const next = code ? C.upcoming(code, today, open ? 12 : 2) : [];
  const pick = (k) => { C.setCountry(k); setSaved(C.savedCountry()); onChange && onChange(k); };
  const fmt = (d) => new Date(d + "T12:00").toLocaleDateString(dateLocale(), { weekday: "short", day: "numeric", month: "short" });
  return (
    <div className="mb-3" data-testid="country-row">
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0"><span className="block text-[12px] text-[var(--c-ink)]">{tr("Your country")}</span>
          <span className="block text-[11px] text-[var(--c-mut)]">{tr("Money, VAT, holidays and the weekend follow it")}</span></span>
        <select value={code} onChange={(e) => pick(e.target.value)} className="shrink-0 rounded-[14px] border border-[var(--c-ln)] bg-transparent px-2 py-1 text-[12px] text-[var(--c-ink)] max-w-[48%] focus:outline-none focus:border-[var(--c-acc)] placeholder:text-[var(--c-mut)]" data-testid="country-pick">
          {!code ? <option value="">{tr("Choose…")}</option> : null}
          {list.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select>
      </div>
      {!saved && guess ? <button onClick={() => pick(guess)} className="mt-1.5 rounded-lg border border-[var(--c-acc)] px-2.5 py-1 text-[12px] text-[var(--c-acc)]" data-testid="country-confirm">{tr("Yes, I live in {c}", { c: countryLabel(guess) })}</button> : null}
      {c ? <div className="mt-2 rounded-xl border border-[var(--c-ln)] px-3 py-2 text-[12px] text-[var(--c-ink)] space-y-1" data-testid="country-card">
        <p className="m-0">{[c.cur, c.vat == null ? tr("VAT: varies") : tr("VAT {v}%", { v: c.vat }), tr("Weekend: {d}", { d: c.weekend.map(DAY).join(" · ") })].join("  ·  ")}</p>
        <p className="m-0" data-testid="country-tel">{C.emergencyLines(code).join("  ·  ")}</p>
        {c.note ? <p className="m-0 text-[var(--c-mut)]">{tr(c.note)}</p> : null}
        {next.length ? <div data-testid="country-holidays">
          {next.map((h) => <p key={h.date + h.name} className="m-0 flex gap-2"><span className="w-24 shrink-0 text-[var(--c-mut)]">{fmt(h.date)}</span><span className="flex-1">{C.holidayName(h)}{h.lunar ? " ☾" : ""}</span></p>)}
          <button onClick={() => setOpen(!open)} className="text-[var(--c-acc)] text-[12px] mt-1" data-testid="country-more">{open ? tr("Less") : tr("All the holidays")}</button>
        </div> : null}
      </div> : null}
    </div>);
}
