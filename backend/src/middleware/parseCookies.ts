import { Request, Response, NextFunction } from 'express';

/**
 * Lightweight cookie parser middleware.
 * Parses the Cookie header into req.cookies without using the cookie-parser package.
 */
export function parseCookies(req: Request, _res: Response, next: NextFunction): void {
  if (!req.cookies) {
    req.cookies = {};
  }
  const header = req.headers.cookie;
  if (header) {
    for (const pair of header.split(';')) {
      const idx = pair.indexOf('=');
      if (idx < 0) continue;
      const key = pair.substring(0, idx).trim();
      const val = pair.substring(idx + 1).trim();
      try {
        req.cookies[key] = decodeURIComponent(val);
      } catch {
        req.cookies[key] = val;
      }
    }
  }
  next();
}
