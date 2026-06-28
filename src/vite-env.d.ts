/// <reference types="vite/client" />

type WindowState = {
  isMaximized: boolean;
  platform: string;
};

interface Window {
  electronAPI: {
    getWindowState: () => Promise<WindowState>;
    minimizeWindow: () => Promise<void>;
    toggleMaximizeWindow: () => Promise<WindowState>;
    closeWindow: () => Promise<void>;
    onWindowStateChange: (callback: (state: WindowState) => void) => () => void;
  };
}
