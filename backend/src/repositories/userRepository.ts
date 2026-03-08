import type { PoolClient } from 'pg';
import db from '../config/db';
import type { UserRow, User, CreateUserInput } from '../models/user';
import { rowToUser } from '../models/user';

// ─── UserRepository ───────────────────────────────────────────────────────────

/**
 * Data-access layer for the `users` table.
 *
 * Rules:
 * - No business logic (hashing, validation) lives here.
 * - All queries use parameterised placeholders.
 * - Every method accepts an optional PoolClient for transaction support.
 */
export const UserRepository = {
  // ── findByUsername ─────────────────────────────────────────────────────────

  /**
   * Returns the full row (including password_hash) for the given username,
   * or null if not found.
   *
   * Deliberately returns UserRow (not User) so the auth service can compare
   * the hash.  Never forward the raw row to the client.
   */
  async findByUsername(
    username: string,
    client?: PoolClient,
  ): Promise<UserRow | null> {
    const query = `
      SELECT id, username, password_hash, role, created_at
      FROM   users
      WHERE  username = $1
      LIMIT  1
    `;
    const conn   = client ?? db;
    const result = await conn.query<UserRow>(query, [username]);
    return result.rows.length > 0 ? (result.rows[0] as UserRow) : null;
  },

  // ── findById ───────────────────────────────────────────────────────────────

  /**
   * Returns the safe User model for the given UUID, or null if not found.
   */
  async findById(
    id: string,
    client?: PoolClient,
  ): Promise<User | null> {
    const query = `
      SELECT id, username, password_hash, role, created_at
      FROM   users
      WHERE  id = $1
      LIMIT  1
    `;
    const conn   = client ?? db;
    const result = await conn.query<UserRow>(query, [id]);
    return result.rows.length > 0 ? rowToUser(result.rows[0] as UserRow) : null;
  },

  // ── create ─────────────────────────────────────────────────────────────────

  /**
   * Inserts a new user and returns the saved record (without password_hash).
   * Throws a DB unique-violation error if the username is already taken —
   * the service layer translates this into an AppError(409).
   */
  async create(
    input: CreateUserInput,
    client?: PoolClient,
  ): Promise<User> {
    const query = `
      INSERT INTO users (username, password_hash, role)
      VALUES ($1, $2, $3)
      RETURNING id, username, password_hash, role, created_at
    `;
    const conn   = client ?? db;
    const result = await conn.query<UserRow>(query, [
      input.username,
      input.passwordHash,
      input.role,
    ]);
    return rowToUser(result.rows[0] as UserRow);
  },

  // ── findAll ────────────────────────────────────────────────────────────────

  /**
   * Returns all users ordered by creation date (newest first).
   */
  async findAll(client?: PoolClient): Promise<User[]> {
    const query = `
      SELECT id, username, password_hash, role, created_at
      FROM   users
      ORDER  BY created_at DESC
    `;
    const conn   = client ?? db;
    const result = await conn.query<UserRow>(query);
    return result.rows.map((r) => rowToUser(r as UserRow));
  },

  // ── updateById ────────────────────────────────────────────────────────────

  /**
   * Updates username and/or password_hash for a given user id.
   * Returns the updated safe User, or null if not found.
   */
  async updateById(
    id: string,
    fields: { username?: string; passwordHash?: string },
    client?: PoolClient,
  ): Promise<User | null> {
    const setClauses: string[] = [];
    const values: unknown[]    = [];

    if (fields.username !== undefined) {
      values.push(fields.username);
      setClauses.push(`username = $${values.length}`);
    }
    if (fields.passwordHash !== undefined) {
      values.push(fields.passwordHash);
      setClauses.push(`password_hash = $${values.length}`);
    }
    if (setClauses.length === 0) return null;

    values.push(id);
    const query = `
      UPDATE users
      SET    ${setClauses.join(', ')}
      WHERE  id = $${values.length}
      RETURNING id, username, password_hash, role, created_at
    `;
    const conn   = client ?? db;
    const result = await conn.query<UserRow>(query, values);
    return result.rows.length > 0 ? rowToUser(result.rows[0] as UserRow) : null;
  },

  // ── deleteById ────────────────────────────────────────────────────────────

  /**
   * Deletes a user by id. Returns true if a row was deleted, false if not found.
   */
  async deleteById(
    id: string,
    client?: PoolClient,
  ): Promise<boolean> {
    const query = `DELETE FROM users WHERE id = $1`;
    const conn   = client ?? db;
    const result = await conn.query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
