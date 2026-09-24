export interface User {
  id: number;
  username: string;
  role: string;
}

export interface OverviewMetrics {
  totalCommands: number;
  completedCommands: number;
  failedCommands: number;
  duplicateInteractions: number;
  mirrorAttemptsCount: number;
  failedMirrorAttempts: number;
  activeGuildsCount: number;
  uptimeSeconds: number;
}

export interface InteractionLog {
  id: number;
  interactionId: string;
  interactionType: number;
  commandName: string | null;
  guildId: string | null;
  channelId: string | null;
  userId: string | null;
  username: string | null;
  rawInput: string | null;
  processingStatus: 'received' | 'processing' | 'completed' | 'failed' | 'duplicate';
  responsePayload: string | null;
  actionsPerformed: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MirrorAttempt {
  id: number;
  interactionId: string;
  destinationType: string;
  attemptNumber: number;
  status: 'pending' | 'retrying' | 'delivered' | 'failed' | 'exhausted';
  httpStatusCode: number | null;
  errorMessage: string | null;
  payloadPreview: string | null;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface DiscordConfig {
  id: number;
  guildId: string;
  applicationId: string;
  publicKey: string;
  botTokenMasked: string;
  hasBotToken: boolean;
  targetChannelId: string;
  mirrorDestinationUrlMasked: string;
  mirrorDestinationType: 'discord_webhook' | 'slack_webhook';
  hasMirrorUrl: boolean;
  mirrorEnabled: boolean;
  maxMirrorRetries: number;
  retryBackoffMs: number;
  updatedAt: string;
}

export interface CommandConfig {
  id: number;
  commandName: string;
  enabled: boolean;
  statusMessageTemplate?: string;
  includeSystemMetrics?: boolean;
  reportMinLength?: number;
  reportMaxLength?: number;
  reportAckTemplate?: string;
  mirrorFormattingTemplate?: string;
  updatedAt: string;
}

export interface ActionLog {
  id: number;
  actor: string;
  actionType: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}
