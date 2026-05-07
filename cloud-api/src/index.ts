import express from 'express';
import cors from 'cors';
import { recordsRouter } from './routes/records';
import { getDatabase } from './db/sqlite';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Warm up DB on startup
  await getDatabase();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'clinic-cloud-api', version: '1.0.0' });
  });

  app.use('/records', recordsRouter());

  app.listen(PORT, () => {
    console.log(`[cloud-api] Listening on http://localhost:${PORT}`);
    console.log(`[cloud-api] POST /records  — receive records from bridge`);
    console.log(`[cloud-api] GET  /records  — list all stored records`);
  });
}

main().catch((err) => {
  console.error('[cloud-api] Fatal error:', err);
  process.exit(1);
});
