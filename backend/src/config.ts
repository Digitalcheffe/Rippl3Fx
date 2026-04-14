import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

interface AppConfig {
  encryption_key: string;
  jwt_secret: string;
}

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const DB_PATH = path.join(DATA_DIR, 'rippl3fx.db');

let _config: AppConfig | null = null;

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function loadOrCreateConfig(): AppConfig {
  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Try loading existing config
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const stored = JSON.parse(raw) as Partial<AppConfig>;
      // Env vars override stored values
      return {
        encryption_key: process.env.ENCRYPTION_KEY || stored.encryption_key || generateSecret(),
        jwt_secret: process.env.JWT_SECRET || stored.jwt_secret || generateSecret(),
      };
    } catch {
      // Corrupted config — regenerate
    }
  }

  // Generate fresh config — env vars take priority if set
  const config: AppConfig = {
    encryption_key: process.env.ENCRYPTION_KEY || generateSecret(),
    jwt_secret: process.env.JWT_SECRET || generateSecret(),
  };

  // Persist to disk so secrets survive restarts
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Config generated at ${CONFIG_PATH}`);

  return config;
}

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadOrCreateConfig();
  }
  return _config;
}

export function getDbPath(): string {
  return DB_PATH;
}

export function getDataDir(): string {
  return DATA_DIR;
}
