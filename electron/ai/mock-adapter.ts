import { MockAdapter, createAIClient, withMockStreaming } from "@codehz/ai";
import type { AIClient, InputItem, MessageItem, NormalizedRequest, Usage } from "@codehz/ai";

export const AI_ADAPTER_KIND = "mock" as const;
export const AI_MODEL = "mock-assistant";
export const AI_INSTRUCTIONS =
  "你是 NovelEvolver 原型里的内置写作助手。当前运行在 mock adapter 上，请简洁回应，并明确这是演示数据。";

/**
 * 从请求 input 中提取最后一条 user 消息的纯文本。
 *
 * mock handler 在被调用时据此生成演示回复，使 client 与具体输入解耦——
 * 同一个 client 实例可服务多次 stream 调用，与真实后端用法一致。
 */
function extractLastUserText(input: readonly InputItem[]): string {
  for (let i = input.length - 1; i >= 0; i--) {
    const item = input[i]!;
    if (item.type === "message" && item.role === "user") {
      return item.content
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("");
    }
  }
  return "";
}

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
 * client 与具体输入解耦：handler 在每次 stream 调用时从 `request.input`
 * 提取最后一条用户消息，再生成演示回复与估算用量。因此同一个 client
 * 实例可服务多轮对话，与真实后端 `client.stream(request)` 的用法一致——
 * 后续接入真实模型时只需替换此工厂，业务层无需改动。
 *
 * `branchName` 作为分支级配置传入（与真实后端按分支定制 instructions /
 * 模型配置的形态对齐），不随单次请求变化。
 */
export function createMockClient(branchName: string): AIClient {
  return createAIClient({
    adapter: new MockAdapter({
      handler: withMockStreaming(
        async function* (request: NormalizedRequest) {
          const prompt = extractLastUserText(request.input);
          const reply = buildMockReply(branchName, prompt);
          const usage = buildMockUsage(prompt, reply);
          yield {
            type: "message",
            id: "mock-message",
            content: reply,
          };
          yield { type: "complete", usage };
        },
        {
          charsPerSecond: 48,
          chunkSize: 2,
          initialDelayMs: 120,
        },
      ),
    }),
    model: AI_MODEL,
  });
}

/**
 * 将用户文本包装为 AI 请求的输入项。
 */
export function toInputItem(text: string): MessageItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "text", text }],
  };
}
