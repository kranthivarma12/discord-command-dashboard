\# AI Context — Discord Command Dashboard



\## 1. Project Overview



This project is a full-stack web application with a Discord bot that processes slash commands, records interactions, applies configured rules, responds to users, and mirrors notifications to another Discord channel.



\## 2. Technology Stack



\* Frontend: React, TypeScript, Vite

\* Backend: Node.js, Express.js, TypeScript

\* Database: PostgreSQL with Drizzle ORM

\* Local development database: PGlite

\* Authentication: JWT-based admin sessions

\* Discord: Slash commands and signed interaction requests

\* Testing: Vitest

\* Deployment: Render

\* Database hosting: Neon PostgreSQL



\## 3. Main Features



1\. Admin authentication and protected dashboard.

2\. Discord server configuration.

3\. Slash commands: `/status` and `/report`.

4\. Discord Ed25519 signature verification.

5\. Discord PING/PONG interaction handling.

6\. Interaction logging and duplicate-request protection.

7\. Configurable command behavior.

8\. Notification mirroring through a Discord webhook.

9\. Audit logs and mirror delivery tracking.

10\. Automated tests for authentication, signatures, validation, and command processing.



\## 4. Project Architecture



\* `server.ts` — Express server and API routing.

\* `src/` — Application source code.

\* `package.json` — Dependencies and scripts.

\* `.env.example` — Environment variable template.

\* `README.md` — Setup, deployment, and usage documentation.

\* `AI\_NOTES.md` — AI assistance and development notes.

\* `AGENTS.md` — Project-specific instructions.



\## 5. Security



\* Verify Discord interaction signatures before processing requests.

\* Reject invalid or unsigned requests.

\* Protect admin APIs with authentication.

\* Store credentials in environment variables.

\* Avoid exposing secrets in logs or responses.

\* Use Discord interaction IDs to prevent duplicate processing.

\* Track mirror delivery attempts and failures.



\## 6. Development Commands



```bash

npm install

npm run dev

npm run lint

npm test

npm run build

npm start

```



\## 7. Environment Configuration



Use `.env.example` as a template for local environment configuration.



Never commit `.env` files or expose production credentials.



\## 8. Production URLs



Application:

https://discord-command-dashboard.onrender.com



Discord interactions endpoint:

https://discord-command-dashboard.onrender.com/api/discord/interactions



\## 9. Known Limitations



\* Render's free service may experience cold starts.

\* Strict response-time compliance under three seconds during cold starts has not been verified.

\* Production behavior should be tested after deployment.



\## 10. Development Guidelines



\* Preserve existing API contracts and database schema.

\* Do not commit local database files or secrets.

\* Run lint, tests, and build after relevant code changes.

\* Update project documentation when behavior changes.



