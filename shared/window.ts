export type WindowState = {
  isMaximized: boolean;
  platform: string;
};

export type ElectronAPI = {
  getWindowState: () => Promise<WindowState>;
  minimizeWindow: () => Promise<void>;
  toggleMaximizeWindow: () => Promise<WindowState>;
  closeWindow: () => Promise<void>;
  onWindowStateChange: (callback: (state: WindowState) => void) => () => void;
};