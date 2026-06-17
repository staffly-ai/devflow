import { Controller, Post, Headers, Body, UseGuards, Logger, HttpCode } from '@nestjs/common';
import { WebhookGuard } from './webhook.guard';
import { SkillRouterService } from '../skills/skill-router.service';
import { AgentService } from '../agent/agent.service';
import { GitHubToolsService } from '../mcp/github-tools.service';
import { NormalizedEvent, GitHubPushPayload, GitHubPullRequestPayload } from './webhook.types';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly skillRouter: SkillRouterService,
    private readonly agentService: AgentService,
    private readonly githubTools: GitHubToolsService,
  ) {}

  @Post()
  @UseGuards(WebhookGuard)
  @HttpCode(200)
  async handle(
    @Body() payload: any,
    @Headers('x-github-event') eventHeader: string,
  ): Promise<{ status: string }> {
    const event = this.normalize(eventHeader, payload);
    if (!event) return { status: 'ignored' };

    const skill = this.skillRouter.route(event);
    if (!skill) {
      this.logger.log(`No skill matched for ${event.type} on ${event.branch}`);
      return { status: 'no_skill' };
    }

    this.logger.log(`Running skill "${skill.name}" for ${event.branch}`);

    const diff = await this.githubTools.executeTool('get_diff', {
      owner: event.owner,
      repo: event.repo,
      base: event.commitSha + '^',
      head: event.commitSha,
    });

    // Run agent in background — don't await so webhook returns fast
    this.agentService.run(skill.template, event, diff).catch((err) =>
      this.logger.error(`Agent error: ${err.message}`),
    );

    return { status: 'accepted' };
  }

  private normalize(eventHeader: string, payload: any): NormalizedEvent | null {
    if (eventHeader === 'push') {
      const p = payload as GitHubPushPayload;
      const branch = p.ref.replace('refs/heads/', '');
      return {
        type: 'push',
        owner: p.repository.owner.login,
        repo: p.repository.name,
        branch,
        commitSha: p.after,
        commitMessage: p.head_commit?.message ?? '',
      };
    }

    if (eventHeader === 'pull_request') {
      const p = payload as GitHubPullRequestPayload;
      if (!['opened', 'synchronize'].includes(p.action)) return null;
      const type = p.action === 'opened' ? 'pull_request:opened' : 'pull_request:synchronize';
      return {
        type,
        owner: p.repository.owner.login,
        repo: p.repository.name,
        branch: p.pull_request.head.ref,
        commitSha: p.pull_request.head.sha,
        commitMessage: '',
        prNumber: p.number,
        prTitle: p.pull_request.title,
        prBody: p.pull_request.body ?? '',
      };
    }

    return null;
  }
}
