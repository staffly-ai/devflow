# devflow — Design Spec
**Date:** 2026-06-10  
**Repo:** github.com/staffly-ai/devflow  
**Package:** @staffly/devflow

## Overview

devflow is an open-source server that connects Bitbucket webhook events to Claude (Anthropic API) via MCP Server, enabling teams to automate SDLC workflows with AI. The primary use case is automatic code review triggered on every push to a feature branch — ensuring consistent development process (code quality, test coverage) before a PR is opened.

devflow complements interactive Claude Code usage (staffly-dev-ai plugin) — it handles the server-side, autonomous layer of the SCRUM flow.

## Architecture

```
Bitbucket push event
        │
        ▼
┌─────────────────────┐
│   WebhookModule     │  NestJS controller, verifies Bitbucket HMAC signature
│   POST /webhook     │  extracts: branch, diff, PR info, commit
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
│   Claude invocation │     │         get_file_diff    │
└─────────────────────┘     │         get_pr_info      │
                            │         get_jira_issue   │
                            └──────────┬───────────────┘
                                       │
                                       ▼
                            Bitbucket REST API / Jira API
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
│   │       ├── bitbucket.tool.ts    ← post_pr_comment, get_diff, get_pr_info
│   │       └── jira.tool.ts         ← get_jira_issue (optional)
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
- `trigger` — Bitbucket event type: `push` | `pullrequest:created` | `pullrequest:updated`
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
BITBUCKET_WEBHOOK_SECRET=...
BITBUCKET_APP_PASSWORD=...
BITBUCKET_WORKSPACE=staffly

# Optional
SKILLS_DIR=./skills              # path to skills directory
PORT=3000
LOG_LEVEL=info
JIRA_BASE_URL=                   # enables Jira tool if set
JIRA_EMAIL=
JIRA_API_TOKEN=
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
2. Bitbucket sends POST to `https://devflow.staffly.pl/webhook`
3. `WebhookGuard` verifies HMAC-SHA256 signature
4. `SkillRouter` matches event `push` + branch `feature/*` → loads `code-review.md`
5. `AgentService` builds prompt: skill template + diff + PR info
6. Claude calls MCP tools to fetch additional context if needed
7. Claude calls `post_pr_comment` tool with structured review
8. Developer sees inline comments in Bitbucket PR

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
