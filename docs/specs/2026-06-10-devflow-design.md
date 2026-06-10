# devflow — Design Spec
**Date:** 2026-06-10  
**Repo:** github.com/staffly-ai/devflow  
**Package:** @staffly/devflow

## Overview

devflow is an open-source server that connects GitHub webhook events to Claude (Anthropic API) via tool use, enabling teams to automate SDLC workflows with AI. The primary use case is automatic code review triggered on every push to a feature branch — ensuring consistent development process (code quality, test coverage) before a PR is opened.

devflow complements interactive Claude Code usage (staffly-dev-ai plugin) — it handles the server-side, autonomous layer of the SCRUM flow.

## Architecture

```
GitHub push / PR event
        │
        ▼
┌─────────────────────┐
│   WebhookModule     │  NestJS controller, verifies GitHub HMAC signature
│   POST /webhook     │  (X-Hub-Signature-256) — extracts: branch, diff, PR info
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   SkillsModule      │  reads *.md files from SKILLS_DIR
│   SkillRouter       │  maps event type + branch pattern → skill file
└────────┬────────────┘
         │ skill prompt template + event context
         ▼
┌─────────────────────┐     ┌──────────────────────────┐
│   AgentModule       │────▶│      McpModule           │
│   Anthropic SDK     │◀────│  tools: post_pr_comment  │
│   Claude invocation │     │         get_diff         │
└─────────────────────┘     │         get_pr_info      │
                            └──────────┬───────────────┘
                                       │
                                       ▼
                                 GitHub REST API
```

## Project Structure

```
devflow/
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   ├── webhook/
│   │   ├── webhook.module.ts
│   │   ├── webhook.controller.ts    ← POST /webhook
│   │   └── webhook.guard.ts         ← HMAC signature verification
│   ├── skills/
│   │   ├── skills.module.ts
│   │   ├── skill-loader.service.ts  ← reads *.md from SKILLS_DIR
│   │   └── skill-router.service.ts  ← event → skill mapping
│   ├── mcp/
│   │   ├── mcp.module.ts
│   │   ├── mcp-server.service.ts    ← MCP Server definition
│   │   └── tools/
│   │       └── github-tools.service.ts  ← post_pr_comment, get_diff, get_pr_info
│   └── agent/
│       ├── agent.module.ts
│       └── agent.service.ts         ← Anthropic SDK, Claude invocation
├── skills/                          ← built-in skills (replaceable)
│   └── code-review.md
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

## Skill Format

Skills are Markdown files with YAML frontmatter:

```markdown
---
name: code-review
trigger: push
branches: "feature/*"
---

Review the following code diff. Check for: correctness, security issues,
missing unit tests, missing smoke/e2e test coverage.

Provide structured feedback as inline PR comments.

DIFF:
{{diff}}

PR INFO:
{{pr_info}}
```

**Frontmatter fields:**
- `name` — skill identifier
- `trigger` — GitHub event type: `push` | `pull_request:opened` | `pull_request:synchronize`
- `branches` — glob pattern for branch names (optional, defaults to all branches)

**Template variables available in prompt:**
- `{{diff}}` — git diff of the push
- `{{pr_info}}` — PR title, description, reviewers
- `{{branch}}` — branch name
- `{{commit_message}}` — commit message

## Configuration

All configuration via environment variables:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-...
GITHUB_WEBHOOK_SECRET=...
GITHUB_TOKEN=ghp_...

# Optional
SKILLS_DIR=./skills              # path to skills directory
PORT=3000
```

## Skills Pluggability

Users replace built-in skills by mounting a custom directory:

```bash
# Docker
docker run -v ./my-skills:/app/skills staffly/devflow

# docker-compose
volumes:
  - ./my-skills:/app/skills

# Local dev
SKILLS_DIR=/path/to/custom/skills npm run start
```

devflow loads all `*.md` files from `SKILLS_DIR` at startup. No hot-reload in v1.

## Dockerfile (target)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY skills/ ./skills/
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Data Flow — Code Review on Push

1. Developer pushes to `feature/STF-1234-something`
2. GitHub sends POST to `https://devflow.staffly.pl/webhook`
3. `WebhookGuard` verifies `X-Hub-Signature-256` HMAC-SHA256 signature
4. `SkillRouter` matches event `push` + branch `feature/*` → loads `code-review.md`
5. `AgentService` fetches diff from GitHub API, fills skill template variables
6. Claude runs tool-use loop: calls `post_pr_comment` with structured review
7. Developer sees review comment on the GitHub PR

## Out of Scope (v1)

- Web panel / dashboard UI
- Hot-reload of skills
- Multi-repo configuration
- Metrics / observability
- Authentication for the web panel
- Auto-fix suggestions (Claude commits fixes)

## Future (v2+)

- Web panel (separate decision on frontend framework)
- Scheduled skills (daily standup prep, sprint review summaries)
- Hot-reload skills without restart
- k8s deployment manifests (reuse staffly-dev-ops patterns)
