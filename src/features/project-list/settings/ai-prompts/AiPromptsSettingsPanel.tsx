import { useCallback, useEffect, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type {
  AiPromptConfigPublic,
  AiPromptConfigWrite,
  AiPromptsSettingsSnapshot,
} from "#shared/rpc/services/index";

import {
  settingsEmptyStateClass,
  settingsLayerHiddenClass,
  settingsListClass,
  settingsListItemClass,
  settingsListItemMetaClass,
  settingsListItemTitleClass,
  settingsPanelHeaderClass,
  settingsPanelRootClass,
  settingsPanelScrollClass,
  settingsPanelSectionClass,
} from "../settings-chrome";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { AiPromptConfigForm } from "./AiPromptConfigForm";

type PromptEditorMode =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; prompt: AiPromptConfigPublic }
  | { type: "detail"; prompt: AiPromptConfigPublic };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  if (typeof error === "string" && error.trim() !== "") {
    return error;
  }
  return fallback;
}

function resolvePromptSubpageTitle(editor: PromptEditorMode): string | null {
  if (editor.type === "create") {
    return "添加提示词";
  }
  if (editor.type === "edit") {
    return `编辑：${editor.prompt.title}`;
  }
  if (editor.type === "detail") {
    return `详情：${editor.prompt.title}`;
  }
  return null;
}

function summarizePrompt(text: string): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 48) {
    return singleLine;
  }
  return `${singleLine.slice(0, 48)}…`;
}

export function AiPromptsSettingsPanel() {
  const [snapshot, setSnapshot] = useState<AiPromptsSettingsSnapshot | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<PromptEditorMode>({ type: "closed" });

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await settingsService.getAiPrompts();
      setSnapshot(next);
    } catch (error) {
      setLoadError(errorMessage(error, "加载 AI 提示词设置失败"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const prompts = snapshot?.prompts ?? [];

  const applySnapshot = (next: AiPromptsSettingsSnapshot) => {
    setSnapshot(next);
    setActionError(null);
  };

  const runMutation = async (
    action: () => Promise<AiPromptsSettingsSnapshot> | AiPromptsSettingsSnapshot,
    fallback: string,
  ) => {
    setBusy(true);
    setActionError(null);
    try {
      const next = await action();
      applySnapshot(next);
      return true;
    } catch (error) {
      setActionError(errorMessage(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closeEditor = () => {
    setActionError(null);
    setEditor({ type: "closed" });
  };

  const handleSubmit = async (input: AiPromptConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiPrompt(input),
      input.id ? "保存提示词失败" : "添加提示词失败",
    );
    if (ok) {
      setEditor({ type: "closed" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("确定删除该提示词？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiPrompt(id), "删除提示词失败");
    if (ok && editor.type !== "closed" && "prompt" in editor && editor.prompt.id === id) {
      setEditor({ type: "closed" });
    }
  };

  const handleOpenEditor = (next: PromptEditorMode) => {
    setActionError(null);
    setEditor(next);
  };

  if (loading && snapshot === null) {
    return (
      <div className={settingsPanelRootClass}>
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            <div className={settingsEmptyStateClass}>加载中…</div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && snapshot === null) {
    return (
      <div className={settingsPanelRootClass}>
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            <p className="text-xs text-ctp-red">{loadError}</p>
            <Button
              onClick={() => {
                void refresh();
              }}
            >
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isSubpageOpen = editor.type !== "closed";
  const subpageTitle = resolvePromptSubpageTitle(editor);

  return (
    <div className={settingsPanelRootClass}>
      {isSubpageOpen && subpageTitle ? (
        <SettingsSubpageHeader title={subpageTitle} onBack={closeEditor} />
      ) : null}

      {/* Keep-alive list layer: own scrollport so form scroll cannot clobber list position. */}
      <div className={cn(settingsPanelScrollClass, isSubpageOpen && settingsLayerHiddenClass)}>
        <div className={settingsPanelSectionClass}>
          <div className={settingsPanelHeaderClass}>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-app-foreground">AI 提示词</h3>
              <p className="mt-0.5 text-2xs text-app-muted">
                配置可复用提示词模板，后续可在侧栏通过 /调用名 使用。
              </p>
            </div>
            <Button
              disabled={busy}
              variant="primary"
              onClick={() => {
                handleOpenEditor({ type: "create" });
              }}
            >
              <span aria-hidden="true" className="icon-[codicon--add] text-sm" />
              添加提示词
            </Button>
          </div>

          {actionError ? <p className="text-xs text-ctp-red">{actionError}</p> : null}

          {prompts.length === 0 ? (
            <div className={settingsEmptyStateClass}>
              还没有自定义提示词，点击「添加提示词」开始。
            </div>
          ) : null}

          {prompts.length > 0 ? (
            <ul className={settingsListClass}>
              {prompts.map((item) => (
                <li key={item.id} className={settingsListItemClass}>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className={settingsListItemTitleClass}>{item.title}</span>
                      <span className="font-mono text-2xs text-app-muted">/{item.slug}</span>
                    </div>
                    <div className={settingsListItemMetaClass}>
                      <span className="truncate">{summarizePrompt(item.prompt)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      aria-label={`查看提示词 ${item.title} 详情`}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        handleOpenEditor({ type: "detail", prompt: item });
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--info] text-base" />
                    </Button>
                    <Button
                      aria-label={`编辑提示词 ${item.title}`}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        handleOpenEditor({ type: "edit", prompt: item });
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--edit] text-base" />
                    </Button>
                    <Button
                      aria-label={`删除提示词 ${item.title}`}
                      disabled={busy}
                      variant="ghost"
                      size="icon-md"
                      onClick={() => {
                        void handleRemove(item.id);
                      }}
                    >
                      <span aria-hidden="true" className="icon-[codicon--trash] text-base" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {isSubpageOpen ? (
        <div className={settingsPanelScrollClass}>
          <div className={settingsPanelSectionClass}>
            {editor.type === "create" ? (
              <AiPromptConfigForm
                busy={busy}
                error={actionError}
                onCancel={closeEditor}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "edit" ? (
              <AiPromptConfigForm
                key={editor.prompt.id}
                busy={busy}
                error={actionError}
                initial={editor.prompt}
                onCancel={closeEditor}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "detail" ? (
              <AiPromptConfigForm
                key={editor.prompt.id}
                busy={busy}
                error={actionError}
                initial={editor.prompt}
                readOnly
                onCancel={closeEditor}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
