/**
 * GeoPackage (GPKG) utility — pure-JavaScript implementation using sql.js.
 *
 * Exports:
 *  - createGeoPackage()  PostGIS query rows  → GPKG file on disk
 *  - encodeGpkgGeom()    GeoJSON string      → GPKG binary geometry blob
 *  - getWkbOffset()      GPKG flags byte     → WKB start offset
 */

import { promises as fs } from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

// ── GeoJSON geometry types ────────────────────────────────────────────────────

type Coord = [number, number];

interface GeoJsonPoint             { type: 'Point';              coordinates: Coord      }
interface GeoJsonLineString        { type: 'LineString';         coordinates: Coord[]    }
interface GeoJsonPolygon           { type: 'Polygon';            coordinates: Coord[][]  }
interface GeoJsonMultiPoint        { type: 'MultiPoint';         coordinates: Coord[]    }
interface GeoJsonMultiLineString   { type: 'MultiLineString';    coordinates: Coord[][]  }
interface GeoJsonMultiPolygon      { type: 'MultiPolygon';       coordinates: Coord[][][] }
interface GeoJsonGeometryCollection {
  type: 'GeometryCollection';
  geometries: GeoJsonGeometry[];
}

type GeoJsonGeometry =
  | GeoJsonPoint
  | GeoJsonLineString
  | GeoJsonPolygon
  | GeoJsonMultiPoint
  | GeoJsonMultiLineString
  | GeoJsonMultiPolygon
  | GeoJsonGeometryCollection;

// ── Low-level binary writers ──────────────────────────────────────────────────

function u8(v: number): Buffer {
  return Buffer.from([v]);
}

function u32LE(v: number): Buffer {
  const b = Buffer.allocUnsafe(4);
  b.writeUInt32LE(v, 0);
  return b;
}

function f64LE(v: number): Buffer {
  const b = Buffer.allocUnsafe(8);
  b.writeDoubleLE(v, 0);
  return b;
}

// ── Coordinate collection for bbox ───────────────────────────────────────────

function collectXY(geom: GeoJsonGeometry, out: number[]): void {
  switch (geom.type) {
    case 'Point':
      out.push(geom.coordinates[0], geom.coordinates[1]);
      break;
    case 'LineString':
    case 'MultiPoint':
      for (const c of geom.coordinates) out.push(c[0], c[1]);
      break;
    case 'Polygon':
    case 'MultiLineString':
      for (const ring of geom.coordinates) for (const c of ring) out.push(c[0], c[1]);
      break;
    case 'MultiPolygon':
      for (const poly of geom.coordinates)
        for (const ring of poly)
          for (const c of ring) out.push(c[0], c[1]);
      break;
    case 'GeometryCollection':
      for (const g of geom.geometries) collectXY(g, out);
      break;
  }
}

function geomBbox(geom: GeoJsonGeometry): [number, number, number, number] {
  const xy: number[] = [];
  collectXY(geom, xy);
  if (xy.length < 2) return [0, 0, 0, 0];

  let minX = xy[0] as number;
  let maxX = xy[0] as number;
  let minY = xy[1] as number;
  let maxY = xy[1] as number;

  for (let i = 0; i < xy.length; i += 2) {
    const x = xy[i] as number;
    const y = xy[i + 1] as number;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, maxX, minY, maxY];
}

// ── WKB encoding ──────────────────────────────────────────────────────────────

export function encodeWkb(geom: GeoJsonGeometry): Buffer {
  const parts: Buffer[] = [u8(0x01)]; // little-endian byte-order mark

  switch (geom.type) {
    case 'Point':
      parts.push(u32LE(1), f64LE(geom.coordinates[0]), f64LE(geom.coordinates[1]));
      break;

    case 'LineString':
      parts.push(u32LE(2), u32LE(geom.coordinates.length));
      for (const c of geom.coordinates) parts.push(f64LE(c[0]), f64LE(c[1]));
      break;

    case 'Polygon':
      parts.push(u32LE(3), u32LE(geom.coordinates.length));
      for (const ring of geom.coordinates) {
        parts.push(u32LE(ring.length));
        for (const c of ring) parts.push(f64LE(c[0]), f64LE(c[1]));
      }
      break;

    case 'MultiPoint':
      parts.push(u32LE(4), u32LE(geom.coordinates.length));
      for (const c of geom.coordinates)
        parts.push(encodeWkb({ type: 'Point', coordinates: c }));
      break;

    case 'MultiLineString':
      parts.push(u32LE(5), u32LE(geom.coordinates.length));
      for (const ls of geom.coordinates)
        parts.push(encodeWkb({ type: 'LineString', coordinates: ls }));
      break;

    case 'MultiPolygon':
      parts.push(u32LE(6), u32LE(geom.coordinates.length));
      for (const poly of geom.coordinates)
        parts.push(encodeWkb({ type: 'Polygon', coordinates: poly }));
      break;

    case 'GeometryCollection':
      parts.push(u32LE(7), u32LE(geom.geometries.length));
      for (const g of geom.geometries) parts.push(encodeWkb(g));
      break;
  }

  return Buffer.concat(parts);
}

// ── GPKG geometry blob ────────────────────────────────────────────────────────

/**
 * Encodes a GeoJSON string as a GeoPackage binary geometry blob.
 *
 * Header layout:
 *   [0-1]   Magic   0x47 0x50  ("GP")
 *   [2]     Version 0x00
 *   [3]     Flags   0x03  (bit0=little-endian | bits1-3=envelope_type_1)
 *   [4-7]   SRID    int32 LE
 *   [8-39]  Envelope [minx, maxx, miny, maxy]  (4 × float64 LE)
 *   [40+]   WKB geometry
 */
export function encodeGpkgGeom(
  geojsonStr: string | null | undefined,
  srid: number,
): Buffer {
  if (!geojsonStr) {
    // Empty geometry: flag bit 6 = 1 → 0x41 (LE + empty)
    const h = Buffer.allocUnsafe(8);
    h.writeUInt8(0x47, 0);
    h.writeUInt8(0x50, 1);
    h.writeUInt8(0x00, 2);
    h.writeUInt8(0x41, 3);
    h.writeInt32LE(srid, 4);
    return h;
  }

  const geom = JSON.parse(geojsonStr) as GeoJsonGeometry;
  const [minX, maxX, minY, maxY] = geomBbox(geom);
  const wkb = encodeWkb(geom);

  // Fixed header (8 bytes) + envelope (32 bytes)
  const header = Buffer.allocUnsafe(40);
  header.writeUInt8(0x47, 0);       // 'G'
  header.writeUInt8(0x50, 1);       // 'P'
  header.writeUInt8(0x00, 2);       // version
  header.writeUInt8(0x03, 3);       // flags: bit0=LE, bit1=envelope_type_1
  header.writeInt32LE(srid, 4);     // SRID
  header.writeDoubleLE(minX, 8);    // envelope minx
  header.writeDoubleLE(maxX, 16);   // envelope maxx
  header.writeDoubleLE(minY, 24);   // envelope miny
  header.writeDoubleLE(maxY, 32);   // envelope maxy

  return Buffer.concat([header, wkb]);
}

// ── GPKG geometry header parsing ─────────────────────────────────────────────

/**
 * Returns the byte offset where WKB data begins inside a GPKG geometry blob.
 *
 *   Offset = 8 (fixed header) + envelope_size
 *
 * Envelope sizes (envelope type encoded in bits 1-3 of flags byte):
 *   0 →  0 bytes (no envelope)
 *   1 → 32 bytes [minx, maxx, miny, maxy]
 *   2 → 48 bytes [minx, maxx, miny, maxy, minz, maxz]
 *   3 → 48 bytes [minx, maxx, miny, maxy, minm, maxm]
 *   4 → 64 bytes [minx, maxx, miny, maxy, minz, maxz, minm, maxm]
 */
export function getWkbOffset(flagsByte: number): number {
  const envType = (flagsByte >> 1) & 0x07;
  const envSizes: Partial<Record<number, number>> = { 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 };
  return 8 + (envSizes[envType] ?? 0);
}

// ── GeoPackage file creation ──────────────────────────────────────────────────

/**
 * Creates a GeoPackage (.gpkg) file from PostGIS query rows.
 *
 * @param layerName  Table / layer name (used as feature table name inside GPKG)
 * @param rows       PostGIS rows; must include `st_asgeojson` column
 * @param geomCol    Original geometry column name (excluded from attributes)
 * @param srid       Spatial reference identifier
 * @param geomType   Geometry type string, e.g. "MULTIPOLYGON"
 * @param outPath    Absolute path where the .gpkg file will be written
 */
export async function createGeoPackage(
  layerName: string,
  rows: Record<string, unknown>[],
  geomCol: string,
  srid: number,
  geomType: string,
  outPath: string,
): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // ── Mandatory GPKG PRAGMAs ──────────────────────────────────────────────
  db.run('PRAGMA application_id = 1196444487;'); // 0x47504B47 = 'GPKG'
  db.run('PRAGMA user_version = 10200;');         // GPKG 1.2.0

  // ── gpkg_spatial_ref_sys ────────────────────────────────────────────────
  db.run(`CREATE TABLE gpkg_spatial_ref_sys (
    srs_name                 TEXT    NOT NULL,
    srs_id                   INTEGER NOT NULL PRIMARY KEY,
    organization             TEXT    NOT NULL,
    organization_coordsys_id INTEGER NOT NULL,
    definition               TEXT    NOT NULL,
    description              TEXT
  )`);

  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES
    ('Undefined cartesian SRS',  -1, 'NONE', -1, 'undefined', NULL)`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES
    ('Undefined geographic SRS',  0, 'NONE',  0, 'undefined', NULL)`);
  db.run(`INSERT INTO gpkg_spatial_ref_sys VALUES (
    'WGS 84 geodetic', 4326, 'EPSG', 4326,
    'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]]',
    'longitude/latitude coordinates in decimal degrees on the WGS 84 spheroid'
  )`);

  if (srid !== 4326 && srid !== 0 && srid !== -1) {
    db.run(
      `INSERT OR IGNORE INTO gpkg_spatial_ref_sys VALUES (?, ?, 'EPSG', ?, 'undefined', NULL)`,
      [`EPSG:${srid}`, srid, srid],
    );
  }

  // ── gpkg_contents ───────────────────────────────────────────────────────
  db.run(`CREATE TABLE gpkg_contents (
    table_name  TEXT     NOT NULL PRIMARY KEY,
    data_type   TEXT     NOT NULL,
    identifier  TEXT,
    description TEXT     DEFAULT '',
    last_change DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    min_x       REAL,
    min_y       REAL,
    max_x       REAL,
    max_y       REAL,
    srs_id      INTEGER,
    CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
  )`);

  db.run(
    `INSERT INTO gpkg_contents (table_name, data_type, identifier, srs_id)
     VALUES (?, 'features', ?, ?)`,
    [layerName, layerName, srid],
  );

  // ── gpkg_geometry_columns ───────────────────────────────────────────────
  db.run(`CREATE TABLE gpkg_geometry_columns (
    table_name         TEXT    NOT NULL,
    column_name        TEXT    NOT NULL,
    geometry_type_name TEXT    NOT NULL,
    srs_id             INTEGER NOT NULL,
    z                  TINYINT NOT NULL DEFAULT 0,
    m                  TINYINT NOT NULL DEFAULT 0,
    CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
    CONSTRAINT fk_gc_tn  FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name),
    CONSTRAINT fk_gc_srs FOREIGN KEY (srs_id)     REFERENCES gpkg_spatial_ref_sys(srs_id)
  )`);

  const normGeomType = geomType.toUpperCase().replace(/\s+/g, '');
  db.run(`INSERT INTO gpkg_geometry_columns VALUES (?, 'geom', ?, ?, 0, 0)`, [
    layerName,
    normGeomType,
    srid,
  ]);

  // ── Feature table ───────────────────────────────────────────────────────
  // Skip PostGIS metadata columns and the original geometry column
  const SKIP = new Set([
    geomCol.toLowerCase(),
    'st_asgeojson',
    'geometrytype',
    'st_srid',
  ]);

  const attrCols =
    rows.length > 0
      ? Object.keys(rows[0]).filter(k => !SKIP.has(k.toLowerCase()))
      : [];

  const colDefs = [
    'id INTEGER PRIMARY KEY AUTOINCREMENT',
    ...attrCols.map(c => `"${c}" TEXT`),
    'geom BLOB',
  ].join(', ');

  db.run(`CREATE TABLE "${layerName}" (${colDefs})`);

  // ── Insert features ─────────────────────────────────────────────────────
  if (rows.length > 0) {
    const insertCols = [...attrCols.map(c => `"${c}"`), 'geom'].join(', ');
    const placeholders = [...attrCols.map(() => '?'), '?'].join(', ');
    const stmt = db.prepare(
      `INSERT INTO "${layerName}" (${insertCols}) VALUES (${placeholders})`,
    );

    for (const row of rows) {
      const geojsonStr = (row['st_asgeojson'] as string | null | undefined) ?? null;
      const gpkgGeom = encodeGpkgGeom(geojsonStr, srid);

      const vals: Array<string | null | Uint8Array> = [
        ...attrCols.map(c => {
          const v = row[c];
          return v !== null && v !== undefined ? String(v) : null;
        }),
        gpkgGeom,
      ];
      stmt.run(vals);
    }
    stmt.free();
  }

  // ── Export ──────────────────────────────────────────────────────────────
  const exported = db.export();
  db.close();

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, Buffer.from(exported));
}
