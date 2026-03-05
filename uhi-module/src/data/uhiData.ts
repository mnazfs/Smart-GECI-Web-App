// Mock UHI data for Idukki region
// Coordinates centered around Idukki, Kerala (9.8369° N, 77.0080° E)

export interface UHIZone {
  id: string;
  name: string;
  coordinates: [number, number][];
  lst: number; // Land Surface Temperature in °C
  uhiClass: 'Low' | 'Moderate' | 'High';
  ndvi: number; // Normalized Difference Vegetation Index (-1 to 1)
  ndbi: number; // Normalized Difference Built-up Index (-1 to 1)
  area: number; // Area in sq km
}

export interface Statistics {
  meanLST: number;
  meanNDVI: number;
  meanNDBI: number;
  highHeatZones: number;
  totalZones: number;
  maxLST: number;
  minLST: number;
}

// Generate polygon coordinates around a center point
const generatePolygon = (lat: number, lng: number, size: number = 0.008): [number, number][] => {
  return [
    [lat - size, lng - size],
    [lat - size, lng + size],
    [lat + size, lng + size],
    [lat + size, lng - size],
    [lat - size, lng - size],
  ];
};

export const uhiZones: UHIZone[] = [
  {
    id: 'zone-1',
    name: 'Town Center',
    coordinates: generatePolygon(9.8369, 77.0080, 0.006),
    lst: 38.5,
    uhiClass: 'High',
    ndvi: 0.12,
    ndbi: 0.65,
    area: 1.2,
  },
  {
    id: 'zone-2',
    name: 'Market Area',
    coordinates: generatePolygon(9.8920, 76.7280, 0.005),
    lst: 36.8,
    uhiClass: 'High',
    ndvi: 0.18,
    ndbi: 0.58,
    area: 0.9,
  },
  {
    id: 'zone-3',
    name: 'Industrial Zone',
    coordinates: generatePolygon(9.8850, 76.7320, 0.007),
    lst: 37.2,
    uhiClass: 'High',
    ndvi: 0.08,
    ndbi: 0.72,
    area: 1.5,
  },
  {
    id: 'zone-4',
    name: 'Residential North',
    coordinates: generatePolygon(9.8960, 76.7200, 0.008),
    lst: 32.4,
    uhiClass: 'Moderate',
    ndvi: 0.35,
    ndbi: 0.42,
    area: 2.1,
  },
  {
    id: 'zone-5',
    name: 'Residential South',
    coordinates: generatePolygon(9.8820, 76.7180, 0.007),
    lst: 31.8,
    uhiClass: 'Moderate',
    ndvi: 0.38,
    ndbi: 0.38,
    area: 1.8,
  },
  {
    id: 'zone-6',
    name: 'Agricultural West',
    coordinates: generatePolygon(9.8880, 76.7100, 0.009),
    lst: 28.5,
    uhiClass: 'Low',
    ndvi: 0.68,
    ndbi: 0.12,
    area: 2.8,
  },
  {
    id: 'zone-7',
    name: 'Forest Reserve',
    coordinates: generatePolygon(9.9000, 76.7350, 0.010),
    lst: 26.2,
    uhiClass: 'Low',
    ndvi: 0.82,
    ndbi: 0.05,
    area: 3.5,
  },
  {
    id: 'zone-8',
    name: 'Rubber Plantation',
    coordinates: generatePolygon(9.8780, 76.7400, 0.008),
    lst: 27.8,
    uhiClass: 'Low',
    ndvi: 0.72,
    ndbi: 0.08,
    area: 2.4,
  },
  {
    id: 'zone-9',
    name: 'Bus Stand Area',
    coordinates: generatePolygon(9.8910, 76.7230, 0.004),
    lst: 35.6,
    uhiClass: 'Moderate',
    ndvi: 0.22,
    ndbi: 0.52,
    area: 0.6,
  },
  {
    id: 'zone-10',
    name: 'Hospital Complex',
    coordinates: generatePolygon(9.8870, 76.7290, 0.005),
    lst: 33.4,
    uhiClass: 'Moderate',
    ndvi: 0.28,
    ndbi: 0.48,
    area: 0.8,
  },
  {
    id: 'zone-11',
    name: 'School Zone',
    coordinates: generatePolygon(9.8940, 76.7150, 0.005),
    lst: 30.2,
    uhiClass: 'Low',
    ndvi: 0.45,
    ndbi: 0.32,
    area: 0.9,
  },
  {
    id: 'zone-12',
    name: 'River Bank',
    coordinates: generatePolygon(9.8830, 76.7080, 0.006),
    lst: 25.8,
    uhiClass: 'Low',
    ndvi: 0.75,
    ndbi: 0.06,
    area: 1.3,
  },
];

export const calculateStatistics = (zones: UHIZone[]): Statistics => {
  const lstValues = zones.map(z => z.lst);
  const ndviValues = zones.map(z => z.ndvi);
  const ndbiValues = zones.map(z => z.ndbi);
  
  return {
    meanLST: Number((lstValues.reduce((a, b) => a + b, 0) / lstValues.length).toFixed(1)),
    meanNDVI: Number((ndviValues.reduce((a, b) => a + b, 0) / ndviValues.length).toFixed(2)),
    meanNDBI: Number((ndbiValues.reduce((a, b) => a + b, 0) / ndbiValues.length).toFixed(2)),
    highHeatZones: zones.filter(z => z.uhiClass === 'High').length,
    totalZones: zones.length,
    maxLST: Math.max(...lstValues),
    minLST: Math.min(...lstValues),
  };
};

export const getUHIColor = (uhiClass: UHIZone['uhiClass']): string => {
  switch (uhiClass) {
    case 'Low': return '#22c55e';
    case 'Moderate': return '#eab308';
    case 'High': return '#ef4444';
  }
};

export const getLSTColor = (lst: number): string => {
  if (lst < 28) return '#22c55e';
  if (lst < 32) return '#84cc16';
  if (lst < 35) return '#eab308';
  if (lst < 37) return '#f97316';
  return '#ef4444';
};

export const getNDVIColor = (ndvi: number): string => {
  if (ndvi < 0.2) return '#f87171';
  if (ndvi < 0.4) return '#fbbf24';
  if (ndvi < 0.6) return '#a3e635';
  return '#22c55e';
};

export const getNDBIColor = (ndbi: number): string => {
  if (ndbi < 0.2) return '#22c55e';
  if (ndbi < 0.4) return '#a3e635';
  if (ndbi < 0.6) return '#fbbf24';
  return '#ef4444';
};

export const getSuggestedAction = (zone: UHIZone): string => {
  if (zone.uhiClass === 'High') {
    if (zone.ndvi < 0.2) {
      return 'Critical: Plant trees and create green corridors. Consider cool roofs and reflective pavements.';
    }
    return 'Install cool roofs, increase shade structures, and enhance green spaces.';
  }
  if (zone.uhiClass === 'Moderate') {
    if (zone.ndbi > 0.5) {
      return 'Add vertical gardens, permeable pavements, and rooftop vegetation.';
    }
    return 'Maintain existing vegetation and add shade trees along streets.';
  }
  return 'Preserve natural vegetation and prevent urban encroachment.';
};
