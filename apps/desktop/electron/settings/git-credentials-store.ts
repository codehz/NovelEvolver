import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type {
  GitCredentialConfigPublic,
  GitCredentialConfigWrite,
  GitCredentialsSettingsSnapshot,
} from "@novelevolver/domain/settings/ai-settings";
import { normalizeGitCredentialHost } from "@novelevolver/domain/settings/ai-settings";
import { safeStorage } from "electron";
import { nanoid } from "nanoid";

const FILE_VERSION = 1 as const;

type StoredCredentialRecord = {
  id: string;
  host: string;
  username: string;
  secretCipher?: string;
};

type StoredFile = {
  version: typeof FILE_VERSION;
  credentials: StoredCredentialRecord[];
};

const EMPTY_FILE: StoredFile = {
  version: FILE_VERSION,
  credentials: [],
};

export type GitCredentialRuntime = {
  host: string;
  username: string;
  secret: string | null;
};

function toPublic(record: StoredCredentialRecord): GitCredentialConfigPublic {
  return {
    id: record.id,
    host: record.host,
    username: record.username,
    hasSecret: Boolean(record.secretCipher),
  };
}

function encryptSecret(secret: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("系统密钥加密不可用，无法保存 Git 凭证。请检查操作系统密钥环配置。");
  }
  return safeStorage.encryptString(secret).toString("base64");
}

/**
 * Decrypt a stored cipher for main-process runtime use (not exposed over RPC).
 * Returns null when missing.
 * Throws when a cipher exists but cannot be decrypted.
 */
function decryptSecretCipher(secretCipher: string | undefined): string | null {
  if (!secretCipher) {
    return null;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("系统密钥加密不可用，无法读取 Git 凭证。请检查操作系统密钥环配置。");
  }
  try {
    return safeStorage.decryptString(Buffer.from(secretCipher, "base64"));
  } catch {
    throw new Error("Git 凭证无法解密，请在设置中重新保存。");
  }
}

export class GitCredentialsStore {
  readonly #filePath: string;
  #data: StoredFile;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#data = this.#load();
  }

  getSnapshot(): GitCredentialsSettingsSnapshot {
    return {
      credentials: this.#data.credentials.map(toPublic),
    };
  }

  upsert(input: GitCredentialConfigWrite): GitCredentialsSettingsSnapshot {
    const host = normalizeGitCredentialHost(input.host);
    const username = input.username.trim();

    if (username === "") {
      throw new Error("用户名不能为空。");
    }

    const duplicate = this.#data.credentials.find(
      (entry) => entry.host === host && entry.id !== input.id,
    );
    if (duplicate) {
      throw new Error(`域名「${host}」已存在凭证。`);
    }

    if (input.id) {
      const index = this.#data.credentials.findIndex((entry) => entry.id === input.id);
      if (index < 0) {
        throw new Error("凭证不存在。");
      }

      const existing = this.#data.credentials[index]!;
      let secretCipher = existing.secretCipher;

      if (input.secret !== undefined) {
        if (input.secret === "") {
          secretCipher = undefined;
        } else {
          secretCipher = encryptSecret(input.secret);
        }
      }

      this.#data.credentials[index] = {
        id: existing.id,
        host,
        username,
        secretCipher,
      };
    } else {
      if (input.secret === undefined || input.secret === "") {
        throw new Error("请填写密码或个人访问令牌（PAT）。");
      }

      this.#data.credentials.push({
        id: nanoid(12),
        host,
        username,
        secretCipher: encryptSecret(input.secret),
      });
    }

    this.#sortByHost();
    this.#persist();
    return this.getSnapshot();
  }

  remove(id: string): GitCredentialsSettingsSnapshot {
    const next = this.#data.credentials.filter((entry) => entry.id !== id);
    if (next.length === this.#data.credentials.length) {
      throw new Error("凭证不存在。");
    }
    this.#data.credentials = next;
    this.#persist();
    return this.getSnapshot();
  }

  /**
   * Main-process only: resolve decrypted credentials by host.
   * Missing record → null. Cipher present but undecryptable → throws.
   */
  resolve(hostInput: string): GitCredentialRuntime | null {
    let host: string;
    try {
      host = normalizeGitCredentialHost(hostInput);
    } catch {
      return null;
    }

    const record = this.#data.credentials.find((entry) => entry.host === host);
    if (!record) {
      return null;
    }

    return {
      host: record.host,
      username: record.username,
      secret: decryptSecretCipher(record.secretCipher),
    };
  }

  #sortByHost(): void {
    this.#data.credentials.sort((a, b) => a.host.localeCompare(b.host));
  }

  #load(): StoredFile {
    if (!existsSync(this.#filePath)) {
      return { ...EMPTY_FILE, credentials: [] };
    }
    try {
      const parsed = JSON.parse(readFileSync(this.#filePath, "utf8")) as Partial<StoredFile>;
      const credentials = Array.isArray(parsed.credentials)
        ? parsed.credentials.filter(isStoredCredentialRecord).map((entry) => ({
            id: entry.id,
            host: entry.host,
            username: entry.username,
            ...(entry.secretCipher ? { secretCipher: entry.secretCipher } : {}),
          }))
        : [];
      credentials.sort((a, b) => a.host.localeCompare(b.host));
      return {
        version: FILE_VERSION,
        credentials,
      };
    } catch {
      return { ...EMPTY_FILE, credentials: [] };
    }
  }

  #persist(): void {
    mkdirSync(dirname(this.#filePath), { recursive: true });
    writeFileSync(this.#filePath, `${JSON.stringify(this.#data, null, 2)}\n`, "utf8");
  }
}

function isStoredCredentialRecord(value: unknown): value is StoredCredentialRecord {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<StoredCredentialRecord>;
  return (
    typeof record.id === "string" &&
    record.id !== "" &&
    typeof record.host === "string" &&
    record.host !== "" &&
    typeof record.username === "string" &&
    (record.secretCipher === undefined || typeof record.secretCipher === "string")
  );
}
