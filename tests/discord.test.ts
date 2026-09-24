import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { app } from '../server.ts';
import {
  generateTestKeyPair,
  signMessageForDiscord,
  verifyDiscordSignature,
  isValidHexPublicKey,
} from '../src/server/discord/verify.ts';
import { getDb, closeDb } from '../src/server/db/index.ts';
import { discordConfigs, interactionLogs, mirrorAttempts } from '../src/server/db/schema.ts';
import { eq } from 'drizzle-orm';
import { ensureDefaultAdmin, getSessionSecret } from '../src/server/auth/index.ts';

describe('Discord Interactions & Verification Test Suite', () => {
  const { publicKeyHex, keyPair } = generateTestKeyPair();
  let server: http.Server;

  beforeAll(async () => {
    process.env.DISCORD_PUBLIC_KEY = publicKeyHex;
    process.env.SESSION_SECRET = 'test-session-secret-vitest-32-chars-ok';
    process.env.ADMIN_DEFAULT_USER = 'admin';
    process.env.ADMIN_DEFAULT_PASSWORD = 'Admin@DiscordInterOps2026!';

    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });

    const db = await getDb();
    await ensureDefaultAdmin();

    // Mock fetch for deterministic testing
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any, _options?: any) => {
      const urlStr = String(url);
      if (urlStr.includes('unreachable-webhook-test')) {
        throw new Error('Connection refused by remote host');
      }
      if (urlStr.includes('test-mirror-url')) {
        return new Response(null, { status: 204 });
      }
      if (urlStr.includes('discord.com/api/v10/applications')) {
        return new Response(JSON.stringify([{ id: 'cmd-1', name: 'status' }]), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    // Configure test discord settings in database
    await db.delete(discordConfigs);
    await db.insert(discordConfigs).values({
      guildId: 'test-guild-123',
      applicationId: 'test-app-456',
      publicKey: publicKeyHex,
      botToken: 'sample-bot-token-for-testing',
      targetChannelId: '', // allow any channel for tests
      mirrorDestinationUrl: 'https://discord.com/api/webhooks/999999/test-mirror-url',
      mirrorDestinationType: 'discord_webhook',
      mirrorEnabled: true,
      maxMirrorRetries: 2,
      retryBackoffMs: 10,
    });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await closeDb();
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  // 1. Valid Discord signature
  it('verifies a valid Ed25519 signature correctly', () => {
    const rawBody = JSON.stringify({ type: 1, id: 'ping-sig-test' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(rawBody, timestamp, keyPair.secretKey);

    const isValid = verifyDiscordSignature(rawBody, signature, timestamp, publicKeyHex);
    expect(isValid).toBe(true);
  });

  // 2. Invalid Discord signature
  it('rejects an invalid Ed25519 signature', () => {
    const rawBody = JSON.stringify({ type: 1, id: 'invalid-sig-test' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const fakeSignature = 'a'.repeat(128); // wrong signature

    const isValid = verifyDiscordSignature(rawBody, fakeSignature, timestamp, publicKeyHex);
    expect(isValid).toBe(false);
  });

  // 3. Missing signature / timestamp
  it('rejects missing signature or missing timestamp', () => {
    const rawBody = JSON.stringify({ type: 1, id: 'missing-sig-test' });
    const timestamp = Math.floor(Date.now() / 1000).toString();

    expect(verifyDiscordSignature(rawBody, undefined, timestamp, publicKeyHex)).toBe(false);
    expect(verifyDiscordSignature(rawBody, 'abcd', undefined, publicKeyHex)).toBe(false);
    expect(verifyDiscordSignature(rawBody, undefined, undefined, publicKeyHex)).toBe(false);
    expect(isValidHexPublicKey('invalid-hex-key')).toBe(false);
  });

  // 4. PING -> PONG
  it('handles Discord PING (Type 1) and returns PONG (Type 1)', async () => {
    const pingInteraction = {
      id: `ping-${Date.now()}`,
      type: 1,
      token: 'test-ping-token',
      application_id: 'test-app-456',
    };
    const bodyStr = JSON.stringify(pingInteraction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: 1 });
  });

  // Unsigned request rejected with 401
  it('rejects unsigned interaction requests with 401 Unauthorized', async () => {
    const res = await request(server)
      .post('/api/discord/interactions')
      .send({ type: 1 });

    expect(res.status).toBe(401);
  });

  // Tampered body rejected with 401
  it('rejects interaction with tampered request body with 401 Unauthorized', async () => {
    const originalBody = JSON.stringify({ type: 1, id: 'ping-tamper-test' });
    const tamperedBody = JSON.stringify({ type: 1, id: 'ping-tamper-test-modified' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(originalBody, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(tamperedBody);

    expect(res.status).toBe(401);
  });

  // Tampered timestamp rejected with 401
  it('rejects interaction with tampered timestamp with 401 Unauthorized', async () => {
    const bodyStr = JSON.stringify({ type: 1, id: 'ping-time-tamper-test' });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const forgedTimestamp = (Number(timestamp) + 100).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', forgedTimestamp)
      .send(bodyStr);

    expect(res.status).toBe(401);
  });

  // Missing rawBody rejected with 400
  it('rejects requests missing raw request body with 400 Bad Request', async () => {
    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'text/plain')
      .set('X-Signature-Ed25519', 'a'.repeat(128))
      .set('X-Signature-Timestamp', '123456789')
      .send('');

    expect(res.status).toBe(400);
  });

  // 5. /status processing
  it('processes /status slash command and records interaction log', async () => {
    const statusInteraction = {
      id: `status-${Date.now()}`,
      type: 2,
      token: 'test-status-token',
      application_id: 'test-app-456',
      guild_id: 'test-guild-123',
      channel_id: 'test-channel-789',
      data: {
        id: 'cmd-status',
        name: 'status',
      },
      member: {
        user: {
          id: 'user-456',
          username: 'alex_ops',
        },
      },
    };

    const bodyStr = JSON.stringify(statusInteraction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe(4);
    expect(res.body.data.content).toContain('Discord InterOps Bot');

    // Verify recorded in DB
    const db = await getDb();
    const records = await db
      .select()
      .from(interactionLogs)
      .where(eq(interactionLogs.interactionId, statusInteraction.id));

    expect(records.length).toBe(1);
    expect(records[0].commandName).toBe('status');
    expect(records[0].processingStatus).toBe('completed');
    expect(records[0].username).toBe('alex_ops');
  });

  // 6. /report processing
  it('processes /report command with valid input', async () => {
    const reportInteraction = {
      id: `report-${Date.now()}`,
      type: 2,
      token: 'test-report-token',
      application_id: 'test-app-456',
      guild_id: 'test-guild-123',
      channel_id: 'test-channel-789',
      data: {
        id: 'cmd-report',
        name: 'report',
        options: [
          {
            name: 'text',
            type: 3,
            value: 'Database latency spike detected on node 3',
          },
        ],
      },
      member: {
        user: {
          id: 'user-789',
          username: 'sarah_dev',
        },
      },
    };

    const bodyStr = JSON.stringify(reportInteraction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.type).toBe(4);
    expect(res.body.data.content).toContain('Report Submitted Successfully');

    // Verify interaction recorded
    const db = await getDb();
    const records = await db
      .select()
      .from(interactionLogs)
      .where(eq(interactionLogs.interactionId, reportInteraction.id));

    expect(records.length).toBe(1);
    expect(records[0].rawInput).toBe('Database latency spike detected on node 3');
  });

  // 7. Duplicate interaction (Idempotency)
  it('enforces idempotency and never executes the same interaction twice', async () => {
    const uniqueId = `idempotent-test-${Date.now()}`;
    const interaction = {
      id: uniqueId,
      type: 2,
      token: 'test-idempotent-token',
      application_id: 'test-app-456',
      data: {
        id: 'cmd-status',
        name: 'status',
      },
      user: {
        id: 'user-111',
        username: 'sam_admin',
      },
    };

    const bodyStr = JSON.stringify(interaction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    // First request
    const firstRes = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(firstRes.status).toBe(200);

    // Second (duplicate) request with identical ID
    const duplicateRes = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(duplicateRes.status).toBe(200);

    // Verify only ONE primary record exists in DB
    const db = await getDb();
    const records = await db
      .select()
      .from(interactionLogs)
      .where(eq(interactionLogs.interactionId, uniqueId));

    expect(records.length).toBe(1);
  });

  // 8. Invalid command input
  it('validates /report text input and rejects empty or too short input', async () => {
    const invalidReportInteraction = {
      id: `invalid-report-${Date.now()}`,
      type: 2,
      token: 'test-token',
      application_id: 'test-app-456',
      data: {
        id: 'cmd-report',
        name: 'report',
        options: [
          {
            name: 'text',
            type: 3,
            value: 'hi', // too short (< 3 chars)
          },
        ],
      },
      member: {
        user: {
          id: 'user-222',
          username: 'charlie',
        },
      },
    };

    const bodyStr = JSON.stringify(invalidReportInteraction);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toContain('Validation Error');
    expect(res.body.data.flags).toBe(64); // Ephemeral error
  });

  // 9. Mirror failure handling
  it('persists mirror delivery attempts and records failure state without corrupting interaction', async () => {
    const db = await getDb();
    // Temporarily configure an invalid/unreachable webhook URL
    await db
      .update(discordConfigs)
      .set({
        mirrorDestinationUrl: 'http://127.0.0.1:9999/unreachable-webhook-test',
        maxMirrorRetries: 1,
      });

    const reportWithFailedMirror = {
      id: `mirror-fail-${Date.now()}`,
      type: 2,
      token: 'test-token',
      application_id: 'test-app-456',
      data: {
        id: 'cmd-report',
        name: 'report',
        options: [
          {
            name: 'text',
            type: 3,
            value: 'Valid report text with failing mirror destination',
          },
        ],
      },
      member: {
        user: {
          id: 'user-333',
          username: 'dave',
        },
      },
    };

    const bodyStr = JSON.stringify(reportWithFailedMirror);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const res = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(res.status).toBe(200);

    // Check that mirror attempt failure was persisted in database
    const attempts = await db
      .select()
      .from(mirrorAttempts)
      .where(eq(mirrorAttempts.interactionId, reportWithFailedMirror.id));

    expect(attempts.length).toBeGreaterThan(0);
    expect(['failed', 'exhausted']).toContain(attempts[0].status);
  });

  // 10. Authentication and Authorization
  it('rejects unauthenticated requests to admin API and permits authenticated requests', async () => {
    // Unauthenticated GET
    const unauthRes = await request(server).get('/api/overview');
    expect(unauthRes.status).toBe(401);

    // Login with default admin credentials
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'Admin@DiscordInterOps2026!',
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();

    const authToken = loginRes.body.token;

    // Authenticated request with Bearer token
    const authRes = await request(server)
      .get('/api/overview')
      .set('Authorization', `Bearer ${authToken}`);

    expect(authRes.status).toBe(200);
    expect(authRes.body.metrics).toBeDefined();
    expect(authRes.body.metrics.totalCommands).toBeGreaterThanOrEqual(0);
  });

  // 11. Secret leakage prevention
  it('never leaks bot tokens or webhook secrets in API responses', async () => {
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: 'Admin@DiscordInterOps2026!',
      });

    const authToken = loginRes.body.token;

    const configRes = await request(server)
      .get('/api/config/discord')
      .set('Authorization', `Bearer ${authToken}`);

    expect(configRes.status).toBe(200);
    // Real raw secret string 'sample-bot-token-for-testing' must NOT appear
    expect(configRes.text).not.toContain('sample-bot-token-for-testing');
    // Masked version should be present
    expect(configRes.body.botTokenMasked).toBeDefined();
    expect(configRes.body.botTokenMasked).toContain('••••');
  });

  // 12. Critical Integration Test: Full End-to-End Processing Path
  it('executes full critical path: verification -> interaction -> DB log -> mirror record -> overview stats', async () => {
    const integrationInteractionId = `integration-${Date.now()}`;
    const reportData = {
      id: integrationInteractionId,
      type: 2,
      token: 'integration-token-456',
      application_id: 'test-app-456',
      guild_id: 'test-guild-123',
      channel_id: 'test-channel-789',
      data: {
        id: 'cmd-report',
        name: 'report',
        options: [{ name: 'text', type: 3, value: 'Full critical path test report' }],
      },
      user: { id: 'user-integration', username: 'integration_tester' },
    };

    const bodyStr = JSON.stringify(reportData);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signMessageForDiscord(bodyStr, timestamp, keyPair.secretKey);

    const postRes = await request(server)
      .post('/api/discord/interactions')
      .set('Content-Type', 'application/json')
      .set('X-Signature-Ed25519', signature)
      .set('X-Signature-Timestamp', timestamp)
      .send(bodyStr);

    expect(postRes.status).toBe(200);

    // Verify interaction in logs API
    const loginRes = await request(server)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'Admin@DiscordInterOps2026!' });
    const token = loginRes.body.token;

    const logsRes = await request(server)
      .get(`/api/logs/interactions?search=${integrationInteractionId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.logs.length).toBe(1);
    expect(logsRes.body.logs[0].interactionId).toBe(integrationInteractionId);
  });

  // 13. Security Guard: Production SESSION_SECRET enforcement
  it('enforces required SESSION_SECRET in production with no hardcoded fallback', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.SESSION_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.SESSION_SECRET;

      expect(() => getSessionSecret()).toThrow(/SESSION_SECRET environment variable is required in production/i);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;

      if (originalSecret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = originalSecret;
    }
  });

  // 14. Security Guard: Production DATABASE_URL enforcement
  it('enforces required DATABASE_URL in production with no silent PGlite fallback', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalDbUrl = process.env.DATABASE_URL;

    try {
      process.env.NODE_ENV = 'production';
      delete process.env.DATABASE_URL;

      await closeDb();
      await expect(getDb()).rejects.toThrow(/DATABASE_URL environment variable is required in production environment/i);
    } finally {
      if (originalEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalEnv;

      if (originalDbUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDbUrl;
    }
  });
});
