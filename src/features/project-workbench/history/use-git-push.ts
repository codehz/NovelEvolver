import { useCallback, useState } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import { isQuickPickDismissedError, quickPickApi } from "#app/shared/lib/quick-pick";
import type { ProjectPushResult } from "#shared/rpc/session/index";
import {
  getHttpsRemoteUrlValidationError,
  normalizeHttpsRemoteUrl,
} from "#shared/rpc/session/index";
import { useProjectContext } from "#workbench/session/project-scope";

async function promptRemoteUrl(initialValue = ""): Promise<string> {
  const raw = await quickPickApi.showInput({
    title: "设置远程仓库",
    inputLabel: "HTTPS 地址",
    placeholder: "https://github.com/org/repo.git",
    initialValue,
    hint: "仅支持 HTTPS；凭证在 设置 → Git 凭证 中按域名配置",
    dismissAriaLabel: "取消设置远程仓库",
    validate: getHttpsRemoteUrlValidationError,
  });
  return normalizeHttpsRemoteUrl(raw);
}

export function useGitPush() {
  const project = useProjectContext();
  const [pushing, setPushing] = useState(false);

  const push = useCallback(
    async (options?: { forcePromptRemote?: boolean }) => {
      if (pushing) {
        return;
      }

      setPushing(true);
      try {
        let remoteUrl = (await Promise.resolve(project.remoteUrl)) as string | null;
        const shouldPrompt =
          options?.forcePromptRemote === true || remoteUrl === null || remoteUrl === "";

        if (shouldPrompt) {
          const nextUrl = await promptRemoteUrl(remoteUrl ?? "");
          await Promise.resolve(project.setRemoteUrl(nextUrl));
          remoteUrl = nextUrl;
        }

        const result = (await project.pushCurrentBranch()) as ProjectPushResult;
        notificationApi.info(`已推送 ${result.branchName} → ${result.remoteUrl}`, {
          source: "推送",
        });
      } catch (error) {
        if (isQuickPickDismissedError(error)) {
          return;
        }
        notificationApi.error(error instanceof Error ? error.message : "推送失败", {
          source: "推送",
        });
      } finally {
        setPushing(false);
      }
    },
    [project, pushing],
  );

  return { pushing, push };
}
