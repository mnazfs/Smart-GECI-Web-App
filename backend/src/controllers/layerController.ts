import type { Request, Response, NextFunction } from 'express';
import { syncWorkspaceLayers, fetchWfsFeatures, fetchGetFeatureInfo } from '../services/geoserverService';
import { getLayerHierarchy, setLayerParent, setLayerRestricted } from '../services/layerService';
import { LayerRepository }     from '../repositories/layerRepository';
import { AppError }            from '../middleware/errorHandler';
import { successResponse }     from '../utils';
import { env }                 from '../config/env';

// ─── syncLayers ───────────────────────────────────────────────────────────────

/**
 * POST /api/layers/sync
 *
 * Body (optional):
 *   { "workspace": "smart_geci" }
 *
 * Calls geoserverService.syncWorkspaceLayers() and returns the sync summary.
 */
export async function syncLayers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Allow the caller to override the workspace; fall back to the env default
    const workspace =
      (req.body as { workspace?: string }).workspace ??
      env.GEOSERVER_DEFAULT_WORKSPACE;

    if (!workspace || workspace.trim() === '') {
      return next(new AppError('workspace is required', 400));
    }

    const result = await syncWorkspaceLayers(workspace.trim());

    res.status(200).json(
      successResponse({
        workspace: result.workspace,
        total:     result.total,
        inserted:  result.inserted,
        skipped:   result.skipped,
        layers:    result.layers,
      }),
    );
  } catch (err) {
    // Wrap plain Error from geoserverService into a 502 so the client
    // knows the failure was upstream, not an internal bug.
    if (err instanceof Error && !(err instanceof AppError)) {
      return next(new AppError(err.message, 502));
    }
    next(err);
  }
}

// ─── getLayers ────────────────────────────────────────────────────────────────

/**
 * GET /api/layers
 *
 * Returns all layers from layer_registry (flat list).
 * Hierarchy assembly is handled by the frontend / a dedicated endpoint later.
 */
export async function getLayers(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const layers = await LayerRepository.getAllLayers();
    res.status(200).json(successResponse(layers));
  } catch (err) {
    next(err);
  }
}

// ─── getHierarchy ─────────────────────────────────────────────────────────────

/**
 * GET /api/layers/hierarchy
 *
 * Returns a nested tree of all visible layers, built in memory from
 * the flat layer_registry rows.  No recursive SQL is used.
 *
 * Response shape:
 * [
 *   {
 *     id, name, geoserverName, restricted,
 *     children: [ { id, name, geoserverName, restricted, children: [] }, … ]
 *   }
 * ]
 */
export async function getHierarchy(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // req.role is populated by the roleContext middleware (see app.ts).
    // It is always a valid UserRole — unknown values are normalised to 'guest'.
    const tree = await getLayerHierarchy(req.role);
    res.status(200).json(successResponse(tree));
  } catch (err) {
    next(err);
  }
}

// ─── updateRestricted ─────────────────────────────────────────────────────────

/**
 * PATCH /api/layers/:id/restricted
 *
 * Body: { "restricted": true | false }
 *
 * Toggles the access-control flag on a single layer.
 */
export async function updateRestricted(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const body = req.body as { restricted?: unknown };

    if (typeof body.restricted !== 'boolean') {
      return next(new AppError('restricted must be a boolean', 400));
    }

    const updated = await LayerRepository.updateRestricted({ id, restricted: body.restricted });

    if (!updated) {
      return next(new AppError(`Layer ${id} not found`, 404));
    }

    res.status(200).json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}

// ─── updateParentAdmin ────────────────────────────────────────────────────────

/**
 * PUT /api/layers/:id/parent
 *
 * Admin-only.  Reassigns the parent of a layer.
 *
 * Body: { "parentId": "<uuid>" | null }
 *
 * Errors:
 *   400 — missing / wrong-type body, self-parent, circular hierarchy
 *   403 — non-admin caller (enforced by requireAdmin middleware, not here)
 *   404 — layer or proposed parent not found
 */
export async function updateParentAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const body   = req.body as { parentId?: unknown };

    // Accept explicit null (promote to root) but reject missing key
    if (!('parentId' in body)) {
      return next(new AppError('parentId is required (use null to promote to root)', 400));
    }

    const rawParentId = body.parentId;
    if (rawParentId !== null && typeof rawParentId !== 'string') {
      return next(new AppError('parentId must be a string UUID or null', 400));
    }

    const updated = await setLayerParent(id, rawParentId as string | null);
    res.status(200).json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}

// ─── updateRestrictedAdmin ────────────────────────────────────────────────────

/**
 * PUT /api/layers/:id/restricted
 *
 * Admin-only.  Sets the restricted access-control flag on a layer.
 *
 * Body: { "restricted": true | false }
 *
 * Errors:
 *   400 — missing / wrong-type body field
 *   403 — non-admin caller (enforced by requireAdmin middleware, not here)
 *   404 — layer not found
 */
export async function updateRestrictedAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const body   = req.body as { restricted?: unknown };

    if (typeof body.restricted !== 'boolean') {
      return next(new AppError('restricted must be a boolean', 400));
    }

    const updated = await setLayerRestricted(id, body.restricted);
    res.status(200).json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}

// ─── getFeatureInfo ─────────────────────────────────────────────────────────

/**
 * GET /api/layers/feature-info?layers=...&bbox=...&width=...&height=...&x=...&y=...
 *
 * Server-side proxy for WMS GetFeatureInfo requests.
 * Returns the GeoJSON FeatureCollection from GeoServer, bypassing browser CORS.
 */
export async function getFeatureInfo(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { layers, bbox, width, height, x, y, srs } = req.query as Record<string, string>;

    if (!layers || !bbox || !width || !height || !x || !y) {
      return next(new AppError('Missing required query params: layers, bbox, width, height, x, y', 400));
    }

    const data = await fetchGetFeatureInfo({
      layers,
      bbox,
      width:  parseInt(width,  10),
      height: parseInt(height, 10),
      x:      parseInt(x,      10),
      y:      parseInt(y,      10),
      srs,
    });

    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
}

// ─── getWfsData ──────────────────────────────────────────────────────────────

/**
 * GET /api/layers/:id/wfs-data
 *
 * Server-side proxy for WFS GetFeature requests.
 * Fetches GeoJSON from GeoServer and forwards it, avoiding browser CORS issues.
 */
export async function getWfsData(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const layer = await LayerRepository.findById(id);
    if (!layer) {
      return next(new AppError(`Layer ${id} not found`, 404));
    }

    const geojson = await fetchWfsFeatures(layer.geoserverName);
    res.status(200).json(geojson);
  } catch (err) {
    next(err);
  }
}

// ─── updateRenderMode ─────────────────────────────────────────────────────────

/**
 * PATCH /api/layers/:id/render-mode
 *
 * Sets how the layer is served to the map client (wms or wfs).
 *
 * Body: { "renderMode": "wms" | "wfs" }
 *
 * Errors:
 *   400 — missing / invalid renderMode value
 *   404 — layer not found
 */
export async function updateRenderMode(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }   = req.params as { id: string };
    const body     = req.body as { renderMode?: unknown };
    const rawMode  = body.renderMode;

    if (rawMode !== 'wms' && rawMode !== 'wfs') {
      return next(new AppError('renderMode must be "wms" or "wfs"', 400));
    }

    const updated = await LayerRepository.updateLayerRenderMode({ id, renderMode: rawMode });

    if (!updated) {
      return next(new AppError(`Layer ${id} not found`, 404));
    }

    res.status(200).json(successResponse(updated));
  } catch (err) {
    next(err);
  }
}
