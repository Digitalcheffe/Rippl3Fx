import { doubleCsrf } from 'csrf-csrf';
import { Request } from 'express';
import { getConfig } from '../config';

const {
  doubleCsrfProtection,
  generateCsrfToken,
} = doubleCsrf({
  getSecret: () => getConfig().jwt_secret,
  getSessionIdentifier: (req: Request) => req.cookies?.token || req.ip || 'anonymous',
  cookieName: '__csrf',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
  getCsrfTokenFromRequest: (req: Request) =>
    req.headers['x-csrf-token'] as string || '',
});

export { doubleCsrfProtection, generateCsrfToken };
