import { Router } from 'express';
import { syncLayers, getLayers, getHierarchy, updateRestricted } from '../controllers/layerController';

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

export default router;
