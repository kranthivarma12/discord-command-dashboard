import { getDb } from '../db/index.ts';
import { mirrorAttempts, actionLogs } from '../db/schema.ts';
import { logger } from '../utils/logger.ts';

export interface MirrorPayloadData {
  interactionId: string;
  reporterUsername: string;
  reporterUserId: string;
  guildId: string;
  channelId: string;
  reportContent: string;
  timestamp: string;
  customTemplate?: string;
}

export interface MirrorResult {
  success: boolean;
  attempts: number;
  statusCode?: number;
  errorMessage?: string;
}

/**
 * Format message based on custom template or standard format.
 */
export function formatMirrorMessage(data: MirrorPayloadData): { text: string; formatted: string } {
  const template = data.customTemplate ||
    '🚨 **Discord Report Received**\n**Reporter:** {user} ({userId})\n**Channel:** {channel}\n**Server:** {server}\n**Timestamp:** {timestamp}\n**Content:**\n> {content}';

  const formatted = template
    .replace(/\{user\}/g, `@${data.reporterUsername || 'unknown'}`)
    .replace(/\{userId\}/g, data.reporterUserId || 'unknown')
    .replace(/\{channel\}/g, data.channelId || 'direct-message')
    .replace(/\{server\}/g, data.guildId || 'direct-message')
    .replace(/\{timestamp\}/g, data.timestamp || new Date().toISOString())
    .replace(/\{content\}/g, data.reportContent);

  return {
    text: `Report from ${data.reporterUsername}: ${data.reportContent}`,
    formatted,
  };
}

/**
 * Executes delivery to a Discord or Slack webhook with bounded retries and timeouts.
 */
export async function deliverMirrorNotification(
  destinationUrl: string,
  destinationType: 'discord_webhook' | 'slack_webhook',
  data: MirrorPayloadData,
  maxRetries: number = 3,
  backoffMs: number = 1000
): Promise<MirrorResult> {
  const db = await getDb();
  const { text, formatted } = formatMirrorMessage(data);

  if (!destinationUrl || destinationUrl.trim() === '') {
    const errorMsg = 'Mirror destination URL is not configured';
    logger.warn(errorMsg, { interactionId: data.interactionId });

    await db.insert(mirrorAttempts).values({
      interactionId: data.interactionId,
      destinationType,
      attemptNumber: 1,
      status: 'failed',
      errorMessage: errorMsg,
      payloadPreview: formatted.substring(0, 255),
    });

    return {
      success: false,
      attempts: 1,
      errorMessage: errorMsg,
    };
  }

  // Construct payload based on destination type
  let requestBody: any;
  if (destinationType === 'slack_webhook') {
    requestBody = {
      text: formatted,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: '🚨 Discord Incident Report', emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Reporter:*\n<@${data.reporterUserId}> (${data.reporterUsername})` },
            { type: 'mrkdwn', text: `*Server ID:*\n${data.guildId || 'N/A'}` },
            { type: 'mrkdwn', text: `*Channel ID:*\n${data.channelId || 'N/A'}` },
            { type: 'mrkdwn', text: `*Time:*\n${data.timestamp}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `*Report Content:*\n>>> ${data.reportContent}` },
        },
      ],
    };
  } else {
    // Discord Webhook
    requestBody = {
      content: formatted,
      embeds: [
        {
          title: '🚨 Incident Report',
          color: 0xe03131,
          fields: [
            { name: 'Reporter', value: `${data.reporterUsername} (${data.reporterUserId})`, inline: true },
            { name: 'Server ID', value: data.guildId || 'Direct Message', inline: true },
            { name: 'Channel ID', value: data.channelId || 'N/A', inline: true },
            { name: 'Report Content', value: data.reportContent },
          ],
          timestamp: data.timestamp,
          footer: { text: `Interaction ID: ${data.interactionId}` },
        },
      ],
    };
  }

  let attempt = 0;
  let lastError = '';
  let lastStatus = 0;

  while (attempt < maxRetries) {
    attempt++;
    logger.info(`Attempting mirror delivery (attempt ${attempt}/${maxRetries})`, {
      interactionId: data.interactionId,
      destinationType,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    try {
      const response = await fetch(destinationUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeout);
      lastStatus = response.status;

      if (response.ok || response.status === 204) {
        logger.info('Mirror delivery succeeded', {
          interactionId: data.interactionId,
          attempt,
          status: response.status,
        });

        await db.insert(mirrorAttempts).values({
          interactionId: data.interactionId,
          destinationType,
          attemptNumber: attempt,
          status: 'delivered',
          httpStatusCode: response.status,
          payloadPreview: formatted.substring(0, 255),
        });

        return {
          success: true,
          attempts: attempt,
          statusCode: response.status,
        };
      } else {
        const errorText = await response.text().catch(() => 'Unknown HTTP response');
        lastError = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
        logger.warn('Mirror delivery returned non-OK status', {
          interactionId: data.interactionId,
          attempt,
          status: response.status,
          error: lastError,
        });

        const isExhausted = attempt >= maxRetries;
        await db.insert(mirrorAttempts).values({
          interactionId: data.interactionId,
          destinationType,
          attemptNumber: attempt,
          status: isExhausted ? 'exhausted' : 'failed',
          httpStatusCode: response.status,
          errorMessage: lastError,
          payloadPreview: formatted.substring(0, 255),
        });

        if (!isExhausted) {
          // Exponential backoff
          await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
        }
      }
    } catch (err: any) {
      clearTimeout(timeout);
      const isAbort = err.name === 'AbortError';
      lastError = isAbort ? 'HTTP Request Timeout (5000ms)' : (err.message || 'Network error');
      logger.error('Mirror delivery network exception', {
        interactionId: data.interactionId,
        attempt,
        error: lastError,
      });

      const isExhausted = attempt >= maxRetries;
      await db.insert(mirrorAttempts).values({
        interactionId: data.interactionId,
        destinationType,
        attemptNumber: attempt,
        status: isExhausted ? 'exhausted' : 'failed',
        errorMessage: lastError,
        payloadPreview: formatted.substring(0, 255),
      });

      if (!isExhausted) {
        await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
      }
    }
  }

  // Audit log mirror failure
  await db.insert(actionLogs).values({
    actor: 'system:mirror_delivery',
    actionType: 'mirror_failed',
    details: JSON.stringify({
      interactionId: data.interactionId,
      destinationType,
      attempts: attempt,
      error: lastError,
    }),
  });

  return {
    success: false,
    attempts: attempt,
    statusCode: lastStatus,
    errorMessage: lastError,
  };
}
