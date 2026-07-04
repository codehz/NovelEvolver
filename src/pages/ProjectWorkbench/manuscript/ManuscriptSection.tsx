import { TreePane } from "../tree/TreePane";
import { useManuscriptTreePane } from "./use-manuscript-tree-pane";

export function ManuscriptSectionBody() {
  const pane = useManuscriptTreePane();
  return <TreePane {...pane} />;
}
