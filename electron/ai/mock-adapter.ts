import { MockAdapter, createAIClient } from "@codehz/ai";
import type {
  AIClient,
  InputItem,
  MessageItem,
  MockHandlerContext,
  NormalizedRequest,
  Usage,
} from "@codehz/ai";

import { AI_TOOL_NAMES } from "./tools/definitions";
import type { ListResourceFilesResult } from "./tools/resource-library";

export const AI_ADAPTER_KIND = "mock" as const;
export const AI_MODEL = "mock-assistant";
export const AI_INSTRUCTIONS =
  "你是 NovelEvolver 原型里的内置写作助手。当前运行在 mock adapter 上，请简洁回应，并明确这是演示数据。";

const LIST_RESOURCE_KEYWORDS =
  /资源库|文件列表|列出.*文件|list\s+files?|list\s+resources?|resources/i;

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

function shouldListResources(prompt: string): boolean {
  return LIST_RESOURCE_KEYWORDS.test(prompt);
}

function extractPathFromPrompt(prompt: string): string {
  const pathMatch = prompt.match(/path\s*[:：]\s*["']?([^"'\n]+)["']?/i);
  if (pathMatch?.[1]) {
    return pathMatch[1]!.trim();
  }

  const quotedMatch = prompt.match(/["']([^"']+)["']/);
  if (quotedMatch?.[1] && !LIST_RESOURCE_KEYWORDS.test(quotedMatch[1]!)) {
    return quotedMatch[1]!.trim();
  }

  return "";
}

function findLastUserMessageIndex(input: readonly InputItem[]): number {
  for (let i = input.length - 1; i >= 0; i--) {
    const item = input[i]!;
    if (item.type === "message" && item.role === "user") {
      return i;
    }
  }
  return -1;
}

function hasListResourceToolResultAfterLastUser(input: readonly InputItem[]): boolean {
  const lastUserIndex = findLastUserMessageIndex(input);
  for (let i = input.length - 1; i > lastUserIndex; i--) {
    const item = input[i]!;
    if (item.type === "tool_result" && item.toolName === AI_TOOL_NAMES.list_resource_files) {
      return true;
    }
  }
  return false;
}

function findListResourceToolResultAfterLastUser(
  input: readonly InputItem[],
): ListResourceFilesResult | null {
  const lastUserIndex = findLastUserMessageIndex(input);
  for (let i = input.length - 1; i > lastUserIndex; i--) {
    const item = input[i]!;
    if (
      item.type === "tool_result" &&
      item.toolName === AI_TOOL_NAMES.list_resource_files &&
      item.outcome === "success"
    ) {
      for (const block of item.content) {
        if (block.type === "json" && block.json !== undefined && typeof block.json === "object") {
          return block.json as ListResourceFilesResult;
        }
      }
    }
  }
  return null;
}

function buildMockReply(branchName: string, prompt: string): string {
  const excerpt = prompt.length > 180 ? `${prompt.slice(0, 180)}...` : prompt;
  return [
    `已收到你的请求。当前分支：**${branchName}**。`,
    "当前走的是 `@codehz/ai` 的 `MockAdapter`，思维链和正文都来自演示数据。",
    "你的输入摘录：",
    `> ${excerpt.replaceAll("\n", "\n> ")}`,
    "我会先给出一段模拟思维链摘要，再输出最终答复，方便前端验证展示层级。",
    "下一步可以继续接入：",
    "- 真实模型 adapter",
    "- 章节正文、设定卡、检索结果等上下文注入",
    "- 更多工具调用与结果回填",
  ].join("\n\n");
}

function buildMockReasoning(branchName: string, prompt: string): string {
  const excerpt = prompt.trim().replaceAll("\n", " ");
  const summarizedPrompt =
    excerpt === "" ? "用户尚未提供有效内容，需要先提示补充上下文。" : excerpt;
  const preview =
    summarizedPrompt.length > 96 ? `${summarizedPrompt.slice(0, 96)}...` : summarizedPrompt;

  return [
    "1. 识别当前任务处于 mock adapter，目标是生成稳定、可观察的演示流。",
    `2. 锁定分支上下文为「${branchName}」，确保后续多分支会话能展示隔离效果。`,
    `3. 从用户输入中截取关键请求：${preview}`,
    "4. 输出策略：先流式给出思维链摘要，再给出 markdown 正文，最后补 usage 数据。",
  ].join("\n");
}

function buildListResourceReasoning(branchName: string, path: string): string {
  const scope = path === "" ? "整个资源库" : `目录「${path}」`;
  return [
    "1. 识别用户想查看资源库文件列表。",
    `2. 当前分支为「${branchName}」，将在该分支的 ${scope} 下递归收集文件。`,
    `3. 调用工具 \`${AI_TOOL_NAMES.list_resource_files}\` 获取结构化结果。`,
    "4. 收到 tool_result 后，再整理为 markdown 列表回复用户。",
  ].join("\n");
}

function buildResourceListReply(result: ListResourceFilesResult): string {
  if (result.files.length === 0) {
    return "资源库中没有找到文件。";
  }

  return [
    `共找到 **${result.files.length}** 个文件：`,
    "",
    "| 路径 | 名称 |",
    "| --- | --- |",
    ...result.files.map((file) => `| ${file.path} | ${file.name} |`),
  ].join("\n");
}

function estimateTokenCount(text: string): number {
  const normalized = text.trim();
  if (normalized === "") {
    return 0;
  }

  return Math.max(1, Math.ceil(normalized.length / 1.8));
}

function buildMockUsage(prompt: string, reasoning: string, reply: string): Usage {
  const inputTokens = estimateTokenCount(`${AI_INSTRUCTIONS}\n${prompt}`) + 24;
  const reasoningTokens = estimateTokenCount(reasoning) + 8;
  const outputTokens = estimateTokenCount(reply) + 12;

  return {
    inputTokens,
    reasoningTokens,
    outputTokens,
    totalTokens: inputTokens + reasoningTokens + outputTokens,
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
      handler: async function* (request: NormalizedRequest, _context: MockHandlerContext) {
        const prompt = extractLastUserText(request.input);

        if (shouldListResources(prompt) && !hasListResourceToolResultAfterLastUser(request.input)) {
          const path = extractPathFromPrompt(prompt);
          const reasoning = buildListResourceReasoning(branchName, path);
          const usage = buildMockUsage(prompt, reasoning, "");
          yield {
            type: "reasoning",
            id: "mock-reasoning",
            visibility: "summary",
            content: reasoning,
            stream: {
              charsPerSecond: 36,
              chunkSize: 3,
              initialDelayMs: 80,
            },
          };
          yield {
            type: "tool_call",
            id: "mock-list-resources",
            name: AI_TOOL_NAMES.list_resource_files,
            argumentsText: JSON.stringify({ path }),
          };
          yield { type: "complete", usage };
          return;
        }

        if (hasListResourceToolResultAfterLastUser(request.input)) {
          const toolResult = findListResourceToolResultAfterLastUser(request.input);
          if (toolResult !== null) {
            const reply = buildResourceListReply(toolResult);
            const usage = buildMockUsage(prompt, "", reply);
            yield {
              type: "message",
              id: "mock-message",
              content: reply,
              stream: {
                charsPerSecond: 48,
                chunkSize: 2,
                initialDelayMs: 120,
              },
            };
            yield { type: "complete", usage };
            return;
          }
        }

        const reasoning = buildMockReasoning(branchName, prompt);
        const reply = buildMockReply(branchName, prompt);
        const usage = buildMockUsage(prompt, reasoning, reply);
        yield {
          type: "reasoning",
          id: "mock-reasoning",
          visibility: "summary",
          content: reasoning,
          stream: {
            charsPerSecond: 36,
            chunkSize: 3,
            initialDelayMs: 80,
          },
        };
        yield {
          type: "message",
          id: "mock-message",
          content: reply,
          stream: {
            charsPerSecond: 48,
            chunkSize: 2,
            initialDelayMs: 120,
          },
        };
        yield { type: "complete", usage };
      },
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
