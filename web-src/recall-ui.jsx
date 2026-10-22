/* ---- v6.38 (upgrade D3): the small "Remembered" card — what Attune already knows about a person named in the text (recall.js).
   Under Instant's box (a message shared from WhatsApp) and under Home's box. A tap opens the page it came from. */
import React, { useEffect, useMemo, useState } from "react";
import { Brain } from "lucide-react";
import { tr } from "./i18n.js";
import { recallFor } from "./recall.js";
import { loadStores } from "./lifeask.js";

const PAGE = { xray: "xray", life: "life", money: "money", memory: "memory" };
const storesNow = () => { const s = loadStores(); try { s.xray = JSON.parse(localStorage.getItem("attune:xray:v1") || "[]") || []; } catch (e) { s.xray = []; } return s; };

export function RecallCard({ text, navTo, className = "" }) {
  const [t, setT] = useState(text);
  useEffect(() => { const h = setTimeout(() => setT(text), 350); return () => clearTimeout(h); }, [text]);
  const found = useMemo(() => { try { return String(t || "").trim().length >= 3 ? recallFor(t, storesNow()) : []; } catch (e) { return []; } }, [t]);
  if (!found.length) return null;
  return (
    <div className={"rounded-[18px] border border-[var(--c-acc)]/30 bg-[var(--c-soft)] p-3 space-y-1.5 " + className} data-testid="recall-card">
      {found.map((p) => (
        <div key={p.person}>
          <p className="text-[12px] text-[var(--c-acc)] font-extrabold flex items-center gap-1.5 m-0"><Brain size={13} />{tr("Remembered about {p}", { p: p.person })}</p>
          <ul className="m-0 mt-1 p-0 list-none space-y-0.5">{p.items.map((x, i) => (
            <li key={i}><button onClick={() => navTo && navTo(PAGE[x.src])} className="text-start min-h-[36px] text-[13px] font-semibold text-[var(--c-ink)] hover:underline" dir="auto" data-testid="recall-item">• {x.what}</button></li>))}</ul>
        </div>))}
    </div>);
}
