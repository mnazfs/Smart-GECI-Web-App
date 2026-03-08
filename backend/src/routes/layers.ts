import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import {
  syncLayers,
  getLayers,
  getHierarchy,
  updateRestricted,
  updateParentAdmin,
  updateRestrictedAdmin,
  updateRenderMode,
  getWfsData,
  getFeatureInfo,
  downloadLayerAsGPKG,
  uploadLayerFromGPKG,
  deleteLayerFromGeoServer,
} from '../controllers/layerController';
import { requireAdmin } from '../middleware/roleMiddleware';

// ── Multer — GPKG upload ──────────────────────────────────────────────────────

const uploadsDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename:    (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.gpkg')) {
      cb(new Error('Only .gpkg files are allowed'));
    } else {
      cb(null, true);
    }
  },
});

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
 * GET /api/layers/feature-info?layers=...&bbox=...&width=...&height=...&x=...&y=...
 * Server-side proxy for WMS GetFeatureInfo — avoids browser CORS restrictions.
 */
router.get('/feature-info', getFeatureInfo);

/**
 * POST /api/layers/sync
 * Pulls layers from GeoServer workspace and inserts unknown ones.
 * Body (optional): { "workspace": "smart_geci" }
 */
router.post('/sync', syncLayers);

/**
 * POST /api/layers/upload  [admin only]
 * Uploads a .gpkg file, imports features into PostGIS, and publishes to GeoServer.
 * Form field: gpkg (file, max 100 MB)
 */
router.post('/upload', requireAdmin, upload.single('gpkg'), uploadLayerFromGPKG);

/**
 * GET /api/layers/:layerName/download  [admin only]
 * Exports the layer from PostGIS as a GeoPackage file and streams it to the client.
 */
router.get('/:layerName/download', requireAdmin, downloadLayerAsGPKG);

/**
 * DELETE /api/layers/:name/geoserver  [admin only]
 * Removes the feature type from GeoServer and drops the PostGIS table.
 */
router.delete('/:name/geoserver', requireAdmin, deleteLayerFromGeoServer);

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

/**
 * PATCH /api/layers/:id/render-mode
 * Sets how the layer is served: 'wms' (tile layer) or 'wfs' (GeoJSON vector).
 * Body: { "renderMode": "wms" | "wfs" }
 */
router.patch('/:id/render-mode', updateRenderMode);

/**
 * GET /api/layers/:id/wfs-data
 * Server-side proxy: fetches GeoJSON features from GeoServer WFS and
 * returns them to the browser, bypassing browser CORS restrictions.
 */
router.get('/:id/wfs-data', getWfsData);

export default router;
