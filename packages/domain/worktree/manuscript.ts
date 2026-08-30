import type { ExternalImportEntry, ExternalImportSkip } from "./external-import";

export type { ExternalImportEntry, ExternalImportSkip };

export type ManuscriptNodeType = "folder" | "chapter";

export type ManuscriptFolderNode = {
  id: string;
  type: "folder";
  title: string;
  children: string[];
};

export type ManuscriptChapterNode = {
  id: string;
  type: "chapter";
  title: string;
};

export type ManuscriptNode = ManuscriptFolderNode | ManuscriptChapterNode;

export type ManuscriptOutline = {
  version: 1;
  rootId: "root";
  nodes: Record<string, ManuscriptNode>;
};

export type WorktreeNodeIdResult = {
  nodeId: string;
};

export type ManuscriptImportCreated = {
  nodeId: string;
  relativePath: string;
  kind: "chapter" | "folder";
};

export type ManuscriptImportResult = {
  created: ManuscriptImportCreated[];
  skipped: ExternalImportSkip[];
};
