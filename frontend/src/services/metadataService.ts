import { apiClient } from "./api";
import type { FacilityMetadata } from "@/types/layer";

export const metadataService = {
  fetchByLocation: async (
    lat: number,
    lng: number
  ): Promise<FacilityMetadata | null> => {
    try {
      const response = await apiClient.get<FacilityMetadata>(
        "/facilities/by-location",
        { params: { lat, lng } }
      );
      return response.data;
    } catch {
      // Demo fallback
      return {
        id: "demo-facility",
        name: "Campus Building",
        type: "Academic",
        description: "A facility on the GECI campus.",
        location: { lat, lng },
        properties: {
          Floor: "3",
          Capacity: "200",
          "Year Built": "2015",
        },
      };
    }
  },
};
