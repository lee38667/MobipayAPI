process.env.PROMAX_API_KEY = process.env.PROMAX_API_KEY || 'test-key';
process.env.MOBIPAY_HMAC_SECRET = process.env.MOBIPAY_HMAC_SECRET || 'test-secret';
process.env.MOBIPAY_HMAC_KEY_ID = process.env.MOBIPAY_HMAC_KEY_ID || 'test-key-id';

import request from 'supertest';
import app from '../src/index';

describe('Smoke tests', () => {
  it('GET /health should return ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
