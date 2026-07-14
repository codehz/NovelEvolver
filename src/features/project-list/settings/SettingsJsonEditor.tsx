import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { linter } from "@codemirror/lint";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { settingsJsonEditorHostClass } from "./settings-chrome";

const settingsJsonEditorTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      minHeight: "0",
      backgroundColor: "transparent",
      fontSize: "0.75rem",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "var(--font-mono)",
      lineHeight: "1.35",
      maxHeight: "10rem",
    },
    ".cm-content": {
      padding: "0.375rem 0",
      minHeight: "5.5rem",
      caretColor: "var(--color-app-foreground)",
      color: "var(--color-app-foreground)",
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
    ".cm-diagnostic-error": {
      borderBottom: "1px dashed var(--color-ctp-red)",
    },
  },
  { dark: true },
);

const settingsJsonHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--color-ctp-blue)" },
  { tag: t.string, color: "var(--color-ctp-green)" },
  { tag: t.number, color: "var(--color-ctp-peach)" },
  { tag: t.bool, color: "var(--color-ctp-mauve)" },
  { tag: t.null, color: "var(--color-ctp-mauve)" },
  { tag: t.brace, color: "var(--color-ctp-overlay1)" },
  { tag: t.squareBracket, color: "var(--color-ctp-overlay1)" },
  { tag: t.separator, color: "var(--color-ctp-overlay1)" },
  { tag: t.invalid, color: "var(--color-ctp-red)" },
]);

const settingsJsonSyntaxHighlighting = syntaxHighlighting(settingsJsonHighlightStyle, {
  fallback: true,
});

type SettingsJsonEditorProps = {
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
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
 * Compact CodeMirror JSON editor for settings forms.
 * Controlled by `value` / `onValueChange`; external value changes replace the document.
 */
export function SettingsJsonEditor({
  value,
  onValueChange,
  disabled = false,
  placeholder,
  "aria-label": ariaLabel = "JSON 编辑器",
  className,
}: SettingsJsonEditorProps) {
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
      settingsJsonEditorTheme,
      EditorView.lineWrapping,
      json(),
      settingsJsonSyntaxHighlighting,
      linter(jsonParseLinter()),
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
        spellcheck: "false",
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

  return (
    <div
      ref={hostRef}
      className={cn(settingsJsonEditorHostClass, disabled && "opacity-50", className)}
      data-disabled={disabled ? "" : undefined}
    />
  );
}
