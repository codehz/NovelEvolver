/** Summary for a repository branch tip. */
export type BranchSummary = {
  /** Branch name, e.g. "main". null if HEAD is detached. */
  name: string | null;
  /** Commit SHA of HEAD. null if the repository has no commits yet. */
  commit: string | null;
};

/** Result of a successful {@link ProjectSession.pushCurrentBranch}. */
export type ProjectPushResult = {
  branchName: string;
  remoteUrl: string;
  objectCount: number;
  updatedRef: string;
  oldHash: string | null;
  newHash: string | null;
};

/** Result of a successful {@link ProjectSession.pullCurrentBranch}. */
export type ProjectPullResult = {
  branchName: string;
  remoteUrl: string;
  objectCount: number;
  updatedRef: string;
  oldHash: string | null;
  newHash: string | null;
  /** True when the local branch tip advanced (fast-forward). */
  fastForwarded: boolean;
};
