import React from "react";
import { createRoot } from "react-dom/client";
import App from "../attune.jsx";

// v6.28 (Ali: "sometimes the app crashes"): every page already has its own guard (guard.jsx); this one catches what is OUTSIDE a
// page — a window, a sheet, the sidebar — so an error there shows a way back instead of a blank app. Errors (also those in
// timers and promises, which never reach React) are written to the Engine log and kept for the next start.
function note(where, err) {
  const msg = String((err && (err.stack || err.message)) || err || "").slice(0, 600);
  try { localStorage.setItem("attune:lastcrash", JSON.stringify({ at: Date.now(), where, msg })); } catch (e) {}
  try { if (window.AttuneNative && window.AttuneNative.logLine) window.AttuneNative.logLine("Page error (" + where + "): " + msg.split("\n")[0]); } catch (e) {}
}
window.addEventListener("error", (e) => note("script", e.error || e.message));
window.addEventListener("unhandledrejection", (e) => { note("promise", e.reason); try { window.dispatchEvent(new CustomEvent("attune-error", { detail: { msg: String((e.reason && e.reason.message) || e.reason || "") } })); } catch (x) {} });

class RootGuard extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { note("app", err); }
  render() {
    if (!this.state.err) return this.props.children;
    const ar = document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
    return React.createElement("div", { style: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, background: "#0f1514", color: "#e6eeec", fontFamily: "system-ui, sans-serif" }, "data-testid": "app-error", dir: ar ? "rtl" : "ltr" },
      React.createElement("div", { style: { maxWidth: 420, textAlign: "center" } },
        React.createElement("p", { style: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" } }, ar ? "حدث خطأ في Attune" : "Attune ran into a problem"),
        React.createElement("p", { style: { fontSize: 13.5, color: "#95a7a3", margin: "0 0 16px" } }, ar ? "بياناتك محفوظة. افتح Attune من جديد — وسُجّل الخطأ في سجل المحرك." : "Your data is safe. Reopen Attune — the error is saved in the Engine log."),
        React.createElement("button", { onClick: () => { try { location.reload(); } catch (e) {} }, style: { padding: "10px 18px", borderRadius: 12, border: 0, background: "#3cc3ac", color: "#08221d", fontWeight: 700 } }, ar ? "افتح Attune من جديد" : "Reopen Attune")));
  }
}

const root = document.getElementById("root");
document.getElementById("boot").remove();
createRoot(root).render(React.createElement(RootGuard, null, React.createElement(App)));
