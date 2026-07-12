import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { useAiChatSessionActions } from "../hooks/use-ai-chat-session-actions";

export function AiChatHeaderActions({
  mockAiAvailable,
  onClearDraft,
}: {
  mockAiAvailable: boolean;
  onClearDraft: () => void;
}) {
  const { loading, pending, handleOpenHistory, handleCreateConversation, handleRunMockScenario } =
    useAiChatSessionActions(onClearDraft);

  return (
    <SidebarHeaderActions>
      {mockAiAvailable ? (
        <SidebarHeaderActionButton
          disabled={loading || pending}
          icon="icon-[codicon--beaker]"
          label="运行 AI 测试场景"
          onClick={() => {
            void handleRunMockScenario();
          }}
        />
      ) : null}
      <SidebarHeaderActionButton
        disabled={loading}
        icon="icon-[codicon--history]"
        label="历史会话"
        onClick={() => {
          void handleOpenHistory();
        }}
      />
      <SidebarHeaderActionButton
        disabled={loading}
        icon="icon-[codicon--add]"
        label="新建会话"
        onClick={() => {
          void handleCreateConversation();
        }}
      />
    </SidebarHeaderActions>
  );
}
