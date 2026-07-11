import type { AiChatPendingUserInput } from "#shared/rpc/ai-rpc";

/**
 * 为 pending user input 条目分配稳定的字符串 key。
 *
 * 条目中的 `handle` 是随快照/增量流推送的活对象 stub，本身没有可序列化 id；
 * 用 WeakMap 按 handle 对象引用分配递增字符串，供 React 列表 key 与
 * “当前激活条目”状态追踪使用。同一 handle 引用在其生命周期内始终拿到同一 key。
 */
const handleKeyMap = new WeakMap<object, string>();
let handleKeyCounter = 0;

export function pendingInputKey(input: AiChatPendingUserInput): string {
  let key = handleKeyMap.get(input.handle);
  if (key === undefined) {
    key = `handle-${handleKeyCounter++}`;
    handleKeyMap.set(input.handle, key);
  }
  return key;
}

export function summarizePendingInput(
  input: AiChatPendingUserInput,
  fallbackIndex: number,
): string {
  const prompt = input.prompt?.trim();
  if (!prompt) {
    return `问题 ${fallbackIndex + 1}`;
  }
  return prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt;
}
