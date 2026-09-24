import dotenv from 'dotenv';
import { registerDiscordCommands } from '../discord/register-commands.ts';
import { getDb } from '../db/index.ts';
import { discordConfigs } from '../db/schema.ts';

dotenv.config();

async function run() {
  console.log('--- Registering Discord Slash Commands ---');

  const db = await getDb();
  const configList = await db.select().from(discordConfigs).limit(1);
  const cfg = configList[0];

  const applicationId = cfg?.applicationId || process.env.DISCORD_APPLICATION_ID || '';
  const botToken = cfg?.botToken || process.env.DISCORD_BOT_TOKEN || '';
  const guildId = cfg?.guildId || process.env.DISCORD_GUILD_ID || '';

  if (!applicationId || !botToken) {
    console.error('Error: DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN must be set either in the database or in .env');
    process.exit(1);
  }

  console.log(`Application ID: ${applicationId}`);
  console.log(`Target Guild: ${guildId || 'Global (all servers)'}`);

  const result = await registerDiscordCommands({
    applicationId,
    botToken,
    guildId: guildId || undefined,
  });

  if (result.success) {
    console.log('✅ Commands successfully registered with Discord API!');
    console.log(JSON.stringify(result.data, null, 2));
    process.exit(0);
  } else {
    console.error('❌ Failed to register commands:', result.error);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
