import { Injectable } from '@nestjs/common';
import { minimatch } from 'minimatch';
import { SkillLoaderService, Skill } from './skill-loader.service';
import { NormalizedEvent } from '../webhook/webhook.types';

@Injectable()
export class SkillRouterService {
  constructor(private readonly loader: SkillLoaderService) {}

  route(event: NormalizedEvent): Skill | null {
    return (
      this.loader
        .getAll()
        .find((skill) => {
          if (skill.trigger !== event.type) return false;
          // Normalize bare '*' to '**' so it matches branches containing slashes
          const pattern = skill.branches === '*' ? '**' : skill.branches;
          return minimatch(event.branch, pattern);
        }) ?? null
    );
  }
}
