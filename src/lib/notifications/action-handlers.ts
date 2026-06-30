type ActionHandler = () => void | Promise<void>;

const handlers = new Map<string, ActionHandler>();

export function actionHandlerKey(notificationId: string, actionId: string): string {
  return `${notificationId}:${actionId}`;
}

export function registerActionHandlers(
  notificationId: string,
  entries: Array<{ id: string; onClick: ActionHandler }>,
): void {
  for (const entry of entries) {
    handlers.set(actionHandlerKey(notificationId, entry.id), entry.onClick);
  }
}

export function unregisterActionHandlers(notificationId: string, actionIds: string[]): void {
  for (const actionId of actionIds) {
    handlers.delete(actionHandlerKey(notificationId, actionId));
  }
}

export function clearActionHandlersForNotification(notificationId: string): void {
  for (const key of handlers.keys()) {
    if (key.startsWith(`${notificationId}:`)) {
      handlers.delete(key);
    }
  }
}

export function runActionHandler(notificationId: string, actionId: string): void {
  const handler = handlers.get(actionHandlerKey(notificationId, actionId));
  if (handler == null) {
    return;
  }
  void Promise.resolve(handler());
}
