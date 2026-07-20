/**
 * Normalize user input to a clean HTTPS remote repository URL.
 * Rejects empty, non-https schemes (http/ssh/git@), and unparseable URLs.
 * Strips trailing slashes; keeps path and optional `.git` suffix.
 */
export function normalizeHttpsRemoteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") {
    throw new Error("远程仓库地址不能为空。");
  }

  if (/^git@/i.test(trimmed) || /^ssh:\/\//i.test(trimmed)) {
    throw new Error("仅支持 HTTPS 远程地址，不支持 SSH。");
  }

  if (/^http:\/\//i.test(trimmed)) {
    throw new Error("仅支持 HTTPS 远程地址，请使用 https:// 开头。");
  }

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(candidate)) {
    throw new Error("请输入完整 HTTPS 地址，例如 https://github.com/org/repo.git");
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error("无法解析远程仓库地址。");
  }

  if (url.protocol !== "https:") {
    throw new Error("仅支持 HTTPS 远程地址，请使用 https:// 开头。");
  }

  if (url.hostname === "") {
    throw new Error("远程仓库地址缺少主机名。");
  }

  // Drop userinfo from normalized form; credentials live in settings store.
  url.username = "";
  url.password = "";
  // Remote URLs should not carry query/hash for Git HTTPS.
  url.search = "";
  url.hash = "";

  let href = url.href;
  // URL.href keeps a trailing slash for bare host paths; strip all trailing slashes.
  href = href.replace(/\/+$/, "");
  if (href === "https:" || href === "https://") {
    throw new Error("远程仓库地址不完整。");
  }
  return href;
}

/** Whether `raw` normalizes to a valid HTTPS remote URL. */
export function isHttpsRemoteUrl(raw: string): boolean {
  try {
    normalizeHttpsRemoteUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate input for UI (quick-pick). Returns error message or null when valid.
 * Empty string is treated as invalid.
 */
export function getHttpsRemoteUrlValidationError(raw: string): string | null {
  try {
    normalizeHttpsRemoteUrl(raw);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "远程仓库地址无效。";
  }
}
