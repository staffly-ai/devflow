import { Injectable, Inject } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

@Injectable()
export class GitHubToolsService {
  private octokit: Octokit;

  constructor(@Inject('GITHUB_TOKEN') token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'get_diff',
        description: 'Fetch the git diff between two commits in a GitHub repository.',
        input_schema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            base: { type: 'string', description: 'Base commit SHA' },
            head: { type: 'string', description: 'Head commit SHA' },
          },
          required: ['owner', 'repo', 'base', 'head'],
        },
      },
      {
        name: 'get_pr_info',
        description: 'Get title and description of a GitHub pull request.',
        input_schema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            pr_number: { type: 'number', description: 'Pull request number' },
          },
          required: ['owner', 'repo', 'pr_number'],
        },
      },
      {
        name: 'post_pr_comment',
        description: 'Post a review comment on a GitHub pull request.',
        input_schema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            pr_number: { type: 'number', description: 'Pull request number' },
            body: { type: 'string', description: 'Comment body (Markdown)' },
          },
          required: ['owner', 'repo', 'pr_number', 'body'],
        },
      },
    ];
  }

  async executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    switch (name) {
      case 'get_diff':
        return this.getDiff(
          input.owner as string,
          input.repo as string,
          input.base as string,
          input.head as string,
        );
      case 'get_pr_info':
        return this.getPrInfo(
          input.owner as string,
          input.repo as string,
          input.pr_number as number,
        );
      case 'post_pr_comment':
        return this.postPrComment(
          input.owner as string,
          input.repo as string,
          input.pr_number as number,
          input.body as string,
        );
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const { data } = await this.octokit.repos.compareCommits({ owner, repo, base, head });
    if (!data.files?.length) return 'No changed files.';
    return data.files
      .map((f) => `### ${f.filename}\n${f.patch ?? '(binary)'}`)
      .join('\n\n');
  }

  private async getPrInfo(owner: string, repo: string, pr_number: number): Promise<string> {
    const { data } = await this.octokit.pulls.get({ owner, repo, pull_number: pr_number });
    return `Title: ${data.title}\n\n${data.body ?? '(no description)'}`;
  }

  private async postPrComment(
    owner: string,
    repo: string,
    pr_number: number,
    body: string,
  ): Promise<string> {
    await this.octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr_number,
      body,
      event: 'COMMENT',
    });
    return 'Comment posted.';
  }
}
