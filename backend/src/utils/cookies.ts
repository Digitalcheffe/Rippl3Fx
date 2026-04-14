import { Request } from 'express';

/** Parse a specific cookie value from the raw Cookie header — no cookieParser needed. */
export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  const match = header.split(';').find(c => c.trim().startsWith(`${name}=`));
  if (!match) return undefined;
  return decodeURIComponent(match.split('=')[1].trim());
}
