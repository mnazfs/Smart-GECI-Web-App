import express from 'express';
import helmet  from 'helmet';
import cors    from 'cors';
import { env } from './config/env';
import { createRequestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { roleContext } from './middleware/roleContext';
import apiRouter from './routes';

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin:      env.CORS_ORIGIN,
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-role'],
  }),
);

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── HTTP request logging ─────────────────────────────────────────────────────
app.use(createRequestLogger());

// ─── Role context (reads x-role header, attaches req.role) ───────────────────
// Replace the header read with JWT decoding here when auth is implemented.
app.use(roleContext);

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── 404 catch-all (must be after all routes) ────────────────────────────────
app.use(notFoundHandler);

// ─── Centralized error handler (must be last) ────────────────────────────────
app.use(errorHandler);

export default app;
