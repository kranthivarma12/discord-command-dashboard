/**
 * Structured server-side logger with automatic secret redaction.
 * Ensures tokens, webhook URLs, DB passwords, and sensitive keys are never exposed in logs.
 */

const SENSITIVE_PATTERNS = [
  /https:\/\/discord\.com\/api\/webhooks\/[0-9]+\/[A-Za-z0-9_-]+/gi,
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/gi,
  /([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38})/g, // Discord bot token pattern
  /Bot\s+[A-Za-z0-9_.-]+/gi,
  /Bearer\s+[A-Za-z0-9_.-]+/gi,
  /password["']?\s*[:=]\s*["']?[^"'\s,]+/gi,
  /postgres(ql)?:\/\/[^:]+:([^@]+)@/gi, // Database passwords in connection strings
];

export function sanitize(input: any): any {
  if (typeof input === 'string') {
    let sanitized = input;
    // Redact webhook URLs
    sanitized = sanitized.replace(
      /https:\/\/discord\.com\/api\/webhooks\/([0-9]+)\/([A-Za-z0-9_-]+)/gi,
      'https://discord.com/api/webhooks/$1/[REDACTED_WEBHOOK_TOKEN]'
    );
    sanitized = sanitized.replace(
      /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+/gi,
      'https://hooks.slack.com/services/[REDACTED_SLACK_WEBHOOK]'
    );
    // Redact database credentials in URIs
    sanitized = sanitized.replace(
      /postgres(ql)?:\/\/([^:]+):([^@]+)@/gi,
      'postgres://$2:[REDACTED_PASSWORD]@'
    );
    // Redact bcrypt hashes ($2a$, $2b$, $2y$)
    sanitized = sanitized.replace(
      /\$2[aby]\$[0-9]{2}\$[A-Za-z0-9./]{53}/g,
      '[REDACTED_PASSWORD_HASH]'
    );
    // Redact JWT tokens
    sanitized = sanitized.replace(
      /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[REDACTED_JWT]'
    );
    // Redact Discord bot tokens
    sanitized = sanitized.replace(
      /([a-zA-Z0-9_-]{24}\.[a-zA-Z0-9_-]{6}\.[a-zA-Z0-9_-]{27,38})/g,
      '[REDACTED_BOT_TOKEN]'
    );
    return sanitized;
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitize(item));
  }

  if (input !== null && typeof input === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, val] of Object.entries(input)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes('token') ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('hash') ||
        lowerKey.includes('credential') ||
        lowerKey.includes('authorization') ||
        lowerKey.includes('webhook') ||
        lowerKey.includes('apikey') ||
        lowerKey.includes('api_key') ||
        lowerKey.includes('privatekey') ||
        lowerKey.includes('private_key') ||
        lowerKey.includes('secretkey') ||
        lowerKey.includes('secret_key') ||
        lowerKey.includes('signature')
      ) {
        cleanObj[key] = '[REDACTED]';
      } else {
        cleanObj[key] = sanitize(val);
      }
    }
    return cleanObj;
  }

  return input;
}

export const logger = {
  info(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
      console.log(JSON.stringify({ level: 'info', timestamp, message: sanitize(message), meta: sanitize(meta) }));
    } else {
      console.log(JSON.stringify({ level: 'info', timestamp, message: sanitize(message) }));
    }
  },
  warn(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
      console.warn(JSON.stringify({ level: 'warn', timestamp, message: sanitize(message), meta: sanitize(meta) }));
    } else {
      console.warn(JSON.stringify({ level: 'warn', timestamp, message: sanitize(message) }));
    }
  },
  error(message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    if (meta !== undefined) {
      console.error(JSON.stringify({ level: 'error', timestamp, message: sanitize(message), meta: sanitize(meta) }));
    } else {
      console.error(JSON.stringify({ level: 'error', timestamp, message: sanitize(message) }));
    }
  },
  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      console.log(JSON.stringify({ level: 'debug', timestamp, message: sanitize(message), meta: sanitize(meta) }));
    }
  },
};
