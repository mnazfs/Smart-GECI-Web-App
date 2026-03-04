import type { Request, Response, NextFunction } from 'express';
import { parseRole } from '../types/role';
import type { UserRole } from '../types/role';

/**
 * Augment Express Request to carry a typed `role` property.
 * Populated by the roleContext middleware.
 *
 * Future: JWT verification will replace the header read and set the same field,
 * so no controller or service code needs to change when auth is added.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      role: UserRole;
    }
  }
}

/**
 * roleContext middleware
 *
 * Reads the `x-role` request header and attaches a validated UserRole to
 * `req.role`.  Unknown or missing values fall back to `'guest'` so every
 * downstream handler always has a safe, typed role available.
 *
 * Usage: mount globally in app.ts or per-router as needed.
 *
 * Replace the header read with JWT decoding here once auth is implemented —
 * no other files need to change.
 */
export function roleContext(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.headers['x-role'];
  req.role = parseRole(Array.isArray(raw) ? raw[0] : raw);
  next();
}
