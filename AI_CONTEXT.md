# 🤖 AI Agent & Developer Context: Discord InterOps Gateway

## Purpose & Scope
This repository is a production-ready Discord Interactions API gateway and administrative web console. It processes Discord slash commands (`/status`, `/report <text>`), verifies cryptographic Ed25519 signatures, deduplicates interactions for idempotency, mirrors notifications to secondary channels (Discord Webhook or Slack Incoming Webhook), and exposes an authenticated operational dashboard.

## Core File Manifest & Responsibilities

| Path | Description |
| :--- | :--- |
| `server.ts` | Express application bootstrap, Vite dev middleware mounting, static asset serving, and port binding. |
| `src/server/routes/discord.ts` | Discord Interactions endpoint (`POST /api/discord/interactions`) and simulator endpoint (`POST /api/discord/simulate`). |
| `src/server/crypto/discord-verify.ts` | Ed25519 signature verification utility using TweetNaCl. |
| `src/server/db/schema.ts` | Drizzle ORM schema definitions for users, configurations, interaction logs, mirror attempts, and audit logs. |
| `src/server/db/index.ts` | Database connection manager with automatic fallback between PostgreSQL (`DATABASE_URL`) and embedded PGlite. |
| `src/server/services/mirror-service.ts` | Downstream notification dispatcher supporting Discord and Slack webhooks with exponential backoff. |
| `src/server/services/discord-api.ts` | Discord REST API v10 client for slash command registration. |
| `src/server/middleware/auth.ts` | Authentication & role-based access control middleware with bcrypt and JWT. |
| `src/App.tsx` | Main React admin console application routing, state management, and telemetry polling. |
| `src/views/*` | Admin console views: Overview, CommandLogs, Failures (dead-letter), DiscordConfig, CommandBehavior, Simulator, Audit. |
| `tests/discord.test.ts` | Vitest integration and unit test suite covering signature verification, idempotency, command validation, dead-letter recovery, and auth. |

## Development Rules & Invariants
1. **Never parse JSON before capturing the raw body**: Ed25519 signature verification requires the exact bytes received from Discord. Any change in byte ordering breaks verification.
2. **Never bypass signature verification**: In production and testing alike, always use cryptographically signed payloads.
3. **Respect Discord's 3-second response deadline**: All slash commands must respond within 3000ms. Heavy downstream tasks (e.g. secondary webhooks) must be scheduled asynchronously.
4. **Idempotency is mandatory**: Always check `interaction_logs` by `interaction_id` before processing commands.
5. **Never leak secrets**: Raw Discord bot tokens and webhook secrets must be masked before returning to frontend clients.
