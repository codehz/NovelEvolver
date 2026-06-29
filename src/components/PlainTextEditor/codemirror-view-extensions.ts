import { EditorView, lineNumbers } from "@codemirror/view";

import { codeMirrorCustomScrollbarExtension } from "@/lib/scrollbar";

import { novelEvolverEditorTheme } from "./codemirror-theme";

/** Static CodeMirror extensions shared by every plain-text editor instance. */
export const plainTextEditorViewExtensions = [
  novelEvolverEditorTheme,
  lineNumbers(),
  EditorView.lineWrapping,
  codeMirrorCustomScrollbarExtension,
];
