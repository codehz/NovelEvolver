import type { MockScenarioDefinition } from "./scenario-types";
import {
  getToolResult,
  hasToolResult,
  isSubagentRequest,
  readToolResultText,
} from "./scenario-types";

const basicStream: MockScenarioDefinition = {
  id: "stream.basic",
  title: "基础流式时间线",
  description: "展示 reasoning、正文交错输出与 usage。",
  initialPrompt: "运行基础流式时间线测试。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "initial",
      matches: () => true,
      run: function* () {
        yield {
          type: "reasoning",
          id: "scenario-basic-reasoning-1",
          visibility: "summary",
          content: "先确认输入，再组织一段适合写作工作台展示的回复。",
        };
        yield {
          type: "message",
          id: "scenario-basic-message-1",
          content: "这是场景生成的第一段正文，用来观察流式 Markdown 渲染。",
        };
        yield {
          type: "reasoning",
          id: "scenario-basic-reasoning-2",
          visibility: "summary",
          content: "补充检查第二段消息能否保持独立时间线位置。",
        };
        yield {
          type: "message",
          id: "scenario-basic-message-2",
          content: "第二段正文已完成。场景输出具有稳定 ID，可供自动化断言。",
        };
        yield {
          type: "complete",
          usage: { inputTokens: 24, outputTokens: 36, reasoningTokens: 18, totalTokens: 78 },
        };
      },
    },
  ],
};

const simulatedTool: MockScenarioDefinition = {
  id: "tools.simulated-project-structure",
  title: "模拟项目结构工具",
  description: "使用固定工具结果测试 running、完成状态与续跑。",
  initialPrompt: "调用项目结构工具并整理结果。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  simulatedResults: {
    "scenario-simulated-structure": {
      outcome: "success",
      content: [
        {
          type: "json",
          json: {
            domain: "resource",
            resource: {
              root_id: "root",
              nodes: [
                {
                  id: "root",
                  domain: "resource",
                  kind: "folder",
                  name: "",
                  parent_id: null,
                  child_ids: ["folder-1", "file-1"],
                  display_path: "",
                },
                {
                  id: "folder-1",
                  domain: "resource",
                  kind: "folder",
                  name: "设定",
                  parent_id: "root",
                  child_ids: [],
                  display_path: "设定",
                },
                {
                  id: "file-1",
                  domain: "resource",
                  kind: "file",
                  name: "主角.md",
                  parent_id: "root",
                  child_ids: [],
                  display_path: "主角.md",
                },
              ],
            },
          },
        },
      ],
    },
  },
  turns: [
    {
      id: "call-tool",
      matches: (request) => !hasToolResult(request, "scenario-simulated-structure"),
      run: function* () {
        yield {
          type: "tool_call",
          id: "scenario-simulated-structure",
          name: "read_structure",
          argumentsText: JSON.stringify({ domain: "resource" }),
        };
      },
    },
    {
      id: "render-result",
      matches: (request) => hasToolResult(request, "scenario-simulated-structure"),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, "scenario-simulated-structure"));
        yield {
          type: "message",
          id: "scenario-simulated-structure-message",
          content: `模拟工具已返回固定数据：\n\n\`\`\`json\n${result}\n\`\`\``,
        };
      },
    },
  ],
};

const integratedTool: MockScenarioDefinition = {
  id: "tools.integrated-project-structure",
  title: "真实项目结构工具",
  description: "对当前项目执行真实项目结构工具并展示结果。",
  initialPrompt: "读取当前项目的资源结构。",
  toolMode: "integrated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "call-tool",
      matches: (request) => !hasToolResult(request, "scenario-integrated-structure"),
      run: function* () {
        yield {
          type: "tool_call",
          id: "scenario-integrated-structure",
          name: "read_structure",
          argumentsText: JSON.stringify({ domain: "resource" }),
        };
      },
    },
    {
      id: "render-result",
      matches: (request) => hasToolResult(request, "scenario-integrated-structure"),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, "scenario-integrated-structure"));
        yield {
          type: "message",
          id: "scenario-integrated-structure-message",
          content: `真实工具执行完成。\n\n\`\`\`json\n${result}\n\`\`\``,
        };
      },
    },
  ],
};

const askUser: MockScenarioDefinition = {
  id: "tools.ask-user",
  title: "单个用户输入工具",
  description: "暂停等待一个选项式用户回答，然后继续生成。",
  initialPrompt: "通过 ask_user 收集一个剧情目标。",
  toolMode: "integrated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "ask",
      matches: (request) => !hasToolResult(request, "scenario-ask-user"),
      run: function* () {
        yield {
          type: "tool_call",
          id: "scenario-ask-user",
          name: "ask_user",
          argumentsText: JSON.stringify({
            question: "你想优先验证哪类剧情目标？",
            context: "这是显式测试场景发起的用户输入请求。",
            placeholder: "输入目标或选择建议…",
            choices: [
              { title: "角色动机", description: "检查人物行为驱动力" },
              { title: "冲突升级", description: "检查矛盾推进节奏" },
            ],
          }),
        };
      },
    },
    {
      id: "answer",
      matches: (request) => hasToolResult(request, "scenario-ask-user"),
      run: function* ({ request }) {
        const answer = readToolResultText(getToolResult(request, "scenario-ask-user"));
        yield {
          type: "message",
          id: "scenario-ask-user-message",
          content: `已收到用户输入：${answer}`,
        };
      },
    },
  ],
};

const parallelAskUserIds = ["scenario-ask-1", "scenario-ask-2", "scenario-ask-3"] as const;

const parallelAskUser: MockScenarioDefinition = {
  id: "tools.parallel-ask-user",
  title: "并行用户输入工具",
  description: "同时等待三个用户回答并在全部完成后续跑。",
  initialPrompt: "并行收集人物、冲突和结尾信息。",
  toolMode: "integrated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "ask",
      matches: (request) => !parallelAskUserIds.every((id) => hasToolResult(request, id)),
      run: function* () {
        const questions = ["主角的目标是什么？", "核心冲突是什么？", "结尾留下什么悬念？"];
        for (let index = 0; index < parallelAskUserIds.length; index++) {
          yield {
            type: "tool_call",
            id: parallelAskUserIds[index]!,
            name: "ask_user",
            argumentsText: JSON.stringify({
              question: questions[index],
              context: `并行问题 ${index + 1}/${parallelAskUserIds.length}`,
            }),
          };
        }
      },
    },
    {
      id: "answer",
      matches: (request) => parallelAskUserIds.every((id) => hasToolResult(request, id)),
      run: function* ({ request }) {
        const answers = parallelAskUserIds.map((id) =>
          readToolResultText(getToolResult(request, id)),
        );
        yield {
          type: "message",
          id: "scenario-parallel-ask-message",
          content: `三个回答均已收到：\n\n${answers.map((answer, index) => `${index + 1}. ${answer}`).join("\n")}`,
        };
      },
    },
  ],
};

const interruptedStream: MockScenarioDefinition = {
  id: "errors.interrupted-stream",
  title: "流意外中断",
  description: "输出部分正文后中断，用于验证错误恢复 UI。",
  initialPrompt: "运行流中断错误场景。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "interrupt",
      matches: () => true,
      run: function* () {
        yield {
          type: "message",
          id: "scenario-interrupt-message",
          content: "这是一段未完成的回复。",
        };
        yield { type: "interrupt" };
      },
    },
  ],
};

const providerWarning: MockScenarioDefinition = {
  id: "errors.provider-warning",
  title: "Provider 警告",
  description: "展示非致命 provider warning，并继续完成回复。",
  initialPrompt: "运行 provider warning 场景。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "warning",
      matches: () => true,
      run: function* () {
        yield {
          type: "warning",
          code: "MOCK_RATE_LIMIT_NEAR",
          message: "这是可恢复的测试警告，响应仍会继续。",
        };
        yield {
          type: "message",
          id: "scenario-warning-message",
          content: "warning 之后的正文已正常完成。",
        };
      },
    },
  ],
};

const contentFilter: MockScenarioDefinition = {
  id: "errors.content-filter",
  title: "内容过滤终止",
  description: "模拟 provider 内容过滤警告和非正常 stop reason。",
  initialPrompt: "运行内容过滤终止场景。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "filtered",
      matches: () => true,
      run: function* () {
        yield {
          type: "warning",
          code: "CONTENT_FILTERED",
          message: "测试响应被内容策略截断。",
        };
        yield { type: "complete", stopReason: "content_filter" };
      },
    },
  ],
};

const backendFailure: MockScenarioDefinition = {
  id: "errors.backend-failure",
  title: "后端错误（立即失败）",
  description: "模拟首 token 前 backend 错误（无任何输出），验证重试功能和错误恢复 UI。",
  initialPrompt: "运行后端错误场景。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "fail-immediately",
      matches: () => true,
      // oxlint-disable-next-line require-yield — 模拟首 token 前 backend 抛错
      run: function* () {
        throw new Error("模拟的后端服务错误：连接超时。");
      },
    },
  ],
};

const simulatedToolError: MockScenarioDefinition = {
  id: "tools.simulated-error",
  title: "模拟工具失败",
  description: "工具返回 error 后由 AI 整理失败信息。",
  initialPrompt: "调用一个会失败的文件读取工具。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  simulatedResults: {
    "scenario-tool-error": {
      outcome: "error",
      content: [{ type: "text", text: "测试文件不存在。" }],
      errorMessage: "测试文件不存在。",
    },
  },
  turns: [
    {
      id: "call-tool",
      matches: (request) => !hasToolResult(request, "scenario-tool-error"),
      run: function* () {
        yield {
          type: "tool_call",
          id: "scenario-tool-error",
          name: "read_resource_file",
          argumentsText: JSON.stringify({ path: "不存在.md" }),
        };
      },
    },
    {
      id: "render-error",
      matches: (request) => hasToolResult(request, "scenario-tool-error"),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, "scenario-tool-error"));
        yield {
          type: "message",
          id: "scenario-tool-error-message",
          content: `工具失败路径已完成：${result}`,
        };
      },
    },
  ],
};

const SUBAGENT_BASIC_CALL_ID = "scenario-subagent-basic";

const subagentBasic: MockScenarioDefinition = {
  id: "subagent.basic",
  title: "子代理基础委派",
  description: "编排者调用 run_subagent，子代理直接返回摘要，编排者整理结论。",
  initialPrompt: "委托一致性审查子代理检查人设。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "parent-delegate",
      matches: (request) =>
        !isSubagentRequest(request) && !hasToolResult(request, SUBAGENT_BASIC_CALL_ID),
      run: function* () {
        yield {
          type: "reasoning",
          id: "scenario-subagent-basic-reasoning",
          visibility: "summary",
          content: "任务可拆分，委派给一致性审查子代理。",
        };
        yield {
          type: "tool_call",
          id: SUBAGENT_BASIC_CALL_ID,
          name: "run_subagent",
          argumentsText: JSON.stringify({
            agent_id: "builtin-consistency-reviewer",
            task: "审查主角人设是否前后一致，给出简短结论。",
            constraints: "只读，不要改写文档。",
            focus: [{ domain: "manuscript", id: "chapter-1" }],
            parent_summary: "用户要求检查人设一致性。",
          }),
        };
      },
    },
    {
      id: "child-complete",
      matches: (request) => isSubagentRequest(request),
      run: function* () {
        yield {
          type: "reasoning",
          id: "scenario-subagent-child-reasoning",
          visibility: "summary",
          content: "根据任务与焦点节点整理审查结论。",
        };
        yield {
          type: "message",
          id: "scenario-subagent-child-message",
          content: "审查完成：未发现明显人设冲突。主角动机与前文章节一致。",
        };
        yield {
          type: "complete",
          usage: { inputTokens: 40, outputTokens: 28, totalTokens: 68 },
        };
      },
    },
    {
      id: "parent-summarize",
      matches: (request) =>
        !isSubagentRequest(request) && hasToolResult(request, SUBAGENT_BASIC_CALL_ID),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, SUBAGENT_BASIC_CALL_ID));
        yield {
          type: "message",
          id: "scenario-subagent-parent-message",
          content: `子代理已返回：\n\n\`\`\`json\n${result}\n\`\`\``,
        };
      },
    },
  ],
};

const SUBAGENT_TOOL_CALL_ID = "scenario-subagent-with-tool";
const SUBAGENT_CHILD_READ_ID = "scenario-subagent-child-read";

const subagentWithTool: MockScenarioDefinition = {
  id: "subagent.with-tool",
  title: "子代理带工具回合",
  description: "子代理先调用 read_document（模拟结果），再汇总；用于验证进度 phase 与续跑。",
  initialPrompt: "委托子代理读取章节后给出审查结论。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  simulatedResults: {
    [SUBAGENT_CHILD_READ_ID]: {
      outcome: "success",
      content: [
        {
          type: "json",
          json: {
            id: "chapter-1",
            title: "第一章",
            content: "主角走进雨夜，外套被风吹起。",
          },
        },
      ],
    },
  },
  turns: [
    {
      id: "parent-delegate",
      matches: (request) =>
        !isSubagentRequest(request) && !hasToolResult(request, SUBAGENT_TOOL_CALL_ID),
      run: function* () {
        yield {
          type: "tool_call",
          id: SUBAGENT_TOOL_CALL_ID,
          name: "run_subagent",
          argumentsText: JSON.stringify({
            agent_id: "builtin-consistency-reviewer",
            task: "读取第一章并判断开场是否自洽。",
            focus: [{ domain: "manuscript", id: "chapter-1" }],
          }),
        };
      },
    },
    {
      id: "child-call-tool",
      matches: (request) =>
        isSubagentRequest(request) && !hasToolResult(request, SUBAGENT_CHILD_READ_ID),
      run: function* () {
        yield {
          type: "message",
          id: "scenario-subagent-tool-thinking",
          content: "先读取焦点章节。",
        };
        yield {
          type: "tool_call",
          id: SUBAGENT_CHILD_READ_ID,
          name: "read_document",
          argumentsText: JSON.stringify({ domain: "manuscript", id: "chapter-1" }),
        };
      },
    },
    {
      id: "child-after-tool",
      matches: (request) =>
        isSubagentRequest(request) && hasToolResult(request, SUBAGENT_CHILD_READ_ID),
      run: function* () {
        yield {
          type: "message",
          id: "scenario-subagent-tool-summary",
          content: "已读取章节。结论：雨夜开场与人设描述一致，暂无冲突。",
        };
        yield {
          type: "complete",
          usage: { inputTokens: 52, outputTokens: 34, totalTokens: 86 },
        };
      },
    },
    {
      id: "parent-summarize",
      matches: (request) =>
        !isSubagentRequest(request) && hasToolResult(request, SUBAGENT_TOOL_CALL_ID),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, SUBAGENT_TOOL_CALL_ID));
        yield {
          type: "message",
          id: "scenario-subagent-with-tool-parent-message",
          content: `子代理工具回合已完成：\n\n\`\`\`json\n${result}\n\`\`\``,
        };
      },
    },
  ],
};

const SUBAGENT_FAIL_CALL_ID = "scenario-subagent-failed";

const subagentFailed: MockScenarioDefinition = {
  id: "subagent.failed",
  title: "子代理失败路径",
  description: "子代理未产出可用摘要，编排者收到 failed 结果并整理。",
  initialPrompt: "委托一个会失败的子代理任务。",
  toolMode: "simulated",
  mutatesWorkspace: false,
  turns: [
    {
      id: "parent-delegate",
      matches: (request) =>
        !isSubagentRequest(request) && !hasToolResult(request, SUBAGENT_FAIL_CALL_ID),
      run: function* () {
        yield {
          type: "tool_call",
          id: SUBAGENT_FAIL_CALL_ID,
          name: "run_subagent",
          argumentsText: JSON.stringify({
            agent_id: "builtin-consistency-reviewer",
            task: "故意不返回摘要以触发失败路径。",
          }),
        };
      },
    },
    {
      id: "child-empty",
      matches: (request) => isSubagentRequest(request),
      run: function* () {
        // No message text → executor reports "子代理未返回可用摘要。"
        yield {
          type: "complete",
          usage: { inputTokens: 10, outputTokens: 0, totalTokens: 10 },
        };
      },
    },
    {
      id: "parent-summarize",
      matches: (request) =>
        !isSubagentRequest(request) && hasToolResult(request, SUBAGENT_FAIL_CALL_ID),
      run: function* ({ request }) {
        const result = readToolResultText(getToolResult(request, SUBAGENT_FAIL_CALL_ID));
        yield {
          type: "message",
          id: "scenario-subagent-failed-parent-message",
          content: `子代理失败路径已完成：\n\n\`\`\`json\n${result}\n\`\`\``,
        };
      },
    },
  ],
};

export const MOCK_SCENARIOS = [
  basicStream,
  simulatedTool,
  integratedTool,
  askUser,
  parallelAskUser,
  simulatedToolError,
  subagentBasic,
  subagentWithTool,
  subagentFailed,
  providerWarning,
  contentFilter,
  interruptedStream,
  backendFailure,
] as const satisfies readonly MockScenarioDefinition[];
