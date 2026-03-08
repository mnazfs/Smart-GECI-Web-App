import type { Request, Response, NextFunction } from 'express';
import { listUsers, updateUser, deleteUser } from '../services/authService';
import { AppError }       from '../middleware/errorHandler';
import { successResponse } from '../utils';

// ─── listUsersHandler ────────────────────────────────────────────────────────

/**
 * GET /api/users
 *
 * Admin-only. Returns all users.
 *
 * 200 — { users: User[] }
 */
export async function listUsersHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await listUsers();
    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

// ─── updateUserHandler ───────────────────────────────────────────────────────

/**
 * PUT /api/users/:id
 *
 * Admin-only. Updates a user's username and/or password.
 *
 * Body: { "username"?: string, "password"?: string }
 *
 * 200 — { user: User }
 * 400 — missing / invalid fields
 * 404 — user not found
 * 409 — username already taken
 */
export async function updateUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { username, password } = req.body as {
      username?: unknown;
      password?: unknown;
    };

    if (username !== undefined && (typeof username !== 'string' || username.trim() === '')) {
      return next(new AppError('username must be a non-empty string', 400));
    }
    if (password !== undefined && typeof password !== 'string') {
      return next(new AppError('password must be a string', 400));
    }

    const result = await updateUser(id, {
      username: typeof username === 'string' ? username.trim() : undefined,
      password: typeof password === 'string' ? password : undefined,
    });

    res.status(200).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

// ─── deleteUserHandler ───────────────────────────────────────────────────────

/**
 * DELETE /api/users/:id
 *
 * Admin-only. Deletes a user by id.
 *
 * 200 — { message: "User deleted" }
 * 400 — attempt to delete own account
 * 404 — user not found
 */
export async function deleteUserHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    // Prevent an admin from deleting their own account
    if (req.user?.id === id) {
      return next(new AppError('You cannot delete your own account', 400));
    }

    await deleteUser(id);
    res.status(200).json(successResponse({ message: 'User deleted' }));
  } catch (err) {
    next(err);
  }
}
