import type { AIClient, InputItem, MessageItem } from "@codehz/ai";

import { createScenarioClient } from "./mock/scenario-runner";
import type { MockScenarioDefinition } from "./mock/scenario-types";

export const AI_ADAPTER_KIND = "mock" as const;
export const AI_MODEL = "mock-assistant";
export const AI_INSTRUCTIONS =
  "你是内置写作助手。当前运行在 mock backend 上，请简洁回应，并明确这是演示数据。";

function extractLastUserText(input: readonly InputItem[]): string {
  for (let index = input.length - 1; index >= 0; index--) {
    const item = input[index]!;
    if (item.type !== "message" || item.role !== "user") {
      continue;
    }
    return item.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  }
  return "";
}

const freeformDemoScenario: MockScenarioDefinition = {
  id: "freeform-demo",
  title: "普通演示对话",
  description: "为非测试会话提供简洁的确定性 mock 回复。",
  initialPrompt: "运行普通演示对话。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "reply",
      matches: () => true,
      run: function* ({ request, clientLabel }) {
        const prompt = extractLastUserText(request.input).trim();
        const preview = prompt.length > 120 ? `${prompt.slice(0, 120)}...` : prompt;
        yield {
          type: "reasoning",
          visibility: "summary",
          content: `确认 mock 会话上下文 ${clientLabel}，并生成确定性演示回复。`,
        };
        yield {
          type: "message",
          content: [
            "这是 mock backend 生成的演示数据。",
            "",
            `已收到：${preview || "（空输入）"}`,
            "",
            "可以继续输入下一条写作请求。",
          ].join("\n"),
        };
      },
    },
  ],
};

export function createMockClient(clientLabel: string): AIClient {
  return createScenarioClient({
    scenario: freeformDemoScenario,
    pacing: "preview",
    clientLabel,
  });
}

export function toInputItem(text: string): MessageItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "text", text }],
  };
}
