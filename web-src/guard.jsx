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
    return React.createElement("div", { className: "rounded-2xl border border-amber-800 bg-amber-500/5 p-4 space-y-2", "data-testid": "screen-error" },
      React.createElement("p", { className: "text-sm text-amber-200 font-medium" }, tr("Something went wrong on this screen.")),
      React.createElement("p", { className: "text-[12px] text-slate-400 break-words", dir: "ltr" }, String((this.state.err && this.state.err.message) || this.state.err).slice(0, 300)),
      React.createElement("p", { className: "text-[12px] text-slate-400" }, tr("Your chats and data are safe. Try again — if it keeps happening, send me this message.")),
      React.createElement("button", { className: "px-3 py-2 rounded-lg text-xs font-semibold bg-teal-500 text-slate-950", onClick: () => this.setState({ err: null }) }, tr("Try again")));
  }
}
