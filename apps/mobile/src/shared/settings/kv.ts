import { MMKV } from "react-native-mmkv";

export type SettingsKv = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
};

const storage = new MMKV({ id: "novelevolver-settings" });

export const settingsKv: SettingsKv = {
  getString(key) {
    return storage.getString(key);
  },
  set(key, value) {
    storage.set(key, value);
  },
};

export function readJson(kv: SettingsKv, key: string): unknown {
  const raw = kv.getString(key);
  if (raw == null || raw === "") {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeJson(kv: SettingsKv, key: string, value: unknown): void {
  kv.set(key, JSON.stringify(value));
}
