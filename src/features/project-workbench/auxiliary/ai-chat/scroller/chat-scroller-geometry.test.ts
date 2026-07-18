import { describe, expect, test } from "bun:test";

import {
  classifyPathChange,
  findDivergentIndex,
  findFirstNewTurnAnchorId,
  findLastSharedPrefixId,
  findLastTurnAnchorId,
  getScrollableEdges,
  getScrollTopForElement,
  isAtScrollLiveEdge,
  resolveBranchSwitchPinTarget,
} from "./chat-scroller-geometry";

function msgs(...ids: string[]): { id: string }[] {
  return ids.map((id) => ({ id }));
}

describe("classifyPathChange", () => {
  test("empty both", () => {
    expect(classifyPathChange([], [])).toBe("empty");
  });

  test("same sequence", () => {
    expect(classifyPathChange(["a", "b"], ["a", "b"])).toBe("same");
  });

  test("pure append", () => {
    expect(classifyPathChange(["a"], ["a", "b"])).toBe("append");
    expect(classifyPathChange([], ["a"])).toBe("append");
  });

  test("pure prepend", () => {
    expect(classifyPathChange(["b", "c"], ["a", "b", "c"])).toBe("prepend");
  });

  test("replace on mid-path branch switch", () => {
    expect(classifyPathChange(["u1", "a1", "u2"], ["u1", "a1b", "u2b"])).toBe("replace");
  });

  test("replace when shortening", () => {
    expect(classifyPathChange(["a", "b", "c"], ["a", "b"])).toBe("replace");
  });
});

describe("resolveBranchSwitchPinTarget", () => {
  test("same-depth assistant sibling", () => {
    expect(resolveBranchSwitchPinTarget(["u1", "a1", "u2"], ["u1", "a1b", "u2b"], 1)).toBe("a1b");
  });

  test("same-depth user sibling", () => {
    expect(resolveBranchSwitchPinTarget(["u1", "a1", "u2"], ["u1", "a1", "u2b"], 2)).toBe("u2b");
  });

  test("out-of-range falls back to last shared prefix", () => {
    expect(resolveBranchSwitchPinTarget(["u1", "a1", "u2", "a2"], ["u1", "a1b"], 4)).toBe("u1");
  });

  test("root sibling with no shared prefix", () => {
    expect(resolveBranchSwitchPinTarget(["u1", "a1"], ["u1b", "a1b"], 0)).toBe("u1b");
    expect(resolveBranchSwitchPinTarget(["u1", "a1"], ["u1b", "a1b"], 5)).toBe("u1b");
  });

  test("empty next", () => {
    expect(resolveBranchSwitchPinTarget(["u1"], [], 0)).toBeNull();
  });
});

describe("findDivergentIndex", () => {
  test("first differing id", () => {
    expect(findDivergentIndex(msgs("u1", "a1"), msgs("u1", "a1b"))).toBe(1);
  });

  test("equal paths return length", () => {
    expect(findDivergentIndex(msgs("u1", "a1"), msgs("u1", "a1"))).toBe(2);
  });

  test("prefix / empty", () => {
    expect(findDivergentIndex(msgs("u1", "a1"), msgs("u1"))).toBe(1);
    expect(findDivergentIndex([], msgs("u1"))).toBe(0);
  });
});

describe("findLastSharedPrefixId", () => {
  test("shared then diverge", () => {
    expect(findLastSharedPrefixId(["u1", "a1", "u2"], ["u1", "a1b"])).toBe("u1");
  });

  test("none shared", () => {
    expect(findLastSharedPrefixId(["u1"], ["u2"])).toBeNull();
  });
});

describe("turn-anchor helpers", () => {
  test("findFirstNewTurnAnchorId", () => {
    const anchors = new Set(["u2", "u3"]);
    expect(findFirstNewTurnAnchorId(["u1", "a1"], ["u1", "a1", "u2", "a2"], anchors)).toBe("u2");
    expect(findFirstNewTurnAnchorId(["u1"], ["u1", "a1"], anchors)).toBeNull();
  });

  test("findLastTurnAnchorId", () => {
    const anchors = new Set(["u1", "u2"]);
    expect(findLastTurnAnchorId(["u1", "a1", "u2", "a2"], anchors)).toBe("u2");
    expect(findLastTurnAnchorId(["a1", "a2"], anchors)).toBeNull();
  });
});

function rect(top: number, bottom: number): DOMRect {
  return {
    top,
    bottom,
    height: bottom - top,
    left: 0,
    right: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON() {},
  } as DOMRect;
}

describe("getScrollTopForElement", () => {
  test("start align uses content top minus margin", () => {
    const viewport = {
      clientHeight: 200,
      scrollHeight: 1000,
      scrollTop: 0,
      getBoundingClientRect: () => rect(0, 200),
    } as HTMLElement;
    const element = {
      offsetHeight: 40,
      getBoundingClientRect: () => rect(300, 340),
    } as HTMLElement;
    // content top = 0 + 300; start with margin 64 → 236; max = 800
    expect(getScrollTopForElement({ element, viewport, align: "start", scrollMargin: 64 })).toBe(
      236,
    );
  });
});

describe("getScrollableEdges", () => {
  test("without content end uses maxScroll residual", () => {
    const viewport = {
      clientHeight: 200,
      scrollHeight: 400,
      scrollTop: 0,
      getBoundingClientRect: () => rect(0, 200),
    } as HTMLElement;
    expect(getScrollableEdges(viewport, 8)).toEqual({ start: false, end: true });
    viewport.scrollTop = 200;
    expect(getScrollableEdges(viewport, 8)).toEqual({ start: true, end: false });
  });

  test("content end ignores empty pad below last message", () => {
    // maxScroll residual would say end=true (pad), but last message fully in view.
    const viewport = {
      clientHeight: 200,
      scrollHeight: 400,
      scrollTop: 0,
      getBoundingClientRect: () => rect(0, 200),
    } as HTMLElement;
    const lastMessage = {
      getBoundingClientRect: () => rect(40, 120),
    } as HTMLElement;
    expect(getScrollableEdges(viewport, 8, lastMessage)).toEqual({ start: false, end: false });
  });

  test("content end true when last message sticks below viewport", () => {
    const viewport = {
      clientHeight: 200,
      scrollHeight: 800,
      scrollTop: 0,
      getBoundingClientRect: () => rect(0, 200),
    } as HTMLElement;
    const lastMessage = {
      getBoundingClientRect: () => rect(150, 280),
    } as HTMLElement;
    expect(getScrollableEdges(viewport, 8, lastMessage)).toEqual({ start: false, end: true });
  });
});

describe("isAtScrollLiveEdge", () => {
  test("near max is live edge even with residual pad", () => {
    const viewport = {
      clientHeight: 200,
      scrollHeight: 400,
      scrollTop: 195,
    } as HTMLElement;
    expect(isAtScrollLiveEdge(viewport, 8)).toBe(true);
    viewport.scrollTop = 100;
    expect(isAtScrollLiveEdge(viewport, 8)).toBe(false);
  });
});
