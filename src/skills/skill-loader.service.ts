import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';

export interface Skill {
  name: string;
  trigger: string;
  branches: string;
  template: string;
}

@Injectable()
export class SkillLoaderService implements OnModuleInit {
  private skills: Skill[] = [];

  constructor(@Inject('SKILLS_DIR') private readonly skillsDir: string) {}

  async onModuleInit() {
    this.skills = this.loadSkills();
  }

  private loadSkills(): Skill[] {
    if (!fs.existsSync(this.skillsDir)) return [];
    return fs
      .readdirSync(this.skillsDir)
      .filter((f) => f.endsWith('.md'))
      .map((file) => {
        const content = fs.readFileSync(path.join(this.skillsDir, file), 'utf-8');
        const { data, content: template } = matter(content);
        return {
          name: data.name ?? path.basename(file, '.md'),
          trigger: data.trigger ?? 'push',
          branches: data.branches ?? '*',
          template: template.trim(),
        };
      });
  }

  getAll(): Skill[] {
    return this.skills;
  }
}
