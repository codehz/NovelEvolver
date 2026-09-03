// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, test } from "bun:test";

import { buildChangeComparisonModel } from "./change-comparison";

describe("buildChangeComparisonModel", () => {
  test("groups separated edits and restores one hunk", () => {
    const model = buildChangeComparisonModel(
      "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine",
      "one\nTWO\nthree\nfour\nfive\nSIX\nseven\neight\nnine",
    );
    expect(model.hunks).toHaveLength(2);
    expect(model.hunks[0].restoredContent).toBe(
      "one\ntwo\nthree\nfour\nfive\nSIX\nseven\neight\nnine",
    );
    expect(model.hunks[1].restoredContent).toBe(
      "one\nTWO\nthree\nfour\nfive\nsix\nseven\neight\nnine",
    );
  });

  test("handles created and deleted text", () => {
    expect(buildChangeComparisonModel("", "new\ntext").hunks[0].restoredContent).toBe("");
    expect(buildChangeComparisonModel("old\ntext", "").hunks[0].restoredContent).toBe("old\ntext");
  });

  test("preserves a final line without a newline", () => {
    const model = buildChangeComparisonModel("before", "after");
    expect(model.hunks[0].restoredContent).toBe("before");
    expect(model.lines.map((line) => line.text)).toEqual(["before", "after"]);
  });
});
