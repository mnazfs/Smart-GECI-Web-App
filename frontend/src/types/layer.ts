export interface LayerNode {
  id: string;
  name: string;
  geoserverName: string;
  parentId: string | null;
  restricted: boolean;
  children?: LayerNode[];
}

export interface FacilityMetadata {
  id: string;
  name: string;
  type: string;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  properties: Record<string, string>;
}
