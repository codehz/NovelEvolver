import { HashRouter } from "react-router-dom";

import { WindowFrame } from "./components/WindowFrame";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <HashRouter>
      <WindowFrame>
        <AppRoutes />
      </WindowFrame>
    </HashRouter>
  );
}
