import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';
import { email } from '../services/email';
import { receipts } from '../services/receipts';
import { store } from '../store/memory';

export async function registerHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { account_reference, email: emailAddr, fullname, device_type, pack_id, trial_days } = req.body || {};
    if (!emailAddr) return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'email is required' });
    if (!['m3u', 'mag'].includes(device_type)) return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'device_type must be m3u or mag' });
    if (!pack_id) return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'pack_id is required' });

    const trial = await promaxClient.createTrial({ account_reference, email: emailAddr, fullname, device_type, pack_id, trial_days });
    // Save a simple confirmation PDF (stub)
    const receiptPath = await receipts.generateTrialConfirmation({ email: emailAddr, username: trial.username });
  await email.send({ to: emailAddr, subject: 'Your trial credentials', text: `Username: ${trial.username}\nPassword: ${trial.password}`, attachments: [{ path: receiptPath }] });
  store.clients.set(trial.username, { user_id: trial.user_id, username: trial.username, email: emailAddr, account_reference });

    return res.json({ status: 'ok', promax_user_id: trial.user_id, username: trial.username, password: trial.password });
  } catch (err: any) {
    if (err.upstream === 'promax') {
      return res.status(502).json({ status: 'error', code: 'upstream_failure', message: 'Promax unavailable' });
    }
    next(err);
  }
}
