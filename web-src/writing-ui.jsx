/* ---- v8.5 (E3 of the 27 Oct review — Ali agreed): Writing is ONE box. Paste or type any text, then one button: Improve (a prompt
   for any AI), Shorten, or Humanize (sound like a person). The button opens that tool with the text in it and runs it; Copilot
   and the Prompt lab stay as the tabs next to it. */
import React, { useState } from "react";
import { Wand2, Scissors, PenLine } from "lucide-react";
import { tr } from "./i18n.js";
import * as U from "./ui-kit.jsx";

const ACTIONS = [["improve", "Improve", "A clear, complete prompt for ChatGPT, Claude, Gemini…", Wand2], ["compress", "Shorten", "The same meaning in fewer words", Scissors],
  ["humanize", "Humanize", "Sounds like a person wrote it", PenLine]];

export function WritingBox({ onGo, start = "" }) {
  const [text, setText] = useState(start);
  return (
    <div className={U.page + " rounded-[20px] p-4 md:p-6 space-y-4 lg:max-w-[80ch]"} data-testid="writing-page">
      <div><h2 className={U.h1}>{tr("Writing")}</h2>
        <p className={"m-0 mt-0.5 text-[13px] " + U.muted}>{tr("Paste or type any text, then pick what to do with it.")}</p></div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} dir="auto" rows={7} placeholder={tr("Your text — a prompt, an email, a message, a paragraph…")}
        className={U.area + " min-h-[160px]"} data-testid="writing-text" />
      <div className="grid sm:grid-cols-3 gap-2">
        {ACTIONS.map(([k, l, sub, I]) => (
          <button key={k} onClick={() => onGo(k, text)} disabled={!text.trim()} data-testid={"writing-" + k}
            className={U.card + " p-3.5 text-start min-h-[72px] flex items-start gap-3 hover:border-[var(--c-acc)] disabled:opacity-45"}>
            <span className="w-9 h-9 rounded-[12px] grid place-items-center bg-[var(--c-soft)] text-[var(--c-acc)] shrink-0"><I size={17} /></span>
            <span className="min-w-0"><span className="block text-[14.5px] font-extrabold">{tr(l)}</span><span className={"block text-[12px] " + U.muted}>{tr(sub)}</span></span>
          </button>))}
      </div>
    </div>);
}
