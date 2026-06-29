import { RpcSession, type RpcStub } from "capnweb";

import type { AppRpcRoot } from "@shared/rpc/app-rpc";
import type { AppRpcTransportBridge } from "@shared/rpc/bridge";
import { RendererRpcTransport } from "./app-rpc-transport";

type AppRpcClientState = {
  transport: RendererRpcTransport;
  session: RpcSession<AppRpcRoot>;
  root: RpcStub<AppRpcRoot>;
};

let appRpcStatePromise: Promise<AppRpcClientState> | null = null;
let windowServicePromise: Promise<unknown> | null = null;
let projectsServicePromise: Promise<unknown> | null = null;

async function createAppRpcClientState(): Promise<AppRpcClientState> {
  const bridge = window.appRpcBridge as AppRpcTransportBridge;
  const { sessionId } = await bridge.connect();
  const transport = new RendererRpcTransport(bridge, sessionId);
  const session = new RpcSession<AppRpcRoot>(transport);
  const root = session.getRemoteMain();

  return { transport, session, root };
}

async function getAppRpcState(): Promise<AppRpcClientState> {
  appRpcStatePromise ??= createAppRpcClientState();
  return appRpcStatePromise;
}

export async function getAppRpc(): Promise<RpcStub<AppRpcRoot>> {
  const state = await getAppRpcState();
  return state.root;
}

export async function getWindowService() {
  if (!windowServicePromise) {
    windowServicePromise = getAppRpc().then((root) => root.getWindowService());
  }

  return windowServicePromise as Promise<
    Awaited<ReturnType<RpcStub<AppRpcRoot>["getWindowService"]>>
  >;
}

export async function getProjectsService() {
  if (!projectsServicePromise) {
    projectsServicePromise = getAppRpc().then((root) => root.getProjectsService());
  }

  return projectsServicePromise as Promise<
    Awaited<ReturnType<RpcStub<AppRpcRoot>["getProjectsService"]>>
  >;
}

window.addEventListener("beforeunload", () => {
  if (!appRpcStatePromise) {
    return;
  }

  void appRpcStatePromise.then((state) => state.transport.disconnect("Window unloaded."));
});
