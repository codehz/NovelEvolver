import { randomUUID } from "node:crypto";

import { RpcSession } from "capnweb";
import { BrowserWindow, type IpcMain, type IpcMainInvokeEvent } from "electron";

import {
  APP_RPC_CONNECT_CHANNEL,
  APP_RPC_DISCONNECT_CHANNEL,
  APP_RPC_MESSAGE_CHANNEL,
  isAppRpcDisconnectFrame,
  type AppRpcConnectResult,
  type AppRpcFrame,
} from "@shared/rpc/transport";
import type { RpcMainDeps } from "./deps";
import { ProjectsServiceImpl } from "./projects-service";
import { AppRpcRootImpl } from "./root";
import { MainRpcTransport } from "./transport";
import { WindowServiceImpl } from "./window-service";

type RpcSessionRecord = {
  sessionId: string;
  transport: MainRpcTransport;
  session: RpcSession;
  root: AppRpcRootImpl;
  windowService: WindowServiceImpl;
  webContentsId: number;
};

export class ElectronRpcServer {
  readonly #deps: RpcMainDeps;
  readonly #sessionsByWebContentsId = new Map<number, RpcSessionRecord>();

  constructor(deps: RpcMainDeps) {
    this.#deps = deps;
  }

  register(ipcMain: IpcMain): void {
    ipcMain.handle(APP_RPC_CONNECT_CHANNEL, (event) => this.connect(event));
    ipcMain.handle(APP_RPC_MESSAGE_CHANNEL, (event, frame: AppRpcFrame) =>
      this.handleMessage(event, frame),
    );
    ipcMain.handle(APP_RPC_DISCONNECT_CHANNEL, (event, frame: AppRpcFrame) =>
      this.handleDisconnect(event, frame),
    );
  }

  attachWindow(window: BrowserWindow): void {
    const forwardWindowState = () => {
      const record = this.#sessionsByWebContentsId.get(window.webContents.id);
      if (!record) {
        return;
      }

      record.windowService.emitStateChanged();
    };

    window.on("maximize", forwardWindowState);
    window.on("unmaximize", forwardWindowState);
    window.on("focus", forwardWindowState);
    window.on("blur", forwardWindowState);

    window.webContents.once("destroyed", () => {
      this.closeByWebContentsId(window.webContents.id, new Error("WebContents destroyed."));
    });

    window.webContents.on("render-process-gone", () => {
      this.closeByWebContentsId(window.webContents.id, new Error("Renderer process gone."));
    });
  }

  connect(event: IpcMainInvokeEvent): AppRpcConnectResult {
    const webContents = event.sender;
    const window = BrowserWindow.fromWebContents(webContents);
    if (!window) {
      throw new Error("Window not found for sender.");
    }

    this.closeByWebContentsId(webContents.id, new Error("RPC session replaced by reconnect."));

    const sessionId = randomUUID();
    const windowService = new WindowServiceImpl(window, this.#deps);
    const projectsService = new ProjectsServiceImpl(window, this.#deps);
    const root = new AppRpcRootImpl(windowService, projectsService);
    const transport = new MainRpcTransport(webContents, sessionId);
    const session = new RpcSession(transport, root);

    this.#sessionsByWebContentsId.set(webContents.id, {
      sessionId,
      transport,
      session,
      root,
      windowService,
      webContentsId: webContents.id,
    });

    return { sessionId };
  }

  handleMessage(event: IpcMainInvokeEvent, frame: AppRpcFrame): void {
    const record = this.#sessionsByWebContentsId.get(event.sender.id);
    if (!record || record.sessionId !== frame.sessionId) {
      return;
    }

    record.transport.pushFrame(frame);
  }

  handleDisconnect(event: IpcMainInvokeEvent, frame: AppRpcFrame): void {
    if (!isAppRpcDisconnectFrame(frame)) {
      return;
    }

    const record = this.#sessionsByWebContentsId.get(event.sender.id);
    if (!record || record.sessionId !== frame.sessionId) {
      return;
    }

    this.closeRecord(
      record,
      frame.reason ? new Error(frame.reason) : new Error("Renderer disconnected."),
    );
  }

  closeByWebContentsId(webContentsId: number, error: Error): void {
    const record = this.#sessionsByWebContentsId.get(webContentsId);
    if (!record) {
      return;
    }

    this.closeRecord(record, error);
  }

  closeRecord(record: RpcSessionRecord, error: Error): void {
    if (this.#sessionsByWebContentsId.get(record.webContentsId)?.sessionId !== record.sessionId) {
      return;
    }

    this.#sessionsByWebContentsId.delete(record.webContentsId);
    record.transport.close(error);
    record.root[Symbol.dispose]();
    void record.session.drain().catch(() => undefined);
  }
}
