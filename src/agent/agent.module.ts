import { Module } from '@nestjs/common';
import { AgentService } from './agent.service';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [McpModule],
  providers: [
    {
      provide: 'ANTHROPIC_API_KEY',
      useFactory: () => process.env.ANTHROPIC_API_KEY ?? '',
    },
    AgentService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
