import { RpcSession, type RpcStub } from "capnweb";

import type { AppRpcRoot } from "#shared/rpc/app-rpc";
import type { AppRpcTransportBridge } from "#shared/rpc/bridge";

import { RendererRpcTransport } from "./app-rpc-transport";

type AppRpcClientState = {
  transport: RendererRpcTransport;
  session: RpcSession<AppRpcRoot>;
  root: RpcStub<AppRpcRoot>;
};

async function createAppRpcClientState(): Promise<AppRpcClientState> {
  const bridge = window.appRpcBridge as AppRpcTransportBridge;
  const { sessionId } = await bridge.connect();
  const transport = new RendererRpcTransport(bridge, sessionId);
  const session = new RpcSession<AppRpcRoot>(transport);
  const root = session.getRemoteMain();

  return { transport, session, root };
}

const appRpcState = await createAppRpcClientState();

export const appRpc = appRpcState.root;
export const windowService = appRpc.window;
export const projectsService = appRpc.projects;

window.addEventListener("beforeunload", () => {
  void appRpcState.transport.disconnect("Window unloaded.");
});
