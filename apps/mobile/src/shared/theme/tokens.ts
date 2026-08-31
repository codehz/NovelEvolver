import { mocha, type MochaHex } from "./mocha";

/**
 * Append 8-bit hex alpha (`#rrggbbaa`). `amount` is 0–1.
 * Replaces CSS `color-mix` / Tailwind `/N` opacity used on desktop.
 */
export function withAlpha(hex: MochaHex | `#${string}`, amount: number): string {
  const clamped = Math.min(1, Math.max(0, amount));
  const alpha = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex.slice(0, 7)}${alpha}`;
}

/**
 * Semantic colors aligned with desktop `apps/desktop/src/index.css` `@theme`.
 * Mocha is pinned — do not follow the system light/dark scheme.
 */
export const color = {
  background: mocha.base,
  foreground: mocha.text,
  muted: mocha.subtext0,
  surface: mocha.mantle,
  crust: mocha.crust,
  primary: mocha.mauve,
  primaryForeground: mocha.crust,
  border: mocha.surface0,
  field: mocha.surface0,
  placeholder: mocha.overlay0,
  overlay: mocha.overlay0,
  overlayMuted: mocha.overlay1,
  subtext: mocha.subtext1,
  error: mocha.red,
  warning: mocha.yellow,
  success: mocha.green,
  info: mocha.blue,
  accent: mocha.mauve,
} as const;

/** Pressed / hover washes matching desktop `interaction-chrome`. */
export const wash = {
  iconButton: withAlpha(mocha.text, 0.08),
  row: withAlpha(mocha.surface0, 0.55),
  panel: withAlpha(mocha.surface0, 0.4),
  mutedFill: withAlpha(mocha.surface0, 0.72),
  backdrop: withAlpha(mocha.crust, 0.55),
  accentSoft: withAlpha(mocha.mauve, 0.14),
  dangerSoft: withAlpha(mocha.red, 0.1),
} as const;

/** Font families registered by the native mobile projects. */
export const fontFamily = {
  sans: "MiSans",
  mono: "Maple Mono CN",
} as const;

/** Type scale in dp, matching desktop rem at 16px root. */
export const fontSize = {
  xxs: 11,
  xs: 12,
  chat: 13,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
} as const;

/** Radius: controls `rounded-sm`, panels `rounded-lg`, pills `rounded-full`. */
export const radius = {
  control: 4,
  md: 6,
  panel: 8,
  pill: 9999,
} as const;

/** 4dp grid, matching Tailwind spacing. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const;

export const theme = {
  mocha,
  color,
  wash,
  fontFamily,
  fontSize,
  radius,
  space,
} as const;
