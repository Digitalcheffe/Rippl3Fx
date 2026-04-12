import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

export function generateSecret(): speakeasy.GeneratedSecret {
  return speakeasy.generateSecret({
    name: 'Rippl3FX',
    issuer: 'Rippl3FX',
  });
}

export async function generateQRCode(secret: string, username: string): Promise<string> {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    encoding: 'base32',
    label: `Rippl3FX:${username}`,
    issuer: 'Rippl3FX',
  });
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyCode(secret: string, code: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 1,
  });
}
