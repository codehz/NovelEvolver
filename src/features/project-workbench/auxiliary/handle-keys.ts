import type { AiChatUserInputHandle } from "#shared/rpc/ai-rpc";

/**
 * 为 RPC handle（客户端 stub 对象）分配稳定的字符串 key。
 *
 * handle 是随快照/增量流推送的活对象，本身没有可序列化的 id；用 WeakMap 按对象引用
 * 分配递增字符串，供 React 列表 key 与"当前激活 handle"状态追踪使用。同一对象引用
 * 在其生命周期内始终拿到同一 key，对象被 GC 后条目自动清理。
 */
const handleKeyMap = new WeakMap<object, string>();
let handleKeyCounter = 0;

export function handleKey(handle: object): string {
  let key = handleKeyMap.get(handle);
  if (key === undefined) {
    key = `handle-${handleKeyCounter++}`;
    handleKeyMap.set(handle, key);
  }
  return key;
}

export function summarizeHandlePrompt(
  handle: AiChatUserInputHandle,
  fallbackIndex: number,
): string {
  const prompt = handle.prompt?.trim();
  if (!prompt) {
    return `问题 ${fallbackIndex + 1}`;
  }
  return prompt.length > 24 ? `${prompt.slice(0, 24)}…` : prompt;
}
