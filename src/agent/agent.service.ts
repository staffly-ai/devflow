import { Injectable, Inject, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { GitHubToolsService } from '../mcp/github-tools.service';
import { NormalizedEvent } from '../webhook/webhook.types';

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private anthropic: Anthropic;

  constructor(
    @Inject('ANTHROPIC_API_KEY') apiKey: string,
    private readonly githubTools: GitHubToolsService,
  ) {
    this.anthropic = new Anthropic({ apiKey });
  }

  async run(template: string, event: NormalizedEvent, diff: string): Promise<void> {
    const prompt = this.fillTemplate(template, event, diff);
    const tools = this.githubTools.getToolDefinitions();

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt },
    ];

    while (true) {
      const response = await this.anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 8192,
        thinking: { type: 'adaptive' },
        tools: tools as Anthropic.Tool[],
        messages,
      });

      if (response.stop_reason === 'end_turn') break;

      if (response.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;
          this.logger.log(`Calling tool: ${block.name}`);
          const result = await this.githubTools.executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      break;
    }
  }

  private fillTemplate(template: string, event: NormalizedEvent, diff: string): string {
    const prInfo = event.prTitle
      ? `Title: ${event.prTitle}\n${event.prBody ?? ''}`
      : '(not a PR event)';

    return template
      .replace(/{{diff}}/g, diff)
      .replace(/{{branch}}/g, event.branch)
      .replace(/{{commit_message}}/g, event.commitMessage)
      .replace(/{{pr_info}}/g, prInfo);
  }
}
