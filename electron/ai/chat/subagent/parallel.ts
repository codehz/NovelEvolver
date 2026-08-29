/** Run async tasks with a fixed concurrency limit; results preserve task order. */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  if (tasks.length === 0) {
    return [];
  }

  const concurrency = Math.max(1, Math.floor(limit));
  const results: T[] = Array.from({ length: tasks.length });
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= tasks.length) {
        return;
      }
      results[index] = await tasks[index]!();
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}
