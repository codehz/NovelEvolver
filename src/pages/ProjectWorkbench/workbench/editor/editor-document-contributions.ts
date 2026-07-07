import type { RpcPromise } from "capnweb";

import type { PlainTextEditorHandle } from "#app/components/PlainTextEditor";
import type { ManuscriptHandle } from "#shared/rpc/manuscript-rpc";
import type { ResourceLibraryHandle } from "#shared/rpc/resource-library-rpc";

import type {
  ContentWorkbenchEditorTab,
  WorkbenchEditorDocument,
  WorkbenchEditorTab,
} from "../state/types";

export type WorkbenchEditorDocumentContributionContext = {
  manuscript: RpcPromise<ManuscriptHandle>;
  resources: RpcPromise<ResourceLibraryHandle>;
};

type WorkbenchEditorDocumentContribution = {
  tabKind: ContentWorkbenchEditorTab["kind"];
  documentKind: WorkbenchEditorDocument["kind"];
  notificationSource: string;
  getTabDocumentKey: (tab: ContentWorkbenchEditorTab) => string;
  getDocumentKey: (document: WorkbenchEditorDocument) => string;
  readContent: (
    document: WorkbenchEditorDocument,
    context: WorkbenchEditorDocumentContributionContext,
  ) => Promise<string>;
  writeContent: (
    tab: ContentWorkbenchEditorTab,
    content: string,
    context: WorkbenchEditorDocumentContributionContext,
  ) => Promise<unknown>;
  areDocumentsEqual: (left: WorkbenchEditorDocument, right: WorkbenchEditorDocument) => boolean;
};

function applySyncedContent(
  document: WorkbenchEditorDocument,
  content: string,
  editorHandle: PlainTextEditorHandle | undefined,
): WorkbenchEditorDocument {
  const currentValue = editorHandle?.getValue();
  if (currentValue === content) {
    return {
      ...document,
      baselineContent: content,
    };
  }

  if (currentValue === undefined || currentValue === document.baselineContent) {
    editorHandle?.setValue(content);
    return {
      ...document,
      baselineContent: content,
    };
  }

  return document;
}

const resourceDocumentContribution: WorkbenchEditorDocumentContribution = {
  tabKind: "resource",
  documentKind: "resource",
  notificationSource: "资源库",
  getTabDocumentKey: (tab) =>
    `resource:${(tab as Extract<ContentWorkbenchEditorTab, { kind: "resource" }>).resourceId}`,
  getDocumentKey: (document) =>
    `resource:${(document as Extract<WorkbenchEditorDocument, { kind: "resource" }>).resourceId}`,
  readContent: async (document, context) => {
    const resourceDocument = document as Extract<WorkbenchEditorDocument, { kind: "resource" }>;
    return Promise.resolve(context.resources.readFile(resourceDocument.resourceId));
  },
  writeContent: (tab, content, context) => {
    const resourceTab = tab as Extract<ContentWorkbenchEditorTab, { kind: "resource" }>;
    return Promise.resolve(context.resources.writeFile(resourceTab.resourceId, content));
  },
  areDocumentsEqual: (left, right) =>
    left.key === right.key &&
    left.baselineContent === right.baselineContent &&
    (left as Extract<WorkbenchEditorDocument, { kind: "resource" }>).resourceId ===
      (right as Extract<WorkbenchEditorDocument, { kind: "resource" }>).resourceId,
};

const manuscriptDocumentContribution: WorkbenchEditorDocumentContribution = {
  tabKind: "manuscript",
  documentKind: "manuscript",
  notificationSource: "正文",
  getTabDocumentKey: (tab) =>
    `manuscript:${(tab as Extract<ContentWorkbenchEditorTab, { kind: "manuscript" }>).chapterId}`,
  getDocumentKey: (document) =>
    `manuscript:${(document as Extract<WorkbenchEditorDocument, { kind: "manuscript" }>).chapterId}`,
  readContent: async (document, context) => {
    const manuscriptDocument = document as Extract<WorkbenchEditorDocument, { kind: "manuscript" }>;
    return Promise.resolve(context.manuscript.readChapter(manuscriptDocument.chapterId));
  },
  writeContent: (tab, content, context) => {
    const manuscriptTab = tab as Extract<ContentWorkbenchEditorTab, { kind: "manuscript" }>;
    return Promise.resolve(context.manuscript.writeChapter(manuscriptTab.chapterId, content));
  },
  areDocumentsEqual: (left, right) =>
    left.key === right.key &&
    left.baselineContent === right.baselineContent &&
    (left as Extract<WorkbenchEditorDocument, { kind: "manuscript" }>).chapterId ===
      (right as Extract<WorkbenchEditorDocument, { kind: "manuscript" }>).chapterId,
};

const workbenchEditorDocumentContributions = [
  resourceDocumentContribution,
  manuscriptDocumentContribution,
] as const;

function getWorkbenchEditorDocumentContributionByTab(
  tab: ContentWorkbenchEditorTab,
): WorkbenchEditorDocumentContribution {
  const contribution = workbenchEditorDocumentContributions.find(
    (candidate) => candidate.tabKind === tab.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor content tab kind: ${tab.kind}`);
  }
  return contribution;
}

function getWorkbenchEditorDocumentContributionByDocument(
  document: WorkbenchEditorDocument,
): WorkbenchEditorDocumentContribution {
  const contribution = workbenchEditorDocumentContributions.find(
    (candidate) => candidate.documentKind === document.kind,
  );
  if (contribution === undefined) {
    throw new Error(`Unsupported workbench editor document kind: ${document.kind}`);
  }
  return contribution;
}

export function getWorkbenchEditorContentTabDocumentKey(tab: ContentWorkbenchEditorTab): string {
  return getWorkbenchEditorDocumentContributionByTab(tab).getTabDocumentKey(tab);
}

export function getWorkbenchEditorTabDocumentKey(tab: WorkbenchEditorTab): string | null {
  const contribution = workbenchEditorDocumentContributions.find(
    (candidate) => candidate.tabKind === tab.kind,
  );
  return contribution?.getTabDocumentKey(tab as ContentWorkbenchEditorTab) ?? null;
}

export function getWorkbenchEditorDocumentKey(document: WorkbenchEditorDocument): string {
  return getWorkbenchEditorDocumentContributionByDocument(document).getDocumentKey(document);
}

export function getWorkbenchEditorContentTabNotificationSource(
  tab: ContentWorkbenchEditorTab,
): string {
  return getWorkbenchEditorDocumentContributionByTab(tab).notificationSource;
}

export function syncWorkbenchEditorDocument(
  document: WorkbenchEditorDocument,
  editorHandle: PlainTextEditorHandle | undefined,
  context: WorkbenchEditorDocumentContributionContext,
): Promise<WorkbenchEditorDocument> {
  return getWorkbenchEditorDocumentContributionByDocument(document)
    .readContent(document, context)
    .then((content) => applySyncedContent(document, content, editorHandle));
}

export function writeWorkbenchEditorContentTab(
  tab: ContentWorkbenchEditorTab,
  content: string,
  context: WorkbenchEditorDocumentContributionContext,
): Promise<unknown> {
  return getWorkbenchEditorDocumentContributionByTab(tab).writeContent(tab, content, context);
}

export function areWorkbenchEditorDocumentsStructurallyEqual(
  left: WorkbenchEditorDocument,
  right: WorkbenchEditorDocument,
): boolean {
  const leftContribution = getWorkbenchEditorDocumentContributionByDocument(left);
  const rightContribution = getWorkbenchEditorDocumentContributionByDocument(right);
  if (leftContribution.documentKind !== rightContribution.documentKind) {
    return false;
  }
  return leftContribution.areDocumentsEqual(left, right);
}
