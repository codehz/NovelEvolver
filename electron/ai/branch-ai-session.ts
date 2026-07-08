import { MockAdapter, createAIClient } from "@codehz/ai";
import type { AIResponse, AIStreamEvent, InputItem, Usage } from "@codehz/ai";

import type { AiChatMessage, AiChatMessageUsage, AiChatSnapshot } from "#shared/rpc/ai-rpc";

import { RpcStreamPublisher } from "../lib/stream-publisher";

const AI_ADAPTER_KIND = "mock" as const;
const AI_MODEL = "mock-assistant";
const AI_INSTRUCTIONS =
  "你是 NovelEvolver 原型里的内置写作助手。当前运行在 mock adapter 上，请简洁回应，并明确这是演示数据。";

function messageText(text: string): InputItem {
  return {
    type: "message",
    role: "user",
    content: [{ type: "text", text }],
  };
}

function readResponseText(response: AIResponse): string {
  return response.output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content)
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function toMessageUsage(usage: AIResponse["usage"]): AiChatMessageUsage | null {
  if (!usage) {
    return null;
  }

  const messageUsage: AiChatMessageUsage = {};

  if (typeof usage.inputTokens === "number") {
    messageUsage.inputTokens = usage.inputTokens;
  }
  if (typeof usage.outputTokens === "number") {
    messageUsage.outputTokens = usage.outputTokens;
  }
  if (typeof usage.reasoningTokens === "number") {
    messageUsage.reasoningTokens = usage.reasoningTokens;
  }
  if (typeof usage.totalTokens === "number") {
    messageUsage.totalTokens = usage.totalTokens;
  } else if (
    typeof messageUsage.inputTokens === "number" &&
    typeof messageUsage.outputTokens === "number"
  ) {
    messageUsage.totalTokens = messageUsage.inputTokens + messageUsage.outputTokens;
  }

  return Object.keys(messageUsage).length > 0 ? messageUsage : null;
}

function cloneMessage(message: AiChatMessage): AiChatMessage {
  return {
    ...message,
    usage: message.usage ? { ...message.usage } : null,
  };
}

export class BranchAiSession {
  readonly #branchName: string;
  readonly #publisher = new RpcStreamPublisher<AiChatSnapshot>();
  readonly #messages: AiChatMessage[] = [];
  readonly #history: InputItem[] = [];
  #pending = false;
  #errorMessage: string | null = null;
  #messageCounter = 0;

  constructor(branchName: string) {
    this.#branchName = branchName;
  }

  subscribe(): ReadableStream<AiChatSnapshot> {
    return this.#publisher.subscribe({
      getInitialValue: () => this.#createSnapshot(),
    });
  }

  sendMessage(text: string): void {
    const normalized = text.trim();
    if (normalized === "") {
      throw new Error("AI 消息不能为空。");
    }
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中。");
    }

    const userMessage = this.#appendMessage("user", normalized, "complete");
    const assistantMessage = this.#appendMessage("assistant", "", "streaming");
    const requestInput = [...this.#history, messageText(userMessage.text)];
    const mockReply = buildMockReply(this.#branchName, normalized);
    const mockUsage = buildMockUsage(normalized, mockReply);

    this.#pending = true;
    this.#errorMessage = null;
    this.#emitSnapshot();

    const client = createAIClient({
      adapter: new MockAdapter({
        stream: {
          charsPerSecond: 48,
          chunkSize: 2,
          initialDelayMs: 120,
        },
        turns: [
          {
            steps: [
              {
                type: "message",
                id: assistantMessage.id,
                content: mockReply,
              },
              { type: "complete", usage: mockUsage },
            ],
          },
        ],
      }),
      model: AI_MODEL,
    });

    void this.#runRequest(client.stream({ instructions: AI_INSTRUCTIONS, input: requestInput }), {
      assistantMessageId: assistantMessage.id,
      requestInput,
    });
  }

  resetConversation(): void {
    if (this.#pending) {
      throw new Error("AI 请求仍在处理中，暂时不能清空对话。");
    }

    this.#messages.length = 0;
    this.#history.length = 0;
    this.#errorMessage = null;
    this.#emitSnapshot();
  }

  [Symbol.dispose](): void {
    this.#publisher[Symbol.dispose]();
  }

  #createSnapshot(): AiChatSnapshot {
    return {
      adapterKind: AI_ADAPTER_KIND,
      model: AI_MODEL,
      messages: this.#messages.map(cloneMessage),
      pending: this.#pending,
      errorMessage: this.#errorMessage,
    };
  }

  #emitSnapshot(): void {
    this.#publisher.emit(this.#createSnapshot());
  }

  #appendMessage(
    role: AiChatMessage["role"],
    text: string,
    status: AiChatMessage["status"],
  ): AiChatMessage {
    const message: AiChatMessage = {
      id: `ai-chat-${this.#messageCounter++}`,
      role,
      text,
      status,
      usage: null,
    };
    this.#messages.push(message);
    return message;
  }

  #patchMessage(id: string, patch: Partial<AiChatMessage>): void {
    const index = this.#messages.findIndex((message) => message.id === id);
    if (index < 0) {
      return;
    }

    this.#messages[index] = {
      ...this.#messages[index]!,
      ...patch,
    };
  }

  async #runRequest(
    stream: AsyncIterable<AIStreamEvent>,
    context: {
      assistantMessageId: string;
      requestInput: InputItem[];
    },
  ): Promise<void> {
    let completedResponse: AIResponse | null = null;

    try {
      for await (const event of stream) {
        this.#handleStreamEvent(event, context.assistantMessageId);
        if (event.type === "response.completed") {
          completedResponse = event.response;
        }
      }

      if (completedResponse === null) {
        throw new Error("AI 流在完成前结束。");
      }

      const finalText = readResponseText(completedResponse);
      this.#patchMessage(context.assistantMessageId, {
        text: finalText,
        status: "complete",
        usage: toMessageUsage(completedResponse.usage),
      });
      this.#history.length = 0;
      this.#history.push(...context.requestInput, ...completedResponse.replay);
      this.#pending = false;
      this.#emitSnapshot();
    } catch (error) {
      this.#pending = false;
      this.#errorMessage = toErrorMessage(error);

      const assistantMessage = this.#messages.find(
        (message) => message.id === context.assistantMessageId,
      );
      if (assistantMessage?.text === "") {
        const index = this.#messages.findIndex(
          (message) => message.id === context.assistantMessageId,
        );
        if (index >= 0) {
          this.#messages.splice(index, 1);
        }
      } else {
        this.#patchMessage(context.assistantMessageId, { status: "complete" });
      }

      this.#emitSnapshot();
    }
  }

  #handleStreamEvent(event: AIStreamEvent, assistantMessageId: string): void {
    if (event.type !== "message.delta" || event.itemId !== assistantMessageId) {
      return;
    }

    const assistantMessage = this.#messages.find((message) => message.id === assistantMessageId);
    if (!assistantMessage) {
      return;
    }

    this.#patchMessage(assistantMessageId, {
      text: `${assistantMessage.text}${event.delta.text}`,
    });
    this.#emitSnapshot();
  }
}
