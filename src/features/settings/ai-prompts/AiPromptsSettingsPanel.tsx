import { useEffect, useRef, useState } from "react";

import { settingsService } from "#app/shared/lib/rpc/app-rpc";
import { createAsyncLoader, useAsyncLoader } from "#app/shared/lib/ui/async-loader";
import { cn } from "#app/shared/lib/ui/cn";
import { Button } from "#app/shared/ui";
import type { AiPromptConfigPublic, AiPromptConfigWrite } from "#shared/rpc/services/index";

import {
  settingsEmptyStateClass,
  settingsGhostActionClass,
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
import { settingsErrorMessage } from "../settings-error";
import type { SettingsFormHandle } from "../settings-leave-guard";
import { SettingsSubpageHeader } from "../SettingsSubpageHeader";
import { useSettingsEditorLeave } from "../use-settings-editor-leave";
import { useSettingsMutation } from "../use-settings-mutation";
import { AiPromptConfigForm } from "./AiPromptConfigForm";

type PromptEditorMode =
  | { type: "closed" }
  | { type: "create" }
  | { type: "edit"; prompt: AiPromptConfigPublic }
  | { type: "detail"; prompt: AiPromptConfigPublic };

const promptsSettingsLoader = createAsyncLoader(() => settingsService.getAiPrompts());

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

type AiPromptsSettingsPanelProps = {
  /** Whether the prompts tab is currently active. */
  active?: boolean;
};

export function AiPromptsSettingsPanel({ active = true }: AiPromptsSettingsPanelProps) {
  const {
    data: snapshot,
    error: loadErrorRaw,
    isLoading,
    refresh,
  } = useAsyncLoader(promptsSettingsLoader);
  const { actionError, busy, clearActionError, runMutation } = useSettingsMutation(refresh);
  const [editor, setEditor] = useState<PromptEditorMode>({ type: "closed" });
  const [editorDirty, setEditorDirty] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const formRef = useRef<SettingsFormHandle | null>(null);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadError =
    loadErrorRaw !== undefined
      ? settingsErrorMessage(loadErrorRaw, "加载 AI 提示词设置失败")
      : null;

  const prompts = snapshot?.prompts ?? [];

  const closeEditor = () => {
    clearActionError();
    setEditorDirty(false);
    setEditor({ type: "closed" });
  };

  const { requestClose } = useSettingsEditorLeave({
    active,
    editorOpen: editor.type === "create" || editor.type === "edit",
    busy,
    dirty: editorDirty,
    formRef,
    closeEditor,
    onDiscard: () => {
      setEditorDirty(false);
      setFormKey((key) => key + 1);
    },
  });

  const handleSubmit = async (input: AiPromptConfigWrite) => {
    const ok = await runMutation(
      () => settingsService.upsertAiPrompt(input),
      input.id ? "保存提示词失败" : "添加提示词失败",
    );
    if (ok) {
      setEditorDirty(false);
      setEditor({ type: "closed" });
    }
    return ok;
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("确定删除该提示词？")) {
      return;
    }
    const ok = await runMutation(() => settingsService.removeAiPrompt(id), "删除提示词失败");
    if (ok && editor.type !== "closed" && "prompt" in editor && editor.prompt.id === id) {
      closeEditor();
    }
  };

  const handleOpenEditor = (next: PromptEditorMode) => {
    clearActionError();
    setEditorDirty(false);
    setFormKey((key) => key + 1);
    setEditor(next);
  };

  if (isLoading && snapshot === undefined) {
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

  if (loadError && snapshot === undefined) {
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
        <SettingsSubpageHeader
          title={subpageTitle}
          onBack={() => {
            if (editor.type === "detail") {
              closeEditor();
              return;
            }
            void requestClose();
          }}
        />
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
                      className={settingsGhostActionClass}
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
                      className={settingsGhostActionClass}
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
                      className={settingsGhostActionClass}
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
                key={`create-${formKey}`}
                busy={busy}
                error={actionError}
                formRef={formRef}
                onDirtyChange={setEditorDirty}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "edit" ? (
              <AiPromptConfigForm
                key={`${editor.prompt.id}-${formKey}`}
                busy={busy}
                error={actionError}
                formRef={formRef}
                initial={editor.prompt}
                onDirtyChange={setEditorDirty}
                onSubmit={handleSubmit}
              />
            ) : null}

            {editor.type === "detail" ? (
              <AiPromptConfigForm
                key={`detail-${editor.prompt.id}-${formKey}`}
                busy={busy}
                error={actionError}
                initial={editor.prompt}
                readOnly
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
