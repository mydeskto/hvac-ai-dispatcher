import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { router } from './routes';

const app = express();
app.use(cors());
app.use(express.json());
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
  console.log(`HVAC AI Dispatcher API listening on http://localhost:${port}`);
});
