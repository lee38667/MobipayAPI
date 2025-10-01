import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';
import { pricing } from '../services/pricing';

export async function lookupHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const account = String(req.query.account || '').trim();
    const type = (String(req.query.type || 'auto').toLowerCase());
    if (!account) return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'account is required' });
    if (!['mag', 'm3u', 'auto'].includes(type)) {
      return res.status(400).json({ status: 'error', code: 'invalid_type', message: 'type must be one of: mag, m3u, auto' });
    }

    const device = await promaxClient.deviceInfo({ account, type: type as any });
    if (!device) return res.status(404).json({ status: 'not_found', message: 'Account not found' });

    const due_amount = pricing.computeDueAmount(device);
    return res.json({
      status: 'ok',
      client: device,
      due_amount,
      currency: pricing.currency(),
      allowed_subscriptions: [1, 3, 6, 12],
      message: 'Account found. Due amount computed.'
    });
  } catch (err) {
    next(err);
  }
}
