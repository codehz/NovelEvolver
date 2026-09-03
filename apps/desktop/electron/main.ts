import { join } from "node:path";

import { app, BrowserWindow, ipcMain } from "electron";

import { AppDatabase } from "./db/app-database";
import { ElectronRpcServer } from "./rpc/server/connect";
import { AiAgentsStore } from "./settings/ai-agents-store";
import { AiModelsStore } from "./settings/ai-models-store";
import { AiPromptsStore } from "./settings/ai-prompts-store";
import { AiRuntimePolicyStore } from "./settings/ai-runtime-policy-store";
import { GitCredentialsStore } from "./settings/git-credentials-store";

app.commandLine.appendSwitch("enable-features", "OverlayScrollbar");

const isDev = !app.isPackaged;

// Pin identity before `ready`. Electron derives userData and Linux
// libsecret OSCrypt from `app.getName()` (`productName` / `name`). After
// the monorepo that became `@novelevolver/desktop`, then `NovelEvolver`,
// so old config and encrypted API keys / git secrets were unreachable.
const APP_IDENTITY_NAME = "novelevolver";
app.setName(APP_IDENTITY_NAME);
app.setPath("userData", join(app.getPath("appData"), APP_IDENTITY_NAME));

let appDb: AppDatabase | null = null;
let aiModelsStore: AiModelsStore | null = null;
let aiAgentsStore: AiAgentsStore | null = null;
let aiPromptsStore: AiPromptsStore | null = null;
let aiRuntimePolicyStore: AiRuntimePolicyStore | null = null;
let gitCredentialsStore: GitCredentialsStore | null = null;
let rpcServer: ElectronRpcServer | null = null;

function getAppDb(): AppDatabase {
  if (!appDb) {
    throw new Error("App database is not initialized.");
  }

  return appDb;
}

function getAiModelsStore(): AiModelsStore {
  if (!aiModelsStore) {
    throw new Error("AI models store is not initialized.");
  }

  return aiModelsStore;
}

function getAiAgentsStore(): AiAgentsStore {
  if (!aiAgentsStore) {
    throw new Error("AI agents store is not initialized.");
  }
  return aiAgentsStore;
}

function getAiPromptsStore(): AiPromptsStore {
  if (!aiPromptsStore) {
    throw new Error("AI prompts store is not initialized.");
  }
  return aiPromptsStore;
}

function getAiRuntimePolicyStore(): AiRuntimePolicyStore {
  if (!aiRuntimePolicyStore) {
    throw new Error("AI runtime policy store is not initialized.");
  }
  return aiRuntimePolicyStore;
}

function getGitCredentialsStore(): GitCredentialsStore {
  if (!gitCredentialsStore) {
    throw new Error("Git credentials store is not initialized.");
  }
  return gitCredentialsStore;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    icon: join(__dirname, "../build/icon.png"),
    title: "NovelEvolver",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#1e1e1e",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  rpcServer?.attachWindow(window);

  if (isDev) {
    void window.loadURL("http://localhost:5173");
    return;
  }

  void window.loadFile(join(__dirname, "../dist/index.html"));
}

void app.whenReady().then(() => {
  const userData = app.getPath("userData");
  appDb = new AppDatabase(join(userData, "app-state.db"));
  aiModelsStore = new AiModelsStore(join(userData, "ai-settings.json"));
  aiAgentsStore = new AiAgentsStore(join(userData, "ai-agents.json"), getAiModelsStore);
  aiPromptsStore = new AiPromptsStore(join(userData, "ai-prompts.json"));
  aiRuntimePolicyStore = new AiRuntimePolicyStore(join(userData, "ai-runtime-policy.json"));
  gitCredentialsStore = new GitCredentialsStore(join(userData, "git-credentials.json"));
  rpcServer = new ElectronRpcServer({
    getAppDb,
    getAiModelsStore,
    getAiAgentsStore,
    getAiPromptsStore,
    getAiRuntimePolicyStore,
    getGitCredentialsStore,
    mockAiEnabled: process.env.NOVEL_EVOLVER_MOCK_AI === "1",
    getWindowState: (window) => ({
      isFocused: window.isFocused(),
      isMaximized: window.isMaximized(),
      platform: process.platform,
    }),
  });
  rpcServer.register(ipcMain);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  appDb?.close();
  appDb = null;
  aiModelsStore = null;
  aiAgentsStore = null;
  aiPromptsStore = null;
  aiRuntimePolicyStore = null;
  rpcServer = null;
});
