import { Router } from 'express';

interface Session {
  code: string;
  doctorId: string;
  doctorName: string;
  createdAt: number;
}

// In-memory store — sessions expire after 8 hours
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** Generate a random 4-character alphanumeric code */
function generateCode(): string {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

/** Purge expired sessions */
function purgeExpired(): void {
  const now = Date.now();
  for (const [code, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(code);
  }
}

/**
 * POST /session
 * Body: { doctorId: string, doctorName: string }
 * Returns: { code: string }
 *
 * GET /session/:code
 * Returns: { doctorId: string, doctorName: string }
 */
export function sessionRouter(): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const { doctorId, doctorName } = req.body ?? {};
    if (!doctorId || typeof doctorId !== 'string') {
      res.status(400).json({ error: 'doctorId is required' });
      return;
    }
    purgeExpired();
    const code = generateCode();
    sessions.set(code, {
      code,
      doctorId: doctorId.trim(),
      doctorName: (doctorName ?? '').trim(),
      createdAt: Date.now(),
    });
    res.json({ ok: true, code });
  });

  router.get('/:code', (req, res) => {
    purgeExpired();
    const session = sessions.get(req.params.code.toUpperCase());
    if (!session) {
      res.status(404).json({ error: 'Session not found or expired' });
      return;
    }
    res.json({ doctorId: session.doctorId, doctorName: session.doctorName });
  });

  return router;
}
