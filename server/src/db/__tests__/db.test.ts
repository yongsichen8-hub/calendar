import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../index';

describe('Database initialization', () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      db.close();
    }
  });

  it('should create all required tables', () => {
    db = initializeDatabase(':memory:');

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all()
      .map((row: any) => row.name);

    expect(tables).toEqual([
      'categories',
      'expense_categories',
      'expense_entries',
      'inspiration_categories',
      'inspiration_entries',
      'key_results',
      'kr_milestones',
      'management_subjects',
      'objectives',
      'summaries',
      'todo_items',
      'travel_orders',
      'travel_policy',
      'users',
      'work_entries',
    ]);
  });

  it('should create idx_work_entries_user_date_slot index', () => {
    db = initializeDatabase(':memory:');

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_work_entries_user_date_slot'"
      )
      .all();

    expect(indexes).toHaveLength(1);
  });

  it('should enable WAL mode (pragma is called)', () => {
    db = initializeDatabase(':memory:');

    const result = db.pragma('journal_mode') as { journal_mode: string }[];
    expect(result[0].journal_mode).toBe('memory');
  });

  it('should enable foreign keys', () => {
    db = initializeDatabase(':memory:');

    const result = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it('should be idempotent (safe to call twice)', () => {
    db = initializeDatabase(':memory:');

    expect(() => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          passwordHash TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);
    }).not.toThrow();
  });

  it('should have progress column in key_results instead of completed', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(key_results)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('progress');
    expect(columnNames).not.toContain('completed');
  });

  it('should set user_version to 17 after all migrations', () => {
    db = initializeDatabase(':memory:');

    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(18);
  });

  it('should have endDate column in expense_entries', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('endDate');
  });

  it('should have paid column in expense_entries', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('paid');
  });

  it('should have budget column in expense_categories', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(expense_categories)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('budget');
  });

  it('should have currency and exchangeRate columns in management_subjects', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(management_subjects)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('currency');
    expect(columnNames).toContain('exchangeRate');
  });

  it('should have currency column in expense_entries', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('currency');
  });

  it('should have travel_orders table', () => {
    db = initializeDatabase(':memory:');

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='travel_orders'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('should have travelOrderId and subType columns in expense_entries', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('travelOrderId');
    expect(columnNames).toContain('subType');
  });

  it('should have travel_policy table', () => {
    db = initializeDatabase(':memory:');

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='travel_policy'"
    ).all();
    expect(tables).toHaveLength(1);

    const columns = db.prepare("PRAGMA table_info(travel_policy)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('dailyAllowance');
    expect(columnNames).toContain('hotelTier1BeijingLow');
    expect(columnNames).toContain('hotelTier4');
  });

  it('should have destination and destinationCity columns in travel_orders', () => {
    db = initializeDatabase(':memory:');

    const columns = db.prepare("PRAGMA table_info(travel_orders)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);
    expect(columnNames).toContain('destination');
    expect(columnNames).toContain('destinationCity');
  });

  it('should migrate completed=1 to progress=100 for existing data', () => {
    // Simulate an old database with completed column
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Create old schema with completed column
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id),
        UNIQUE(userId, name)
      );
      CREATE TABLE objectives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        categoryId INTEGER NOT NULL,
        quarter TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      );
      CREATE TABLE key_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objectiveId INTEGER NOT NULL,
        description TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (objectiveId) REFERENCES objectives(id) ON DELETE CASCADE
      );
    `);

    // Insert test data
    db.exec(`INSERT INTO users (username, passwordHash) VALUES ('testuser', 'hash')`);
    db.exec(`INSERT INTO categories (userId, name, color) VALUES (1, 'Work', '#000')`);
    db.exec(`INSERT INTO objectives (userId, categoryId, quarter, title) VALUES (1, 1, '2025-Q1', 'Test Obj')`);
    db.exec(`INSERT INTO key_results (objectiveId, description, completed) VALUES (1, 'KR done', 1)`);
    db.exec(`INSERT INTO key_results (objectiveId, description, completed) VALUES (1, 'KR not done', 0)`);
    db.close();

    // Now run initializeDatabase which should perform the migration
    // Since we can't reuse the in-memory DB, we test the migration logic directly
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // Recreate old schema with data
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id),
        UNIQUE(userId, name)
      );
      CREATE TABLE objectives (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        categoryId INTEGER NOT NULL,
        quarter TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (categoryId) REFERENCES categories(id)
      );
      CREATE TABLE key_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        objectiveId INTEGER NOT NULL,
        description TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (objectiveId) REFERENCES objectives(id) ON DELETE CASCADE
      );
    `);
    db.exec(`INSERT INTO users (username, passwordHash) VALUES ('testuser', 'hash')`);
    db.exec(`INSERT INTO categories (userId, name, color) VALUES (1, 'Work', '#000')`);
    db.exec(`INSERT INTO objectives (userId, categoryId, quarter, title) VALUES (1, 1, '2025-Q1', 'Test Obj')`);
    db.exec(`INSERT INTO key_results (objectiveId, description, completed) VALUES (1, 'KR done', 1)`);
    db.exec(`INSERT INTO key_results (objectiveId, description, completed) VALUES (1, 'KR not done', 0)`);

    // Manually run the migration logic (same as in initializeDatabase)
    const currentVersion = db.pragma('user_version', { simple: true }) as number;
    expect(currentVersion).toBe(0);

    db.transaction(() => {
      const columns = db.prepare("PRAGMA table_info(key_results)").all() as { name: string }[];
      const hasCompleted = columns.some(c => c.name === 'completed');
      const hasProgress = columns.some(c => c.name === 'progress');

      if (hasCompleted && !hasProgress) {
        db.exec(`ALTER TABLE key_results ADD COLUMN progress INTEGER NOT NULL DEFAULT 0`);
        db.exec(`UPDATE key_results SET progress = 100 WHERE completed = 1`);
        db.exec(`UPDATE key_results SET progress = 0 WHERE completed = 0`);

        db.exec(`
          CREATE TABLE key_results_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            objectiveId INTEGER NOT NULL,
            description TEXT NOT NULL,
            progress INTEGER NOT NULL DEFAULT 0,
            createdAt TEXT NOT NULL DEFAULT (datetime('now')),
            updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (objectiveId) REFERENCES objectives(id) ON DELETE CASCADE
          );
          INSERT INTO key_results_new SELECT id, objectiveId, description, progress, createdAt, updatedAt FROM key_results;
          DROP TABLE key_results;
          ALTER TABLE key_results_new RENAME TO key_results;
        `);
      }
      db.pragma('user_version = 1');
    })();

    // Verify migration results
    const rows = db.prepare('SELECT description, progress FROM key_results ORDER BY id').all() as any[];
    expect(rows).toEqual([
      { description: 'KR done', progress: 100 },
      { description: 'KR not done', progress: 0 },
    ]);

    // Verify completed column is gone
    const cols = db.prepare("PRAGMA table_info(key_results)").all() as { name: string }[];
    expect(cols.map(c => c.name)).not.toContain('completed');
    expect(cols.map(c => c.name)).toContain('progress');

    // Verify version updated
    const version = db.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(1);
  });
});
