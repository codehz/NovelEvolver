import { EditorView, lineNumbers } from "@codemirror/view";
import { cn } from "@/lib/cn";
import { codeMirrorCustomScrollbarExtension } from "./codemirror-custom-scrollbar";

const editorHostClass = cn("h-full min-h-0 min-w-0");

const novelEvolverEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      minHeight: 0,
      position: "relative",
      backgroundColor: "transparent",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "0.875rem",
      lineHeight: "var(--spacing-pte-line)",
    },
    ".cm-content": {
      padding: "0",
      caretColor: "var(--color-app-foreground)",
      color: "var(--color-app-foreground)",
    },
    ".cm-line": {
      padding: "0 0.75rem 0 0",
      minHeight: "var(--spacing-pte-line)",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "none",
      color: "var(--color-pte-line-number)",
    },
    ".cm-gutters-before": {
      paddingLeft: "var(--spacing-pte-gutter-inset)",
      paddingRight: "var(--spacing-pte-gutter)",
    },
    ".cm-lineNumbers .cm-gutterElement": {
      textAlign: "right",
      fontVariantNumeric: "tabular-nums",
      padding: "0 0.25rem 0 0",
      minWidth: "auto",
      lineHeight: "var(--spacing-pte-line)",
      whiteSpace: "nowrap",
    },
    ".cm-activeLine": {
      backgroundColor: "var(--color-pte-line-highlight)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-ctp-mauve)",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--color-pte-selection) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-pte-selection) !important",
    },
  },
  { dark: true },
);

export const plainTextEditorExtensions = [
  novelEvolverEditorTheme,
  lineNumbers(),
  EditorView.lineWrapping,
  codeMirrorCustomScrollbarExtension,
];

export { editorHostClass };
