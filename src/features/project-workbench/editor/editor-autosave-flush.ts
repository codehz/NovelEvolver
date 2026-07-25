type AutosaveFlushFn = () => Promise<void>;

let flushAllPending: AutosaveFlushFn | null = null;

export function registerEditorAutosaveFlush(fn: AutosaveFlushFn | null): void {
  flushAllPending = fn;
}

/** Flush every pending debounced editor autosave so transfer/delete sees latest content. */
export async function flushPendingEditorAutosaves(): Promise<void> {
  if (flushAllPending === null) {
    return;
  }
  await flushAllPending();
}
