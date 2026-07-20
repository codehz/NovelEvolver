/**
 * Build HTTP Basic Authorization headers for Git HTTPS Smart HTTP clients.
 *
 * Prefer this over nano-git's `token` option, which sets `Authorization: Bearer …`
 * and is not accepted by most Git hosts for password/PAT HTTPS push.
 */
export function buildGitHttpsBasicAuthHeaders(
  username: string,
  secret: string,
): Record<string, string> {
  const token = Buffer.from(`${username}:${secret}`, "utf8").toString("base64");
  return {
    Authorization: `Basic ${token}`,
  };
}
