export type AiModelsStackParamList = {
  List: undefined;
  ProviderEditor: { id?: string };
  ModelEditor: { id?: string; providerId?: string };
};

export type AiAgentsStackParamList = {
  List: undefined;
  AgentEditor: { id?: string };
};

export type AiPromptsStackParamList = {
  List: undefined;
  PromptEditor: { id?: string };
};
