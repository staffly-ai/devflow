import { Module } from '@nestjs/common';
import { SkillLoaderService } from './skill-loader.service';
import { SkillRouterService } from './skill-router.service';

@Module({
  providers: [
    {
      provide: 'SKILLS_DIR',
      useFactory: () => process.env.SKILLS_DIR ?? './skills',
    },
    SkillLoaderService,
    SkillRouterService,
  ],
  exports: [SkillRouterService],
})
export class SkillsModule {}
