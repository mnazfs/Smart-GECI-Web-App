-- ============================================================
-- Migration: 005_seed_users
-- Description: Seeds one 'authorized' user and one 'admin' user.
--
--              Default credentials
--              ─────────────────────────────────────────────
--              Role         Username   Password
--              authorized   user       User@1234
--              admin        admin      Admin@1234
--              ─────────────────────────────────────────────
--              Passwords are hashed with bcrypt (bf, 12 rounds)
--              via pgcrypto — the same cost factor used by the
--              Node.js authService.
--
--              ON CONFLICT DO NOTHING makes this idempotent:
--              re-running the migration never duplicates rows.
-- ============================================================

INSERT INTO users (username, password_hash, role)
VALUES
    (
        'user',
        crypt('User@1234', gen_salt('bf', 12)),
        'authorized'
    ),
    (
        'admin',
        crypt('Admin@1234', gen_salt('bf', 12)),
        'admin'
    )
ON CONFLICT (username) DO NOTHING;
