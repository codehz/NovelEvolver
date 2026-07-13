import { SidebarHeaderActionButton, SidebarHeaderActions } from "#workbench/chrome";

import { AiChatHistorySelector } from "../history/AiChatHistorySelector";
import { useAiChatSessionActions } from "../hooks/use-ai-chat-session-actions";

export function AiChatHeaderActions({
  mockAiAvailable,
  onClearDraft,
}: {
  mockAiAvailable: boolean;
  onClearDraft: () => void;
}) {
  const { loading, pending, handleCreateConversation, handleRunMockScenario } =
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
      <AiChatHistorySelector disabled={loading} onClearDraft={onClearDraft} />
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
