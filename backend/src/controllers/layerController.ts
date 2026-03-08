import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { promises as fs } from 'fs';
import {
  syncWorkspaceLayers,
  fetchWfsFeatures,
  fetchGetFeatureInfo,
  publishLayerToGeoServer,
  deleteGeoServerLayer,
} from '../services/geoserverService';
import { getLayerHierarchy, setLayerParent, setLayerRestricted } from '../services/layerService';
import { LayerRepository }     from '../repositories/layerRepository';
import { AppError }            from '../middleware/errorHandler';
import { successResponse }     from '../utils';
import { env }                 from '../config/env';
import db                      from '../config/db';
import { createGeoPackage, getWkbOffset } from '../utils/geopackage';
import initSqlJs               from 'sql.js';

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

// ─── downloadLayerAsGPKG ──────────────────────────────────────────────────────

/** Validates that a layer / table name contains only safe identifier characters. */
function assertSafeIdent(name: string, label: string, next: NextFunction): boolean {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    next(new AppError(`Invalid ${label}: "${name}"`, 400));
    return false;
  }
  return true;
}

/**
 * GET /api/layers/:layerName/download  [Admin]
 *
 * Exports a PostGIS table as a GeoPackage file and streams it to the client.
 *
 * Steps:
 *   1. Strip GeoServer workspace prefix (e.g. "smartgeci:roads" → "roads")
 *   2. Query geometry_columns for geom column name + SRID
 *   3. SELECT all rows with geometry as GeoJSON
 *   4. Build GPKG binary with sql.js
 *   5. Stream via res.download(); delete file after 5 s
 */
export async function downloadLayerAsGPKG(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const rawName   = req.params['layerName'] ?? '';
    const tableName = rawName.includes(':') ? rawName.split(':').pop()! : rawName;

    if (!assertSafeIdent(tableName, 'layerName', next)) return;

    // ── Geometry metadata ─────────────────────────────────────────────────
    const geomMeta = await db.query<{ f_geometry_column: string; srid: number }>(
      `SELECT f_geometry_column, srid
       FROM geometry_columns
       WHERE f_table_name = $1
       LIMIT 1`,
      [tableName],
    );

    if (geomMeta.rows.length === 0) {
      return next(new AppError(`Layer "${tableName}" not found in geometry_columns`, 404));
    }

    const geomCol = geomMeta.rows[0]!.f_geometry_column;
    const srid    = geomMeta.rows[0]!.srid;

    // ── Query features ────────────────────────────────────────────────────
    const dataResult = await db.query<Record<string, unknown>>(
      `SELECT *,
              ST_AsGeoJSON("${geomCol}") AS st_asgeojson,
              GeometryType("${geomCol}")  AS geometrytype,
              ST_SRID("${geomCol}")       AS st_srid
       FROM "${tableName}"
       LIMIT 10000`,
    );

    const rows     = dataResult.rows;
    const geomType = (rows[0]?.['geometrytype'] as string | undefined) ?? 'GEOMETRY';

    // ── Build GPKG ────────────────────────────────────────────────────────
    const exportsDir = path.join(__dirname, '../../exports');
    await fs.mkdir(exportsDir, { recursive: true });
    const outPath = path.join(exportsDir, `${tableName}.gpkg`);

    await createGeoPackage(tableName, rows, geomCol, srid, geomType, outPath);

    // ── Stream to client ──────────────────────────────────────────────────
    res.download(outPath, `${tableName}.gpkg`, (err) => {
      if (err && !res.headersSent) {
        next(new AppError('Failed to send file', 500));
      }
      // Delete the exported file after 5 seconds
      setTimeout(() => {
        fs.unlink(outPath).catch(() => { /* ignore */ });
      }, 5_000);
    });
  } catch (err) {
    next(err);
  }
}

// ─── uploadLayerFromGPKG ──────────────────────────────────────────────────────

/**
 * POST /api/layers/upload  [Admin]
 *
 * Parses an uploaded .gpkg file, creates a PostGIS table with the features,
 * builds a spatial index, and publishes the layer on GeoServer.
 *
 * Multipart field: gpkg (file ≤ 100 MB)
 */
export async function uploadLayerFromGPKG(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const file = req.file;
  if (!file) {
    return next(new AppError('No file uploaded', 400));
  }

  try {
    // ── Open GeoPackage with sql.js ───────────────────────────────────────
    const SQL       = await initSqlJs();
    const fileBytes = await fs.readFile(file.path);
    const gpkg      = new SQL.Database(new Uint8Array(fileBytes));

    // ── Read gpkg_contents ────────────────────────────────────────────────
    const contentsRes = gpkg.exec(
      `SELECT table_name FROM gpkg_contents WHERE data_type = 'features' LIMIT 1`,
    );
    if (!contentsRes.length || !contentsRes[0]!.values.length) {
      gpkg.close();
      await fs.unlink(file.path).catch(() => { /* ignore */ });
      return next(new AppError('No feature tables found in GeoPackage', 400));
    }
    const featureTable = String(contentsRes[0]!.values[0]![0]);

    // ── Read gpkg_geometry_columns ────────────────────────────────────────
    const geomColRes = gpkg.exec(
      `SELECT column_name, geometry_type_name, srs_id
       FROM gpkg_geometry_columns
       WHERE table_name = ?`,
      [featureTable],
    );
    if (!geomColRes.length || !geomColRes[0]!.values.length) {
      gpkg.close();
      await fs.unlink(file.path).catch(() => { /* ignore */ });
      return next(new AppError('No geometry columns found in GeoPackage', 400));
    }

    const [geomColumn, geomTypeName, uploadSrid] = geomColRes[0]!.values[0] as [
      string, string, number,
    ];

    // ── Get all features ──────────────────────────────────────────────────
    const featureRes = gpkg.exec(`SELECT * FROM "${featureTable}"`);
    gpkg.close();

    const colNames   = featureRes.length > 0 ? featureRes[0]!.columns : [];
    const featureRows = featureRes.length > 0 ? featureRes[0]!.values  : [];

    // ── Derive a safe PostGIS table name from the uploaded filename ───────
    const baseName = path.basename(file.originalname, '.gpkg');
    let pgTableName = baseName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    if (!/^[a-z_]/.test(pgTableName)) pgTableName = 'layer_' + pgTableName;

    // ── Attribute column indices (skip geometry column) ───────────────────
    const attrColPairs = colNames
      .map((c, i) => ({ col: c, idx: i }))
      .filter(({ col }) => col !== geomColumn);

    const geomColIdx = colNames.indexOf(geomColumn);

    // ── Create PostGIS table ──────────────────────────────────────────────
    const attrDefs = attrColPairs.map(({ col }) => `"${col}" TEXT`).join(', ');
    const createSQL = `
      CREATE TABLE IF NOT EXISTS "${pgTableName}" (
        id   SERIAL PRIMARY KEY
        ${attrDefs ? ', ' + attrDefs : ''},
        geom GEOMETRY(${geomTypeName}, ${uploadSrid})
      )`;
    await db.query(createSQL);

    // ── Insert features ───────────────────────────────────────────────────
    for (const row of featureRows) {
      const geomRaw = row[geomColIdx];
      if (!(geomRaw instanceof Uint8Array)) continue;

      const flagsByte = geomRaw[3];
      if (flagsByte === undefined) continue;

      const wkbOffset = getWkbOffset(flagsByte);
      const wkb       = geomRaw.slice(wkbOffset);
      const wkbHex    = Buffer.from(wkb).toString('hex');

      const attrVals = attrColPairs.map(({ idx }) => {
        const v = row[idx];
        return v !== null && v !== undefined ? String(v) : null;
      });

      if (attrColPairs.length > 0) {
        const colList    = attrColPairs.map(({ col }) => `"${col}"`).join(', ');
        const phList     = attrColPairs.map((_, i) => `$${i + 1}`).join(', ');
        const geomExpr   = `ST_GeomFromWKB('\\x${wkbHex}'::bytea, ${uploadSrid})`;
        await db.query(
          `INSERT INTO "${pgTableName}" (${colList}, geom) VALUES (${phList}, ${geomExpr})`,
          attrVals,
        );
      } else {
        const geomExpr = `ST_GeomFromWKB('\\x${wkbHex}'::bytea, ${uploadSrid})`;
        await db.query(`INSERT INTO "${pgTableName}" (geom) VALUES (${geomExpr})`);
      }
    }

    // ── Spatial index ─────────────────────────────────────────────────────
    await db.query(
      `CREATE INDEX IF NOT EXISTS "${pgTableName}_geom_idx"
       ON "${pgTableName}" USING GIST (geom)`,
    );

    // ── Cleanup uploaded file ─────────────────────────────────────────────
    await fs.unlink(file.path).catch(() => { /* ignore */ });

    // ── Publish to GeoServer (non-fatal) ──────────────────────────────────
    try {
      await publishLayerToGeoServer(pgTableName);
    } catch (geoErr) {
      console.error('[GeoServer] Publish failed:', geoErr instanceof Error ? geoErr.message : geoErr);
    }

    res.status(201).json(
      successResponse({ tableName: pgTableName, features: featureRows.length }),
    );
  } catch (err) {
    await fs.unlink(file.path).catch(() => { /* ignore */ });
    next(err);
  }
}

// ─── deleteLayerFromGeoServer ─────────────────────────────────────────────────

/**
 * DELETE /api/layers/:name/geoserver  [Admin]
 *
 * 1. Removes the feature type (and associated layer/styles) from GeoServer.
 * 2. Drops the PostGIS table with CASCADE.
 */
export async function deleteLayerFromGeoServer(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const name = req.params['name'] ?? '';
    if (!assertSafeIdent(name, 'layer name', next)) return;

    // Remove from GeoServer (404 treated as already-done by the service)
    await deleteGeoServerLayer(name);

    // Drop the PostGIS table
    await db.query(`DROP TABLE IF EXISTS "${name}" CASCADE`);

    // Best-effort: remove from layer_registry (may not exist for freshly uploaded layers)
    await db.query(
      `DELETE FROM layer_registry WHERE geoserver_name = $1 OR geoserver_name = $2`,
      [name, `${env.GEOSERVER_WORKSPACE}:${name}`],
    ).catch(() => { /* ignore — table may not have the row */ });

    res.status(200).json(successResponse({ deleted: name }));
  } catch (err) {
    next(err);
  }
}
