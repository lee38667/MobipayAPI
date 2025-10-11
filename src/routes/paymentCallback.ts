import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';
import { pricing } from '../services/pricing';
import { receipts } from '../services/receipts';
import { email } from '../services/email';
import { store } from '../store/memory';

export async function paymentCallbackHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { transaction_id, account, amount, currency, paid_for, receipt_file, timestamp } = req.body || {};
    const txnId = String(transaction_id || '').trim();
    const accountId = String(account || '').trim();
    const currencyCode = String(currency || '').trim().toUpperCase();
    const bodyTimestamp = String(timestamp || '').trim();
    const amountNumber = Number(amount);
    if (!txnId || !accountId || !Number.isFinite(amountNumber) || !currencyCode || paid_for == null || !bodyTimestamp) {
      return res.status(400).json({ status: 'error', code: 'invalid_input', message: 'Missing required fields' });
    }

    // Idempotency check
  const existing = store.transactions.get(txnId);
    if (existing) {
      return res.status(409).json({ status: 'error', code: 'duplicate_transaction', message: 'Already processed' });
    }

    // Pricing rule enforcement
  const duration = Number(paid_for);
    if (!pricing.allowedDurations().includes(duration)) {
      return res.status(400).json({ status: 'error', code: 'invalid_subscription', message: 'paid_for must be one of the configured package durations' });
    }

    const expected = pricing.expectedAmount(duration);
    if (expected == null || amountNumber !== expected) {
      return res.status(400).json({ status: 'error', code: 'amount_mismatch', message: `Amount must equal ${expected}` });
    }

    // Determine user existence
    const device = await promaxClient.deviceInfo({ account: accountId, type: 'auto' });
    let promax_action: 'new' | 'renew' = 'renew';
    let promax_response: any;
    if (!device) {
      promax_action = 'new';
      promax_response = await promaxClient.createUser({ account: accountId, months: duration });
    } else {
      promax_response = await promaxClient.renewUser({ username: device.username, months: duration });
      if (device.enabled === '0') {
        await promaxClient.enableDevice({ username: device.username });
      }
    }

    // Generate receipt and send email (email address unknown in PRD lookup response; stubbed)
    const receiptPath = await receipts.generatePaymentReceipt({ transaction_id: txnId, account: accountId, amount: amountNumber, currency: currencyCode, paid_for: duration, timestamp: bodyTimestamp });
    await email.send({ to: 'customer@example.com', subject: 'Payment Receipt', text: `Tx ${txnId} successful`, attachments: [{ path: receiptPath }] });

    // Persist transaction
    store.transactions.set(txnId, { transaction_id: txnId, account: accountId, amount: amountNumber, currency: currencyCode, paid_for: duration, promax_action, promax_response, receipt_path: receiptPath, status: 'verified' });

    return res.json({ status: 'ok', promax_action, promax_response, receipt_url: receiptPath });
  } catch (err) {
    next(err);
  }
}
