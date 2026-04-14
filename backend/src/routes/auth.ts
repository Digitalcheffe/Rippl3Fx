import { Router, Request, Response } from 'express';
import db from '../db/connection';
import { hashPassword, comparePassword } from '../auth/bcrypt';
import { signToken } from '../auth/jwt';
import { generateSecret, generateQRCode, verifyCode } from '../auth/totp';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { clearWeekStartCache } from '../utils/week';
import { rerollWeeklyData } from '../rollup/weekly';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// GET /api/auth/status — first-run detection
router.get('/status', asyncHandler((_req: Request, res: Response) => {
  const user = db.prepare('SELECT id FROM user LIMIT 1').get();
  res.json({ configured: !!user });
}));

// POST /api/auth/setup — create first user
router.post('/setup', asyncHandler(async (req: Request, res: Response) => {
  const existing = db.prepare('SELECT id FROM user LIMIT 1').get();
  if (existing) {
    res.status(400).json({ error: 'User already configured' });
    return;
  }

  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const passwordHash = await hashPassword(password);
  db.prepare('INSERT INTO user (username, password_hash) VALUES (?, ?)').run(username, passwordHash);

  const user = db.prepare('SELECT id FROM user WHERE username = ?').get(username) as { id: number };
  const token = signToken(user.id);

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.json({ success: true });
}));

// POST /api/auth/login — authenticate user
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password, totpCode } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  const user = db.prepare('SELECT id, password_hash, totp_enabled, totp_secret FROM user WHERE username = ?')
    .get(username) as { id: number; password_hash: string; totp_enabled: number; totp_secret: string | null } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // If TOTP enabled, require code
  if (user.totp_enabled && user.totp_secret) {
    if (!totpCode) {
      res.json({ totpRequired: true });
      return;
    }
    if (!verifyCode(user.totp_secret, totpCode)) {
      res.status(401).json({ error: 'Invalid TOTP code' });
      return;
    }
  }

  const token = signToken(user.id);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({ success: true });
}));

// POST /api/auth/logout
router.post('/logout', asyncHandler((_req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ success: true });
}));

// GET /api/auth/me — get current user (protected)
router.get('/me', requireAuth, asyncHandler((req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = db.prepare('SELECT id, username, totp_enabled, week_start_day, created_at FROM user WHERE id = ?')
    .get(req.user.userId) as { id: number; username: string; totp_enabled: number; week_start_day: number; created_at: string } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
}));

// PUT /api/auth/week-start — update week start day preference (protected)
router.put('/week-start', requireAuth, asyncHandler((req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { weekStartDay } = req.body;
  if (typeof weekStartDay !== 'number' || weekStartDay < 0 || weekStartDay > 6) {
    res.status(400).json({ error: 'weekStartDay must be 0 (Sun) through 6 (Sat)' });
    return;
  }
  db.prepare('UPDATE user SET week_start_day = ? WHERE id = ?').run(weekStartDay, req.user.userId);
  clearWeekStartCache();
  res.json({ success: true, weekStartDay });
  // Re-rollup weekly data async — don't block the response
  try { rerollWeeklyData(weekStartDay); } catch (err: any) {
    console.error(`[Auth] Weekly re-rollup failed: ${err.message}`);
  }
}));

// POST /api/auth/totp/setup — generate TOTP secret + QR (protected)
router.post('/totp/setup', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const user = db.prepare('SELECT username, totp_enabled FROM user WHERE id = ?')
    .get(req.user.userId) as { username: string; totp_enabled: number } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const secret = generateSecret();
  // Store secret temporarily — not enabled until verified
  db.prepare('UPDATE user SET totp_secret = ? WHERE id = ?').run(secret.base32, req.user.userId);

  const qrCode = await generateQRCode(secret.base32, user.username);
  res.json({ secret: secret.base32, qrCode });
}));

// POST /api/auth/totp/verify — verify TOTP code and enable (protected)
router.post('/totp/verify', requireAuth, asyncHandler((req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: 'TOTP code required' });
    return;
  }

  const user = db.prepare('SELECT totp_secret FROM user WHERE id = ?')
    .get(req.user.userId) as { totp_secret: string | null } | undefined;

  if (!user?.totp_secret) {
    res.status(400).json({ error: 'TOTP not set up — call /api/auth/totp/setup first' });
    return;
  }

  if (!verifyCode(user.totp_secret, code)) {
    res.status(400).json({ error: 'Invalid TOTP code' });
    return;
  }

  db.prepare('UPDATE user SET totp_enabled = 1 WHERE id = ?').run(req.user.userId);
  res.json({ success: true, totpEnabled: true });
}));

// POST /api/auth/totp/disable — disable TOTP (protected)
router.post('/totp/disable', requireAuth, asyncHandler((req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  db.prepare('UPDATE user SET totp_enabled = 0, totp_secret = NULL WHERE id = ?').run(req.user.userId);
  res.json({ success: true, totpEnabled: false });
}));

// POST /api/auth/change-password (protected)
router.post('/change-password', requireAuth, asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password required' });
    return;
  }

  const user = db.prepare('SELECT password_hash FROM user WHERE id = ?')
    .get(req.user.userId) as { password_hash: string } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const valid = await comparePassword(currentPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await hashPassword(newPassword);
  db.prepare('UPDATE user SET password_hash = ? WHERE id = ?').run(newHash, req.user.userId);
  res.json({ success: true });
}));

export default router;
