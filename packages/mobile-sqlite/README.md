# `@novelevolver/mobile-sqlite`

面向裸 React Native 应用的同步 SQLite 适配层。从官网下载并锁定 SQLite amalgamation（见 `sqlite.manifest.json`），通过 Turbo Native Module 在 Android / iOS 上提供同一套引擎；不使用系统 SQLite，也不依赖 `react-native-nitro-sqlite`。

## 已实现的接口

- `Database`：`open`、`run`、`exec`、`query`、`prepare`、`transaction`、`close`
- `Statement`：`all`、`get`、`run`
- 位置参数绑定、`Uint8Array` / `ArrayBufferView` BLOB（含空 BLOB；`sqlite3_bind_blob(NULL, n=0)` 会被当成 SQL NULL，引擎对此做了修复）
- 嵌套事务 savepoint
- `readonly`（`SQLITE_OPEN_READONLY`）
- `Symbol.dispose`

原生层只暴露 `open` / `execute` / `close`。`Statement` 缓存的是 SQL 字符串，不是原生 prepared statement。

## 移动端数据库路径

数据库名必须是文件名，例如 `project.sqlite`。目录通过 `location` 传入，相对于 Android `filesDir` / iOS Documents：

```ts
import { Database } from "@novelevolver/mobile-sqlite";

const database = new Database("project.sqlite", {
  location: "projects/123",
});
```

`:memory:` 使用 SQLite 内存库，不落盘。

## 原生依赖

本包会被 React Native Community CLI 自动链接。`sqlite3.c` / `sqlite3.h` 不进 git，由 `bun run sqlite:ensure` 按清单下载并校验 SHA3-256。Android Gradle 配置和 iOS `pod install` 也会触发。离线：`SKIP_SQLITE=1`。强制刷新：`SQLITE_FORCE=1`。
