export { computeManuscriptDiffItems } from "./manuscript-diff";
export { computeResourceDiffItems } from "./resource-diff";
export {
  type ObjectDatabase,
  type BaseSnapshot,
  readFileFromTree,
  readTextFromTree,
  buildParentMap,
  parseOutlineOrNull,
  buildAncestorPath,
  computeDepth,
  computeStats,
  computeLCS,
  buildBaseSnapshot,
  getWorktreeResourcePaths,
  getWorktreeOutline,
  ensureResourcesDirectory,
  joinWorktreeChild,
  toWorktreePath,
  RESOURCES_DIR,
  chapterBodyPath,
  MANUSCRIPT_OUTLINE_PATH,
} from "./utils";
