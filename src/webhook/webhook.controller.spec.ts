import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { SkillRouterService } from '../skills/skill-router.service';
import { AgentService } from '../agent/agent.service';
import { GitHubToolsService } from '../mcp/github-tools.service';

const SECRET = 'test-secret';

function sign(body: string) {
  return 'sha256=' + createHmac('sha256', SECRET).update(Buffer.from(body)).digest('hex');
}

describe('WebhookController', () => {
  let app: INestApplication;
  let mockAgent: jest.Mocked<AgentService>;
  let mockRouter: jest.Mocked<SkillRouterService>;
  let mockGitHub: jest.Mocked<GitHubToolsService>;

  beforeEach(async () => {
    mockAgent = { run: jest.fn().mockResolvedValue(undefined) } as any;
    mockRouter = { route: jest.fn() } as any;
    mockGitHub = { executeTool: jest.fn().mockResolvedValue('diff content') } as any;

    const module = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: 'WEBHOOK_SECRET', useValue: SECRET },
        { provide: SkillRouterService, useValue: mockRouter },
        { provide: AgentService, useValue: mockAgent },
        { provide: GitHubToolsService, useValue: mockGitHub },
        WebhookGuard,
      ],
    }).compile();

    app = module.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(() => app.close());

  it('returns 200 and triggers agent when skill matched', async () => {
    mockRouter.route.mockReturnValue({
      name: 'code-review',
      trigger: 'push',
      branches: 'feature/*',
      template: 'Review: {{diff}}',
    });

    const body = JSON.stringify({
      ref: 'refs/heads/feature/STF-1',
      after: 'abc123',
      before: '000000',
      repository: { full_name: 'staffly-ai/devflow', owner: { login: 'staffly-ai' }, name: 'devflow' },
      head_commit: { id: 'abc123', message: 'add feature' },
    });

    const res = await request(app.getHttpServer())
      .post('/webhook')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', sign(body))
      .set('content-type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(mockAgent.run).toHaveBeenCalledTimes(1);
  });

  it('returns 200 and skips agent when no skill matched', async () => {
    mockRouter.route.mockReturnValue(null);

    const body = JSON.stringify({
      ref: 'refs/heads/main',
      after: 'abc123',
      before: '000000',
      repository: { full_name: 'staffly-ai/devflow', owner: { login: 'staffly-ai' }, name: 'devflow' },
      head_commit: { id: 'abc123', message: 'merge' },
    });

    const res = await request(app.getHttpServer())
      .post('/webhook')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', sign(body))
      .set('content-type', 'application/json')
      .send(body);

    expect(res.status).toBe(200);
    expect(mockAgent.run).not.toHaveBeenCalled();
  });

  it('returns 401 when signature is invalid', async () => {
    const body = JSON.stringify({ ref: 'refs/heads/feature/x' });

    const res = await request(app.getHttpServer())
      .post('/webhook')
      .set('x-github-event', 'push')
      .set('x-hub-signature-256', 'sha256=invalidsig')
      .set('content-type', 'application/json')
      .send(body);

    expect(res.status).toBe(401);
  });
});
