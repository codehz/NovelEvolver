export { activateOnEnterSpace } from "./activate-on-enter-space";
export {
  buildChangeRoots,
  buildChangeTree,
  collectChangeTreeFolderKeys,
  flattenChangeTree,
  type ChangeDomainRoot,
  type ChangeFlatRow,
  type ChangeTreeFolderNode,
  type ChangeTreeLeafNode,
  type ChangeTreeNode,
} from "./change-tree-projector";
export { ChangeStatsBadge } from "./ChangeStatsBadge";
export { ChangesDomainRow } from "./ChangesDomainRow";
export { isMissingComparisonTargetError, isNoChangeTextDiffError } from "./comparison-errors";
export { formatCommitTime, formatHistoryTime } from "./format-history-time";
