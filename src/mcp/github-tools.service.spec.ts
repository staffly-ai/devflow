import { Test } from '@nestjs/testing';
import { GitHubToolsService } from './github-tools.service';
import { Octokit } from '@octokit/rest';

jest.mock('@octokit/rest');

describe('GitHubToolsService', () => {
  let service: GitHubToolsService;
  let mockOctokit: jest.Mocked<Octokit>;

  beforeEach(async () => {
    mockOctokit = {
      repos: {
        compareCommits: jest.fn().mockResolvedValue({
          data: { files: [{ filename: 'a.ts', patch: '@@ -1 +1 @@\n-old\n+new' }] },
        }),
      },
      pulls: {
        get: jest.fn().mockResolvedValue({
          data: { title: 'My PR', body: 'Some description', number: 42 },
        }),
        createReview: jest.fn().mockResolvedValue({ data: { id: 1 } }),
      },
    } as any;

    (Octokit as jest.Mock).mockImplementation(() => mockOctokit);

    const module = await Test.createTestingModule({
      providers: [
        { provide: 'GITHUB_TOKEN', useValue: 'test-token' },
        GitHubToolsService,
      ],
    }).compile();
    service = module.get(GitHubToolsService);
  });

  it('exposes tool definitions', () => {
    const defs = service.getToolDefinitions();
    const names = defs.map((d) => d.name);
    expect(names).toContain('get_diff');
    expect(names).toContain('get_pr_info');
    expect(names).toContain('post_pr_comment');
  });

  it('get_diff returns formatted diff', async () => {
    const result = await service.executeTool('get_diff', {
      owner: 'staffly-ai',
      repo: 'devflow',
      base: 'abc',
      head: 'def',
    });
    expect(result).toContain('a.ts');
    expect(result).toContain('+new');
  });

  it('get_pr_info returns PR summary', async () => {
    const result = await service.executeTool('get_pr_info', {
      owner: 'staffly-ai',
      repo: 'devflow',
      pr_number: 42,
    });
    expect(result).toContain('My PR');
  });

  it('post_pr_comment posts review comment', async () => {
    const result = await service.executeTool('post_pr_comment', {
      owner: 'staffly-ai',
      repo: 'devflow',
      pr_number: 42,
      body: 'LGTM',
    });
    expect(result).toBe('Comment posted.');
    expect(mockOctokit.pulls.createReview).toHaveBeenCalledWith(
      expect.objectContaining({ body: 'LGTM', event: 'COMMENT' }),
    );
  });
});
