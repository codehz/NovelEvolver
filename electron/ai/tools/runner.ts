import type { ToolCallItem, ToolResultItem } from "@codehz/ai";
import { toolResultItem } from "@codehz/ai";

import type { WorktreeSession } from "../../worktree/session";
import { toErrorMessage } from "../ai-utils";
import { AskUserRequestHandleImpl, parseAskUserArgs } from "./ask-user";
import { type AI_TOOL_NAMES } from "./definitions";
import {
  executeDeleteDocument,
  executeGetWorktreeChanges,
  executeListDocumentHistory,
  executeMoveDocument,
  executeReadDocumentDiff,
  executeReadHistoryVersion,
  executeRenameDocument,
} from "./project-edit-tools";
import {
  executeCreateFolder,
  executeCreateTextDocument,
  executeEditTextDocument,
  executeGetProjectStructure,
  executeReadTextDocument,
  executeReplaceTextDocument,
  executeSearchProject,
} from "./project-tools";
import type { UserInputRequest } from "./user-input-types";

export type { UserInputRequest, UserInputResolver } from "./user-input-types";

export type ToolExecutionResult = {
  toolResult: ToolResultItem;
  resultText: string | null;
  errorMessage: string | null;
  userInputRequest?: UserInputRequest;
};

export type ResolveWorktree = () => WorktreeSession;

export type ToolRunner = {
  execute(call: ToolCallItem): Promise<ToolExecutionResult>;
};

// ---- result helpers ----

function okJson(call: ToolCallItem, json: unknown): ToolExecutionResult {
  const resultText = JSON.stringify(json, null, 2);
  return {
    toolResult: toolResultItem(call.id, call.name, "success", [{ type: "json", json }]),
    resultText,
    errorMessage: null,
  };
}

function err(call: ToolCallItem, message: string): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "error", [{ type: "text", text: message }]),
    resultText: null,
    errorMessage: message,
  };
}

function askUserResult(
  call: ToolCallItem,
  args: ReturnType<typeof parseAskUserArgs>,
): ToolExecutionResult {
  return {
    toolResult: toolResultItem(call.id, call.name, "rejected", [
      { type: "text", text: "等待用户回答。" },
    ]),
    resultText: null,
    errorMessage: null,
    userInputRequest: {
      toolName: call.name,
      prompt: args.question,
      createHandle: (resolver) => new AskUserRequestHandleImpl(call, resolver),
      serializable: { toolName: call.name, args },
    },
  };
}

// ---- handler registry ----

type ToolHandler = (worktree: WorktreeSession, call: ToolCallItem) => ToolExecutionResult;

const toolHandlers: Partial<Record<AI_TOOL_NAMES, ToolHandler>> = {
  ask_user(worktree, call) {
    const args = parseAskUserArgs(call);
    return askUserResult(call, args);
  },
  read_structure(worktree, call) {
    const output = executeGetProjectStructure(worktree, call);
    return okJson(call, output);
  },
  read_document(worktree, call) {
    return okJson(call, executeReadTextDocument(worktree, call));
  },
  search_documents(worktree, call) {
    const output = executeSearchProject(worktree, call);
    return okJson(call, output);
  },
  write_document(worktree, call) {
    const output = executeEditTextDocument(worktree, call);
    return okJson(call, output);
  },
  replace_document_text(worktree, call) {
    return okJson(call, executeReplaceTextDocument(worktree, call));
  },
  create_folder(worktree, call) {
    const output = executeCreateFolder(worktree, call);
    return okJson(call, output);
  },
  create_document(worktree, call) {
    const output = executeCreateTextDocument(worktree, call);
    return okJson(call, output);
  },
  move_node(worktree, call) {
    return okJson(call, executeMoveDocument(worktree, call));
  },
  rename_node(worktree, call) {
    return okJson(call, executeRenameDocument(worktree, call));
  },
  delete_node(worktree, call) {
    return okJson(call, executeDeleteDocument(worktree, call));
  },
  read_changes(worktree, call) {
    return okJson(call, executeGetWorktreeChanges(worktree, call));
  },
  read_change(worktree, call) {
    return okJson(call, executeReadDocumentDiff(worktree, call));
  },
  read_history(worktree, call) {
    return okJson(call, executeListDocumentHistory(worktree, call));
  },
  read_history_entry(worktree, call) {
    return okJson(call, executeReadHistoryVersion(worktree, call));
  },
};

// ---- runner ----

export function createToolRunner(resolveWorktree: ResolveWorktree): ToolRunner {
  return {
    async execute(call: ToolCallItem): Promise<ToolExecutionResult> {
      const handler = toolHandlers[call.name as AI_TOOL_NAMES];
      if (!handler) {
        return err(call, `Unknown tool: ${call.name}`);
      }
      try {
        return handler(resolveWorktree(), call);
      } catch (error) {
        return err(call, toErrorMessage(error));
      }
    },
  };
}
