import { ScopeProvider } from "bunshi/react";

import { PlainTextEditor } from "./PlainTextEditor";
import { editorTabScope } from "./workbench-editor-molecules";

type EditorTabPaneProps = {
  tabId: string;
  active: boolean;
  defaultValue: string;
};

export function EditorTabPane({ tabId, active, defaultValue }: EditorTabPaneProps) {
  return (
    <ScopeProvider scope={editorTabScope} value={tabId}>
      <div
        className={active ? "flex min-h-0 min-w-0 flex-1 flex-col" : "hidden"}
        aria-hidden={!active}
      >
        <PlainTextEditor defaultValue={defaultValue} />
      </div>
    </ScopeProvider>
  );
}
