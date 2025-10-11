import fs from 'fs';
import path from 'path';

const DEFAULT_PROMAX_BASE_URL = 'https://api.promax-dash.com/api.php';
const DEFAULT_PROMAX_TIMEOUT_MS = 8000;
const DEFAULT_BOUQUET_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_PORT = 3000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw Object.assign(new Error(`${name} environment variable is required`), { code: 'config_missing', status: 500 });
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const receiptsDir = process.env.RECEIPTS_DIR || path.resolve(process.cwd(), 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

const hmacKeyId = requireEnv('MOBIPAY_HMAC_KEY_ID');
const hmacSecret = requireEnv('MOBIPAY_HMAC_SECRET');

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: optionalInt('PORT', DEFAULT_PORT),
  promax: {
    baseURL: process.env.PROMAX_BASE_URL || DEFAULT_PROMAX_BASE_URL,
    apiKey: requireEnv('PROMAX_API_KEY'),
    timeoutMs: optionalInt('PROMAX_TIMEOUT_MS', DEFAULT_PROMAX_TIMEOUT_MS),
    bouquetCacheTtlMs: optionalInt('PROMAX_BOUQUET_CACHE_TTL_MS', DEFAULT_BOUQUET_CACHE_TTL_MS)
  },
  hmac: {
    keyId: hmacKeyId,
    skewSeconds: optionalInt('HMAC_CLOCK_SKEW_SECONDS', 300),
    secretByKeyId: new Map([[hmacKeyId, hmacSecret]])
  },
  receipts: {
    dir: receiptsDir
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  }
};

export function getPromaxApiKey(): string {
  return config.promax.apiKey;
}

export function getPromaxBaseUrl(): string {
  return config.promax.baseURL;
}

export function getPromaxTimeout(): number {
  return config.promax.timeoutMs;
}

export function getPromaxBouquetCacheTtl(): number {
  return config.promax.bouquetCacheTtlMs;
}

export function getHmacSecretForKeyId(keyId: string): string | undefined {
  return config.hmac.secretByKeyId.get(keyId);
}

export function getHmacSkewSeconds(): number {
  return config.hmac.skewSeconds;
}

export function getReceiptsDir(): string {
  return config.receipts.dir;
}

export function getEmailFrom(): string {
  return config.email.from;
}
