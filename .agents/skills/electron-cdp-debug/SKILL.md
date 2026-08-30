---
name: electron-cdp-debug
description: 通过 Chrome DevTools Protocol 调试 NovelEvolver Electron 应用（启动带 CDP 的实例、用 omp browser 工具连接驱动 UI、验证 mock AI 聊天流程）。适用于 UI 冒烟、审批/ask_user 流程验证、设置页检查等场景。
---

# Electron CDP 调试（NovelEvolver）

在 omp 会话中通过 CDP 驱动本项目的 Electron 应用做 UI 验证。覆盖：带调试端口的启动、browser 工具连接与生命周期、页面查询与交互、以及项目特有的 mock AI 冒烟路径。

## 1. 启动（两条命令，用 hub 管理）

```text
1. vite dev server：hub start name=vite application=bun args=["run","--filter","@novelevolver/desktop","dev:renderer"] cwd=<repo>
2. Electron：hub start name=electron application=bunx args=["electron",".","--remote-debugging-port=9222"] cwd=<repo>/apps/desktop
   env: NOVEL_EVOLVER_MOCK_AI=1   （mock AI 模式，faux provider）
   ready: { log: "DevTools listening", port: 9222, timeout: 60 }
```

注意：

- vite 8 的 dev server 监听 IPv6 `::1`，readiness 的 `port` 探测（默认 127.0.0.1）会误报超时。验证用 `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`，返回 200 即就绪，进程仍活着就继续。
- 端口 9222 被占用时先 `hub stop electron` 再启动（残留实例会让新实例起不来或连到旧实例）。
- 启动前确保 `apps/desktop/dist-electron/main.js` 存在：改过 `apps/desktop/electron/` 代码后先 `bun run --filter @novelevolver/desktop build:electron`（或根目录 `bun run build`），否则跑的是旧 bundle。

## 2. 连接与 tab 生命周期

```json
{ "action": "open", "app": { "cdp_url": "http://127.0.0.1:9222" }, "name": "app" }
```

- **只 open 一次，复用 tab。** 对同一 `name` 重复 open 会让旧 tab detach，之后 evaluate 报 `Execution context is not available in detached frame`。
- **Electron 重启后旧 tab 必失效**：先 `{"action": "close", "name": "app", "all": true}` 再重新 open。
- 每次 `run` 里用 `tab.evaluate(...)` / `tab.waitForSelector(...)`；`code` 里直接写 `return tab.evaluate(...)`，不要用裸 `document`（作用域里没有）。

## 3. 查询页面状态

- 读文本：`tab.evaluate(() => document.body.innerText)`。
- **CJK UI 的 innerText 是逐字换行的**（每个汉字单独一行），精确匹配会失败。检查状态一律用 `.includes('关键词')`。
- 常用就绪断言：`body.innerText.includes('Pi 会话')`（workbench 辅助面板）、`includes('请求执行工具')`（审批卡片出现）、`includes('模拟问题')`（ask_user 卡片）。

## 4. 交互

- **点击（推荐）**：在 evaluate 里按文本找按钮：
  ```js
  tab.evaluate(() => {
    Array.from(document.querySelectorAll("button"))
      .find((b) => b.textContent === "发送")
      ?.click();
  });
  ```
  不要用 `tab.$$`（不存在）或 `:has-text()` 伪类（被拒）。
- **图标按钮**：`b.innerHTML.includes('codicon--settings-gear')` 匹配（文本是图标字体）。项目设置与全局设置是两个不同对话框——全局设置的齿轮在侧栏；项目设置对话框有「取消/保存」按钮。
- **输入**：`await tab.waitForSelector('input[placeholder="发送消息…"]', { timeout: 5000 })` → `click()` → `type('文本')`。占位符里的省略号是 `…` 字符，精确复制。
- **等待**：`await new Promise(r => setTimeout(r, ms))`。`tab.waitForTimeout` 不存在。
- 点击后轮询验证：等一小段时间再读 innerText 断言结果，别假设同步生效。

## 5. 项目特定：mock AI 全流程冒烟

1. 项目列表页点击项目行（`text/04.npk` 之类）→ 等 `Pi 会话` 出现。
2. 输入消息 → 点「发送」。
3. mock 工具流脚本（`makeToolFlowScript`）会依次出现：
   - **审批卡片**：「请求执行工具 / ask_user」+ 参数 JSON + 「批准」「拒绝」→ 点「批准」。
   - **ask_user 卡片**：「模拟问题：是否继续？」+ 「继续」「停止」选项 → 点「继续」。
   - 完成态：工具卡片显示「完成」，回复「已收到你的回答，模拟流程结束。」，tokens 计数增长。
4. 重启 Electron 后再打开同一项目：历史消息从 JSONL 恢复（`你好，Pi 冒烟测试` 等仍在），验证会话持久化。
5. 全局设置（齿轮）：「AI 模型」tab 显示模型提供商 + Pi 内置模型目录（列表很长）；「AI 提示词」tab 显示模板列表 + 「新建模板」；「Git 凭证」tab 存在。旧分类（AI Agent / AI 运行策略）已移除。

## 6. 已知坑

- detached frame / 重复 open → close all + 重新 open。
- innerText 逐字换行 → 用 includes。
- vite IPv6 → readiness 探测误报，用 curl 确认。
- 旧 bundle → 先 `bun run build:electron`。
- 截图用 `tab.screenshot({ selector?, fullPage?, silent? })`，路径由 `browser.screenshotDir` 决定，不接受自定义路径。
