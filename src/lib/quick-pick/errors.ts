export class QuickPickDismissedError extends Error {
  readonly name = "QuickPickDismissedError";

  constructor(message = "Quick pick dismissed") {
    super(message);
  }
}

export function isQuickPickDismissedError(error: unknown): error is QuickPickDismissedError {
  return error instanceof QuickPickDismissedError;
}
