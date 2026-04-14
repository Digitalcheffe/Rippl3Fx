import { Request, Response, NextFunction } from 'express';

/**
 * CSRF protection for JSON APIs.
 *
 * Browsers enforce that cross-origin requests with Content-Type: application/json
 * trigger a CORS preflight. Since our CORS config only allows the same origin,
 * a cross-site form submission cannot set this header — making it an effective
 * CSRF guard for API routes.
 *
 * This middleware rejects non-GET/HEAD/OPTIONS requests that don't send
 * Content-Type: application/json, which blocks cross-site form POSTs.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe methods don't mutate — skip
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    res.status(403).json({ error: 'Forbidden: Content-Type must be application/json' });
    return;
  }

  next();
}
