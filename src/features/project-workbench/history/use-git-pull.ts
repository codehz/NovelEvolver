import { useCallback, useState } from "react";

import { notificationApi } from "#app/shared/lib/notifications";
import { isQuickPickDismissedError, quickPickApi } from "#app/shared/lib/quick-pick";
import type { ProjectPullResult } from "#shared/rpc/session/index";
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

export function useGitPull(options?: { onSuccess?: () => void }) {
  const project = useProjectContext();
  const [pulling, setPulling] = useState(false);
  const onSuccess = options?.onSuccess;

  const pull = useCallback(
    async (pullOptions?: { forcePromptRemote?: boolean }) => {
      if (pulling) {
        return;
      }

      setPulling(true);
      try {
        let remoteUrl = (await Promise.resolve(project.remoteUrl)) as string | null;
        const shouldPrompt =
          pullOptions?.forcePromptRemote === true || remoteUrl === null || remoteUrl === "";

        if (shouldPrompt) {
          const nextUrl = await promptRemoteUrl(remoteUrl ?? "");
          await Promise.resolve(project.setRemoteUrl(nextUrl));
          remoteUrl = nextUrl;
        }

        const result = (await project.pullCurrentBranch()) as ProjectPullResult;
        if (result.fastForwarded) {
          notificationApi.info(`已拉取 ${result.branchName}（快进）← ${result.remoteUrl}`, {
            source: "拉取",
          });
        } else {
          notificationApi.info(`已是最新：${result.branchName}`, {
            source: "拉取",
          });
        }
        onSuccess?.();
      } catch (error) {
        if (isQuickPickDismissedError(error)) {
          return;
        }
        notificationApi.error(error instanceof Error ? error.message : "拉取失败", {
          source: "拉取",
        });
      } finally {
        setPulling(false);
      }
    },
    [onSuccess, project, pulling],
  );

  return { pulling, pull };
}
