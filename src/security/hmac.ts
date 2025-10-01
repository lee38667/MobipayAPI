import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

function getSecretForKeyId(_keyId: string): string {
  return process.env.MOBIPAY_HMAC_SECRET || '';
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function hmacAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('Authorization') || '';
    if (!header.startsWith('HMAC')) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Missing HMAC' });
    // Example: HMAC key_id=demo-key, algorithm=hmac-sha256, signature=BASE64, timestamp=ISO
  const parts = Object.fromEntries(header.replace(/^HMAC\s*/i, '').split(',').map((x: string) => x.trim().split('=')) as any);
    const key_id = parts['key_id'];
    const signature = (parts['signature'] || '').replace(/^"|"$/g, '');
    const algorithm = parts['algorithm'] || 'hmac-sha256';
    const timestamp = (parts['timestamp'] || '').replace(/^"|"$/g, '');
    if (!key_id || !signature || !timestamp) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Invalid HMAC header' });

    const secret = getSecretForKeyId(key_id);
    if (!secret) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Unknown key' });

    const method = req.method.toUpperCase();
    const path = req.originalUrl.split('?')[0];
    const contentType = (req.header('content-type') || '').toLowerCase();
    const bodyString = JSON.stringify(req.body || {});
    const bodyHash = crypto.createHash('sha256').update(bodyString).digest('hex');
    const stringToSign = [method, path, contentType, timestamp, bodyHash].join('\n');
    const computed = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
    if (!safeEqual(signature, computed)) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Invalid signature' });

    const skew = Number(process.env.HMAC_CLOCK_SKEW_SECONDS || 300);
    const ts = Date.parse(timestamp);
    if (!Number.isFinite(ts)) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Invalid timestamp' });
    const now = Date.now();
    if (Math.abs(now - ts) > skew * 1000) return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Stale request' });

    next();
  } catch (e) {
    return res.status(401).json({ status: 'error', code: 'unauthorized', message: 'Signature check failed' });
  }
}
