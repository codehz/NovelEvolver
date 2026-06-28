/// <reference types="vite/client" />

import type { ElectronAPI } from "../shared/window";

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
