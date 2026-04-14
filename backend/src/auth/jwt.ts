import jwt from 'jsonwebtoken';
import { getConfig } from '../config';

const EXPIRY = '7d';

export function signToken(userId: number): string {
  return jwt.sign({ userId }, getConfig().jwt_secret, { expiresIn: EXPIRY });
}

export function verifyToken(token: string): { userId: number } {
  return jwt.verify(token, getConfig().jwt_secret) as { userId: number };
}
