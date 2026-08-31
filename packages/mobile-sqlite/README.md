# `@novelevolver/mobile-sqlite`

面向裸 React Native 应用的 SQLite 适配层。底层使用 `react-native-nitro-sqlite`，通过 Nitro Modules 和 JSI 调用原生 SQLite；这个包不引入任何 Expo 运行时、Expo 模块或 Expo 配置。

## 为什么单独放包

`nano-git@0.11` 的 SQLite 后端依赖 `native-sqlite` 的 `Database` / `Statement` 接口。仓库当前的 `native-sqlite@0.2.1` 在 React Native 条件导出中指向 Expo 专用实现，因此不能直接用于本项目。这个包先提供一个移动端专用、接近 `native-sqlite` 的同步接口，后续接入 nano-git 时只需要在 nano-git 的 SQLite 工厂边界注入它，不需要把 SQLite 细节散落在移动端业务代码中。

## 已实现的接口

- `Database`：`run`、`exec`、`query`、`prepare`、`transaction`、`close`
- `Statement`：`all`、`get`、`iterate`、`run`、`values`
- 位置参数绑定、`ArrayBufferView` / `Uint8Array` BLOB 绑定、嵌套事务 savepoint
- `readonly` 数据库选项（通过 `PRAGMA query_only`）
- `Symbol.dispose` 生命周期

`Statement` 是轻量 SQL 句柄：Nitro SQLite 暴露的是连接级 `execute`，因此这里缓存 SQL 对象而不是缓存原生 prepared statement。nano-git 当前 SQLite 后端使用的操作都在这个接口范围内。

## 移动端数据库路径

移动端数据库名必须是文件名，例如 `project.sqlite`。目录通过构造参数传入：

```ts
import { Database } from "@novelevolver/mobile-sqlite";

const database = new Database("project.sqlite", {
  location: "projects/123",
});
```

`location` 是相对于平台应用数据目录的路径。移动端不能把桌面端的任意绝对文件系统路径直接传给 SQLite；后续 nano-git 适配时，应将项目 ID 映射为受控的数据库名和目录，而不是复用桌面的 repo path。

## 后续接入 nano-git

1. 在 nano-git 的 SQLite backend 增加可注入的 SQLite `Database` 工厂，或维护一个只改变该导入边界的补丁。
2. 移动端工厂创建 `new Database("<project>.sqlite", { location: "projects/<id>" })`。
3. 保持 Git 对象表、refs 表和事务逻辑由 nano-git 管理；本包只负责数据库连接和 `bun:sqlite` 形状的同步 API。
4. 在 Android 模拟器和 iOS 模拟器分别验证：BLOB round-trip、事务回滚、重启后持久化、两个数据库连接的关闭生命周期。

当前没有把 nano-git 引入移动端，也没有修改桌面端现有的 `native-sqlite` 运行时路径。

## 原生依赖

`react-native-nitro-sqlite` 会被 React Native Community CLI 自动链接，并提供 Android/iOS 的原生 SQLite 实现。新增或升级该依赖后，iOS 需要重新执行 CocoaPods 安装；Android 由 React Native Gradle Plugin 在构建时处理 Codegen/原生依赖。

参考资料：

- [React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)
- [React Native Codegen](https://reactnative.dev/docs/the-new-architecture/using-codegen)
- [react-native-nitro-sqlite](https://github.com/margelo/react-native-nitro-sqlite)
