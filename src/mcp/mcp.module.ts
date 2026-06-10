import { Module } from '@nestjs/common';
import { GitHubToolsService } from './github-tools.service';

@Module({
  providers: [
    {
      provide: 'GITHUB_TOKEN',
      useFactory: () => process.env.GITHUB_TOKEN ?? '',
    },
    GitHubToolsService,
  ],
  exports: [GitHubToolsService],
})
export class McpModule {}
