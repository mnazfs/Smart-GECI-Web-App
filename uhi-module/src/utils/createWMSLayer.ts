import L from 'leaflet';

/**
 * GeoServer WMS configuration
 */
const GEOSERVER_BASE_URL = 'http://localhost:8080/geoserver/wms';
const WORKSPACE = 'smartgeci';

/**
 * WMS layer definitions with GeoServer layer names and styles
 */
export const WMS_LAYERS = {
  lst: {
    layerName: `${WORKSPACE}:Idukki_LST`,
    styleName: 'lst_heatmap',
    displayName: 'Land Surface Temperature',
  },
  ndvi: {
    layerName: `${WORKSPACE}:Idukki_NDVI`,
    styleName: 'ndvi_style',
    displayName: 'Vegetation Index',
  },
  ndbi: {
    layerName: `${WORKSPACE}:Idukki_NDBI`,
    styleName: 'ndbi_style',
    displayName: 'Built-up Index',
  },
  uhi: {
    layerName: `${WORKSPACE}:Idukki_UHI`,
    styleName: 'uhi_style',
    displayName: 'Urban Heat Island',
  },
} as const;

export type WMSLayerKey = keyof typeof WMS_LAYERS;

/**
 * Creates a Leaflet WMS tile layer connected to GeoServer
 * 
 * @param layerKey - The layer identifier (lst, ndvi, ndbi, uhi)
 * @param opacity - Layer opacity (0-1)
 * @returns Leaflet WMS TileLayer
 */
export const createWMSLayer = (
  layerKey: WMSLayerKey,
  opacity: number = 1.0
): L.TileLayer.WMS => {
  const config = WMS_LAYERS[layerKey];

  const layer = L.tileLayer.wms(GEOSERVER_BASE_URL, {
    layers: config.layerName,
    styles: config.styleName,
    format: 'image/png',
    transparent: true,
    version: '1.1.1',
    crs: L.CRS.EPSG3857,
    opacity: opacity,
    attribution: '© GeoServer',
  });

  return layer;
};

/**
 * Constructs GetFeatureInfo URL for a given point
 * (For future spatial analysis - not used yet)
 * 
 * @param layerKey - The layer to query
 * @param map - Leaflet map instance
 * @param latlng - Click coordinates
 * @returns GetFeatureInfo URL
 */
export const buildGetFeatureInfoURL = (
  layerKey: WMSLayerKey,
  map: L.Map,
  latlng: L.LatLng
): string => {
  const config = WMS_LAYERS[layerKey];
  const point = map.latLngToContainerPoint(latlng);
  const size = map.getSize();
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: config.layerName,
    QUERY_LAYERS: config.layerName,
    STYLES: config.styleName,
    BBOX: `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`,
    HEIGHT: size.y.toString(),
    WIDTH: size.x.toString(),
    FORMAT: 'image/png',
    INFO_FORMAT: 'application/json',
    SRS: 'EPSG:3857',
    X: Math.floor(point.x).toString(),
    Y: Math.floor(point.y).toString(),
  });

  return `${GEOSERVER_BASE_URL}?${params.toString()}`;
};
