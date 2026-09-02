import type { SHA1 } from "nano-git";

import { encodeUtf8 } from "../bytes";
import { resourceIndexFromTree } from "../resources/index";
import { RESOURCES_DIR } from "../resources/paths";
import { manuscriptTreeToOutline, sortedEntryValues } from "../trees/worktree-tree-bridge";
import { RESOURCES_FILES_DIR_NAME, RESOURCES_INDEX_FILE } from "./state";
import type { WorktreeSessionState } from "./state";

export function writeCurrentTreeToRepo(state: WorktreeSessionState): SHA1 {
  const rootEntries = [];
  rootEntries.push({
    mode: "040000",
    name: "manuscript",
    hash: writeCurrentManuscriptTreeToRepo(state),
  });
  rootEntries.push({
    mode: "040000",
    name: RESOURCES_DIR,
    hash: writeCurrentResourcesTreeToRepo(state),
  });
  return state.repo.createTree(rootEntries);
}

export function writeCurrentManuscriptTreeToRepo(state: WorktreeSessionState): SHA1 {
  const outline = `${JSON.stringify(manuscriptTreeToOutline(state.manuscriptTree), null, 2)}\n`;
  const entries = [
    {
      mode: "100644",
      name: "outline.json",
      hash: state.repo.writeBlob(encodeUtf8(outline)),
    },
  ];

  const chapterEntries = sortedEntryValues(state.currentManuscript.entries)
    .filter((entry) => entry.type === "chapter")
    .map((entry) => ({
      mode: "100644",
      name: `${entry.id}.md`,
      hash: state.repo.writeBlob(encodeUtf8(entry.content)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));

  if (chapterEntries.length > 0) {
    entries.push({
      mode: "040000",
      name: "bodies",
      hash: state.repo.createTree(chapterEntries),
    });
  }

  return state.repo.createTree(entries);
}

export function writeCurrentResourcesTreeToRepo(state: WorktreeSessionState): SHA1 {
  const index = `${JSON.stringify(resourceIndexFromTree(state.resourceTree), null, 2)}\n`;
  const entries = [
    {
      mode: "100644",
      name: RESOURCES_INDEX_FILE,
      hash: state.repo.writeBlob(encodeUtf8(index)),
    },
  ];
  const fileEntries = sortedEntryValues(state.currentResources.entries)
    .filter((entry) => entry.type === "file")
    .map((entry) => ({
      mode: "100644",
      name: `${entry.id}.txt`,
      hash: state.repo.writeBlob(encodeUtf8(entry.content)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
  if (fileEntries.length > 0) {
    entries.push({
      mode: "040000",
      name: RESOURCES_FILES_DIR_NAME,
      hash: state.repo.createTree(fileEntries),
    });
  }
  return state.repo.createTree(entries);
}
