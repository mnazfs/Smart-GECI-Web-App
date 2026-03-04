import { Router } from 'express';
import { syncLayers, getLayers, updateRestricted } from '../controllers/layerController';

const router = Router();

/**
 * GET /api/layers
 * Returns all registered layers (flat list).
 */
router.get('/', getLayers);

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
