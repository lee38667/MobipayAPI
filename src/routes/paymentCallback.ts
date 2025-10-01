import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';
import { pricing } from '../services/pricing';
import { receipts } from '../services/receipts';
import { email } from '../services/email';
import { store } from '../store/memory';

export async function paymentCallbackHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { transaction_id, account, amount, currency, paid_for, receipt_file, timestamp } = req.body || {};
    if (!transaction_id || !account || amount == null || !currency || !paid_for || !timestamp) {
      return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'Missing required fields' });
    }

    // Idempotency check
    const existing = store.transactions.get(transaction_id);
    if (existing) {
      return res.status(409).json({ status: 'error', code: 'duplicate_transaction', message: 'Already processed' });
    }

    // Pricing rule enforcement
    const expected = pricing.expectedAmount(Number(paid_for));
    if (expected == null || Number(amount) !== expected) {
      return res.status(400).json({ status: 'error', code: 'amount_mismatch', message: `Amount must equal ${expected}` });
    }

    // Determine user existence
    const device = await promaxClient.deviceInfo({ account, type: 'auto' });
    let promax_action: 'new' | 'renew' = 'renew';
    let promax_response: any;
    if (!device) {
      promax_action = 'new';
      promax_response = await promaxClient.createUser({ account, months: Number(paid_for) });
    } else {
      promax_response = await promaxClient.renewUser({ username: device.username, months: Number(paid_for) });
      if (device.enabled === '0') {
        await promaxClient.enableDevice({ username: device.username });
      }
    }

    // Generate receipt and send email (email address unknown in PRD lookup response; stubbed)
    const receiptPath = await receipts.generatePaymentReceipt({ transaction_id, account, amount, currency, paid_for });
    await email.send({ to: 'customer@example.com', subject: 'Payment Receipt', text: `Tx ${transaction_id} successful`, attachments: [{ path: receiptPath }] });

    // Persist transaction
    store.transactions.set(transaction_id, { transaction_id, account, amount, currency, paid_for, promax_action, promax_response, receipt_path: receiptPath, status: 'verified' });

    return res.json({ status: 'ok', promax_action, promax_response, receipt_url: receiptPath });
  } catch (err) {
    next(err);
  }
}
