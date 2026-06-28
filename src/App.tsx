import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";

import { WindowFrame } from "./components/WindowFrame";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <Router hook={useHashLocation}>
      <WindowFrame>
        <AppRoutes />
      </WindowFrame>
    </Router>
  );
}
