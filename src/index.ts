import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import { router as apiRouter } from './routes/api';

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.use('/api/v1', apiRouter);

// Health endpoint
app.get('/health', (_req: express.Request, res: express.Response) => res.json({ status: 'ok' }));

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status || 500;
  const code = err.code || 'internal_error';
  const correlation_id = err.correlation_id || undefined;
  res.status(status).json({ status: 'error', code, message: err.message || 'Internal Server Error', correlation_id });
});

export default app;

