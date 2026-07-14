export type TextStats = {
  char_count: number;
  line_count: number;
  word_count: number;
};

export type TextStatsDelta = {
  char_delta: number;
  line_delta: number;
  word_delta: number;
};

export type WriteTextStats = {
  stats: TextStats;
  previous_stats: TextStats;
  delta: TextStatsDelta;
};

export function computeTextStats(text: string): TextStats {
  const trimmed = text.trim();
  return {
    char_count: text.length,
    line_count: text === "" ? 0 : text.split(/\r?\n/u).length,
    word_count: trimmed === "" ? 0 : trimmed.split(/\s+/u).length,
  };
}

export function computeTextStatsDelta(before: TextStats, after: TextStats): TextStatsDelta {
  return {
    char_delta: after.char_count - before.char_count,
    line_delta: after.line_count - before.line_count,
    word_delta: after.word_count - before.word_count,
  };
}

export function withWriteStats(beforeText: string, afterText: string): WriteTextStats {
  const previous_stats = computeTextStats(beforeText);
  const stats = computeTextStats(afterText);
  return {
    stats,
    previous_stats,
    delta: computeTextStatsDelta(previous_stats, stats),
  };
}

export function computeOptionalTextStats(text: string | null | undefined): TextStats | null {
  if (text === null || text === undefined) {
    return null;
  }
  return computeTextStats(text);
}
