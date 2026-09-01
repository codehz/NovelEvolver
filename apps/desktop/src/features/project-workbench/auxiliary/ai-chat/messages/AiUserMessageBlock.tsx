import type { AiChatUserMessage } from "@novelevolver/domain/ai";
import { useState, type FormEvent, type KeyboardEvent } from "react";

import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";

import {
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
  const canEdit = onEdit != null && !actionsDisabled;
  const branch = message.branch;

  function beginEdit(): void {
    if (!canEdit) return;
    setDraft(message.text);
    setEditing(true);
  }

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

  function handleBubbleClick(): void {
    if (!canEdit) return;
    // Preserve text selection / copy — only enter edit on a plain click.
    const selection = window.getSelection();
    if (selection != null && !selection.isCollapsed && selection.toString().length > 0) {
      return;
    }
    beginEdit();
  }

  function handleBubbleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (!canEdit) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      beginEdit();
    }
  }

  return (
    <div className={userMessageRowClass}>
      {editing ? (
        <form className="flex w-full max-w-[88%] flex-col gap-1" onSubmit={handleEditSubmit}>
          <textarea
            className="field-sizing-content min-h-16 w-full resize-none rounded-lg border border-badge-background bg-ctp-surface0/55 px-3 py-2 text-chat leading-5 text-app-foreground outline-none"
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
        <div
          className={cn(userMessageBubbleClass, canEdit && "cursor-pointer")}
          role={canEdit ? "button" : undefined}
          tabIndex={canEdit ? 0 : undefined}
          aria-label={canEdit ? "编辑消息" : undefined}
          onClick={canEdit ? handleBubbleClick : undefined}
          onKeyDown={canEdit ? handleBubbleKeyDown : undefined}
        >
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

      {branch != null && branch.count > 1 ? (
        <div className="flex max-w-[88%] items-center justify-end gap-1">
          <AiMessageBranchSwitcher
            branch={branch}
            disabled={actionsDisabled || onSelectBranch == null}
            onSelect={(index) => {
              onSelectBranch?.(index);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
