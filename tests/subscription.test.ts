process.env.PROMAX_API_KEY = process.env.PROMAX_API_KEY || 'test-key';
process.env.MOBIPAY_HMAC_SECRET = process.env.MOBIPAY_HMAC_SECRET || 'test-secret';
process.env.MOBIPAY_HMAC_KEY_ID = process.env.MOBIPAY_HMAC_KEY_ID || 'test-key-id';

import request from 'supertest';
import app from '../src/index';

jest.mock('../src/services/promaxClient', () => {
  const actual = jest.requireActual('../src/services/promaxClient');
  return {
    ...actual,
    promaxClient: {
      ...actual.promaxClient,
      extendLineSubscription: jest.fn(),
      lineClientInfo: jest.fn()
    }
  };
});

import { promaxClient } from '../src/services/promaxClient';

const extendMock = promaxClient.extendLineSubscription as unknown as jest.Mock;
const infoMock = promaxClient.lineClientInfo as unknown as jest.Mock;

describe('Subscription routes', () => {
  beforeEach(() => {
    extendMock.mockReset();
    infoMock.mockReset();
  });

  describe('POST /api/v1/subscription/extend', () => {
    it('rejects missing credentials', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/extend')
        .send({ username: 'useronly' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_input');
      expect(extendMock).not.toHaveBeenCalled();
    });

    it('rejects unsupported subscription length', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/extend')
        .send({ username: 'user', password: 'pass', sub: 2 });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_subscription');
      expect(extendMock).not.toHaveBeenCalled();
    });

    it('accepts 3-month subscription extension', async () => {
      const upstreamPayload = [{ status: 'true', messasge: 'M3U renew successful' }];
      extendMock.mockResolvedValueOnce(upstreamPayload);

      const res = await request(app)
        .post('/api/v1/subscription/extend')
        .send({ username: 'user', password: 'pass', sub: 3 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(extendMock).toHaveBeenCalledWith({ username: 'user', password: 'pass', months: 3 });
    });

    it('returns upstream payload on success', async () => {
      const upstreamPayload = [{ status: 'true', messasge: 'M3U renew successful' }];
      extendMock.mockResolvedValueOnce(upstreamPayload);

      const res = await request(app)
        .post('/api/v1/subscription/extend')
        .send({ username: 'user', password: 'pass', sub: 12 });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.upstream).toEqual(upstreamPayload);
      expect(extendMock).toHaveBeenCalledWith({ username: 'user', password: 'pass', months: 12 });
    });

    it('propagates upstream failures', async () => {
      const upstreamPayload = [{ status: 'false', messasge: 'Insufficient balance' }];
      extendMock.mockResolvedValueOnce(upstreamPayload);

      const res = await request(app)
        .post('/api/v1/subscription/extend')
        .send({ username: 'user', password: 'pass', sub: 6 });

      expect(res.status).toBe(502);
      expect(res.body.status).toBe('error');
      expect(res.body.upstream).toEqual(upstreamPayload);
    });
  });

  describe('POST /api/v1/subscription/info', () => {
    it('requires password and identifier', async () => {
      const res = await request(app)
        .post('/api/v1/subscription/info')
        .send({ username: 'user' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('invalid_input');
      expect(infoMock).not.toHaveBeenCalled();
    });

    it('returns client info on success', async () => {
      const upstreamPayload = [{ status: 'true', username: 'user', expire: '2025-12-31' }];
      infoMock.mockResolvedValueOnce(upstreamPayload);

      const res = await request(app)
        .post('/api/v1/subscription/info')
        .send({ username: 'user', password: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.client).toEqual(upstreamPayload[0]);
      expect(res.body.upstream).toEqual(upstreamPayload);
      expect(infoMock).toHaveBeenCalledWith({ username: 'user', password: 'pass', mac: undefined });
    });

    it('returns invalid when upstream indicates missing user', async () => {
      const upstreamPayload = [{ status: 'false', messasge: 'Not found' }];
      infoMock.mockResolvedValueOnce(upstreamPayload);

      const res = await request(app)
        .post('/api/v1/subscription/info')
        .send({ username: 'user', password: 'pass' });

      expect(res.status).toBe(404);
      expect(res.body.status).toBe('invalid');
      expect(res.body.upstream).toEqual(upstreamPayload);
    });
  });
});
