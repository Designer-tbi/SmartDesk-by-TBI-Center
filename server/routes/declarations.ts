import { Router } from 'express';
import { requireTenant } from '../middleware/auth.js';

export const declarationsRouter = Router();

declarationsRouter.use(...requireTenant);

/**
 * The declaration calendar itself (DGID/CNSS/INS/Greffe deadlines) is
 * generated client-side from the Finance Law (see Declarations.tsx) — it's
 * the same for every tenant in a given country/year, so there's nothing to
 * store per-company for it. What IS per-company is which of those
 * obligations have actually been filed — that's what this table tracks.
 */

declarationsRouter.get('/status', async (req, res, next) => {
  try {
    const r = await req.db.query(
      `SELECT "declarationId", "doneAt", note FROM declaration_status WHERE "companyId" = $1`,
      [req.user!.companyId],
    );
    res.json(r.rows);
  } catch (error) {
    next(error);
  }
});

declarationsRouter.post('/status/:declarationId', async (req, res, next) => {
  try {
    const { declarationId } = req.params;
    const { note } = req.body || {};
    await req.db.query(
      `INSERT INTO declaration_status (id, "companyId", "declarationId", "doneAt", "doneBy", note)
       VALUES ($1, $2, $3, NOW(), $4, $5)
       ON CONFLICT ("companyId", "declarationId")
       DO UPDATE SET "doneAt" = NOW(), "doneBy" = $4, note = $5`,
      [`ds_${req.user!.companyId}_${declarationId}`, req.user!.companyId, declarationId, req.user!.id, note || null],
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

declarationsRouter.delete('/status/:declarationId', async (req, res, next) => {
  try {
    const { declarationId } = req.params;
    await req.db.query(
      `DELETE FROM declaration_status WHERE "companyId" = $1 AND "declarationId" = $2`,
      [req.user!.companyId, declarationId],
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
