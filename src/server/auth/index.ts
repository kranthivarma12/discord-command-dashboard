import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.ts';
import { admins, actionLogs } from '../db/schema.ts';
import { logger } from '../utils/logger.ts';

let devFallbackSecret: string | null = null;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET environment variable is required in production.');
    }
    if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
      return 'test-session-secret-vitest-secure-key-32chars';
    }
    if (!devFallbackSecret) {
      devFallbackSecret = crypto.randomBytes(32).toString('hex');
      logger.warn(
        'SESSION_SECRET is not set in environment or .env file. Using a cryptographically secure random in-memory secret for local development.'
      );
    }
    return devFallbackSecret;
  }
  return secret.trim();
}

const COOKIE_NAME = 'admin_session';

export interface AdminSessionPayload {
  id: number;
  username: string;
  role: string;
}

export function generateToken(payload: AdminSessionPayload): string {
  return jwt.sign(payload, getSessionSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): AdminSessionPayload | null {
  try {
    return jwt.verify(token, getSessionSecret()) as AdminSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Express middleware to enforce admin authentication on protected endpoints.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check cookie or Bearer token header
  let token = req.cookies?.[COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    return;
  }

  const session = verifyToken(token);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized: Session invalid or expired.' });
    return;
  }

  (req as any).user = session;
  next();
}

/**
 * Initializes default admin user if no admins currently exist and credentials are provided.
 * Never creates a hard-coded or default fallback password.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const db = await getDb();
  const existing = await db.select().from(admins).limit(1);

  if (existing.length === 0) {
    const defaultUsername = (process.env.ADMIN_DEFAULT_USER || process.env.ADMIN_DEFAULT_USERNAME)?.trim();
    const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD?.trim();

    if (!defaultUsername || !defaultPassword) {
      logger.warn(
        'No administrator account found in database. Initial account creation skipped because ADMIN_DEFAULT_USER and ADMIN_DEFAULT_PASSWORD environment variables are not set.'
      );
      return;
    }

    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await db.insert(admins).values({
      username: defaultUsername,
      passwordHash,
      role: 'superadmin',
    });

    logger.info('Initialized default administrator account', {
      username: defaultUsername,
      defaultAccountCreated: true,
    });
  }
}

/**
 * Mask secret strings so they are never leaked to client browsers.
 */
export function maskSecret(secret: string | null | undefined): string {
  if (!secret || secret.trim() === '') return '';
  return '••••••••••••••••';
}
