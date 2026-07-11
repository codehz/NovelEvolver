import {
  isQuickPickDismissedError,
  quickPickApi,
  type QuickPickListItem,
} from "#app/shared/lib/quick-pick";
import type { MockAiScenarioSummary } from "#shared/rpc/ai/index";

function toListItem(scenario: MockAiScenarioSummary): QuickPickListItem {
  const traits = [scenario.toolMode === "integrated" ? "真实工具" : "模拟工具"];
  if (scenario.mutatesWorkspace) {
    traits.push("修改工作区");
  }
  return {
    id: scenario.id,
    label: scenario.title,
    detail: `${scenario.description} · ${traits.join(" · ")}`,
  };
}

export async function pickMockAiScenario(
  scenarios: MockAiScenarioSummary[],
): Promise<string | null> {
  try {
    const result = await quickPickApi.showList({
      title: "运行 AI 测试场景",
      searchLabel: "搜索场景",
      searchPlaceholder: "按名称或用途筛选…",
      emptyMessage: "没有可用的测试场景",
      dismissAriaLabel: "关闭测试场景选择器",
      items: scenarios.map(toListItem),
    });
    return result.kind === "item" ? result.id : null;
  } catch (error) {
    if (isQuickPickDismissedError(error)) {
      return null;
    }
    throw error;
  }
}
