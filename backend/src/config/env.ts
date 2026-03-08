import dotenv from 'dotenv';
import path from 'path';

// Load .env from the backend root (one level up from src/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const env = {
  NODE_ENV:    optionalEnv('NODE_ENV', 'development'),
  PORT:        parseInt(optionalEnv('PORT', '3000'), 10),

  // PostgreSQL
  DB_HOST:     optionalEnv('DB_HOST', 'localhost'),
  DB_PORT:     parseInt(optionalEnv('DB_PORT', '5432'), 10),
  DB_NAME:     requireEnv('DB_NAME'),
  DB_USER:     requireEnv('DB_USER'),
  DB_PASSWORD: requireEnv('DB_PASSWORD'),
  DB_SSL:      optionalEnv('DB_SSL', 'false') === 'true',

  // CORS
  CORS_ORIGIN: optionalEnv('CORS_ORIGIN', 'http://localhost:5173'),

  // GeoServer
  GEOSERVER_URL:               optionalEnv('GEOSERVER_URL', 'http://localhost:8080/geoserver'),
  GEOSERVER_USER:              optionalEnv('GEOSERVER_USER', 'admin'),
  GEOSERVER_PASSWORD:          optionalEnv('GEOSERVER_PASSWORD', 'geoserver'),
  GEOSERVER_DEFAULT_WORKSPACE: optionalEnv('GEOSERVER_DEFAULT_WORKSPACE', 'smart_geci'),
  GEOSERVER_WORKSPACE:         optionalEnv('GEOSERVER_WORKSPACE', 'smartgeci'),
  GEOSERVER_DATASTORE:         optionalEnv('GEOSERVER_DATASTORE', 'campus_db'),

  // JWT
  JWT_SECRET:     requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: optionalEnv('JWT_EXPIRES_IN', '8h'),

  get isDevelopment() { return this.NODE_ENV === 'development'; },
  get isProduction()  { return this.NODE_ENV === 'production'; },
} as const;
