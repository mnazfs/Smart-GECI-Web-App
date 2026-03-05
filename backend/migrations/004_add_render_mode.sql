-- ============================================================
-- Migration: 004_add_render_mode
-- Description: Adds a render_mode column to layer_registry so
--              each layer can be served via WMS (tile-based) or
--              WFS (vector / GeoJSON).  Defaults to 'wms' so all
--              existing rows keep their current behaviour.
-- ============================================================

ALTER TABLE layer_registry
  ADD COLUMN IF NOT EXISTS render_mode VARCHAR(3) NOT NULL DEFAULT 'wms'
    CHECK (render_mode IN ('wms', 'wfs'));

-- Index: used when the map client filters by render mode
CREATE INDEX IF NOT EXISTS idx_layer_registry_render_mode
  ON layer_registry (render_mode);

COMMENT ON COLUMN layer_registry.render_mode IS
  'How the layer is fetched from GeoServer: wms = WMS tile layer, wfs = WFS GeoJSON vector layer';
