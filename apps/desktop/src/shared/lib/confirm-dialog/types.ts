export type ConfirmDialogTone = "default" | "danger";

/** Two-button confirm (existing). */
export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
};

/** Three-button unsaved-changes choice. */
export type UnsavedChangesDialogOptions = {
  title?: string;
  description?: string;
  saveLabel?: string;
  discardLabel?: string;
  cancelLabel?: string;
};

export type UnsavedChangesChoice = "save" | "discard" | "cancel";

export type ConfirmDialogSession =
  | {
      requestId: string;
      kind: "confirm";
      options: ConfirmDialogOptions;
    }
  | {
      requestId: string;
      kind: "unsaved";
      options: UnsavedChangesDialogOptions;
    };

export type ConfirmDialogQueueEntry = ConfirmDialogSession;
