/**
 * Shared role types used across the backend.
 *
 * These mirror the frontend UserRole values.
 * JWT integration will populate this from the token payload; for now
 * the role is read from the `x-role` request header by roleContext middleware.
 */

export type UserRole = 'guest' | 'authorized' | 'admin';

/**
 * Returns true if the role is allowed to see restricted layers.
 */
export function canViewRestricted(role: UserRole): boolean {
  return role === 'authorized' || role === 'admin';
}

/**
 * Normalises and validates an arbitrary string into a UserRole.
 * Falls back to 'guest' for any unknown / missing value.
 */
export function parseRole(raw: string | undefined): UserRole {
  if (raw === 'authorized' || raw === 'admin') return raw;
  return 'guest';
}
