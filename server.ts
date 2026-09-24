import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { apiRouter } from './src/server/routes/api.ts';
import { handleDiscordInteractions } from './src/server/discord/interactions.ts';
import { ensureDefaultAdmin, getSessionSecret } from './src/server/auth/index.ts';
import { getDb } from './src/server/db/index.ts';
import { logger } from './src/server/utils/logger.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Security: HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS Configuration: enforce CLIENT_ORIGIN in production
const clientOrigin = process.env.CLIENT_ORIGIN?.trim();
const corsOptions: cors.CorsOptions = {
  origin: isProduction
    ? (clientOrigin ? clientOrigin.split(',').map(s => s.trim()) : false)
    : true,
  credentials: true,
};

app.use(cors(corsOptions));

// Cookie Parser
app.use(cookieParser());

// Crucial: Raw Body capture for Discord Interactions signature verification
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
    limit: '2mb',
  })
);

app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Health Check Endpoint
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'discord-interops-admin',
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Public Discord Interactions Webhook Endpoint
// Note: Must be reachable without admin authentication
app.post('/api/discord/interactions', handleDiscordInteractions);

// Admin API Routes
app.use('/api', apiRouter);

// Global Error Handler (prevents leaking internal stack traces or secrets)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled server exception', {
    message: err.message || 'Internal error',
  });

  res.status(err.status || 500).json({
    error: isProduction ? 'An unexpected internal error occurred.' : (err.message || 'Internal Server Error'),
  });
});

async function startServer() {
  try {
    // 0. Validate required secrets (fails startup if SESSION_SECRET is missing in production)
    getSessionSecret();

    // 1. Initialize DB and seed default admin (fails startup if DATABASE_URL is missing in production)
    await getDb();
    await ensureDefaultAdmin();

    // 2. Setup Vite in development or static serving in production
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      logger.info('Vite development middleware attached');
    } else {
      const distPath = path.resolve('dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (_req: Request, res: Response) => {
          res.sendFile(path.resolve(distPath, 'index.html'));
        });
        logger.info('Serving production static build from dist');
      } else {
        logger.warn('Production build dist folder not found. Run "npm run build" first.');
      }
    }

    app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Server running on http://0.0.0.0:${PORT} [${isProduction ? 'production' : 'development'}]`);
    });
  } catch (err: any) {
    logger.error('Failed to initialize server', { error: err.message });
    process.exit(1);
  }
}

// Start server unless imported in testing
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer();
}

export { app };
