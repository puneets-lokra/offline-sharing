import initSqlJs, { Database as SqlJsDB } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface PatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: string;
  diagnosis: string;
  notes: string;
  doctorId: string;
  timestamp: string;
  syncStatus: string;
}

let instance: SqlJsDB | null = null;
const DB_PATH = path.resolve(process.cwd(), 'data', 'cloud.db');

/** Initialises the cloud SQLite database and runs migrations */
export async function getDatabase(): Promise<SqlJsDB> {
  if (instance) return instance;

  const SQL = await initSqlJs();
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(DB_PATH)) {
    instance = new SQL.Database(fs.readFileSync(DB_PATH));
  } else {
    instance = new SQL.Database();
  }

  instance.run(`
    CREATE TABLE IF NOT EXISTS records (
      id          TEXT PRIMARY KEY,
      patientId   TEXT NOT NULL,
      name        TEXT NOT NULL,
      age         INTEGER NOT NULL,
      gender      TEXT NOT NULL,
      diagnosis   TEXT NOT NULL,
      notes       TEXT NOT NULL DEFAULT '',
      doctorId    TEXT NOT NULL,
      timestamp   TEXT NOT NULL,
      syncStatus  TEXT NOT NULL DEFAULT 'synced',
      receivedAt  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  persist(instance);
  console.log('[db] Cloud SQLite database ready');
  return instance;
}

function persist(db: SqlJsDB): void {
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

/** Upserts a patient record. Idempotent by id. */
export function upsertRecord(db: SqlJsDB, record: PatientRecord): void {
  db.run(
    `INSERT INTO records (id, patientId, name, age, gender, diagnosis, notes, doctorId, timestamp, syncStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
     ON CONFLICT(id) DO UPDATE SET
       patientId=excluded.patientId, name=excluded.name, age=excluded.age,
       gender=excluded.gender, diagnosis=excluded.diagnosis, notes=excluded.notes,
       doctorId=excluded.doctorId, timestamp=excluded.timestamp`,
    [record.id, record.patientId, record.name, record.age, record.gender,
     record.diagnosis, record.notes, record.doctorId, record.timestamp]
  );
  persist(db);
}

/** Returns all records */
export function getAllRecords(db: SqlJsDB): PatientRecord[] {
  const result = db.exec('SELECT * FROM records ORDER BY timestamp DESC');
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj: any = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as PatientRecord;
  });
}
