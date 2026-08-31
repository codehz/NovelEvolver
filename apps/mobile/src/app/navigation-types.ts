export type ConfirmParams = {
  title: string;
  message: string;
  confirmLabel: string;
};

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  CreateProject: undefined;
  Project: { projectId: string };
  Chapter: { projectId: string; nodeId: string };
  Confirm: ConfirmParams;
};

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
