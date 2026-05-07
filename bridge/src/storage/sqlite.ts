import initSqlJs, { Database as SqlJsDB } from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface PatientRecord {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  diagnosis: string;
  notes: string;
  doctorId: string;
  timestamp: string;
  syncStatus: 'pending' | 'synced';
}

export interface RecordCounts {
  total: number;
  pending: number;
  synced: number;
}

/**
 * SQLite database wrapper using sql.js (WASM — no native build required).
 * Persists to disk on every write.
 */
export class Database {
  private db!: SqlJsDB;
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = path.resolve(dbPath);
  }

  /** Must be called once before using the database */
  async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.migrate();
    console.log(`[sqlite] Database ready at ${this.dbPath}`);
  }

  private migrate(): void {
    this.db.run(`
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
        syncStatus  TEXT NOT NULL DEFAULT 'pending',
        createdAt   TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    this.persist();
  }

  /** Writes the in-memory db back to disk */
  private persist(): void {
    const data = this.db.export();
    fs.writeFileSync(this.dbPath, Buffer.from(data));
  }

  /**
   * Upsert a patient record by id. Idempotent.
   */
  upsertRecord(record: PatientRecord): void {
    this.db.run(
      `INSERT INTO records (id, patientId, name, age, gender, diagnosis, notes, doctorId, timestamp, syncStatus)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         patientId=excluded.patientId, name=excluded.name, age=excluded.age,
         gender=excluded.gender, diagnosis=excluded.diagnosis, notes=excluded.notes,
         doctorId=excluded.doctorId, timestamp=excluded.timestamp, syncStatus=excluded.syncStatus`,
      [record.id, record.patientId, record.name, record.age, record.gender,
       record.diagnosis, record.notes, record.doctorId, record.timestamp, record.syncStatus]
    );
    this.persist();
  }

  /** Returns all records ordered by timestamp descending */
  getAllRecords(): PatientRecord[] {
    const result = this.db.exec(`SELECT * FROM records ORDER BY timestamp DESC`);
    return this.toRecords(result);
  }

  /** Returns all records with syncStatus = 'pending' */
  getPendingRecords(): PatientRecord[] {
    const result = this.db.exec(`SELECT * FROM records WHERE syncStatus = 'pending' ORDER BY timestamp ASC`);
    return this.toRecords(result);
  }

  /** Marks a list of IDs as synced */
  markSynced(ids: string[]): void {
    for (const id of ids) {
      this.db.run(`UPDATE records SET syncStatus = 'synced' WHERE id = ?`, [id]);
    }
    this.persist();
  }

  /** Returns total, pending, and synced counts */
  getRecordCounts(): RecordCounts {
    const result = this.db.exec(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN syncStatus='pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN syncStatus='synced'  THEN 1 ELSE 0 END) as synced
      FROM records
    `);
    if (!result[0]) return { total: 0, pending: 0, synced: 0 };
    const [total, pending, synced] = result[0].values[0] as number[];
    return { total: total ?? 0, pending: pending ?? 0, synced: synced ?? 0 };
  }

  private toRecords(result: any[]): PatientRecord[] {
    if (!result[0]) return [];
    const { columns, values } = result[0];
    return values.map((row: any[]) => {
      const obj: any = {};
      columns.forEach((col: string, i: number) => { obj[col] = row[i]; });
      return obj as PatientRecord;
    });
  }
}

/** Initialises and returns the database (must await init()) */
export async function initDatabase(dbPath: string): Promise<Database> {
  const db = new Database(dbPath);
  await db.init();
  return db;
}
