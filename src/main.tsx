import React from "react";
import ReactDOM from "react-dom/client";

import App from "#app/App";

import "./index.css";

document.documentElement.classList.add("mocha");

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
