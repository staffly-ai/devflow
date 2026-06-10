import { Test } from '@nestjs/testing';
import Anthropic from '@anthropic-ai/sdk';
import { AgentService } from './agent.service';
import { GitHubToolsService } from '../mcp/github-tools.service';
import { NormalizedEvent } from '../webhook/webhook.types';

jest.mock('@anthropic-ai/sdk');

const mockEvent: NormalizedEvent = {
  type: 'push',
  owner: 'staffly-ai',
  repo: 'devflow',
  branch: 'feature/STF-1',
  commitSha: 'abc123',
  commitMessage: 'add feature',
  prNumber: 7,
};

describe('AgentService', () => {
  let service: AgentService;
  let mockCreate: jest.Mock;
  let mockToolsService: jest.Mocked<GitHubToolsService>;

  beforeEach(async () => {
    mockCreate = jest.fn();
    (Anthropic as jest.Mock).mockImplementation(() => ({
      messages: { create: mockCreate },
    }));

    mockToolsService = {
      getToolDefinitions: jest.fn().mockReturnValue([]),
      executeTool: jest.fn().mockResolvedValue('tool result'),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        { provide: 'ANTHROPIC_API_KEY', useValue: 'test-key' },
        { provide: GitHubToolsService, useValue: mockToolsService },
        AgentService,
      ],
    }).compile();
    service = module.get(AgentService);
  });

  it('calls Claude and returns when end_turn with no tool use', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'LGTM' }],
    });

    await service.run('Review this: {{diff}}', mockEvent, 'diff-content');

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      model: 'claude-opus-4-8',
      thinking: { type: 'adaptive' },
    });
  });

  it('handles tool_use loop — calls tool then continues', async () => {
    mockCreate
      .mockResolvedValueOnce({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            id: 'tu_1',
            name: 'post_pr_comment',
            input: { owner: 'staffly-ai', repo: 'devflow', pr_number: 7, body: 'Review' },
          },
        ],
      })
      .mockResolvedValueOnce({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'Done.' }],
      });

    await service.run('Review: {{diff}}', mockEvent, 'diff-content');

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockToolsService.executeTool).toHaveBeenCalledWith('post_pr_comment', expect.any(Object));
  });

  it('fills template variables in prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
    });

    await service.run(
      'Branch: {{branch}}\nDiff: {{diff}}\nCommit: {{commit_message}}',
      mockEvent,
      'my-diff',
    );

    const messages = mockCreate.mock.calls[0][0].messages;
    const userContent = messages[0].content;
    expect(userContent).toContain('Branch: feature/STF-1');
    expect(userContent).toContain('Diff: my-diff');
    expect(userContent).toContain('Commit: add feature');
  });
});
