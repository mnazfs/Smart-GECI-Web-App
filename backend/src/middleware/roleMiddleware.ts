import type { Request, Response, NextFunction } from 'express';

/**
 * requireAdmin
 *
 * Route guard that permits only requests whose `req.role` is `'admin'`.
 *
 * Depends on the `roleContext` middleware (mounted globally in app.ts)
 * having already parsed and attached `req.role` before this guard runs.
 *
 * Returns HTTP 403 for any caller whose role is not `'admin'`.
 *
 * Usage (per-route):
 *   router.put('/:id/parent', requireAdmin, updateParentAdmin);
 *
 * Usage (per-router):
 *   adminRouter.use(requireAdmin);
 *   adminRouter.put('/:id/parent', updateParentAdmin);
 */
export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.role !== 'admin') {
    res.status(403).json({
      success:   false,
      error: {
        message:    'Forbidden: admin role required',
        statusCode: 403,
      },
    });
    return;
  }
  next();
}
