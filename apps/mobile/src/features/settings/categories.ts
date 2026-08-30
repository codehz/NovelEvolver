export const SETTINGS_CATEGORIES = [
  { id: "ai-models", label: "AI 模型" },
  { id: "ai-agents", label: "AI Agent" },
  { id: "ai-prompts", label: "AI 提示词" },
  { id: "ai-runtime-policy", label: "AI 运行策略" },
] as const;

export type SettingsCategoryId = (typeof SETTINGS_CATEGORIES)[number]["id"];

export function settingsCategoryLabel(id: SettingsCategoryId): string {
  return SETTINGS_CATEGORIES.find((category) => category.id === id)?.label ?? id;
}
