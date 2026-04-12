import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { migrate } from './db/migrate';
import { authMiddleware } from './middleware/auth';
import authRouter from './routes/auth';
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

// Health check (no auth)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (no auth required)
app.use('/api/auth', authRouter);

// JWT middleware for all other /api routes
app.use(authMiddleware);

// Serve frontend static files
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// SPA fallback — serve index.html for all non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Rippl3FX running on port ${PORT}`);
});
