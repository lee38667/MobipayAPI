import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { getReceiptsDir } from '../config';

const receiptsDir = getReceiptsDir();
type PdfDoc = InstanceType<typeof PDFDocument>;

async function writePdf(filename: string, build: (doc: PdfDoc) => void): Promise<string> {
  const filepath = path.join(receiptsDir, filename);
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filepath);
    doc.pipe(stream);
    try {
      build(doc);
      doc.end();
    } catch (err) {
      doc.end();
      stream.close();
      reject(err);
      return;
    }
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
  return filepath;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const receipts = {
  async generatePaymentReceipt(input: { transaction_id: string; account: string; amount: number; currency: string; paid_for: number | string; timestamp?: string; }): Promise<string> {
    const filename = `${input.transaction_id}.pdf`;
    return writePdf(filename, doc => {
      doc.fontSize(20).text('Mobipay Payment Receipt', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Transaction ID: ${input.transaction_id}`);
      doc.text(`Account: ${input.account}`);
      doc.text(`Subscription Length: ${input.paid_for} months`);
      doc.text(`Amount Paid: ${formatCurrency(Number(input.amount), input.currency)}`);
      if (input.timestamp) {
        doc.text(`Timestamp: ${input.timestamp}`);
      }
      doc.moveDown();
      doc.text('Thank you for your purchase!', { align: 'center' });
    });
  },

  async generateTrialConfirmation(input: { email: string; username: string; issued_at?: string; }): Promise<string> {
    const filename = `trial-${Date.now()}.pdf`;
    return writePdf(filename, doc => {
      doc.fontSize(18).text('Mobipay Trial Credentials', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Email: ${input.email}`);
      doc.text(`Username: ${input.username}`);
      if (input.issued_at) doc.text(`Issued At: ${input.issued_at}`);
      doc.moveDown();
      doc.text('Enjoy your trial access!', { align: 'center' });
    });
  }
};
