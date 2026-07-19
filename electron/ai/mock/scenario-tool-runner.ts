import { toolResultItem } from "@codehz/ai";

import type { ToolExecutionResult, ToolRunner } from "../tools";
import type { MockScenarioDefinition } from "./scenario-types";

function contentText(content: readonly { type: string; text?: string; json?: unknown }[]): string {
  return content
    .map((block) => {
      if (block.type === "text") {
        return block.text ?? "";
      }
      if (block.type === "json") {
        return JSON.stringify(block.json, null, 2);
      }
      return "";
    })
    .join("\n");
}

export function createScenarioToolRunner(
  realRunner: ToolRunner,
  scenario: MockScenarioDefinition | null,
): ToolRunner {
  if (!scenario || scenario.toolMode === "integrated") {
    return realRunner;
  }

  return {
    async execute(call): Promise<ToolExecutionResult> {
      const result = scenario.simulatedResults?.[call.id];
      if (!result) {
        const message = `Scenario ${scenario.id} has no simulated result for tool call ${call.id}.`;
        return {
          toolResult: toolResultItem(call.id, call.name, "error", [
            { type: "text", text: message },
          ]),
          resultText: null,
          errorMessage: message,
          view: null,
        };
      }

      const resultText = contentText(result.content);
      return {
        toolResult: toolResultItem(call.id, call.name, result.outcome, [...result.content]),
        resultText: resultText === "" ? null : resultText,
        errorMessage: result.errorMessage ?? (result.outcome === "error" ? resultText : null),
        view: null,
      };
    },
  };
}
