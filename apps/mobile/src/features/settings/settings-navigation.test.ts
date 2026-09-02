// @ts-expect-error Bun test types are intentionally not part of the React Native app tsconfig.
import { describe, expect, it } from "bun:test";

import { initialSettingsNavigationState, settingsNavigationReducer } from "./settings-navigation";

describe("settings navigation", () => {
  it("opens and replaces a single detail", () => {
    const provider = settingsNavigationReducer(initialSettingsNavigationState, {
      type: "open-detail",
      detail: { type: "provider-editor", id: "provider-1" },
    });
    const model = settingsNavigationReducer(provider, {
      type: "open-detail",
      detail: { type: "model-editor", providerId: "provider-1" },
    });

    expect(model).toEqual({
      screen: "detail",
      detail: { type: "model-editor", providerId: "provider-1" },
    });
  });

  it("returns from detail to master", () => {
    const detail = settingsNavigationReducer(initialSettingsNavigationState, {
      type: "open-detail",
      detail: { type: "ai-runtime-policy" },
    });

    expect(settingsNavigationReducer(detail, { type: "show-master" })).toEqual(
      initialSettingsNavigationState,
    );
  });
});
