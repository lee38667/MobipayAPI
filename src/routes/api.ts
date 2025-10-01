import { Router } from 'express';
import { lookupHandler } from '../routes/lookup';
import { registerHandler } from '../routes/register';
import { paymentCallbackHandler } from '../routes/paymentCallback';
import { bouquetsHandler } from '../routes/bouquets';
import { hmacAuthMiddleware } from '../security/hmac';
import { adminRouter } from './admin';

export const router = Router();

router.get('/lookup', lookupHandler);
router.post('/register', registerHandler);
router.post('/payment/callback', hmacAuthMiddleware, paymentCallbackHandler);
router.get('/bouquets', bouquetsHandler);
router.use('/admin', adminRouter);
