import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { migrate } from './db/migrate';
import { authMiddleware } from './middleware/auth';
import { generateCsrfToken } from './middleware/csrf';
import { apiLimiter } from './middleware/rateLimiter';
import authRouter from './routes/auth';
import accountsRouter from './routes/accounts';
import itemsRouter from './routes/items';
import tagsRouter from './routes/tags';
import metricsRouter from './routes/metrics';
import logsRouter from './routes/logs';
import discoverRouter from './routes/discover';
import performanceRouter from './routes/performance';
import eventsRouter from './routes/events';
import * as scheduler from './poller/scheduler';

// Run migrations before anything else
migrate();

// Start polling scheduler
scheduler.start();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());
app.use(cookieParser());
// CSRF token endpoint — frontend calls this to get a token for mutation requests
app.get('/api/csrf-token', apiLimiter, (req, res) => {
  const token = generateCsrfToken(req, res);
  res.json({ token });
});

// Health check (no auth)
app.get('/api/health', apiLimiter, (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required, strict rate limit)
app.use('/api/auth', authRouter);

// JWT middleware for all other /api routes
app.use(authMiddleware);

// Protected routes
app.use('/api/accounts', accountsRouter);
app.use('/api/items', itemsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api', metricsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/accounts', discoverRouter);
app.use('/api/performance', performanceRouter);
app.use('/api/events', eventsRouter);

// Global error handler — must be after all routes, before SPA fallback
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error]', err.message || err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', apiLimiter, (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rippl3FX running on port ${PORT}`);
});
