import crypto from 'crypto';
import { getConfig } from '../config';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getKey(): Buffer {
  const key = getConfig().encryption_key;
  // Ensure 32-byte key by hashing
  return crypto.createHash('sha256').update(key).digest();
}

export function encryptCredentials(obj: object): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(obj);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  // Store as iv:encrypted, both hex-encoded
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptCredentials<T = object>(encrypted: string): T {
  const key = getKey();
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
