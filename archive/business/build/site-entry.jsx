// v6.32 — the exported Business website / desktop program (www/business-site.html): one system, or Fleet, on its own.
// Ali: "exportable so user can push it on a designated website if he wants". erp-v2.js siteHTML() puts the data into
// <script id="attune-site-data">; the records then live in that browser (localStorage / IndexedDB).
import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { setLang, getLang, applyDir, LANG_KEY } from "../i18n.js";
import { SiteSystem, SiteFleet } from "../biz-ui.jsx";
import { ConfirmHost } from "../confirm.jsx";

let payload = null;
try { payload = JSON.parse(document.getElementById("attune-site-data").textContent); } catch (e) {}
try { if (payload && !localStorage.getItem(LANG_KEY) && payload.lang === "ar") setLang("ar", { reload: false }); } catch (e) {}
applyDir();

function Site() {
  const [msg, setMsg] = useState(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2600); return () => clearTimeout(t); }, [msg]);
  const flash = (m) => setMsg(String(m));
  let body;
  if (!payload || !payload.data) body = <p style={{ padding: 24, fontFamily: "system-ui" }}>This file has no data.</p>;
  else if (payload.kind === "fleet") body = <SiteFleet seed={payload.data} flash={flash} />;
  else body = <SiteSystem seed={payload.data} flash={flash} />;
  return <>{body}<ConfirmHost />
    {msg ? <div role="status" data-testid="site-toast" style={{ position: "fixed", insetInline: 16, bottom: 90, zIndex: 90, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
      <span style={{ background: "#0F172A", color: "#FFFFFF", padding: "10px 14px", borderRadius: 12, fontSize: 14, maxWidth: 520 }} dir="auto">{msg}</span></div> : null}</>;
}
const boot = document.getElementById("boot"); if (boot) boot.remove();
createRoot(document.getElementById("root")).render(<Site />);
