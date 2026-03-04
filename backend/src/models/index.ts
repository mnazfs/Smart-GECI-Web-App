/**
 * Models index
 *
 * TypeScript interfaces / types that mirror database entities.
 * These are plain TS types — no ORM decorators.
 */

export type {
  Layer,
  LayerRow,
  LayerTreeNode,
  InsertLayerInput,
  UpdateLayerParentInput,
  UpdateLayerRestrictedInput,
} from './layer';
export { rowToLayer } from './layer';
// export type { Facility } from './facility';

// ─── shared API response wrapper ─────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page:       number;
    limit:      number;
    total:      number;
    totalPages: number;
  };
}

export interface ApiError {
  success: false;
  error: {
    message:    string;
    statusCode: number;
    stack?:     string;
  };
}
