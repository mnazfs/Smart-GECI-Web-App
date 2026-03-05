import { apiClient } from "./api";
import type { FacilityMetadata } from "@/types/layer";

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

// Shape returned by the backend's AcademicBlockRow (id + name + any extra columns)
interface FacilityRow {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

/**
 * Maps a raw DB row from the backend to the frontend FacilityMetadata shape.
 * Fields that are not present in the DB row are given sensible defaults.
 */
function rowToMetadata(
  row: FacilityRow,
  lat: number,
  lng: number
): FacilityMetadata {
  const { id, name, type, description, ...rest } = row;
  const properties: Record<string, string> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (v !== null && v !== undefined && k !== "geom") {
      properties[k] = String(v);
    }
  }
  return {
    id: String(id),
    name: String(name),
    type: typeof type === "string" ? type : "Facility",
    description: typeof description === "string" ? description : "",
    location: { lat, lng },
    properties,
  };
}

export const metadataService = {
  fetchByLocation: async (
    lat: number,
    lng: number
  ): Promise<FacilityMetadata | null> => {
    try {
      const response = await apiClient.get<ApiResponse<FacilityRow[]>>(
        "/facilities/by-location",
        { params: { lat, lng } }
      );
      const rows = response.data.data;
      if (!Array.isArray(rows) || rows.length === 0) return null;
      return rowToMetadata(rows[0], lat, lng);
    } catch {
      return null;
    }
  },
};
