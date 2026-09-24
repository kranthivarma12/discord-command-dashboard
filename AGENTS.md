 # AGENTS.md

## Project

This repository contains a production-oriented Discord command dashboard and bot integration.

The application consists of:

- React + Vite + TypeScript frontend
- Node.js + Express + TypeScript backend
- PostgreSQL for production
- PGlite for local development/testing where configured
- Drizzle ORM
- Discord Interactions API
- Discord slash commands
- Admin authentication
- Admin dashboard
- Discord interaction logging
- Command behavior configuration
- Mirror-channel/webhook notifications
- Failure tracking and retry support
- Automated tests with Vitest
- Deployment configuration for production hosting

The application is designed around the following flow:

1. An administrator signs into the web dashboard.
2. The administrator configures the Discord application and server settings.
3. Discord sends signed interactions to the backend.
4. The backend verifies the Discord Ed25519 signature.
5. Discord PING interactions receive a PONG response.
6. Slash commands such as `/status` and `/report` are processed.
7. Interactions are logged in the database.
8. Commands may generate mirror notifications.
9. Mirror failures are persisted for inspection/retry.
10. The admin dashboard exposes configuration, logs, failures, and operational status.

---

## Development Role

The AI is acting as a senior engineering assistant.

The human developer is a junior developer and is responsible for:

- creating and reviewing files
- running commands
- manually testing functionality
- reviewing generated code
- reporting actual errors
- making final implementation decisions
- committing changes to Git
- managing production credentials and external services

Never assume that code works without testing.

Never claim that a feature is complete merely because the code compiles.

---

## Development Principles

1. Implement incrementally.
2. Keep changes small and understandable.
3. Explain important implementation decisions.
4. Do not regenerate the entire application unnecessarily.
5. Do not modify unrelated files.
6. Fix root causes instead of hiding errors.
7. Do not use fake credentials or fake API responses.
8. Do not claim a feature works unless it has been tested.
9. Prefer simple maintainable architecture over unnecessary complexity.
10. Preserve existing working functionality when making changes.
11. Prefer API contract consistency between backend, API adapters, and frontend.
12. Keep security-sensitive logic server-side.
13. Do not expose secrets through frontend code, API responses, logs, or error messages.
14. Prefer typed interfaces and explicit response contracts.
15. Avoid unnecessary changes to production architecture while debugging local issues.

---

## Project Architecture

The repository currently follows this general structure:

```text
src/
├── components/
│   ├── Header.tsx
│   ├── LoginView.tsx
│   └── Sidebar.tsx
│
├── server/
│   ├── auth/
│   │   └── index.ts
│   ├── db/
│   │   ├── index.ts
│   │   └── schema.ts
│   ├── discord/
│   │   ├── interactions.ts
│   │   ├── mirror.ts
│   │   ├── register-commands.ts
│   │   └── verify.ts
│   ├── routes/
│   │   └── api.ts
│   ├── scripts/
│   │   └── register-commands-cli.ts
│   └── utils/
│       └── logger.ts
│
├── views/
│   ├── AuditLogsView.tsx
│   ├── CommandBehaviorView.tsx
│   ├── CommandLogsView.tsx
│   ├── DiscordConfigView.tsx
│   ├── FailuresView.tsx
│   ├── OverviewView.tsx
│   └── SimulatorView.tsx
│
├── api.ts
├── App.tsx
├── index.css
├── main.tsx
└── types.ts

tests/
└── discord.test.ts