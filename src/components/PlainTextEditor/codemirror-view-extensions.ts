import { markdown } from "@codemirror/lang-markdown";
import { EditorView, lineNumbers } from "@codemirror/view";

import { codeMirrorCustomScrollbarExtension } from "#app/shared/lib/ui/scrollbar";

import { novelEvolverMarkdownSyntaxHighlighting } from "./codemirror-markdown-highlight";
import { novelEvolverEditorTheme } from "./codemirror-theme";

/** Static CodeMirror extensions shared by every plain-text editor instance. */
export const plainTextEditorViewExtensions = [
  novelEvolverEditorTheme,
  lineNumbers(),
  EditorView.lineWrapping,
  codeMirrorCustomScrollbarExtension,
  markdown(),
  novelEvolverMarkdownSyntaxHighlighting,
];
