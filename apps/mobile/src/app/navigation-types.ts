import type {
  OverlayAlertParams,
  OverlayConfirmParams,
  OverlayPromptParams,
} from "../shared/ui/OverlayHost";

export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
  Project: { projectId: number };
  Alert: OverlayAlertParams;
  Confirm: OverlayConfirmParams;
  Prompt: OverlayPromptParams;
};

export type ProjectTabParamList = {
  Explorer: undefined;
  Editor: undefined;
  AI: undefined;
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
