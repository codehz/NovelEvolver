export type ConfirmDialogTone = "default" | "danger";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
};

export type ConfirmDialogSession = {
  requestId: string;
  options: ConfirmDialogOptions;
};

export type ConfirmDialogQueueEntry = ConfirmDialogSession;
