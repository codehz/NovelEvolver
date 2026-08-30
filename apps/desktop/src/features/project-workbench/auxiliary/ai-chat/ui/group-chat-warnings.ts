import type { AiChatMessage, AiChatWarning } from "#domain/ai";

export type GroupedChatWarnings = {
  warningsByMessageId: Map<string, AiChatWarning[]>;
  orphanWarnings: AiChatWarning[];
};

export function groupChatWarnings(
  messages: readonly AiChatMessage[],
  warnings: readonly AiChatWarning[],
): GroupedChatWarnings {
  const messageIdSet = new Set(messages.map((message) => message.id));
  const warningsByMessageId = new Map<string, AiChatWarning[]>();
  const orphanWarnings: AiChatWarning[] = [];

  for (const warning of warnings) {
    if (warning.messageId !== "" && messageIdSet.has(warning.messageId)) {
      const list = warningsByMessageId.get(warning.messageId);
      if (list) {
        list.push(warning);
      } else {
        warningsByMessageId.set(warning.messageId, [warning]);
      }
    } else {
      orphanWarnings.push(warning);
    }
  }

  return { warningsByMessageId, orphanWarnings };
}
