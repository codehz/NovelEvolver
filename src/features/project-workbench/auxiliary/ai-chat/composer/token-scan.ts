/**
 * Longest-first greedy scan: find non-overlapping occurrences of known tokens.
 * Longer tokens win when one is a prefix of another (`@foo/bar` vs `@foo`).
 */
export type TokenMatch = {
  from: number;
  to: number;
  token: string;
};

export function findTokenMatches(text: string, tokens: readonly string[]): TokenMatch[] {
  if (tokens.length === 0 || text === "") {
    return [];
  }

  const ordered = [...tokens].sort((left, right) => right.length - left.length);
  const matches: TokenMatch[] = [];
  let index = 0;

  while (index < text.length) {
    let matched: string | null = null;
    for (const token of ordered) {
      if (token !== "" && text.startsWith(token, index)) {
        matched = token;
        break;
      }
    }
    if (matched !== null) {
      matches.push({ from: index, to: index + matched.length, token: matched });
      index += matched.length;
      continue;
    }
    index += 1;
  }

  return matches;
}

/** First occurrence of `token` in `text`, or null. */
export function findFirstToken(text: string, token: string): TokenMatch | null {
  if (token === "") {
    return null;
  }
  const index = text.indexOf(token);
  if (index < 0) {
    return null;
  }
  return { from: index, to: index + token.length, token };
}
