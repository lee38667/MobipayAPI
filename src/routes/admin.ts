import { Router, Request, Response } from 'express';
import { store } from '../store/memory';
import { email } from '../services/email';

export const adminRouter = Router();

adminRouter.get('/transactions/:id', (req: Request, res: Response) => {
  const id = req.params.id;
  const tx = store.transactions.get(id);
  if (!tx) return res.status(404).json({ status: 'not_found', message: 'Transaction not found' });
  return res.json({ status: 'ok', transaction: tx });
});

adminRouter.post('/clients/:username/resend-receipt', async (req: Request, res: Response) => {
  const username = req.params.username;
  const client = store.clients.get(username);
  if (!client) return res.status(404).json({ status: 'not_found', message: 'Client not found' });
  // naive: find last tx by account
  const tx = Array.from(store.transactions.values()).reverse().find(t => t.account === username);
  if (!tx) return res.status(404).json({ status: 'not_found', message: 'No transaction found to resend' });
  await email.send({ to: client.email || 'customer@example.com', subject: 'Your receipt', text: `Receipt for ${tx.transaction_id}`, attachments: [{ path: tx.receipt_path }] });
  return res.json({ status: 'ok' });
});
