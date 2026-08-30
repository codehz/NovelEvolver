import { search } from "@codemirror/search";
import type { Extension } from "@codemirror/state";

import { editorFindHighlight } from "./editor-find-highlight";

/** Shared CM search state + match decorations (no default panel UI). */
export const editorFindExtensions: Extension[] = [search({ top: true }), editorFindHighlight];
