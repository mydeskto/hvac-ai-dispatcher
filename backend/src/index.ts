import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { router } from './routes';
import { simulateMovement } from './tracking';

const app = express();

// Lock down CORS to known origins when CORS_ORIGIN is set (comma-separated);
// open in local/dev so the Next.js proxy and tools can reach the API.
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(cors(allowedOrigins?.length ? { origin: allowedOrigins } : undefined));

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use('/api', router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request', details: err.issues });
    return;
  }
  const status = typeof err === 'object' && err !== null && 'status' in err ? Number((err as { status: number }).status) : 500;
  const message = err instanceof Error ? err.message : 'Unexpected error';
  if (status >= 500) console.error(err);
  res.status(status).json({ error: message });
});

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  setInterval(simulateMovement, 3000);
  console.log(`HVAC AI Dispatcher API listening on http://localhost:${port}`);
});
