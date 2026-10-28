/* ---- A crash in one screen stays in that screen (v5.19) ---------------------------------
   Without this, any error while drawing a screen blanked the WHOLE app (React unmounts
   everything). Now the screen shows what happened and a Try again button; chats, the
   model and every other screen keep working. The error goes to the Engine log.       */
import React from "react";
import { tr } from "./i18n.js";

export class Guard extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    try { console.warn("[attune] screen error in", this.props.name, err); } catch (e) {}
    try { if (window.AttuneNative && window.AttuneNative.logLine) window.AttuneNative.logLine("Screen " + this.props.name + ": " + String((err && err.message) || err)); } catch (e) {}
  }
  render() {
    if (!this.state.err) return this.props.children;
    return React.createElement("div", { className: "calm rounded-[20px] border border-[var(--c-warn)]/40 bg-[var(--c-surf)]! text-[var(--c-ink)] p-4 space-y-2", "data-testid": "screen-error" },
      React.createElement("p", { className: "text-[14.5px] text-[var(--c-warn)] font-extrabold m-0" }, tr("Something went wrong on this screen.")),
      React.createElement("p", { className: "text-[12px] text-[var(--c-mut)] break-words m-0", dir: "ltr" }, String((this.state.err && this.state.err.message) || this.state.err).slice(0, 300)),
      React.createElement("p", { className: "text-[12.5px] text-[var(--c-mut)] m-0" }, tr("Your chats and data are safe. Try again — if it keeps happening, send me this message.")),
      React.createElement("button", { className: "min-h-[44px] h-11 px-5 rounded-[12px] text-[13.5px] font-extrabold bg-[var(--c-acc)] text-[var(--c-on-acc)]", onClick: () => this.setState({ err: null }) }, tr("Try again")));
  }
}
