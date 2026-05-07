import { Router } from 'express';

interface Session {
  code: string;
  patientId: string;
  createdAt: number;
}

// In-memory store — sessions expire after 8 hours
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function generateCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function purgeExpired(): void {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(code);
  }
}

/**
 * POST /session
 * Body: { patientId: string }
 * Returns: { code: string }
 *
 * GET /session/:code
 * Returns: { patientId: string }
 */
export function sessionRouter(): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const { patientId } = req.body ?? {};
    if (!patientId || typeof patientId !== 'string') {
      res.status(400).json({ error: 'patientId is required' });
      return;
    }
    purgeExpired();
    const code = generateCode();
    sessions.set(code, { code, patientId: patientId.trim(), createdAt: Date.now() });
    res.json({ ok: true, code });
  });

  router.get('/:code', (req, res) => {
    purgeExpired();
    const session = sessions.get(req.params.code.toUpperCase());
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }
    res.json({ patientId: session.patientId });
  });

  return router;
}
