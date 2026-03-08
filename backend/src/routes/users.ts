import { Router } from 'express';
import { listUsersHandler, updateUserHandler, deleteUserHandler } from '../controllers/usersController';
import { requireAuth }  from '../middleware/authMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';

const router = Router();

// All routes under /api/users require a valid admin JWT
router.use(requireAuth, requireAdmin);

/**
 * GET /api/users
 * Returns all users in the system.
 */
router.get('/', listUsersHandler);

/**
 * PUT /api/users/:id
 * Updates a user's username and/or password.
 */
router.put('/:id', updateUserHandler);

/**
 * DELETE /api/users/:id
 * Permanently removes a user.
 */
router.delete('/:id', deleteUserHandler);

export default router;
