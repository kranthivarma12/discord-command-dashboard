import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import {
  interactionLogs,
  discordConfigs,
  commandConfigs,
  actionLogs,
} from '../db/schema.ts';
import { verifyDiscordSignature } from './verify.ts';
import { deliverMirrorNotification } from './mirror.ts';
import { logger } from '../utils/logger.ts';

// Discord Interaction Types
export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

// Discord Interaction Response Types
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8,
  MODAL: 9,
} as const;

export interface DiscordInteractionOption {
  name: string;
  type: number;
  value?: any;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteractionData {
  id: string;
  name: string;
  options?: DiscordInteractionOption[];
}

export interface DiscordInteractionBody {
  id: string;
  token: string;
  type: number;
  application_id: string;
  guild_id?: string;
  channel_id?: string;
  data?: DiscordInteractionData;
  member?: {
    user: {
      id: string;
      username: string;
      discriminator?: string;
      global_name?: string;
    };
  };
  user?: {
    id: string;
    username: string;
    discriminator?: string;
    global_name?: string;
  };
}

/**
 * Sends a follow-up or updates the original deferred message in Discord.
 */
export async function followUpDiscordInteraction(
  applicationId: string,
  interactionToken: string,
  payload: { content: string; embeds?: any[]; flags?: number }
): Promise<boolean> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.ok;
  } catch (err: any) {
    logger.error('Failed to send Discord follow-up interaction response', { error: err.message });
    return false;
  }
}

/**
 * Discord Interactions Webhook Handler
 */
export async function handleDiscordInteractions(req: Request, res: Response): Promise<void> {
  const db = await getDb();

  // Retrieve Discord configuration
  const configList = await db.select().from(discordConfigs).limit(1);
  const discordConfig = configList[0];

  // In production, public key is read from database or DISCORD_PUBLIC_KEY env var
  const publicKey = discordConfig?.publicKey || process.env.DISCORD_PUBLIC_KEY || '';

  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const rawBody = (req as any).rawBody;

  // Strict check: rawBody must be captured directly from the incoming stream
  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    logger.warn('Rejected Discord interaction: raw request body is unavailable for signature verification');
    res.status(400).send('Raw request body is required for signature verification');
    return;
  }

  // 1-4: Reject invalid or unsigned requests
  if (!signature || !timestamp || !publicKey) {
    logger.warn('Rejected Discord interaction: missing signature, timestamp, or public key');
    res.status(401).send('Invalid signature or missing verification headers');
    return;
  }

  const isValid = verifyDiscordSignature(rawBody, signature, timestamp, publicKey);
  if (!isValid) {
    logger.warn('Rejected Discord interaction: Ed25519 signature verification failed');
    res.status(401).send('Invalid request signature');
    return;
  }

  const interaction = req.body as DiscordInteractionBody;
  const interactionId = interaction.id;

  if (!interactionId) {
    res.status(400).json({ error: 'Missing interaction ID' });
    return;
  }

  // 5-6: Discord PING (Type 1)
  if (interaction.type === InteractionType.PING) {
    logger.info('Received Discord PING interaction (Type 1)');

    try {
      // Record PING interaction for audit if not already present
      const existingPing = await db
        .select()
        .from(interactionLogs)
        .where(eq(interactionLogs.interactionId, interactionId))
        .limit(1);

      if (existingPing.length === 0) {
        await db.insert(interactionLogs).values({
          interactionId,
          interactionType: InteractionType.PING,
          processingStatus: 'completed',
          actionsPerformed: JSON.stringify(['pong_response']),
          responsePayload: JSON.stringify({ type: InteractionResponseType.PONG }),
        });
      }
    } catch (e: any) {
      logger.debug('PING log save note', { error: e.message });
    }

    res.status(200).json({ type: InteractionResponseType.PONG });
    return;
  }

  // 8-10: Deduplication / Idempotency Check
  const existingRecords = await db
    .select()
    .from(interactionLogs)
    .where(eq(interactionLogs.interactionId, interactionId))
    .limit(1);

  if (existingRecords.length > 0) {
    const existing = existingRecords[0];
    logger.warn('Duplicate interaction detected - returning idempotent cached response', {
      interactionId,
      status: existing.processingStatus,
    });

    if (existing.responsePayload) {
      try {
        const cached = JSON.parse(existing.responsePayload);
        res.status(200).json(cached);
        return;
      } catch {
        // Fall back to simple acknowledged message
      }
    }

    res.status(200).json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'ℹ️ Interaction was already processed (idempotent response).',
        flags: 64, // Ephemeral
      },
    });
    return;
  }

  // Extract common user & location metadata
  const discordUser = interaction.member?.user || interaction.user;
  const userId = discordUser?.id || '';
  const username = discordUser?.global_name || discordUser?.username || 'unknown';
  const guildId = interaction.guild_id || '';
  const channelId = interaction.channel_id || '';
  const commandName = interaction.data?.name || 'unknown';

  // 7. Handle APPLICATION_COMMAND interaction (Type 2)
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    // Check channel configuration: if a target channel is configured and this request is from another channel
    if (
      discordConfig?.targetChannelId &&
      discordConfig.targetChannelId.trim() !== '' &&
      channelId !== discordConfig.targetChannelId.trim()
    ) {
      const channelMismatchResponse = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `⚠️ Bot commands are restricted to channel <#${discordConfig.targetChannelId}>.`,
          flags: 64,
        },
      };

      await db.insert(interactionLogs).values({
        interactionId,
        interactionType: interaction.type,
        commandName,
        guildId,
        channelId,
        userId,
        username,
        rawInput: JSON.stringify(interaction.data?.options || []),
        processingStatus: 'failed',
        errorMessage: `Restricted channel: received in ${channelId}, expected ${discordConfig.targetChannelId}`,
        actionsPerformed: JSON.stringify(['channel_restriction_enforced']),
        responsePayload: JSON.stringify(channelMismatchResponse),
      });

      res.status(200).json(channelMismatchResponse);
      return;
    }

    // Fetch command configuration
    const cmdConfigs = await db
      .select()
      .from(commandConfigs)
      .where(eq(commandConfigs.commandName, `/${commandName}`))
      .limit(1);
    const cmdConfig = cmdConfigs[0];

    // Check if command is disabled
    if (cmdConfig && !cmdConfig.enabled) {
      const disabledResponse = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `⚠️ The command /${commandName} is currently disabled by the administrator.`,
          flags: 64,
        },
      };

      await db.insert(interactionLogs).values({
        interactionId,
        interactionType: interaction.type,
        commandName,
        guildId,
        channelId,
        userId,
        username,
        rawInput: JSON.stringify(interaction.data?.options || []),
        processingStatus: 'failed',
        errorMessage: 'Command disabled by admin config',
        actionsPerformed: JSON.stringify(['command_disabled_check']),
        responsePayload: JSON.stringify(disabledResponse),
      });

      res.status(200).json(disabledResponse);
      return;
    }

    // COMMAND: /status
    if (commandName === 'status') {
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const uptimeStr = `${hours}h ${minutes}m ${seconds}s`;

      const customTemplate = cmdConfig?.statusMessageTemplate ||
        'System status: Operational. Mirror destinations active.';
      const includeMetrics = cmdConfig ? cmdConfig.includeSystemMetrics : true;

      let responseText = `**Discord InterOps Bot**\n${customTemplate}`;
      if (includeMetrics) {
        responseText += `\n\n• **Uptime:** \`${uptimeStr}\`\n• **Mirror Destination:** \`${discordConfig?.mirrorDestinationType || 'None'}\` (${discordConfig?.mirrorEnabled ? 'Enabled' : 'Disabled'})\n• **Database:** \`PostgreSQL (Connected)\`\n• **Environment:** \`${process.env.NODE_ENV || 'production'}\``;
      }

      const responsePayload = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: responseText,
        },
      };

      const actions = ['status_checked', 'system_metrics_generated', 'discord_responded'];

      await db.insert(interactionLogs).values({
        interactionId,
        interactionType: interaction.type,
        commandName: 'status',
        guildId,
        channelId,
        userId,
        username,
        rawInput: '',
        processingStatus: 'completed',
        actionsPerformed: JSON.stringify(actions),
        responsePayload: JSON.stringify(responsePayload),
      });

      res.status(200).json(responsePayload);
      return;
    }

    // COMMAND: /report <text>
    if (commandName === 'report') {
      const textOption = interaction.data?.options?.find(opt => opt.name === 'text');
      const reportText = typeof textOption?.value === 'string' ? textOption.value.trim() : '';

      const minLen = cmdConfig?.reportMinLength ?? 3;
      const maxLen = cmdConfig?.reportMaxLength ?? 1000;

      // 1. Input Validation
      if (!reportText || reportText.length < minLen) {
        const errorMsg = `Report text must be at least ${minLen} characters long.`;
        const invalidResponse = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Validation Error: ${errorMsg}`,
            flags: 64, // Ephemeral
          },
        };

        await db.insert(interactionLogs).values({
          interactionId,
          interactionType: interaction.type,
          commandName: 'report',
          guildId,
          channelId,
          userId,
          username,
          rawInput: reportText,
          processingStatus: 'failed',
          errorMessage: errorMsg,
          actionsPerformed: JSON.stringify(['input_validation_failed']),
          responsePayload: JSON.stringify(invalidResponse),
        });

        res.status(200).json(invalidResponse);
        return;
      }

      if (reportText.length > maxLen) {
        const errorMsg = `Report text must not exceed ${maxLen} characters.`;
        const invalidResponse = {
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: `❌ Validation Error: ${errorMsg}`,
            flags: 64,
          },
        };

        await db.insert(interactionLogs).values({
          interactionId,
          interactionType: interaction.type,
          commandName: 'report',
          guildId,
          channelId,
          userId,
          username,
          rawInput: reportText.substring(0, 100),
          processingStatus: 'failed',
          errorMessage: errorMsg,
          actionsPerformed: JSON.stringify(['input_validation_failed']),
          responsePayload: JSON.stringify(invalidResponse),
        });

        res.status(200).json(invalidResponse);
        return;
      }

      // 2. Record initial interaction as processing
      await db.insert(interactionLogs).values({
        interactionId,
        interactionType: interaction.type,
        commandName: 'report',
        guildId,
        channelId,
        userId,
        username,
        rawInput: reportText,
        processingStatus: 'processing',
        actionsPerformed: JSON.stringify(['input_validated']),
      });

      // 3. Command Behavior
      const ackMessage = cmdConfig?.reportAckTemplate ||
        'Your report has been received and securely forwarded to incident response.';

      const discordResponsePayload = {
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `✅ **Report Submitted Successfully**\n${ackMessage}\n\n*Reference ID: \`${interactionId}\`*`,
        },
      };

      // 4. Respond to Discord within the 3-second window
      res.status(200).json(discordResponsePayload);

      // 5-7. Deliver mirror notification & record downstream status
      const actions = ['input_validated', 'discord_responded'];

      try {
        if (discordConfig && discordConfig.mirrorEnabled && discordConfig.mirrorDestinationUrl) {
          const mirrorResult = await deliverMirrorNotification(
            discordConfig.mirrorDestinationUrl,
            discordConfig.mirrorDestinationType as 'discord_webhook' | 'slack_webhook',
            {
              interactionId,
              reporterUsername: username,
              reporterUserId: userId,
              guildId,
              channelId,
              reportContent: reportText,
              timestamp: new Date().toISOString(),
              customTemplate: cmdConfig?.mirrorFormattingTemplate || undefined,
            },
            discordConfig.maxMirrorRetries || 3,
            discordConfig.retryBackoffMs || 1000
          );

          if (mirrorResult.success) {
            actions.push('mirror_delivered');
            await db
              .update(interactionLogs)
              .set({
                processingStatus: 'completed',
                actionsPerformed: JSON.stringify(actions),
                responsePayload: JSON.stringify(discordResponsePayload),
                updatedAt: new Date(),
              })
              .where(eq(interactionLogs.interactionId, interactionId));
          } else {
            actions.push('mirror_delivery_failed');
            await db
              .update(interactionLogs)
              .set({
                processingStatus: 'failed',
                errorMessage: `Mirror delivery failed: ${mirrorResult.errorMessage || 'Unknown destination error'}`,
                actionsPerformed: JSON.stringify(actions),
                responsePayload: JSON.stringify(discordResponsePayload),
                updatedAt: new Date(),
              })
              .where(eq(interactionLogs.interactionId, interactionId));
          }
        } else {
          actions.push('mirror_skipped_not_configured');
          await db
            .update(interactionLogs)
            .set({
              processingStatus: 'completed',
              actionsPerformed: JSON.stringify(actions),
              responsePayload: JSON.stringify(discordResponsePayload),
              updatedAt: new Date(),
            })
            .where(eq(interactionLogs.interactionId, interactionId));
        }
      } catch (err: any) {
        logger.error('Error during post-response mirror processing', {
          interactionId,
          error: err.message,
        });

        actions.push('mirror_exception');
        await db
          .update(interactionLogs)
          .set({
            processingStatus: 'failed',
            errorMessage: err.message,
            actionsPerformed: JSON.stringify(actions),
            updatedAt: new Date(),
          })
          .where(eq(interactionLogs.interactionId, interactionId));
      }

      return;
    }

    // Unknown application command
    const unknownCmdResponse = {
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: `❓ Unknown command \`/${commandName}\`.`,
        flags: 64,
      },
    };

    await db.insert(interactionLogs).values({
      interactionId,
      interactionType: interaction.type,
      commandName,
      guildId,
      channelId,
      userId,
      username,
      processingStatus: 'failed',
      errorMessage: `Unknown command /${commandName}`,
      responsePayload: JSON.stringify(unknownCmdResponse),
    });

    res.status(200).json(unknownCmdResponse);
    return;
  }

  // Other unhandled interaction types
  res.status(200).json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Interaction acknowledged.' },
  });
}
