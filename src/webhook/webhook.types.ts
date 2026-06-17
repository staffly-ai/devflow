export interface GitHubPushPayload {
  ref: string; // e.g. "refs/heads/feature/STF-1234"
  after: string; // commit SHA
  before: string;
  repository: {
    full_name: string; // e.g. "staffly-ai/devflow"
    owner: { login: string };
    name: string;
  };
  head_commit: {
    id: string;
    message: string;
  };
}

export interface GitHubPullRequestPayload {
  action: 'opened' | 'synchronize' | 'closed' | string;
  number: number;
  pull_request: {
    head: {
      ref: string; // branch name
      sha: string;
    };
    title: string;
    body: string | null;
  };
  repository: {
    full_name: string;
    owner: { login: string };
    name: string;
  };
}

export type GitHubEventPayload = GitHubPushPayload | GitHubPullRequestPayload;

export interface NormalizedEvent {
  type: 'push' | 'pull_request:opened' | 'pull_request:synchronize';
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  prNumber?: number;
  prTitle?: string;
  prBody?: string;
}
