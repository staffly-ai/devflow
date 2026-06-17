import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookGuard } from './webhook.guard';
import { SkillsModule } from '../skills/skills.module';
import { AgentModule } from '../agent/agent.module';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [SkillsModule, AgentModule, McpModule],
  controllers: [WebhookController],
  providers: [
    {
      provide: 'WEBHOOK_SECRET',
      useFactory: () => process.env.GITHUB_WEBHOOK_SECRET ?? '',
    },
    WebhookGuard,
  ],
})
export class WebhookModule {}
