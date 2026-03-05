import { Router } from 'express';
import {
  syncLayers,
  getLayers,
  getHierarchy,
  updateRestricted,
  updateParentAdmin,
  updateRestrictedAdmin,
} from '../controllers/layerController';
import { requireAdmin } from '../middleware/roleMiddleware';

const router = Router();

/**
 * GET /api/layers
 * Returns all registered layers (flat list).
 */
router.get('/', getLayers);

/**
 * GET /api/layers/hierarchy
 * Returns all visible layers as a nested tree (built in memory, no recursive SQL).
 */
router.get('/hierarchy', getHierarchy);

/**
 * POST /api/layers/sync
 * Pulls layers from GeoServer workspace and inserts unknown ones.
 * Body (optional): { "workspace": "smart_geci" }
 */
router.post('/sync', syncLayers);

/**
 * PATCH /api/layers/:id/restricted
 * Toggles the restricted flag on a single layer.
 * Body: { "restricted": true | false }
 */
router.patch('/:id/restricted', updateRestricted);

/**
 * PUT /api/layers/:id/parent
 * Reassigns the parent of a layer, or promotes to root when parentId is null.
 * Detects self-parenting and circular hierarchy.
 * Body: { "parentId": "<uuid>" | null }
 */
router.put('/:id/parent', updateParentAdmin);

/**
 * PUT /api/layers/:id/restricted  [admin only]
 * Sets the restricted flag on a layer.
 * Body: { "restricted": true | false }
 */
router.put('/:id/restricted', requireAdmin, updateRestrictedAdmin);

export default router;
