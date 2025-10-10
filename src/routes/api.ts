import { Router } from 'express';
import { lookupHandler } from '../routes/lookup';
import { registerHandler } from '../routes/register';
import { paymentCallbackHandler } from '../routes/paymentCallback';
import { bouquetsHandler } from '../routes/bouquets';
import { hmacAuthMiddleware } from '../security/hmac';
import { adminRouter } from './admin';
import { extendSubscriptionHandler, clientInfoHandler } from './subscription';

export const router = Router();

router.get('/lookup', lookupHandler);
router.post('/register', registerHandler);
router.post('/payment/callback', hmacAuthMiddleware, paymentCallbackHandler);
router.get('/bouquets', bouquetsHandler);
router.post('/subscription/extend', extendSubscriptionHandler);
router.post('/subscription/info', clientInfoHandler);
router.use('/admin', adminRouter);
