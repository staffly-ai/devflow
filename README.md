# devflow

Open-source NestJS server that connects GitHub webhooks to Claude (Anthropic API)
to automate SDLC workflows — starting with automatic code review on every feature branch push.

## Quick Start

```bash
cp .env.example .env
# Fill in ANTHROPIC_API_KEY, GITHUB_WEBHOOK_SECRET, GITHUB_TOKEN

docker-compose up
```

Then configure your GitHub repository:
**Settings → Webhooks → Add webhook**
- Payload URL: `https://your-server/webhook`
- Content type: `application/json`
- Secret: value of `GITHUB_WEBHOOK_SECRET`
- Events: **Pushes** and **Pull requests**

## How It Works

1. GitHub sends a push/PR event to `POST /webhook`
2. HMAC-SHA256 signature is verified (`X-Hub-Signature-256`)
3. The event is matched against skills in `SKILLS_DIR` (trigger + branch glob)
4. If a skill matches, Claude is invoked with the diff as context
5. Claude calls `post_pr_comment` to post the review to the PR

## Custom Skills

Mount your own skills directory to override built-ins:

```bash
docker run -v ./my-skills:/app/skills \
  -e ANTHROPIC_API_KEY=... \
  -e GITHUB_WEBHOOK_SECRET=... \
  -e GITHUB_TOKEN=... \
  staffly/devflow
```

### Skill Format

```markdown
---
name: my-skill
trigger: push                  # push | pull_request:opened | pull_request:synchronize
branches: "feature/*"          # glob pattern (optional, defaults to *)
---

Your prompt here. Available variables:
- {{diff}}           — git diff
- {{branch}}         — branch name
- {{commit_message}} — commit message
- {{pr_info}}        — PR title + description (PR events only)
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key |
| `GITHUB_WEBHOOK_SECRET` | Yes | GitHub webhook secret |
| `GITHUB_TOKEN` | Yes | GitHub personal access token (repo scope) |
| `SKILLS_DIR` | No | Path to skills directory (default: `./skills`) |
| `PORT` | No | HTTP port (default: `3000`) |

## Development

```bash
npm install
npm run start:dev
```

Run tests:

```bash
npm test
```
