import type { CompiledNeedle, ContentMatch } from "./search";
import { compileNeedle, findAllMatches } from "./search";

export type ApplyReplacementsOptions = {
  onlyStart?: number;
};

export type ApplyReplacementsResult = {
  next: string;
  count: number;
};

export { compileNeedle, findAllMatches };

/** Expand `$n` / `$&` / `$$` / `$<name>` for a single `RegExpExecArray` hit. */
function expandRegexReplacement(match: RegExpExecArray, replacement: string): string {
  if (!replacement.includes("$")) {
    return replacement;
  }

  return replacement.replace(/\$(\$|&|`|'|<([^>]+)>|(\d{1,2}))/g, (token, _main, name, digits) => {
    if (token === "$$") {
      return "$";
    }
    if (token === "$&") {
      return match[0] ?? "";
    }
    if (token === "$`" || token === "$'") {
      // Keep parity with single-occurrence path; rarely used in novel editing.
      return "";
    }
    if (name !== undefined) {
      return match.groups?.[name] ?? "";
    }
    if (digits !== undefined) {
      // ECMAScript substitution: `$n` / `$nn` — use capture when in range
      // (unmatched optional groups are ""); otherwise `$10` with one group →
      // group1 + "0"; else leave the token unchanged.
      const twoDigit = Number(digits);
      if (twoDigit >= 1 && twoDigit < match.length) {
        return match[twoDigit] ?? "";
      }
      if (digits.length === 2) {
        const oneDigit = Number(digits[0]);
        if (oneDigit >= 1 && oneDigit < match.length) {
          return `${match[oneDigit] ?? ""}${digits[1]}`;
        }
      }
    }
    return token;
  });
}

function replacementForMatch(match: ContentMatch, replacement: string): string {
  if (match.regexMatch !== null) {
    return expandRegexReplacement(match.regexMatch, replacement);
  }
  return replacement;
}

/**
 * Apply find/replace using the same line-oriented match engine as search
 * (`findAllMatches`), so `^` / `$` and multi-match-per-line stay consistent.
 */
export function applyReplacements(
  content: string,
  needle: CompiledNeedle,
  replacement: string,
  options?: ApplyReplacementsOptions,
): ApplyReplacementsResult {
  const matches = findAllMatches(content, needle);
  if (matches.length === 0) {
    return { next: content, count: 0 };
  }

  let selected = matches;
  if (options?.onlyStart !== undefined) {
    const hit = matches.find((match) => match.start === options.onlyStart);
    if (hit === undefined) {
      return { next: content, count: 0 };
    }
    selected = [hit];
  }

  // Splice from the end so earlier offsets stay valid.
  let next = content;
  for (let index = selected.length - 1; index >= 0; index -= 1) {
    const match = selected[index]!;
    const end = match.start + match.length;
    next = next.slice(0, match.start) + replacementForMatch(match, replacement) + next.slice(end);
  }

  return { next, count: selected.length };
}
