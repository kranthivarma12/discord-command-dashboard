import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc, sql, like, and, or } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { handleDiscordInteractions } from '../discord/interactions.ts';
import {
  admins,
  discordConfigs,
  commandConfigs,
  interactionLogs,
  mirrorAttempts,
  actionLogs,
} from '../db/schema.ts';
import { requireAuth, generateToken, maskSecret } from '../auth/index.ts';
import { deliverMirrorNotification } from '../discord/mirror.ts';
import { registerDiscordCommands } from '../discord/register-commands.ts';
import { logger } from '../utils/logger.ts';
import { randomUUID } from 'node:crypto';
export const apiRouter = Router();

// ==========================================
// AUTHENTICATION
// ==========================================

apiRouter.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required.' });
    return;
  }

  const db = await getDb();
  const userResults = await db
    .select()
    .from(admins)
    .where(eq(admins.username, username.trim()))
    .limit(1);

  if (userResults.length === 0) {
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const user = userResults[0];
  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    logger.warn('Failed admin login attempt', { username: user.username, ip: req.ip });
    res.status(401).json({ error: 'Invalid username or password.' });
    return;
  }

  const token = generateToken({
    id: user.id,
    username: user.username,
    role: user.role,
  });

  // Secure HTTP-only cookie
  res.cookie('admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  await db.insert(actionLogs).values({
    actor: user.username,
    actionType: 'admin_login',
    details: 'Successful administrator login',
    ipAddress: req.ip || '',
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    token,
  });
});

apiRouter.post('/auth/logout', async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('admin_session');
  res.json({ success: true, message: 'Logged out successfully.' });
});

apiRouter.get('/auth/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const user = (req as any).user;
  res.json({ success: true, user });
});

// ==========================================
// OVERVIEW & METRICS
// ==========================================

apiRouter.get('/overview', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();

  // Aggregate counts
  const allLogs = await db.select().from(interactionLogs);

  const totalCommands = allLogs.length;
  const successfulCommands = allLogs.filter(l => l.processingStatus === 'completed').length;
  const failedCommands = allLogs.filter(l => l.processingStatus === 'failed').length;
  const duplicateCommands = allLogs.filter(l => l.processingStatus === 'duplicate').length;

  // Breakdown by command
  const commandBreakdown: Record<string, { total: number; success: number; failed: number }> = {};
  for (const log of allLogs) {
    const cmd = log.commandName || (log.interactionType === 1 ? 'PING' : 'unknown');
    if (!commandBreakdown[cmd]) {
      commandBreakdown[cmd] = { total: 0, success: 0, failed: 0 };
    }
    commandBreakdown[cmd].total++;
    if (log.processingStatus === 'completed') commandBreakdown[cmd].success++;
    if (log.processingStatus === 'failed') commandBreakdown[cmd].failed++;
  }

  // Recent 10 activities
  const recentActivity = await db
    .select()
    .from(interactionLogs)
    .orderBy(desc(interactionLogs.createdAt))
    .limit(10);

  // Configuration check
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  const integrationStatus = {
    configured: Boolean(cfg?.publicKey && cfg?.applicationId),
    guildConfigured: Boolean(cfg?.guildId),
    channelConfigured: Boolean(cfg?.targetChannelId),
    mirrorConfigured: Boolean(cfg?.mirrorDestinationUrl),
    mirrorEnabled: cfg?.mirrorEnabled ?? false,
    mirrorType: cfg?.mirrorDestinationType || 'discord_webhook',
  };

  res.json({
    metrics: {
      totalCommands,
      successfulCommands,
      failedCommands,
      duplicateCommands,
      successRate: totalCommands > 0 ? Math.round((successfulCommands / totalCommands) * 100) : 100,
    },
    commandBreakdown,
    recentActivity,
    integrationStatus,
  });
});

// ==========================================
// COMMAND / ACTION LOGS
// ==========================================

apiRouter.get('/logs/interactions', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const search = req.query.search ? String(req.query.search).trim() : '';
  const command = req.query.command ? String(req.query.command).trim() : '';
  const status = req.query.status ? String(req.query.status).trim() : '';
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 200);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  // Retrieve logs ordered by newest first
  const allLogs = await db
    .select()
    .from(interactionLogs)
    .orderBy(desc(interactionLogs.createdAt));

  // Filter in-memory for flexible cross-field matching
  let filtered = allLogs;

  if (command && command !== 'all') {
    filtered = filtered.filter(l => l.commandName === command || (command === 'PING' && l.interactionType === 1));
  }

  if (status && status !== 'all') {
    filtered = filtered.filter(l => l.processingStatus === status);
  }

  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      l =>
        (l.interactionId && l.interactionId.toLowerCase().includes(s)) ||
        (l.username && l.username.toLowerCase().includes(s)) ||
        (l.userId && l.userId.toLowerCase().includes(s)) ||
        (l.guildId && l.guildId.toLowerCase().includes(s)) ||
        (l.channelId && l.channelId.toLowerCase().includes(s)) ||
        (l.rawInput && l.rawInput.toLowerCase().includes(s)) ||
        (l.errorMessage && l.errorMessage.toLowerCase().includes(s))
    );
  }

  const total = filtered.length;
  const paginated = filtered.slice(offset, offset + limit);

  res.json({
    total,
    offset,
    limit,
    logs: paginated,
  });
});

apiRouter.get('/logs/actions', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const actions = await db
    .select()
    .from(actionLogs)
    .orderBy(desc(actionLogs.createdAt))
    .limit(100);

  res.json({ actions });
});

// ==========================================
// FAILURES & PROCESSING STATUS
// ==========================================

apiRouter.get('/failures', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();

  // Retrieve failed mirror delivery attempts
  const failedAttempts = await db
  .select()
  .from(mirrorAttempts)
  .where(
    or(
      eq(mirrorAttempts.status, 'failed'),
      eq(mirrorAttempts.status, 'exhausted')
    )
  )
  .orderBy(desc(mirrorAttempts.createdAt))
  .limit(100);

  // Retrieve failed interaction logs
  const failedInteractions = await db
    .select()
    .from(interactionLogs)
    .where(eq(interactionLogs.processingStatus, 'failed'))
    .orderBy(desc(interactionLogs.createdAt))
    .limit(100);

  res.json({
    mirrorAttempts: failedAttempts,
    failedInteractions,
  });
});

apiRouter.post('/failures/:id/retry', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const interactionId = req.params.id;
  const db = await getDb();

  const interaction = await db
    .select()
    .from(interactionLogs)
    .where(eq(interactionLogs.interactionId, interactionId))
    .limit(1);

  if (interaction.length === 0) {
    res.status(404).json({ error: 'Interaction log not found.' });
    return;
  }

  const item = interaction[0];
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  if (!cfg || !cfg.mirrorDestinationUrl) {
    res.status(400).json({ error: 'Mirror destination is not configured in settings.' });
    return;
  }

  // Fetch command config for template
  const cmdConfigs = await db
    .select()
    .from(commandConfigs)
    .where(eq(commandConfigs.commandName, '/report'))
    .limit(1);

  const result = await deliverMirrorNotification(
    cfg.mirrorDestinationUrl,
    cfg.mirrorDestinationType as 'discord_webhook' | 'slack_webhook',
    {
      interactionId: item.interactionId,
      reporterUsername: item.username || 'unknown',
      reporterUserId: item.userId || 'unknown',
      guildId: item.guildId || '',
      channelId: item.channelId || '',
      reportContent: item.rawInput || '(No content recorded)',
      timestamp: item.createdAt.toISOString(),
      customTemplate: cmdConfigs[0]?.mirrorFormattingTemplate || undefined,
    },
    cfg.maxMirrorRetries || 3,
    cfg.retryBackoffMs || 1000
  );

  const user = (req as any).user;
  await db.insert(actionLogs).values({
    actor: user.username,
    actionType: 'manual_mirror_retry',
    details: JSON.stringify({
      interactionId: item.interactionId,
      result: result.success ? 'succeeded' : 'failed',
      attempts: result.attempts,
    }),
    ipAddress: req.ip || '',
  });

  if (result.success) {
    await db
      .update(interactionLogs)
      .set({
        processingStatus: 'completed',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(interactionLogs.interactionId, interactionId));

    res.json({ success: true, message: 'Mirror delivered successfully upon manual retry.' });
  } else {
    res.status(500).json({
      success: false,
      error: `Retry failed: ${result.errorMessage || 'Unknown webhook error'}`,
    });
  }
});

// ==========================================
// CONFIGURATION: DISCORD & MIRROR
// ==========================================

apiRouter.get('/config/discord', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  // Secrets masked to prevent browser leakage
  res.json({
    guildId: cfg?.guildId || process.env.DISCORD_GUILD_ID || '',
    applicationId: cfg?.applicationId || process.env.DISCORD_APPLICATION_ID || '',
    publicKey: cfg?.publicKey || process.env.DISCORD_PUBLIC_KEY || '',
    botTokenMasked: maskSecret(cfg?.botToken || process.env.DISCORD_BOT_TOKEN),
    hasBotToken: Boolean(cfg?.botToken || process.env.DISCORD_BOT_TOKEN),
    targetChannelId: cfg?.targetChannelId || '',
    mirrorDestinationUrlMasked: maskSecret(cfg?.mirrorDestinationUrl || process.env.MIRROR_WEBHOOK_URL),
    hasMirrorUrl: Boolean(cfg?.mirrorDestinationUrl || process.env.MIRROR_WEBHOOK_URL),
    mirrorDestinationType: cfg?.mirrorDestinationType || 'discord_webhook',
    mirrorEnabled: cfg?.mirrorEnabled ?? true,
    maxMirrorRetries: cfg?.maxMirrorRetries ?? 3,
    retryBackoffMs: cfg?.retryBackoffMs ?? 1000,
  });
});

apiRouter.post('/config/discord', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const {
    guildId,
    applicationId,
    publicKey,
    botToken,
    targetChannelId,
    mirrorDestinationUrl,
    mirrorDestinationType,
    mirrorEnabled,
    maxMirrorRetries,
    retryBackoffMs,
  } = req.body;

  const db = await getDb();
  const configList = await db.select().from(discordConfigs).limit(1);
  const existing = configList[0];

  const updateData: any = {
    guildId: typeof guildId === 'string' ? guildId.trim() : existing?.guildId || '',
    applicationId: typeof applicationId === 'string' ? applicationId.trim() : existing?.applicationId || '',
    publicKey: typeof publicKey === 'string' ? publicKey.trim() : existing?.publicKey || '',
    targetChannelId: typeof targetChannelId === 'string' ? targetChannelId.trim() : existing?.targetChannelId || '',
    mirrorDestinationType: mirrorDestinationType || existing?.mirrorDestinationType || 'discord_webhook',
    mirrorEnabled: typeof mirrorEnabled === 'boolean' ? mirrorEnabled : true,
    maxMirrorRetries: typeof maxMirrorRetries === 'number' ? maxMirrorRetries : 3,
    retryBackoffMs: typeof retryBackoffMs === 'number' ? retryBackoffMs : 1000,
    updatedAt: new Date(),
  };

  // Only update secret fields if new, unmasked value is provided
  if (botToken && typeof botToken === 'string' && !botToken.includes('••••')) {
    updateData.botToken = botToken.trim();
  }

  if (mirrorDestinationUrl && typeof mirrorDestinationUrl === 'string' && !mirrorDestinationUrl.includes('••••')) {
    updateData.mirrorDestinationUrl = mirrorDestinationUrl.trim();
  }

  if (existing) {
    await db.update(discordConfigs).set(updateData).where(eq(discordConfigs.id, existing.id));
  } else {
    await db.insert(discordConfigs).values({
      ...updateData,
      botToken: updateData.botToken || '',
      mirrorDestinationUrl: updateData.mirrorDestinationUrl || '',
    });
  }

  const user = (req as any).user;
  await db.insert(actionLogs).values({
    actor: user.username,
    actionType: 'update_discord_config',
    details: 'Updated Discord installation and mirror settings',
    ipAddress: req.ip || '',
  });

  logger.info('Updated Discord configuration successfully', { updatedBy: user.username });
  res.json({ success: true, message: 'Discord configuration updated successfully.' });
});

// ==========================================
// CONFIGURATION: COMMAND BEHAVIORS
// ==========================================

apiRouter.get('/config/commands', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  let commands = await db.select().from(commandConfigs);

  // Initialize default commands if not yet seeded
  if (commands.length === 0) {
    await db.insert(commandConfigs).values([
      {
        commandName: '/status',
        enabled: true,
        statusMessageTemplate: 'System status: Operational. Mirror destinations active.',
        includeSystemMetrics: true,
      },
      {
        commandName: '/report',
        enabled: true,
        reportMinLength: 3,
        reportMaxLength: 1000,
        reportAckTemplate: 'Your report has been received and securely forwarded to incident response.',
        mirrorFormattingTemplate: '🚨 **Discord Report Received**\n**Reporter:** {user} ({userId})\n**Channel:** {channel}\n**Server:** {server}\n**Timestamp:** {timestamp}\n**Content:**\n> {content}',
      },
    ]);
    commands = await db.select().from(commandConfigs);
  }

  res.json({ commands });
});

apiRouter.post('/config/commands', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { commandName, enabled, statusMessageTemplate, includeSystemMetrics, reportMinLength, reportMaxLength, reportAckTemplate, mirrorFormattingTemplate } = req.body;

  if (!commandName) {
    res.status(400).json({ error: 'commandName is required.' });
    return;
  }

  const db = await getDb();
  const existing = await db
    .select()
    .from(commandConfigs)
    .where(eq(commandConfigs.commandName, commandName))
    .limit(1);

  const payload: any = {
    updatedAt: new Date(),
  };

  if (typeof enabled === 'boolean') payload.enabled = enabled;
  if (statusMessageTemplate !== undefined) payload.statusMessageTemplate = statusMessageTemplate;
  if (includeSystemMetrics !== undefined) payload.includeSystemMetrics = includeSystemMetrics;
  if (reportMinLength !== undefined) payload.reportMinLength = parseInt(reportMinLength) || 3;
  if (reportMaxLength !== undefined) payload.reportMaxLength = parseInt(reportMaxLength) || 1000;
  if (reportAckTemplate !== undefined) payload.reportAckTemplate = reportAckTemplate;
  if (mirrorFormattingTemplate !== undefined) payload.mirrorFormattingTemplate = mirrorFormattingTemplate;

  if (existing.length > 0) {
    await db
      .update(commandConfigs)
      .set(payload)
      .where(eq(commandConfigs.commandName, commandName));
  } else {
    await db.insert(commandConfigs).values({
      commandName,
      ...payload,
    });
  }

  const user = (req as any).user;
  await db.insert(actionLogs).values({
    actor: user.username,
    actionType: 'update_command_config',
    details: `Updated configuration for command ${commandName}`,
    ipAddress: req.ip || '',
  });

  res.json({ success: true, message: `Updated configuration for ${commandName}.` });
});

// ==========================================
// TEST MIRROR WEBHOOK
// ==========================================

apiRouter.post('/config/test-mirror', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  // Allow testing URL passed in body or currently saved URL
  const testUrl = req.body.mirrorDestinationUrl && !req.body.mirrorDestinationUrl.includes('••••')
    ? req.body.mirrorDestinationUrl
    : cfg?.mirrorDestinationUrl;

  const testType = req.body.mirrorDestinationType || cfg?.mirrorDestinationType || 'discord_webhook';

  if (!testUrl || testUrl.trim() === '') {
    res.status(400).json({ error: 'No mirror destination URL provided or configured.' });
    return;
  }

  const startTime = Date.now();
  const result = await deliverMirrorNotification(
    testUrl,
    testType as 'discord_webhook' | 'slack_webhook',
    {
      interactionId: `test-${Date.now()}`,
      reporterUsername: (req as any).user.username,
      reporterUserId: String((req as any).user.id),
      guildId: cfg?.guildId || 'test-guild',
      channelId: cfg?.targetChannelId || 'test-channel',
      reportContent: '🧪 This is a test mirror notification dispatched from the Discord InterOps admin dashboard.',
      timestamp: new Date().toISOString(),
    },
    1, // 1 test attempt
    500
  );

  const durationMs = Date.now() - startTime;

  res.json({
    success: result.success,
    statusCode: result.statusCode,
    durationMs,
    error: result.errorMessage,
  });
});

// ==========================================
// DISCORD SLASH COMMAND REGISTRATION
// ==========================================
apiRouter.post('/discord/simulate', requireAuth, async (req, res) => {
  const {
    command,
    text,
    username = 'simulator_user',
    userId = 'simulator-user-001',
    channelId = 'simulator-channel-001',
    guildId = 'simulator-guild-001',
  } = req.body || {};

  if (command !== 'status' && command !== 'report') {
    res.status(400).json({
      error: 'Invalid command. Supported commands are status and report.',
    });
    return;
  }

  if (command === 'report' && typeof text !== 'string') {
    res.status(400).json({
      error: 'Report text is required for the /report command.',
    });
    return;
  }

  const interactionId = `sim-${randomUUID()}`;

  const syntheticInteraction = {
    id: interactionId,
    token: `sim-token-${randomUUID()}`,
    type: 2,
    application_id: process.env.DISCORD_APPLICATION_ID || 'simulator-application',
    guild_id: guildId,
    channel_id: channelId,
    data: {
      id: `sim-command-${command}`,
      name: command,
      options:
        command === 'report'
          ? [
              {
                name: 'text',
                type: 3,
                value: text,
              },
            ]
          : [],
    },
    member: {
      user: {
        id: userId,
        username,
        global_name: username,
      },
    },
  };

  const mockRequest = {
    headers: {},
    body: syntheticInteraction,
    rawBody: Buffer.from(JSON.stringify(syntheticInteraction)),
  } as any;

  let responsePayload: any = null;
  let responseStatus = 200;

  const mockResponse = {
    status(code: number) {
      responseStatus = code;
      return this;
    },

    json(payload: any) {
      responsePayload = payload;
      return this;
    },

    send(payload: any) {
      responsePayload = payload;
      return this;
    },
  } as any;

  const startedAt = Date.now();

  await handleDiscordInteractions(
    mockRequest,
    mockResponse,
    { skipSignatureVerification: true }
  );

  const executionTimeMs = Date.now() - startedAt;

  if (responseStatus >= 400) {
    res.status(responseStatus).json({
      success: false,
      interactionId,
      response: responsePayload,
      executionTimeMs,
      mirrorTriggered: false,
    });
    return;
  }

  res.status(200).json({
    success: true,
    interactionId,
    response: responsePayload,
    executionTimeMs,
    mirrorTriggered: command === 'report',
  });
});
apiRouter.post('/discord/register', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  const db = await getDb();
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  const applicationId = cfg?.applicationId || process.env.DISCORD_APPLICATION_ID || '';
  const botToken = cfg?.botToken || process.env.DISCORD_BOT_TOKEN || '';
  const guildId = cfg?.guildId || process.env.DISCORD_GUILD_ID || '';

  if (!applicationId || !botToken) {
    res.status(400).json({
      error: 'Cannot register commands: Application ID and Bot Token must be configured in settings.',
    });
    return;
  }

  const result = await registerDiscordCommands({
    applicationId,
    botToken,
    guildId: guildId || undefined,
  });

  if (result.success) {
    res.json({
      success: true,
      message: `Successfully registered slash commands (/status, /report) with Discord ${guildId ? `for guild ${guildId}` : 'globally'}.`,
      data: result.data,
    });
  } else {
    res.status(500).json({
      success: false,
      error: result.error || 'Failed to register commands with Discord API.',
    });
  }
});
