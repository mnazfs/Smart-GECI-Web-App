// ─── Database row (snake_case mirrors the DB column names) ───────────────────

export interface LayerRow {
  id:              string;   // UUID
  name:            string;
  geoserver_name:  string;
  parent_id:       string | null;  // UUID | NULL
  restricted:      boolean;
  visible:         boolean;
  created_at:      Date;
  updated_at:      Date;
}

// ─── Application model (camelCase for TS code) ────────────────────────────────

export interface Layer {
  id:            string;
  name:          string;
  geoserverName: string;
  parentId:      string | null;
  restricted:    boolean;
  visible:       boolean;
  createdAt:     Date;
  updatedAt:     Date;
}

// ─── Input types (no generated fields) ───────────────────────────────────────

export interface InsertLayerInput {
  name:          string;
  geoserverName: string;
  parentId?:     string | null;
  restricted?:   boolean;
  visible?:      boolean;
}

export interface UpdateLayerParentInput {
  id:       string;
  parentId: string | null;
}

export interface UpdateLayerRestrictedInput {
  id:         string;
  restricted: boolean;
}

// ─── Row → Model mapper ───────────────────────────────────────────────────────

export function rowToLayer(row: LayerRow): Layer {
  return {
    id:            row.id,
    name:          row.name,
    geoserverName: row.geoserver_name,
    parentId:      row.parent_id,
    restricted:    row.restricted,
    visible:       row.visible,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  };
}

// ─── Tree node (used by hierarchy endpoint) ───────────────────────────────────

export interface LayerTreeNode {
  id:            string;
  name:          string;
  geoserverName: string;
  parentId:      string | null;
  restricted:    boolean;
  children:      LayerTreeNode[];
}
