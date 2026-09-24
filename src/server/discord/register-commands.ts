import { logger } from '../utils/logger.ts';

export interface CommandDefinition {
  name: string;
  description: string;
  options?: Array<{
    name: string;
    description: string;
    type: number; // 3 = STRING, 4 = INTEGER, etc.
    required?: boolean;
  }>;
}

export const BOT_SLASH_COMMANDS: CommandDefinition[] = [
  {
    name: 'status',
    description: 'Check bot operational status, system metrics, and mirror delivery state.',
  },
  {
    name: 'report',
    description: 'Submit an incident report to be logged and mirrored to the operations channel.',
    options: [
      {
        name: 'text',
        description: 'The report details, issue description, or message to submit.',
        type: 3, // STRING
        required: true,
      },
    ],
  },
];

export async function registerDiscordCommands(params: {
  applicationId: string;
  botToken: string;
  guildId?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const { applicationId, botToken, guildId } = params;

  if (!applicationId || !botToken) {
    return {
      success: false,
      error: 'Application ID and Bot Token are required to register slash commands.',
    };
  }

  // If guildId is provided, register for the guild (updates instantly in Discord).
  // Otherwise register globally (can take up to 1 hour to propagate in Discord).
  const url = guildId && guildId.trim() !== ''
    ? `https://discord.com/api/v10/applications/${applicationId.trim()}/guilds/${guildId.trim()}/commands`
    : `https://discord.com/api/v10/applications/${applicationId.trim()}/commands`;

  logger.info('Registering slash commands with Discord API', {
    applicationId,
    guildId: guildId || 'global',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      method: 'PUT', // Overwrites all commands cleanly
      headers: {
        Authorization: `Bot ${botToken.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(BOT_SLASH_COMMANDS),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      logger.error('Failed to register Discord slash commands', {
        status: response.status,
        error: errText,
      });
      return {
        success: false,
        error: `Discord API returned HTTP ${response.status}: ${errText.substring(0, 300)}`,
      };
    }

    const data = await response.json();
    logger.info('Successfully registered Discord slash commands', { count: Array.isArray(data) ? data.length : 1 });
    return {
      success: true,
      data,
    };
  } catch (err: any) {
    clearTimeout(timeout);
    const errorMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
    logger.error('Exception during Discord command registration', { error: errorMsg });
    return {
      success: false,
      error: errorMsg,
    };
  }
}
