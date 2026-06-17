import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SkillLoaderService } from './skill-loader.service';

describe('SkillLoaderService', () => {
  let service: SkillLoaderService;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
    fs.writeFileSync(
      path.join(tmpDir, 'code-review.md'),
      `---\nname: code-review\ntrigger: push\nbranches: "feature/*"\n---\nReview this diff:\n{{diff}}\n`,
    );
    fs.writeFileSync(
      path.join(tmpDir, 'no-branches.md'),
      `---\nname: no-branches\ntrigger: push\n---\nTemplate without branches.\n`,
    );
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: 'SKILLS_DIR', useValue: tmpDir },
        SkillLoaderService,
      ],
    }).compile();
    service = module.get(SkillLoaderService);
    await service.onModuleInit();
  });

  it('loads skills from directory', () => {
    expect(service.getAll()).toHaveLength(2);
  });

  it('parses frontmatter correctly', () => {
    const skill = service.getAll().find((s) => s.name === 'code-review');
    expect(skill).toBeDefined();
    expect(skill!.trigger).toBe('push');
    expect(skill!.branches).toBe('feature/*');
    expect(skill!.template).toContain('{{diff}}');
  });

  it('defaults branches to * when not specified', () => {
    const skill = service.getAll().find((s) => s.name === 'no-branches');
    expect(skill!.branches).toBe('*');
  });
});
