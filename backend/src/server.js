import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import linksRouter from './routes/links.js';
import redirectRouter from './routes/redirect.js';
import analyticsRouter from './routes/analytics.js';
import aiRouter from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',');

app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/links', linksRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);

app.use('/', redirectRouter);

app.use((err, _req, res, _next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`LinkSnip backend listening on port ${PORT}`);
});
