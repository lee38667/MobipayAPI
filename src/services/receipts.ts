import fs from 'fs';
import path from 'path';

const receiptsDir = process.env.RECEIPTS_DIR || './receipts';
if (!fs.existsSync(receiptsDir)) fs.mkdirSync(receiptsDir, { recursive: true });

export const receipts = {
  async generatePaymentReceipt(input: { transaction_id: string; account: string; amount: number; currency: string; paid_for: number | string; }): Promise<string> {
    const filepath = path.join(receiptsDir, `${input.transaction_id}.txt`);
    const content = `Transaction: ${input.transaction_id}\nAccount: ${input.account}\nAmount: ${input.amount} ${input.currency}\nPaid For: ${input.paid_for} months`;
    await fs.promises.writeFile(filepath, content, 'utf-8');
    return filepath;
  },
  async generateTrialConfirmation(input: { email: string; username: string; }): Promise<string> {
    const name = `trial-${Date.now()}.txt`;
    const filepath = path.join(receiptsDir, name);
    const content = `Trial confirmation for ${input.email}\nUsername: ${input.username}`;
    await fs.promises.writeFile(filepath, content, 'utf-8');
    return filepath;
  }
};
