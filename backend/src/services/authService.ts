import bcrypt from 'bcrypt';
import jwt    from 'jsonwebtoken';
import { UserRepository }  from '../repositories/userRepository';
import { AppError }        from '../middleware/errorHandler';
import { env }             from '../config/env';
import type { User, JwtPayload } from '../models/user';

export type { User };

// ─── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12;

// ─── login ────────────────────────────────────────────────────────────────────

export interface LoginResult {
  token: string;
  user:  User;
}

/**
 * Verifies credentials and returns a signed JWT + safe user record.
 *
 * Timing-safe: we always run bcrypt.compare even when the user is not found
 * (dummy hash) so the response time does not leak whether a username exists.
 *
 * @throws AppError(401) on invalid credentials
 */
export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  const row = await UserRepository.findByUsername(username);

  // Dummy hash used when user not found — keeps timing consistent
  const hashToCompare = row?.password_hash ?? '$2b$12$invalidhashplaceholderXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  const match = await bcrypt.compare(password, hashToCompare);

  if (!row || !match) {
    throw new AppError('Invalid username or password', 401);
  }

  const payload: JwtPayload = { id: row.id, role: row.role };
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  // Return safe user (no password_hash)
  const user: User = {
    id:        row.id,
    username:  row.username,
    role:      row.role,
    createdAt: row.created_at,
  };

  return { token, user };
}

// ─── register ─────────────────────────────────────────────────────────────────

export interface RegisterResult {
  user: User;
}

/**
 * Creates a new user account.  Only callable by an admin (enforced by the
 * route-level `requireAdmin` guard; this function does not re-check the caller).
 *
 * @throws AppError(409) if the username is already taken
 * @throws AppError(400) if role is not 'authorized' | 'admin'
 */
export async function register(
  username: string,
  password: string,
  role: string,
): Promise<RegisterResult> {
  // ── Role validation ────────────────────────────────────────────────────────
  if (role !== 'authorized' && role !== 'admin') {
    throw new AppError("role must be 'authorized' or 'admin'", 400);
  }

  // ── Duplicate username check ───────────────────────────────────────────────
  const existing = await UserRepository.findByUsername(username);
  if (existing) {
    throw new AppError(`Username '${username}' is already taken`, 409);
  }

  // ── Hash + persist ─────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await UserRepository.create({
    username,
    passwordHash,
    role: role as 'authorized' | 'admin',
  });

  return { user };
}

// ─── listUsers ────────────────────────────────────────────────────────────────

/**
 * Returns all users. Admin-only (enforced at the route level).
 */
export async function listUsers(): Promise<{ users: User[] }> {
  const users = await UserRepository.findAll();
  return { users };
}

// ─── updateUser ───────────────────────────────────────────────────────────────

export interface UpdateUserInput {
  username?: string;
  password?: string;
}

export interface UpdateUserResult {
  user: User;
}

/**
 * Updates a user's username and/or password. Admin-only.
 *
 * @throws AppError(400) if neither username nor password is supplied
 * @throws AppError(409) if the new username is already taken by another user
 * @throws AppError(404) if the user is not found
 */
export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<UpdateUserResult> {
  if (!input.username && !input.password) {
    throw new AppError('At least one of username or password must be provided', 400);
  }

  const fields: { username?: string; passwordHash?: string } = {};

  if (input.username) {
    // Check uniqueness — must not belong to a different user
    const existing = await UserRepository.findByUsername(input.username);
    if (existing && existing.id !== id) {
      throw new AppError(`Username '${input.username}' is already taken`, 409);
    }
    fields.username = input.username;
  }

  if (input.password) {
    if (input.password.length < 8) {
      throw new AppError('Password must be at least 8 characters', 400);
    }
    fields.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  }

  const user = await UserRepository.updateById(id, fields);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  return { user };
}

// ─── deleteUser ───────────────────────────────────────────────────────────────

/**
 * Deletes a user by id. Admin-only.
 *
 * @throws AppError(404) if the user does not exist
 */
export async function deleteUser(id: string): Promise<void> {
  const deleted = await UserRepository.deleteById(id);
  if (!deleted) {
    throw new AppError('User not found', 404);
  }
}
