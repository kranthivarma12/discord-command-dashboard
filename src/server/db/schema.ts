import { pgTable, serial, text, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const admins = pgTable('admins', {
  id: serial('id').primaryKey(),
  username: varchar('username', { length: 100 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const discordConfigs = pgTable('discord_configs', {
  id: serial('id').primaryKey(),
  guildId: varchar('guild_id', { length: 100 }).notNull().default(''),
  applicationId: varchar('application_id', { length: 100 }).notNull().default(''),
  publicKey: varchar('public_key', { length: 100 }).notNull().default(''),
  botToken: varchar('bot_token', { length: 255 }).notNull().default(''),
  targetChannelId: varchar('target_channel_id', { length: 100 }).notNull().default(''),
  mirrorDestinationUrl: text('mirror_destination_url').notNull().default(''),
  mirrorDestinationType: varchar('mirror_destination_type', { length: 50 }).notNull().default('discord_webhook'),
  mirrorEnabled: boolean('mirror_enabled').notNull().default(true),
  maxMirrorRetries: integer('max_mirror_retries').notNull().default(3),
  retryBackoffMs: integer('retry_backoff_ms').notNull().default(1000),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const commandConfigs = pgTable('command_configs', {
  id: serial('id').primaryKey(),
  commandName: varchar('command_name', { length: 50 }).notNull().unique(),
  enabled: boolean('enabled').notNull().default(true),
  statusMessageTemplate: text('status_message_template').default('System status: Operational. Mirror destinations active.'),
  includeSystemMetrics: boolean('include_system_metrics').default(true),
  reportMinLength: integer('report_min_length').default(3),
  reportMaxLength: integer('report_max_length').default(1000),
  reportAckTemplate: text('report_ack_template').default('Your report has been received and securely forwarded to incident response.'),
  mirrorFormattingTemplate: text('mirror_formatting_template').default('🚨 **Discord Report Received**\n**Reporter:** {user} ({userId})\n**Channel:** {channel}\n**Server:** {server}\n**Timestamp:** {timestamp}\n**Content:**\n> {content}'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const interactionLogs = pgTable('interaction_logs', {
  id: serial('id').primaryKey(),
  interactionId: varchar('interaction_id', { length: 100 }).notNull().unique(),
  interactionType: integer('interaction_type').notNull(),
  commandName: varchar('command_name', { length: 100 }),
  guildId: varchar('guild_id', { length: 100 }),
  channelId: varchar('channel_id', { length: 100 }),
  userId: varchar('user_id', { length: 100 }),
  username: varchar('username', { length: 100 }),
  rawInput: text('raw_input'),
  processingStatus: varchar('processing_status', { length: 50 }).notNull().default('received'), // received, completed, failed, duplicate
  responsePayload: text('response_payload'),
  actionsPerformed: text('actions_performed'), // JSON string array
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mirrorAttempts = pgTable('mirror_attempts', {
  id: serial('id').primaryKey(),
  interactionId: varchar('interaction_id', { length: 100 }).notNull(),
  destinationType: varchar('destination_type', { length: 50 }).notNull(),
  attemptNumber: integer('attempt_number').notNull().default(1),
  status: varchar('status', { length: 50 }).notNull().default('pending'), // pending, delivered, failed, exhausted
  httpStatusCode: integer('http_status_code'),
  errorMessage: text('error_message'),
  payloadPreview: text('payload_preview'),
  nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const actionLogs = pgTable('action_logs', {
  id: serial('id').primaryKey(),
  actor: varchar('actor', { length: 100 }).notNull(),
  actionType: varchar('action_type', { length: 100 }).notNull(),
  details: text('details'),
  ipAddress: varchar('ip_address', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
