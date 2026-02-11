# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Moltworker is a Cloudflare Worker that runs [OpenClaw](https://github.com/openclaw/openclaw) in a Cloudflare Sandbox container. It proxies HTTP/WebSocket requests to the OpenClaw gateway, manages container lifecycle, handles authentication via Cloudflare Access, and provides an admin UI for device pairing.

## Commands

```bash
npm test                        # Run unit tests (vitest, single run)
npm run test:watch              # Tests in watch mode
npm run test:coverage           # Tests with V8 coverage report
npm run typecheck               # TypeScript type checking (tsc --noEmit)
npm run lint                    # Lint with oxlint
npm run lint:fix                # Lint and auto-fix
npm run format                  # Format with oxfmt
npm run format:check            # Check formatting (CI uses this)
npm run build                   # Vite build (worker + client)
npm run deploy                  # Build + deploy to Cloudflare
npm run dev                     # Vite dev server
npm run start                   # wrangler dev (local worker with sandbox)
```

CI runs: lint → format:check → typecheck → test (in that order).

## Architecture

```
Browser → Cloudflare Worker (Hono) → Cloudflare Sandbox Container → OpenClaw Gateway (:18789)
```

**Request flow in `src/index.ts`:**
1. Global middleware: request logging, sandbox initialization
2. Public routes (no auth): `/sandbox-health`, `/logo.*`, `/api/status`, `/_admin/assets/*`
3. CDP routes: `/cdp/*` (shared secret auth, not CF Access)
4. Env validation + Cloudflare Access JWT auth middleware
5. Protected routes: `/api/*` (admin API), `/_admin/*` (React admin UI), `/debug/*` (if enabled)
6. Catch-all: proxy HTTP/WebSocket to OpenClaw gateway inside the sandbox container

**Container startup** (`start-openclaw.sh`): R2 restore → `openclaw onboard` → config patch → background sync loop → gateway launch.

## Project Structure

- `src/index.ts` — Main Hono app, route mounting, WebSocket proxy, env validation
- `src/types.ts` — `MoltbotEnv` interface (all worker env bindings), `AppEnv` Hono type
- `src/config.ts` — Constants: `MOLTBOT_PORT` (18789), `STARTUP_TIMEOUT_MS`
- `src/auth/` — Cloudflare Access JWT verification (`jwt.ts`), JWKS caching (`jwks.ts`), Hono middleware (`middleware.ts`)
- `src/gateway/` — Container process lifecycle (`process.ts`), env var building (`env.ts`), R2 rclone setup (`r2.ts`), R2 backup sync (`sync.ts`)
- `src/routes/` — Route handlers: `public.ts`, `api.ts` (admin endpoints), `admin-ui.ts`, `debug.ts`, `cdp.ts`
- `src/client/` — React admin UI (Vite-built, served at `/_admin/`), device management + R2 status
- `src/assets/` — Static HTML pages (`loading.html`, `config-error.html`)
- `Dockerfile` — Container image: `cloudflare/sandbox` base + Node 22 + rclone + OpenClaw
- `start-openclaw.sh` — Container entrypoint (~260 lines)
- `wrangler.jsonc` — Worker config: Sandbox DO, R2 bucket, Browser binding, container settings

## Testing

Tests use **Vitest** and are colocated with source files (`*.test.ts` next to `*.ts`). Client code (`src/client/`) is excluded from unit tests.

**Test utilities** (`src/test-utils.ts`):
- `createMockEnv()` / `createMockEnvWithR2()` — Mock `MoltbotEnv` with sensible defaults
- `createMockSandbox()` — Mock sandbox with `startProcess`, `listProcesses`, `exec`, etc.
- `createMockProcess()` / `createMockExecResult()` — Mock process/exec results
- `suppressConsole()` — Silence console output in tests

**Running a single test file:**
```bash
npx vitest run src/gateway/env.test.ts
```

## Key Patterns

- **Env vars passed to container** are built in `src/gateway/env.ts` (`buildEnvVars()`). Worker-side names (e.g., `MOLTBOT_GATEWAY_TOKEN`) are mapped to container names (e.g., `OPENCLAW_GATEWAY_TOKEN`).
- **CLI commands** in the sandbox must include `--url ws://localhost:18789`. They take 10-15s due to WebSocket overhead. Use `waitForProcess()` from `src/gateway/utils.ts`.
- **Success detection**: CLI outputs "Approved" (capital A) — use case-insensitive checks.
- **R2 persistence** uses rclone (not s3fs). Never delete `/data/moltbot/*` — it IS the R2 bucket data. Check `AGENTS.md` for R2 gotchas.
- **Docker cache busting**: Bump the version comment in `Dockerfile` when changing `start-openclaw.sh`.
- **AI provider priority**: Cloudflare AI Gateway (native) > Direct Anthropic > Direct OpenAI > Legacy AI Gateway. See `AGENTS.md` for details.
- **OpenClaw naming**: The project was renamed from Moltbot/Clawdbot. Config files use `.openclaw/openclaw.json`. Legacy `.clawdbot` paths still supported for backward compat.

## Code Style

- TypeScript strict mode. Prefer explicit types for function signatures.
- Web framework: Hono. Use `c.json()`, `c.html()` for responses.
- Linter: oxlint. Formatter: oxfmt.
- Keep route handlers thin — extract logic to `src/gateway/` or other modules.
- Development docs go in `AGENTS.md`, user-facing docs in `README.md`.

## Local Development

```bash
npm install
cp .dev.vars.example .dev.vars  # Add ANTHROPIC_API_KEY, DEV_MODE=true, DEBUG_ROUTES=true
npm run start
```

`DEV_MODE=true` skips CF Access auth AND device pairing. WebSocket proxying may not work locally — deploy to Cloudflare for full functionality.
