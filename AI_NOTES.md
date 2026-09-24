# 🧠 AI Engineering Notes & Architectural Decision Records (ADR)

## 1. System Design & Architectural Decisions

### 1.1 Discord Interactions API vs. Gateway WebSockets
- **Context**: Discord offers two primary bot interaction paradigms: the persistent Gateway WebSocket (`gateway.discord.gg`) and the HTTP-based Interactions Webhook API (`POST /api/discord/interactions`).
- **Decision**: We chose the HTTP Interactions API.
- **Rationale**:
  - WebSockets require persistent stateful processes, heartbeat timers, and complex shard management that frequently fail or sleep on free-tier serverless or container hosts (Render, Cloud Run, Railway).
  - The HTTP Interactions API enables scale-to-zero serverless architecture, lower baseline memory consumption, and clean RESTful idempotency semantics.

### 1.2 Raw Body Capture & Cryptographic Signature Verification
- **Challenge**: Discord requires verifying an Ed25519 signature composed of `timestamp + raw_request_body`. If an Express server parses JSON beforehand, whitespace changes, key ordering, or Unicode escapes will alter the byte sequence, causing Ed25519 verification to fail.
- **Solution**:
  - Implemented custom `verify` middleware within `express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })`.
  - Added cryptographic verification utility (`src/server/crypto/discord-verify.ts`) using `tweetnacl`.
  - Enforced strict early validation: if the signature, timestamp, or public key is missing or invalid, the request is immediately rejected with `401 Unauthorized` without invoking route handlers.

### 1.3 Idempotency & Concurrency Strategy
- **Requirement**: Discord guarantees "at least once" delivery. Network blips or retry loops could result in duplicate commands.
- **Solution**:
  - Every Discord interaction includes a unique snowflake `id`.
  - In PostgreSQL, `interaction_logs.interaction_id` has a `UNIQUE` index.
  - On incoming interaction, the system checks for existing records. If found, it returns the cached response with `duplicate` status and logs the occurrence without executing downstream logic or dispatching secondary webhooks.

### 1.4 Respecting the 3-Second Response Window
- **Constraint**: Discord invalidates an interaction token if the gateway does not return an HTTP response within approximately 3,000 milliseconds.
- **Implementation**:
  - `/status` compiles telemetry and responds synchronously within ~35ms.
  - `/report` validates input, writes the interaction log, schedules downstream mirror delivery asynchronously in a background queue (`setImmediate`), and returns the Discord ACK payload immediately.
  - Even if downstream mirror destinations experience timeouts or DNS delays, the user's Discord experience remains snappy and within specification.

### 1.5 Dual Database Mode (Neon / Supabase + Embedded PGlite)
- **Challenge**: Requiring users to configure external credentials just to run unit tests or evaluate the app can introduce friction.
- **Solution**:
  - Built an adapter layer in `src/server/db/index.ts`.
  - When `DATABASE_URL` is set, it connects directly to PostgreSQL (Neon, Supabase, Cloud SQL, AWS RDS).
  - In development/test mode, when `DATABASE_URL` is omitted, it boots an in-memory embedded PostgreSQL (`@electric-sql/pglite`) instance with full SQL compliance.
  - In production (`NODE_ENV === 'production'`), `DATABASE_URL` is strictly required. Startup fails immediately with an explicit configuration error if missing, preventing silent data volatility.

---

## 2. Security Controls & Threat Modeling

1. **Mandatory Production Secrets**:
   - `SESSION_SECRET` is strictly required in production with no hardcoded fallback. Server startup fails fast if it is missing or empty.
   - Initial admin provisioning requires explicit `ADMIN_DEFAULT_USER` and `ADMIN_DEFAULT_PASSWORD`. The application never automatically creates accounts with default or predictable credentials.
2. **Strict Raw Body Stream Verification**:
   - Discord Ed25519 signature verification relies exclusively on the raw HTTP body stream captured directly before JSON parsing.
   - Fallback JSON re-serialization was eliminated; any request lacking a raw body stream is rejected immediately with `400 Bad Request`.
   - Tampered payloads, forged timestamps, or missing headers are rejected with `401 Unauthorized`.
3. **Production CORS Discipline**:
   - Production CORS eliminates wildcard/`origin: true` behavior and strictly validates incoming browser origins against `CLIENT_ORIGIN`.
   - The `/api/discord/interactions` endpoint remains publicly reachable for Discord's webhook infrastructure and relies on Ed25519 cryptographic signatures rather than browser CORS.
4. **Complete Secret Masking**:
   - Sensitive bot tokens and webhook destination URLs are strictly masked (`••••••••••••••••`) in all API responses.
   - Raw credentials are never transmitted to client browsers; the frontend only receives boolean metadata (`hasBotToken`, `hasMirrorUrl`).
5. **Comprehensive Log Sanitization**:
   - Centralized structured logger automatically redacts passwords, bcrypt hashes, JWTs, Discord bot tokens, Slack webhooks, and database credentials before outputting to stdout/stderr.
6. **Timing-Safe Operations**: Signatures are evaluated using constant-time cryptographic comparisons where possible.
7. **Input Length Validation**: `/report` enforces configurable minimum and maximum length bounds (e.g. 3 to 2000 chars) to prevent payload abuse.

---

## 3. Reliability & Downstream Mirroring

- **Mirror Queue**: Tracks attempts in `mirror_attempts` table.
- **Dead-Letter Recovery**: If a mirror destination (e.g., Discord Webhook or Slack Incoming Webhook) is unreachable, the failure is saved with the HTTP code and error stack. Operators can trigger manual retries with 1 click in the Admin Console once destination services recover.
- **Interactive Simulator**: Added an in-browser Discord interaction simulator so administrators and QA engineers can test slash command dispatch and verify signature handling end-to-end.
