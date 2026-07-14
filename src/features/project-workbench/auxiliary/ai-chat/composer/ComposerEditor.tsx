import {
  defaultKeymap,
  history,
  historyKeymap,
  insertNewlineAndIndent,
} from "@codemirror/commands";
import { Compartment, EditorSelection, EditorState, Prec, type Extension } from "@codemirror/state";
import { drawSelection, EditorView, keymap, placeholder as placeholderExt } from "@codemirror/view";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { cn } from "#app/shared/lib/ui/cn";

import { composerEditorHostClass } from "./composer-chrome";
import { isComposerStateEmpty, serializeComposerState } from "./composer-doc";
import {
  addPromptChipEffect,
  clearPromptChipsEffect,
  promptChipExtension,
  type PromptChipData,
} from "./prompt-chip-extension";
import { detectSlashQuery, type PromptSlashItem } from "./slash-query";
import { SlashCommandPicker, type SlashPickerAnchor } from "./SlashCommandPicker";
import { usePromptCatalog } from "./use-prompt-catalog";

export type ComposerEditorHandle = {
  focus: () => void;
  clear: () => void;
  getSerializedText: () => string;
  isEmpty: () => boolean;
};

type ComposerEditorProps = {
  ref?: Ref<ComposerEditorHandle | null>;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** Called when document emptiness / serialized payload may have changed. */
  onDocChange?: () => void;
  /** Enter (no modifiers) when slash menu is closed. Return true if handled. */
  onSubmit?: () => boolean;
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

function coordsToAnchor(coords: { left: number; top: number; bottom: number }): SlashPickerAnchor {
  const x = coords.left;
  const y = coords.top;
  const height = Math.max(1, coords.bottom - coords.top);
  return {
    getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height }),
  };
}

const composerTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      minHeight: "0",
      backgroundColor: "transparent",
      fontSize: "var(--text-chat)",
    },
    "&.cm-focused": {
      outline: "none",
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
      lineHeight: "1.25rem",
      maxHeight: "50vh",
    },
    ".cm-content": {
      padding: "0",
      minHeight: "5rem",
      caretColor: "var(--color-app-foreground)",
      color: "var(--color-app-foreground)",
      fontFamily: "inherit",
    },
    ".cm-line": {
      padding: "0",
    },
    ".cm-placeholder": {
      color: "var(--color-ctp-overlay0)",
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

type SlashMenuState = {
  open: boolean;
  query: string;
  from: number;
  to: number;
  anchor: SlashPickerAnchor | null;
};

const CLOSED_SLASH_MENU: SlashMenuState = {
  open: false,
  query: "",
  from: 0,
  to: 0,
  anchor: null,
};

export function ComposerEditor({
  ref,
  disabled = false,
  placeholder = "输入章节目标、修改要求，或直接粘贴长段正文…",
  "aria-label": ariaLabel = "消息输入",
  className,
  onDocChange,
  onSubmit,
}: ComposerEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onDocChangeRef = useRef(onDocChange);
  const onSubmitRef = useRef(onSubmit);
  const editableCompartmentRef = useRef(new Compartment());
  const placeholderCompartmentRef = useRef(new Compartment());
  const slashMenuFromRef = useRef(0);

  const catalog = usePromptCatalog();
  const catalogRefreshRef = useRef(catalog.refresh);
  catalogRefreshRef.current = catalog.refresh;

  const [slashMenu, setSlashMenu] = useState<SlashMenuState>(CLOSED_SLASH_MENU);
  const slashMenuOpenRef = useRef(false);
  slashMenuOpenRef.current = slashMenu.open;

  onDocChangeRef.current = onDocChange;
  onSubmitRef.current = onSubmit;

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(CLOSED_SLASH_MENU);
  }, []);

  const syncSlashMenu = useCallback((view: EditorView) => {
    if (view.composing) {
      return;
    }
    const detected = detectSlashQuery(view.state);
    if (!detected) {
      if (slashMenuOpenRef.current) {
        setSlashMenu(CLOSED_SLASH_MENU);
      }
      return;
    }

    const coords = view.coordsAtPos(detected.from);
    const anchor = coords ? coordsToAnchor(coords) : null;
    slashMenuFromRef.current = detected.from;
    setSlashMenu({
      open: true,
      query: detected.query,
      from: detected.from,
      to: detected.to,
      anchor,
    });
  }, []);

  const syncSlashMenuRef = useRef(syncSlashMenu);
  syncSlashMenuRef.current = syncSlashMenu;

  const insertPromptChip = useCallback((item: PromptSlashItem) => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const detected = detectSlashQuery(view.state);
    const from = detected?.from ?? slashMenuFromRef.current;
    const to = detected?.to ?? view.state.selection.main.head;
    if (to < from) {
      return;
    }

    const marker = `/${item.slug}`;
    const data: PromptChipData = {
      promptId: item.id,
      slug: item.slug,
      title: item.title,
      body: item.body,
    };

    view.dispatch({
      changes: { from, to, insert: marker },
      selection: EditorSelection.cursor(from + marker.length),
      effects: addPromptChipEffect.of({
        from,
        to: from + marker.length,
        data,
      }),
      userEvent: "input.complete",
    });
    setSlashMenu(CLOSED_SLASH_MENU);
    view.focus();
    onDocChangeRef.current?.();
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      clear: () => {
        const view = viewRef.current;
        if (!view) {
          return;
        }
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: "" },
          effects: clearPromptChipsEffect.of(null),
          selection: EditorSelection.cursor(0),
        });
        setSlashMenu(CLOSED_SLASH_MENU);
        onDocChangeRef.current?.();
      },
      getSerializedText: () => {
        const view = viewRef.current;
        if (!view) {
          return "";
        }
        return serializeComposerState(view.state);
      },
      isEmpty: () => {
        const view = viewRef.current;
        if (!view) {
          return true;
        }
        return isComposerStateEmpty(view.state);
      },
    }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const editableCompartment = editableCompartmentRef.current;
    const placeholderCompartment = placeholderCompartmentRef.current;

    const submitKeymap = keymap.of([
      {
        key: "Enter",
        run: (view) => {
          if (slashMenuOpenRef.current) {
            // Slash picker capture handler owns Enter.
            return true;
          }
          if (view.composing) {
            return false;
          }
          return onSubmitRef.current?.() ?? false;
        },
        shift: insertNewlineAndIndent,
      },
      {
        key: "Escape",
        run: () => {
          if (!slashMenuOpenRef.current) {
            return false;
          }
          setSlashMenu(CLOSED_SLASH_MENU);
          return true;
        },
      },
    ]);

    const extensions: Extension[] = [
      composerTheme,
      EditorView.lineWrapping,
      history(),
      drawSelection(),
      promptChipExtension(),
      // Highest so Enter submits instead of defaultKeymap insertNewlineAndIndent.
      Prec.highest(submitKeymap),
      keymap.of([...defaultKeymap.filter((binding) => binding.key !== "Enter"), ...historyKeymap]),
      editableCompartment.of(editableExtensions(false)),
      placeholderCompartment.of([]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          if (update.docChanged) {
            onDocChangeRef.current?.();
          }
          syncSlashMenuRef.current(update.view);
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
        doc: "",
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

  useEffect(() => {
    if (!slashMenu.open) {
      return;
    }
    void catalogRefreshRef.current();
  }, [slashMenu.open]);

  return (
    <>
      <div
        ref={hostRef}
        className={cn(composerEditorHostClass, disabled && "opacity-50", className)}
        data-disabled={disabled ? "" : undefined}
      />
      <SlashCommandPicker
        open={slashMenu.open}
        query={slashMenu.query}
        items={catalog.items}
        loading={catalog.loading}
        error={catalog.error}
        anchor={slashMenu.anchor}
        onOpenChange={(next) => {
          if (!next) {
            closeSlashMenu();
          }
        }}
        onSelect={insertPromptChip}
      />
    </>
  );
}
