import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef, type CSSProperties } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { disabledSurfaceClass } from "#app/shared/lib/ui/interaction-chrome";

import { settingsPlainTextEditorHostClass } from "./settings-chrome";

const DEFAULT_MIN_HEIGHT = "6.25rem";
const DEFAULT_MAX_HEIGHT = "16rem";

const settingsPlainTextEditorTheme = EditorView.theme(
  {
    "&": {
      height: "auto",
      minHeight: "0",
      backgroundColor: "transparent",
      fontSize: "0.75rem",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
      lineHeight: "1.25rem",
      maxHeight: "var(--settings-pt-max-height, 16rem)",
    },
    ".cm-content": {
      padding: "0.375rem 0",
      minHeight: "var(--settings-pt-min-height, 6.25rem)",
      caretColor: "var(--color-app-foreground)",
      color: "var(--color-app-foreground)",
      fontFamily: "inherit",
    },
    ".cm-line": {
      padding: "0 0.625rem",
    },
    ".cm-placeholder": {
      color: "var(--color-app-muted)",
      fontStyle: "normal",
    },
    ".cm-selectionBackground": {
      backgroundColor: "var(--color-pte-selection) !important",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "var(--color-pte-selection) !important",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "var(--color-app-foreground)",
    },
  },
  { dark: true },
);

/** Local Markdown token styles — reuses global `--color-pte-md-*` tokens only. */
const settingsMarkdownHighlightStyle = HighlightStyle.define([
  {
    tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6],
    color: "var(--color-pte-md-heading)",
    fontWeight: "600",
  },
  { tag: t.strong, fontWeight: "700", color: "var(--color-pte-md-strong)" },
  { tag: t.emphasis, fontStyle: "italic", color: "var(--color-pte-md-emphasis)" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--color-pte-md-muted)" },
  { tag: [t.link, t.url], color: "var(--color-pte-md-link)", textDecoration: "underline" },
  { tag: [t.monospace, t.special(t.monospace)], color: "var(--color-pte-md-code)" },
  { tag: t.quote, color: "var(--color-pte-md-quote)", fontStyle: "italic" },
  { tag: [t.processingInstruction, t.meta], color: "var(--color-pte-md-marker)" },
  { tag: t.contentSeparator, color: "var(--color-pte-md-marker)" },
  { tag: t.keyword, color: "var(--color-pte-md-marker)" },
]);

const settingsMarkdownSyntaxHighlighting = syntaxHighlighting(settingsMarkdownHighlightStyle, {
  fallback: true,
});

type SettingsPlainTextEditorProps = {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** CSS length for content min-height (auto-grow floor). */
  minHeight?: string;
  /** CSS length for scroller max-height (then internal scroll). */
  maxHeight?: string;
};

function editableExtensions(disabled: boolean): Extension {
  return [
    EditorState.readOnly.of(disabled),
    EditorView.editable.of(!disabled),
    EditorView.contentAttributes.of({
      "aria-disabled": disabled ? "true" : "false",
    }),
  ];
}

/**
 * Compact CodeMirror plain-text editor for settings prompt fields.
 * Controlled by `value` / `onValueChange`; external value changes replace the document.
 * Auto-grows with content up to `maxHeight`, then scrolls inside.
 */
export function SettingsPlainTextEditor({
  value,
  onValueChange,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel = "文本编辑器",
  className,
  minHeight = DEFAULT_MIN_HEIGHT,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: SettingsPlainTextEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const suppressOnChangeRef = useRef(false);
  const editableCompartmentRef = useRef(new Compartment());
  const placeholderCompartmentRef = useRef(new Compartment());

  onValueChangeRef.current = onValueChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const editableCompartment = editableCompartmentRef.current;
    const placeholderCompartment = placeholderCompartmentRef.current;

    const extensions: Extension[] = [
      settingsPlainTextEditorTheme,
      EditorView.lineWrapping,
      markdown(),
      settingsMarkdownSyntaxHighlighting,
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      editableCompartment.of(editableExtensions(disabled)),
      placeholderCompartment.of(placeholder ? placeholderExt(placeholder) : []),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }
        const shouldNotify = !suppressOnChangeRef.current;
        suppressOnChangeRef.current = false;
        if (shouldNotify) {
          onValueChangeRef.current(update.state.doc.toString());
        }
      }),
      EditorView.contentAttributes.of({
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
        spellcheck: "true",
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent: host,
    });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaLabel]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === value) {
      return;
    }
    suppressOnChangeRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(editableExtensions(disabled)),
    });
  }, [disabled]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: placeholderCompartmentRef.current.reconfigure(
        placeholder ? placeholderExt(placeholder) : [],
      ),
    });
  }, [placeholder]);

  const hostStyle = {
    "--settings-pt-min-height": minHeight,
    "--settings-pt-max-height": maxHeight,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className={cn(settingsPlainTextEditorHostClass, disabled && disabledSurfaceClass, className)}
      data-disabled={disabled ? "" : undefined}
      style={hostStyle}
    />
  );
}
