import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';

const allowedSubscriptions = new Set([1, 3, 6, 12]);

type PromaxResponse = any;

function extractPrimaryRecord(payload: PromaxResponse): any {
  if (Array.isArray(payload)) {
    return payload[0];
  }
  return payload;
}

function isPromaxSuccess(payload: PromaxResponse): boolean {
  const primary = extractPrimaryRecord(payload);
  const status = primary?.status;
  if (typeof status === 'boolean') return status;
  if (status == null) return false;
  return String(status).toLowerCase() === 'true' || status === 1 || status === '1';
}

function extractMessage(payload: PromaxResponse): string | undefined {
  const primary = extractPrimaryRecord(payload);
  return primary?.message || primary?.messasge || primary?.error || primary?.description;
}

export async function extendSubscriptionHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, sub } = req.body || {};
    const months = Number(sub);
    if (!username || !password) {
      return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'username and password are required' });
    }
    if (!Number.isFinite(months) || !allowedSubscriptions.has(months)) {
      return res.status(400).json({ status: 'error', code: 'invalid_subscription', message: 'sub must be one of: 1, 6, 12' });
    }

    const upstream = await promaxClient.extendLineSubscription({ username, password, months });
    if (!isPromaxSuccess(upstream)) {
      return res.status(502).json({ status: 'error', code: 'upstream_failure', message: extractMessage(upstream) || 'Promax rejected request', upstream });
    }

    return res.json({ status: 'ok', upstream });
  } catch (err: any) {
    if (err.upstream === 'promax') {
      return res.status(502).json({ status: 'error', code: 'upstream_unavailable', message: 'Promax unavailable' });
    }
    next(err);
  }
}

export async function clientInfoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, mac } = req.body || {};
    if ((!username && !mac) || !password) {
      return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'password and either username or mac are required' });
    }

    const upstream = await promaxClient.lineClientInfo({ username, password, mac });
    if (!isPromaxSuccess(upstream)) {
      return res.status(404).json({ status: 'invalid', message: extractMessage(upstream) || 'username not available please register on www.jsiptv.africa', upstream });
    }

    const client = extractPrimaryRecord(upstream);
    return res.json({ status: 'ok', client, upstream });
  } catch (err: any) {
    if (err.upstream === 'promax') {
      return res.status(502).json({ status: 'error', code: 'upstream_unavailable', message: 'Promax unavailable' });
    }
    next(err);
  }
}
