import { describe, expect, test } from "bun:test";

import {
  getHttpsRemoteUrlValidationError,
  isHttpsRemoteUrl,
  normalizeHttpsRemoteUrl,
} from "./https-remote-url";

describe("normalizeHttpsRemoteUrl", () => {
  test("accepts and normalizes https URLs", () => {
    expect(normalizeHttpsRemoteUrl("  https://github.com/org/repo.git  ")).toBe(
      "https://github.com/org/repo.git",
    );
    expect(normalizeHttpsRemoteUrl("https://github.com/org/repo/")).toBe(
      "https://github.com/org/repo",
    );
    expect(normalizeHttpsRemoteUrl("https://gitea.example.com:8443/user/repo.git")).toBe(
      "https://gitea.example.com:8443/user/repo.git",
    );
  });

  test("strips userinfo, query, and hash", () => {
    expect(normalizeHttpsRemoteUrl("https://user:pass@github.com/org/repo.git?x=1#y")).toBe(
      "https://github.com/org/repo.git",
    );
  });

  test("rejects empty and non-https schemes", () => {
    expect(() => normalizeHttpsRemoteUrl("")).toThrow("不能为空");
    expect(() => normalizeHttpsRemoteUrl("   ")).toThrow("不能为空");
    expect(() => normalizeHttpsRemoteUrl("http://github.com/org/repo.git")).toThrow("HTTPS");
    expect(() => normalizeHttpsRemoteUrl("git@github.com:org/repo.git")).toThrow("SSH");
    expect(() => normalizeHttpsRemoteUrl("ssh://git@github.com/org/repo.git")).toThrow("SSH");
    expect(() => normalizeHttpsRemoteUrl("github.com/org/repo")).toThrow("完整 HTTPS");
  });
});

describe("isHttpsRemoteUrl / getHttpsRemoteUrlValidationError", () => {
  test("isHttpsRemoteUrl mirrors normalize success", () => {
    expect(isHttpsRemoteUrl("https://github.com/a/b")).toBe(true);
    expect(isHttpsRemoteUrl("http://github.com/a/b")).toBe(false);
  });

  test("validation error returns message for invalid input", () => {
    expect(getHttpsRemoteUrlValidationError("http://x")).toMatch(/HTTPS/);
    expect(getHttpsRemoteUrlValidationError("https://github.com/a/b")).toBeNull();
  });
});
