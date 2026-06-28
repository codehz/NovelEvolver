import { useEffect, useState } from "react";

type Versions = {
  chrome: string;
  electron: string;
  node: string;
};

type WindowState = {
  isMaximized: boolean;
  platform: string;
};

const fallbackVersions: Versions = {
  chrome: "unknown",
  electron: "unknown",
  node: "unknown",
};

const fallbackWindowState: WindowState = {
  isMaximized: false,
  platform: "unknown",
};

function WindowControls({
  isMaximized,
  onMinimize,
  onToggleMaximize,
  onClose,
}: {
  isMaximized: boolean;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center self-stretch app-region-no-drag">
      <button
        aria-label="Minimize window"
        className="inline-flex w-12 items-center justify-center border-0 bg-transparent text-stone-700/92 [font:inherit] [transition:background-color_160ms_ease,color_160ms_ease] hover:bg-stone-800/8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700/45"
        type="button"
        onClick={onMinimize}
      >
        <span className="-translate-y-px text-lg leading-none">-</span>
      </button>
      <button
        aria-label={isMaximized ? "Restore window" : "Maximize window"}
        className="inline-flex w-12 items-center justify-center border-0 bg-transparent text-stone-700/92 [font:inherit] [transition:background-color_160ms_ease,color_160ms_ease] hover:bg-stone-800/8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700/45"
        type="button"
        onClick={onToggleMaximize}
      >
        <span className="-translate-y-px text-sm leading-none">{isMaximized ? "❐" : "□"}</span>
      </button>
      <button
        aria-label="Close window"
        className="inline-flex w-12 items-center justify-center border-0 bg-transparent text-stone-700/92 [font:inherit] [transition:background-color_160ms_ease,color_160ms_ease] hover:bg-red-700/92 hover:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700/45"
        type="button"
        onClick={onClose}
      >
        <span className="-translate-y-px text-sm leading-none">×</span>
      </button>
    </div>
  );
}

export default function App() {
  const [versions, setVersions] = useState<Versions>(fallbackVersions);
  const [windowState, setWindowState] = useState<WindowState>(fallbackWindowState);

  useEffect(() => {
    window.electronAPI
      .getVersions()
      .then(setVersions)
      .catch(() => {
        setVersions(fallbackVersions);
      });
  }, []);

  useEffect(() => {
    window.electronAPI
      .getWindowState()
      .then(setWindowState)
      .catch(() => {
        setWindowState(fallbackWindowState);
      });

    const disposeWindowStateListener = window.electronAPI.onWindowStateChange((state) => {
      setWindowState(state);
    });

    return () => {
      disposeWindowStateListener();
    };
  }, []);

  const isMac = windowState.platform === "darwin";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ef_0%,#f5ead8_42%,#e8d8c0_100%)] text-stone-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pt-3 pb-4 md:px-6 md:pb-6">
        <header className="flex h-14 items-center justify-between rounded-t-[1.75rem] border border-b-0 border-black/8 bg-white/55 pr-2 pl-4 backdrop-blur-xl select-none app-region-drag md:pl-6">
          <div className={`flex min-w-0 items-center gap-4 ${isMac ? "pl-[4.5rem]" : ""}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-stone-950 text-sm font-semibold tracking-[0.24em] text-stone-50 app-region-no-drag">
              NE
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium tracking-[0.22em] text-stone-500 uppercase">
                NovelEvolver
              </p>
              <p className="truncate text-sm text-stone-700">
                Desktop workspace with a custom title bar
              </p>
            </div>
          </div>

          {isMac ? null : (
            <WindowControls
              isMaximized={windowState.isMaximized}
              onMinimize={() => {
                void window.electronAPI.minimizeWindow();
              }}
              onToggleMaximize={() => {
                void window.electronAPI.toggleMaximizeWindow().then(setWindowState);
              }}
              onClose={() => {
                void window.electronAPI.closeWindow();
              }}
            />
          )}
        </header>

        <section className="flex flex-1 flex-col justify-between rounded-b-[1.75rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_80px_rgba(88,61,37,0.14)] backdrop-blur md:p-12">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center rounded-full border border-amber-950/10 bg-amber-100/70 px-4 py-2 text-sm font-medium tracking-[0.2em] text-amber-950 uppercase">
              Electron + React + TailwindCSS
            </div>

            <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-6">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.04em] text-balance md:text-7xl">
                  NovelEvolver desktop workspace is ready.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-stone-700">
                  Bun drives the toolchain, Vite handles the renderer, and Electron exposes a typed
                  preload bridge for app-facing APIs.
                </p>
              </div>

              <div className="rounded-[1.75rem] border border-stone-200 bg-stone-950 p-6 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <p className="text-sm tracking-[0.24em] text-stone-400 uppercase">Runtime</p>
                <dl className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-stone-400">Electron</dt>
                    <dd className="font-mono text-sm">{versions.electron}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-stone-400">Node.js</dt>
                    <dd className="font-mono text-sm">{versions.node}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-stone-400">Chrome</dt>
                    <dd className="font-mono text-sm">{versions.chrome}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="grid gap-4 pt-10 text-sm text-stone-600 md:grid-cols-3">
            <article className="rounded-3xl border border-stone-200 bg-white/70 p-5">
              <p className="font-medium text-stone-950">Renderer</p>
              <p className="mt-2 leading-6">React 19 with Vite dev server on port 5173.</p>
            </article>
            <article className="rounded-3xl border border-stone-200 bg-white/70 p-5">
              <p className="font-medium text-stone-950">Title Bar</p>
              <p className="mt-2 leading-6">
                Frontend owns drag regions and window actions across platforms.
              </p>
            </article>
            <article className="rounded-3xl border border-stone-200 bg-white/70 p-5">
              <p className="font-medium text-stone-950">Bridge</p>
              <p className="mt-2 leading-6">
                `preload.ts` exposes IPC safely through `contextBridge`.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
