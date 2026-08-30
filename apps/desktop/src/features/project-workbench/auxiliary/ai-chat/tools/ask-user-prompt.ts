/**
 * 历史展示用的 ask_user 参数解析。
 *
 * 仅用于在消息列表中回显已发生的工具调用问题；实时交互（问题/选项/提交回答）
 * 全部经由服务端推送的类型化 handle 完成，不再在此处重复解析实时状态。
 */
export type AskUserToolChoice = {
  title: string;
  description?: string;
};

export type AskUserToolArguments = {
  question?: string;
  context?: string;
  placeholder?: string;
  choices?: AskUserToolChoice[];
};

export function parseAskUserToolArguments(argumentsText: string): AskUserToolArguments | null {
  try {
    const parsed = JSON.parse(argumentsText) as AskUserToolArguments;
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}
