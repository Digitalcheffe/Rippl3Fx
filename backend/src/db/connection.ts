import Database, { Database as DatabaseType } from 'better-sqlite3';
import { getDbPath } from '../config';

const db: DatabaseType = new Database(getDbPath());

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
