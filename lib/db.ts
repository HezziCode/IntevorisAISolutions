import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { Enquiry, BusinessStatus, CategorizationState, Category } from './types';

// Store the SQLite database file in the project root
const DB_PATH = path.resolve(process.cwd(), 'enquiries.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    
    // Enable WAL mode for better concurrency and performance
    dbInstance.exec('PRAGMA journal_mode = WAL;');

    // Initialize enquiries table if it does not already exist
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS enquiries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'New',
        category TEXT,
        categorizationState TEXT NOT NULL DEFAULT 'Pending'
      );
    `);
  }
  return dbInstance;
}

// 1. Create a new enquiry (status: 'New', categorizationState: 'Pending', category: null)
export function saveEnquiry(enquiry: Enquiry): Enquiry {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO enquiries (id, name, email, message, createdAt, status, category, categorizationState)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    enquiry.id,
    enquiry.name,
    enquiry.email,
    enquiry.message,
    enquiry.createdAt,
    enquiry.status,
    enquiry.category,
    enquiry.categorizationState
  );

  return enquiry;
}

// 2. Fetch all enquiries, ordered newest first, with optional status filtering
export function listEnquiries(statusFilter?: string): Enquiry[] {
  const db = getDb();

  if (statusFilter && statusFilter !== 'All') {
    const stmt = db.prepare(`
      SELECT * FROM enquiries
      WHERE status = ?
      ORDER BY datetime(createdAt) DESC
    `);
    return stmt.all(statusFilter) as unknown as Enquiry[];
  }

  const stmt = db.prepare(`
    SELECT * FROM enquiries
    ORDER BY datetime(createdAt) DESC
  `);
  return stmt.all() as unknown as Enquiry[];
}

// 3. Find a single enquiry by its unique ID
export function findEnquiryById(id: string): Enquiry | null {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM enquiries WHERE id = ?`);
  const result = stmt.get(id);
  return (result as unknown as Enquiry) || null;
}

// 4. Update Business Status ('New' | 'In Progress' | 'Resolved')
export function updateStatus(id: string, newStatus: BusinessStatus): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE enquiries
    SET status = ?
    WHERE id = ?
  `);
  const info = stmt.run(newStatus, id);
  return Number(info.changes) > 0;
}

// 5. Update AI Categorization Result (Category & State)
export function updateCategorization(
  id: string,
  category: Category | null,
  state: CategorizationState
): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE enquiries
    SET category = ?, categorizationState = ?
    WHERE id = ?
  `);
  const info = stmt.run(category, state, id);
  return Number(info.changes) > 0;
}
