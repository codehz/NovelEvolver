import { describe, expect, test } from "bun:test";

import { isGitCredentialHost, normalizeGitCredentialHost } from "./settings-rpc";

describe("isGitCredentialHost", () => {
  test("accepts common hostnames", () => {
    expect(isGitCredentialHost("github.com")).toBe(true);
    expect(isGitCredentialHost("gitlab.example.com")).toBe(true);
    expect(isGitCredentialHost("localhost")).toBe(true);
  });

  test("rejects empty, ports, paths, and schemes", () => {
    expect(isGitCredentialHost("")).toBe(false);
    expect(isGitCredentialHost("github.com:443")).toBe(false);
    expect(isGitCredentialHost("github.com/org")).toBe(false);
    expect(isGitCredentialHost("https://github.com")).toBe(false);
    expect(isGitCredentialHost(null)).toBe(false);
  });
});

describe("normalizeGitCredentialHost", () => {
  test("trims and lowercases bare host", () => {
    expect(normalizeGitCredentialHost("  GitHub.COM  ")).toBe("github.com");
  });

  test("strips https URL scheme, path, and port", () => {
    expect(normalizeGitCredentialHost("https://github.com/org/repo.git")).toBe("github.com");
    expect(normalizeGitCredentialHost("http://gitea.example.com:3000/user/repo")).toBe(
      "gitea.example.com",
    );
  });

  test("does not take username from URL userinfo", () => {
    expect(normalizeGitCredentialHost("https://token-user:secret@github.com/org/repo")).toBe(
      "github.com",
    );
  });

  test("parses scp-like git@host:path", () => {
    expect(normalizeGitCredentialHost("git@github.com:org/repo.git")).toBe("github.com");
  });

  test("strips bare host path and port", () => {
    expect(normalizeGitCredentialHost("github.com/org/repo")).toBe("github.com");
    expect(normalizeGitCredentialHost("gitea.local:3000")).toBe("gitea.local");
  });

  test("throws on empty or invalid input", () => {
    expect(() => normalizeGitCredentialHost("")).toThrow("域名不能为空");
    expect(() => normalizeGitCredentialHost("   ")).toThrow("域名不能为空");
    expect(() => normalizeGitCredentialHost("not a host!!!")).toThrow("域名格式无效");
  });
});
