import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/** Catppuccin-aligned Markdown token styles (colors from `@theme` CSS variables). */
const novelEvolverMarkdownHighlightStyle = HighlightStyle.define([
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

export const novelEvolverMarkdownSyntaxHighlighting = syntaxHighlighting(
  novelEvolverMarkdownHighlightStyle,
  { fallback: true },
);
