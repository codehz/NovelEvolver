/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getVersions: () => Promise<{
      chrome: string;
      electron: string;
      node: string;
    }>;
  };
}
