import { Test } from '@nestjs/testing';
import { SkillRouterService } from './skill-router.service';
import { SkillLoaderService, Skill } from './skill-loader.service';
import { NormalizedEvent } from '../webhook/webhook.types';

const mockSkills: Skill[] = [
  { name: 'code-review', trigger: 'push', branches: 'feature/*', template: 'Review: {{diff}}' },
  { name: 'pr-review', trigger: 'pull_request:opened', branches: '*', template: 'PR: {{pr_info}}' },
];

describe('SkillRouterService', () => {
  let service: SkillRouterService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SkillRouterService,
        { provide: SkillLoaderService, useValue: { getAll: () => mockSkills } },
      ],
    }).compile();
    service = module.get(SkillRouterService);
  });

  it('matches push event on feature/* branch', () => {
    const event: NormalizedEvent = {
      type: 'push',
      owner: 'staffly-ai',
      repo: 'devflow',
      branch: 'feature/STF-1234-add-auth',
      commitSha: 'abc123',
      commitMessage: 'WIP',
    };
    const skill = service.route(event);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('code-review');
  });

  it('returns null for push on main branch (no matching skill)', () => {
    const event: NormalizedEvent = {
      type: 'push',
      owner: 'staffly-ai',
      repo: 'devflow',
      branch: 'main',
      commitSha: 'abc123',
      commitMessage: 'merge',
    };
    expect(service.route(event)).toBeNull();
  });

  it('matches pull_request:opened on any branch', () => {
    const event: NormalizedEvent = {
      type: 'pull_request:opened',
      owner: 'staffly-ai',
      repo: 'devflow',
      branch: 'feature/xyz',
      commitSha: 'def456',
      commitMessage: '',
      prNumber: 42,
      prTitle: 'Add feature',
    };
    const skill = service.route(event);
    expect(skill!.name).toBe('pr-review');
  });
});
