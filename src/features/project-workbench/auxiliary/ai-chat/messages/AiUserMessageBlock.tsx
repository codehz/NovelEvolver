import { useState, type FormEvent, type KeyboardEvent } from "react";

import { AppTooltip, Button } from "#app/shared/ui";
import type { AiChatUserMessage } from "#shared/rpc/ai/index";

import {
  userMessageActionsClass,
  userMessageBubbleClass,
  userMessageRowClass,
  userSlashChipClass,
} from "../ui/ai-chat-chrome";
import { AiMessageBranchSwitcher } from "./AiMessageBranchSwitcher";
import { renderTextWithMentions } from "./render-text-with-mentions";

type AiUserMessageBlockProps = {
  message: AiChatUserMessage;
  actionsDisabled?: boolean;
  onEdit?: (text: string) => void;
  onSelectBranch?: (index: number) => void;
};

export function AiUserMessageBlock({
  message,
  actionsDisabled = false,
  onEdit,
  onSelectBranch,
}: AiUserMessageBlockProps) {
  const slash = message.slash;
  const mentions = message.mentions ?? [];
  const remainder = renderTextWithMentions(message.text, mentions);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.text);
  const showActions = !editing && onEdit != null;
  const branch = message.branch;

  function commitEdit(): void {
    const next = draft;
    setEditing(false);
    if (onEdit && next.trim() !== "" && next !== message.text) {
      onEdit(next);
    }
  }

  function cancelEdit(): void {
    setEditing(false);
    setDraft(message.text);
  }

  function handleEditSubmit(event: FormEvent): void {
    event.preventDefault();
    commitEdit();
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      commitEdit();
    }
  }

  return (
    <div className={userMessageRowClass}>
      {editing ? (
        <form className="flex w-full max-w-[88%] flex-col gap-1" onSubmit={handleEditSubmit}>
          <textarea
            className="field-sizing-content min-h-16 w-full resize-none rounded-lg border border-badge-background bg-app-crust px-3 py-2 text-chat leading-5 text-app-foreground outline-none"
            value={draft}
            disabled={actionsDisabled}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            onKeyDown={handleEditKeyDown}
            autoFocus
          />
          <div className="flex items-center justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={actionsDisabled}
              onClick={cancelEdit}
            >
              取消
            </Button>
            <Button type="submit" size="sm" disabled={actionsDisabled || draft.trim() === ""}>
              保存并发送
            </Button>
          </div>
        </form>
      ) : (
        <div className={userMessageBubbleClass}>
          {slash ? (
            <p className="whitespace-pre-wrap">
              <span
                className={userSlashChipClass}
                title={slash.title !== "" ? `${slash.title}\n${slash.body}` : slash.body}
              >
                /{slash.slug}
              </span>
              {remainder}
            </p>
          ) : (
            <p className="whitespace-pre-wrap">{remainder}</p>
          )}
        </div>
      )}

      <div className="flex max-w-[88%] items-center justify-end gap-1">
        {branch && branch.count > 1 && onSelectBranch ? (
          <AiMessageBranchSwitcher
            branch={branch}
            disabled={actionsDisabled}
            onSelect={onSelectBranch}
          />
        ) : null}
        {showActions ? (
          <div className={userMessageActionsClass}>
            <AppTooltip label="编辑" side="top">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="编辑"
                disabled={actionsDisabled}
                onClick={() => {
                  setDraft(message.text);
                  setEditing(true);
                }}
              >
                <span aria-hidden="true" className="icon-[codicon--edit] text-sm" />
              </Button>
            </AppTooltip>
          </div>
        ) : null}
      </div>
    </div>
  );
}
