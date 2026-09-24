# 🛰️ Discord InterOps Gateway & Admin Console

> An enterprise-grade, production-ready Discord Interactions API gateway, command processing engine, and operational dashboard built with **Node.js, Express, TypeScript, React 19, Vite, and PostgreSQL**.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.0-61dafb.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F.svg)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon%2FSupabase-336791.svg)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Vitest-18%20passed-brightgreen.svg)](https://vitest.dev/)
[![Ed25519](https://img.shields.io/badge/Security-Ed25519%20Verified-success.svg)](https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization)

---

## 📋 Executive Overview

Discord InterOps connects Discord slash commands directly to internal operations, engineering incidents, and monitoring pipelines through Discord's modern **Interactions Webhook API** (HTTP endpoints instead of persistent Gateway WebSockets).

Every incoming request is verified cryptographically using **Ed25519**, deduplicated against an immutable transaction log to guarantee **idempotency**, acknowledged within Discord's strict **3-second response deadline**, and mirrored asynchronously to secondary channels (Discord Webhook or Slack Incoming Webhook) with bounded exponential retries and dead-letter queue recovery.

---

## 🏛️ System Architecture

```
                                    +-----------------------------------------+
                                    |         Discord Gateway (Cloud)         |
                                    +-----------------------------------------+
                                                         |
                                                         | HTTPS POST /api/discord/interactions
                                                         | Headers: X-Signature-Ed25519,
                                                         |          X-Signature-Timestamp
                                                         v
+---------------------------------------------------------------------------------------------------+
| Discord InterOps Gateway (Express + TypeScript)                                                   |
|                                                                                                   |
|  1. Raw Body Capture ──> 2. Ed25519 Signature ──> 3. PING (Type 1) ──> Return PONG                |
|                             Verification             Handler                                      |
|                                  |                                                                |
|                                  v                                                                |
|                         4. Idempotency Check ────(Duplicate Detected)──> Return Cached Response   |
|                             (interaction_id)                                                      |
|                                  |                                                                |
|                                  v                                                                |
|                         5. Command Execution                                                      |
|                             ├── /status ──> Build Diagnostics & ACK (<100ms)                     |
|                             └── /report ──> Validate Length, Persist, ACK & Schedule Mirror       |
|                                  |                                                                |
|                                  v                                                                |
|                         6. PostgreSQL Persistence (Drizzle ORM)                                   |
|                             ├── interaction_logs (Audit trail)                                    |
|                             └── mirror_attempts (Delivery state)                                  |
+---------------------------------------------------------------------------------------------------+
                                   |
                   +---------------+---------------+
                   | (Async Non-Blocking Pipeline) |
                   v                               v
    +-----------------------------+ +-----------------------------+
    |   Discord Webhook Mirror    | |    Slack Incoming Webhook   |
    | (Secondary Incidents Room)  | |  (#alerts-channel in Slack) |
    +-----------------------------+ +-----------------------------+
```

---

## ✨ Key Features

### 1. Discord Interactions Protocol Compliance
- **Raw Request Body Preservation**: Captured before any JSON parsing to ensure bit-for-bit accuracy required by cryptographic signatures.
- **Ed25519 Cryptographic Verification**: Verifies `X-Signature-Ed25519` and `X-Signature-Timestamp` using `tweetnacl`. Invalid or missing signatures are immediately rejected with `401 Unauthorized`.
- **Discord PING/PONG**: Correctly handles Interaction Type `1` with Immediate Response `{ type: 1 }`.
- **Discord 3-Second Window SLA**: Commands execute and respond instantaneously within ~40ms, well below the Discord 3000ms threshold.
- **Idempotency & Deduplication**: Employs `interaction_id` as an atomic unique constraint in PostgreSQL. Duplicate interactions return the cached response without re-triggering downstream notifications.

### 2. Supported Slash Commands
- `/status`: Returns gateway health, uptime, database connectivity, and node telemetry.
- `/report <text>`: Validates input parameters (configurable min/max length), records user context, acknowledges the submission, and schedules asynchronous mirroring.

### 3. Asynchronous Mirroring & Dead-Letter Queue
- Supports **Discord Webhook** and **Slack Incoming Webhook** protocols.
- **Non-blocking Dispatch**: Dispatches after the primary Discord interaction is acknowledged, insulating Discord users from external webhook latency.
- **Exponential Backoff**: Configurable retries (default: 3 attempts with 1s, 2s, 4s jitter).
- **Dead-Letter Queue**: Records all delivery failures with HTTP status codes and error traces; administrators can review failures and trigger **1-click manual re-delivery** from the UI.

### 4. Enterprise Admin Web Application
- **Session Authentication**: Secured with bcrypt password hashing and JWT / HTTP-only bearer tokens.
- **Real-Time Telemetry**: Success rates, throughput, idempotency saves, and mirror delivery status.
- **Interactive Command Simulator**: Allows administrators to test `/status` and `/report` directly from the browser with simulated Ed25519 signatures without requiring a live Discord bot token.
- **Live Audit Logs**: Filter, search, inspect raw JSON payloads, and export data.
- **Behavior Customization**: Edit response messages and mirror webhook formatting templates in real-time with live Discord and Slack preview cards.
- **Credential Masking**: Bot tokens and webhook secrets are masked (`••••`) and never leaked in API responses.

---

## 🚀 Quickstart Guide

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- (Optional) Free PostgreSQL database from [Neon.tech](https://neon.tech) or [Supabase](https://supabase.com). If left blank, the app runs an embedded high-performance PostgreSQL (PGlite) instance automatically!

### 1. Clone and Install
```bash
git clone <repository-url>
cd discord-interops-admin
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your secrets in `.env`:
- `SESSION_SECRET`: Strong secret key (min 32 characters) for signing session JWTs and cookies.
- `ADMIN_DEFAULT_USER`: Username for initial admin account initialization.
- `ADMIN_DEFAULT_PASSWORD`: Strong password for initial admin account initialization.
- `DATABASE_URL`: Connection string for PostgreSQL (Neon / Supabase). In development, leave blank to use embedded PGlite.
- `CLIENT_ORIGIN`: Allowed browser origin for CORS in production.

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## 🤖 Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications) and create a **New Application**.
2. Under **General Information**:
   - Copy **Application ID** and paste into Admin Settings.
   - Copy **Public Key** and paste into Admin Settings.
3. Under **Interactions Endpoint URL**:
   - Paste your publicly accessible HTTPS endpoint:  
     `https://<your-domain>/api/discord/interactions`
   - Discord will immediately send a PING request; our gateway will respond with PONG to complete verification.
4. Under **Bot**:
   - Click **Reset Token** and copy the Bot Token into Admin Settings.
5. In the Admin Dashboard:
   - Click **"Register Slash Commands"** to register `/status` and `/report` via the Discord REST API v10.

---

## 🧪 Automated Testing Suite

The codebase includes an extensive end-to-end integration and unit test suite verified with Vitest.

```bash
npm test
```

### Test Coverage Highlights:
- ✅ Ed25519 signature verification with valid and invalid keypairs
- ✅ Rejection of unsigned / forged requests with `401 Unauthorized`
- ✅ Discord PING (Type 1) -> PONG (Type 1)
- ✅ `/status` command execution and PostgreSQL audit log persistence
- ✅ `/report <text>` validation (rejection of strings outside length limits)
- ✅ Idempotency guarantee (duplicate `interaction_id` handled safely)
- ✅ Downstream mirror failure handling and dead-letter queue recording
- ✅ Secret masking (verifies bot tokens and webhook secrets are never leaked in API responses)
- ✅ Authentication & authorization boundaries on all administrative endpoints

---

## ☁️ Free-Tier Deployment Options (No Credit Card Required)

### Option A: Render.com (Recommended)
1. Push this repository to GitHub.
2. Create a free PostgreSQL database at [Neon.tech](https://neon.tech).
3. In Render, select **New Web Service** and connect your repository.
4. Set Environment: **Node**, Build Command: `npm install && npm run build`, Start Command: `npm start`.
5. Add `DATABASE_URL` with your Neon connection string.

### Option B: Railway
1. Click **New Project** -> **Deploy from GitHub repo**.
2. Railway will automatically detect the Dockerfile and deploy the multi-stage build.

### Option C: Fly.io
```bash
fly launch
fly deploy
```

---

## 🔒 Security Architecture

| Vector | Protection Mechanism |
| :--- | :--- |
| **Request Forgery** | Mandatory Ed25519 cryptographic signature verification on raw request bytes. |
| **Replay Attacks** | Timestamp verification + database idempotency keying on `interaction_id`. |
| **Credential Exposure** | Sensitive bot tokens and webhook URLs are masked on read; raw secrets never return to client. |
| **Timing / SLA Vulnerability** | Fast ACK paths (<50ms); heavy operations (mirroring, webhooks) dispatched asynchronously. |
| **Input Injection** | Input length enforcement and parameterized SQL queries via Drizzle ORM. |
| **Administrative Access** | Bcrypt password hashing (cost factor 10) + JWT Bearer token authentication. |

---

## 📄 License
Apache-2.0 License.
