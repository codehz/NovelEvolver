import { useEffect, useState } from "react";

type Versions = {
  chrome: string;
  electron: string;
  node: string;
};

const fallbackVersions: Versions = {
  chrome: "unknown",
  electron: "unknown",
  node: "unknown",
};

export default function App() {
  const [versions, setVersions] = useState<Versions>(fallbackVersions);

  useEffect(() => {
    window.electronAPI.getVersions().then(setVersions).catch(() => {
      setVersions(fallbackVersions);
    });
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff8ef_0%,#f5ead8_42%,#e8d8c0_100%)] px-6 py-10 text-stone-900">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col justify-between rounded-[2rem] border border-black/8 bg-white/70 p-8 shadow-[0_30px_80px_rgba(88,61,37,0.14)] backdrop-blur md:p-12">
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
                Bun drives the toolchain, Vite handles the renderer, and
                Electron exposes a typed preload bridge for app-facing APIs.
              </p>
            </div>

            <div className="rounded-[1.75rem] border border-stone-200 bg-stone-950 p-6 text-stone-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <p className="text-sm uppercase tracking-[0.24em] text-stone-400">
                Runtime
              </p>
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
            <p className="mt-2 leading-6">
              React 19 with Vite dev server on port 5173.
            </p>
          </article>
          <article className="rounded-3xl border border-stone-200 bg-white/70 p-5">
            <p className="font-medium text-stone-950">Styling</p>
            <p className="mt-2 leading-6">
              TailwindCSS v4 wired through the official Vite plugin.
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
    </main>
  );
}
