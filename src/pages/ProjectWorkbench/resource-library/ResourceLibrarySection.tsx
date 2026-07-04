import { TreePane } from "../tree/TreePane";
import { useResourceLibraryTreePane } from "./use-resource-library-tree-pane";

export function ResourceLibrarySectionBody() {
  const pane = useResourceLibraryTreePane();
  return <TreePane {...pane} />;
}
