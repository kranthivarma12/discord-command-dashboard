# AGENTS.md

## Project

This repository contains a production-oriented Discord command dashboard.

The application consists of:

- React + Vite + TypeScript frontend
- Node.js + Express + TypeScript backend
- PostgreSQL database
- Prisma ORM
- Discord Interactions API
- Admin authentication
- Admin dashboard
- Discord command logging
- Mirror-channel notifications

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

Never assume that code works without testing.

## Development Principles

1. Implement incrementally.
2. Keep changes small and understandable.
3. Explain important implementation decisions.
4. Do not generate the entire application in one step.
5. Do not modify unrelated files.
6. Do not hide errors.
7. Do not use fake credentials or fake API responses.
8. Do not claim a feature works unless it has been tested.
9. Prefer simple maintainable architecture over unnecessary complexity.

## Discord Security

Every Discord interaction must:

- verify X-Signature-Ed25519
- verify X-Signature-Timestamp
- use the correct raw request body
- reject invalid requests
- handle Discord PING correctly
- deduplicate using the Discord interaction ID

Never bypass Discord signature verification.

## Secrets

Never commit:

- Discord bot tokens
- Discord application secrets
- Discord public keys if treated as configuration secrets
- webhook URLs
- database passwords
- session secrets
- API keys

Secrets must remain server-side and be supplied through environment variables.

Use `.env.example` with placeholder values only.

## Reliability

The application must:

- avoid duplicate interaction processing
- record processing failures
- handle downstream failures
- use timeouts for external requests
- use deferred Discord responses when processing may exceed Discord's response window
- avoid silently losing commands

## Database

Use PostgreSQL with Prisma.

Important interaction identifiers must have appropriate unique constraints.

Database changes must be made through migrations.

## Testing

Before considering a feature complete:

1. Run the relevant automated tests.
2. Run type checking.
3. Run the application locally.
4. Manually test the feature.
5. Verify expected behavior.
6. Test important failure cases.

## Git

Create focused commits after successfully completing meaningful development stages.

Commit messages should clearly describe the change.

Examples:

- `chore: initialize project`
- `feat: add database schema`
- `feat: add discord interaction verification`
- `feat: add status command`
- `feat: add report command`
- `feat: add interaction idempotency`

Do not commit secrets.

## Implementation Workflow

For every feature:

1. Explain the goal.
2. Identify files that will change.
3. Implement the smallest useful change.
4. Explain important code.
5. Tell the developer exactly how to run it.
6. Tell the developer exactly how to manually test it.
7. Wait for the actual test result before proceeding.

## Current Status

The repository has just been created and cloned.

No application code has been implemented yet.

The first development task is project architecture and initialization.