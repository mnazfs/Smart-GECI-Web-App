export interface LocationAnalysisData {
  coordinates: {
    lat: number;
    lng: number;
  };
  temperature?: number;
  uhiIntensity?: string;
  ndvi?: number;
  ndbi?: number;
  landUse?: string;
  timestamp?: string;
}