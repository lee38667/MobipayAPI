import { Request, Response, NextFunction } from 'express';
import { promaxClient } from '../services/promaxClient';

export async function bouquetsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await promaxClient.bouquets();
    res.json({ status: 'ok', bouquets: data });
  } catch (err: any) {
    return res.status(502).json({ status: 'error', code: 'upstream_failure', message: 'Promax unavailable' });
  }
}
