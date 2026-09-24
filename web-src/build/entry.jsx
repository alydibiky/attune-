import React from "react";
import { createRoot } from "react-dom/client";
import App from "../attune.jsx";

const root = document.getElementById("root");
document.getElementById("boot").remove();
createRoot(root).render(React.createElement(App));
