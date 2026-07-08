import { MockAdapter, createAIClient } from "@codehz/ai";
import type { AIClient, InputItem, Usage } from "@codehz/ai";

export const AI_ADAPTER_KIND = "mock" as const;
export const AI_MODEL = "mock-assistant";
export const AI_INSTRUCTIONS =
  "你是 NovelEvolver 原型里的内置写作助手。当前运行在 mock adapter 上，请简洁回应，并明确这是演示数据。";

function buildMockReply(branchName: string, prompt: string): string {
  const excerpt = prompt.length > 180 ? `${prompt.slice(0, 180)}...` : prompt;
  return [
    `已收到你的请求。当前分支：**${branchName}**。`,
    "当前走的是 `@codehz/ai` 的 `MockAdapter`，下面的内容会用演示数据模拟流式输出。",
    "你的输入摘录：",
    `> ${excerpt.replaceAll("\n", "\n> ")}`,
    "下一步可以继续接入：",
    "- 真实模型 adapter",
    "- 章节正文、设定卡、检索结果等上下文注入",
    "- 工具调用与结果回填",
  ].join("\n\n");
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (normalized === "") {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 1.8));
}

function buildMockUsage(prompt: string, reply: string): Usage {
  const inputTokens = estimateTokenCount(`${AI_INSTRUCTIONS}\n${prompt}`) + 24;
  const outputTokens = estimateTokenCount(reply) + 12;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
  };
}

/**
 * 创建基于 MockAdapter 的演示用 AI 客户端。
 *
 * MockAdapter 会按 `buildMockReply` 生成的内容以流式方式回放，
 * 并附带估算的 token 用量。后续接入真实模型时替换此工厂即可。
 */
export function createMockClient(branchName: string, prompt: string): AIClient {
  const mockReply = buildMockReply(branchName, prompt);
  const mockUsage = buildMockUsage(prompt, mockReply);

  return createAIClient({
    adapter: new MockAdapter({
      handler: async function* () {
        yield {
          type: "message",
          id: "mock-message",
          content: mockReply,
          stream: {
            charsPerSecond: 48,
            chunkSize: 2,
            initialDelayMs: 120,
          },
        };
        yield { type: "complete", usage: mockUsage };
      },
    }),
    model: AI_MODEL,
  });
}

/**
 * 将用户文本包装为 AI 请求的输入项。
 */
export function toInputItem(text: string): InputItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "text", text }],
  };
}
