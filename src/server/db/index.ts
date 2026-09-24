import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import * as schema from './schema.ts';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.ts';

const { Pool } = pg;

// Type for our Drizzle database instance with schema
export type AppDatabase = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let dbInstance: AppDatabase | null = null;
let rawClient: pg.Pool | PGlite | null = null;

export async function getDb(): Promise<AppDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const databaseUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === 'production';

  if (databaseUrl && databaseUrl.trim() !== '') {
    logger.info('Connecting to external PostgreSQL database via DATABASE_URL');
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    });
    rawClient = pool;
    dbInstance = drizzlePg(pool, { schema });
  } else {
    if (isProduction) {
      const errMsg = 'DATABASE_URL environment variable is required in production environment.';
      logger.error(errMsg);
      throw new Error(errMsg);
    }
    logger.info('Initializing embedded PostgreSQL (PGlite) instance for development/testing');
    const dataDir = process.env.NODE_ENV === 'test' || process.env.VITEST
      ? undefined // in-memory for testing
      : path.resolve(process.cwd(), '.data/pglite');

    if (dataDir && !fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const pglite = new PGlite(dataDir);
    rawClient = pglite;
    dbInstance = drizzlePglite(pglite, { schema });
  }

  // Ensure tables and initial records exist
  await initializeDatabase(rawClient);

  return dbInstance;
}

export async function getRawClient(): Promise<pg.Pool | PGlite> {
  if (!rawClient) {
    await getDb();
  }
  return rawClient!;
}

export async function closeDb(): Promise<void> {
  if (rawClient) {
    if ('end' in rawClient && typeof rawClient.end === 'function') {
      await rawClient.end();
    } else if ('close' in rawClient && typeof rawClient.close === 'function') {
      await (rawClient as any).close();
    }
    rawClient = null;
    dbInstance = null;
  }
}

export async function initializeDatabase(client: pg.Pool | PGlite): Promise<void> {
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS discord_configs (
      id SERIAL PRIMARY KEY,
      guild_id VARCHAR(100) NOT NULL DEFAULT '',
      application_id VARCHAR(100) NOT NULL DEFAULT '',
      public_key VARCHAR(100) NOT NULL DEFAULT '',
      bot_token VARCHAR(255) NOT NULL DEFAULT '',
      target_channel_id VARCHAR(100) NOT NULL DEFAULT '',
      mirror_destination_url TEXT NOT NULL DEFAULT '',
      mirror_destination_type VARCHAR(50) NOT NULL DEFAULT 'discord_webhook',
      mirror_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      max_mirror_retries INTEGER NOT NULL DEFAULT 3,
      retry_backoff_ms INTEGER NOT NULL DEFAULT 1000,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS command_configs (
      id SERIAL PRIMARY KEY,
      command_name VARCHAR(50) NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      status_message_template TEXT DEFAULT 'System status: Operational. Mirror destinations active.',
      include_system_metrics BOOLEAN DEFAULT TRUE,
      report_min_length INTEGER DEFAULT 3,
      report_max_length INTEGER DEFAULT 1000,
      report_ack_template TEXT DEFAULT 'Your report has been received and securely forwarded to incident response.',
      mirror_formatting_template TEXT DEFAULT '🚨 **Discord Report Received**\\n**Reporter:** {user} ({userId})\\n**Channel:** {channel}\\n**Server:** {server}\\n**Timestamp:** {timestamp}\\n**Content:**\\n> {content}',
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE TABLE IF NOT EXISTS interaction_logs (
      id SERIAL PRIMARY KEY,
      interaction_id VARCHAR(100) NOT NULL UNIQUE,
      interaction_type INTEGER NOT NULL,
      command_name VARCHAR(100),
      guild_id VARCHAR(100),
      channel_id VARCHAR(100),
      user_id VARCHAR(100),
      username VARCHAR(100),
      raw_input TEXT,
      processing_status VARCHAR(50) NOT NULL DEFAULT 'received',
      response_payload TEXT,
      actions_performed TEXT,
      error_message TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_interaction_logs_id ON interaction_logs (interaction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_interaction_logs_created_at ON interaction_logs (created_at DESC)`,

    `CREATE TABLE IF NOT EXISTS mirror_attempts (
      id SERIAL PRIMARY KEY,
      interaction_id VARCHAR(100) NOT NULL,
      destination_type VARCHAR(50) NOT NULL,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      http_status_code INTEGER,
      error_message TEXT,
      payload_preview TEXT,
      next_retry_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_mirror_attempts_interaction ON mirror_attempts (interaction_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mirror_attempts_status ON mirror_attempts (status)`,

    `CREATE TABLE IF NOT EXISTS action_logs (
      id SERIAL PRIMARY KEY,
      actor VARCHAR(100) NOT NULL,
      action_type VARCHAR(100) NOT NULL,
      details TEXT,
      ip_address VARCHAR(100),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    )`,

    `CREATE INDEX IF NOT EXISTS idx_action_logs_created_at ON action_logs (created_at DESC)`
  ];

  for (const statement of ddlStatements) {
    if ('query' in client) {
      await (client as any).query(statement);
    } else if ('exec' in client) {
      await (client as any).exec(statement);
    }
  }

  logger.info('Database tables verified and ready.');
}
