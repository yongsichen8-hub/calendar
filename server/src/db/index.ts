import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    // Lazy import config to avoid triggering env validation at module load time
    const { config } = require('../config');
    db = initializeDatabase(config.databasePath);
  }
  return db;
}

export function initializeDatabase(dbPath: string): Database.Database {
  // Ensure the directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  const database = new Database(dbPath);

  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      isDefault INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, name)
    );

    CREATE TABLE IF NOT EXISTS work_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      date TEXT NOT NULL,
      timeSlot TEXT NOT NULL,
      subCategory TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (categoryId) REFERENCES categories(id)
    );

    CREATE INDEX IF NOT EXISTS idx_work_entries_user_date_slot
      ON work_entries(userId, date, timeSlot);

    CREATE TABLE IF NOT EXISTS objectives (
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

    CREATE TABLE IF NOT EXISTS key_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      objectiveId INTEGER NOT NULL,
      description TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (objectiveId) REFERENCES objectives(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inspiration_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      UNIQUE(userId, name)
    );

    CREATE TABLE IF NOT EXISTS inspiration_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('inspiration', 'todo')),
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (categoryId) REFERENCES inspiration_categories(id)
    );

    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('daily', 'weekly', 'monthly', 'quarterly')),
      target TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS todo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_todo_items_user_date
      ON todo_items(userId, date);
  `);

  // --- Migration: completed → progress for key_results ---
  const currentVersion = database.pragma('user_version', { simple: true }) as number;

  if (currentVersion < 1) {
    database.transaction(() => {
      // Check if the old 'completed' column exists (existing DB needing migration)
      const columns = database.prepare("PRAGMA table_info(key_results)").all() as { name: string }[];
      const hasCompleted = columns.some(c => c.name === 'completed');
      const hasProgress = columns.some(c => c.name === 'progress');

      if (hasCompleted && !hasProgress) {
        // Existing DB: add progress, migrate data, recreate table without completed
        database.exec(`ALTER TABLE key_results ADD COLUMN progress INTEGER NOT NULL DEFAULT 0`);
        database.exec(`UPDATE key_results SET progress = 100 WHERE completed = 1`);
        database.exec(`UPDATE key_results SET progress = 0 WHERE completed = 0`);

        database.exec(`
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
      // If fresh DB (has progress, no completed), no data migration needed

      // Update version
      database.pragma('user_version = 1');
    })();
  }

  // --- Migration v2: Add kr_milestones table ---
  const currentVersionV2 = database.pragma('user_version', { simple: true }) as number;


  if (currentVersionV2 < 2) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS kr_milestones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          keyResultId INTEGER NOT NULL,
          content TEXT NOT NULL,
          date TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (keyResultId) REFERENCES key_results(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_kr_milestones_kr
          ON kr_milestones(keyResultId);
      `);

      database.pragma('user_version = 2');
    })();
  }

  // --- Migration v3: Add deadline column to todo_items ---
  const currentVersionV3 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV3 < 3) {
    database.transaction(() => {
      const columns = database.prepare("PRAGMA table_info(todo_items)").all() as { name: string }[];
      const hasDeadline = columns.some(c => c.name === 'deadline');
      if (!hasDeadline) {
        database.exec(`ALTER TABLE todo_items ADD COLUMN deadline TEXT DEFAULT NULL`);
      }
      database.pragma('user_version = 3');
    })();
  }

  // --- Migration v4: Add deadline column to inspiration_entries ---
  const currentVersionV4 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV4 < 4) {
    database.transaction(() => {
      const columns = database.prepare("PRAGMA table_info(inspiration_entries)").all() as { name: string }[];
      const hasDeadline = columns.some(c => c.name === 'deadline');
      if (!hasDeadline) {
        database.exec(`ALTER TABLE inspiration_entries ADD COLUMN deadline TEXT DEFAULT NULL`);
      }
      database.pragma('user_version = 4');
    })();
  }

  // --- Migration v5: Add budget ledger tables (management_subjects, expense_categories, expense_entries) ---
  const currentVersionV5 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV5 < 5) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS management_subjects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          name TEXT NOT NULL,
          totalBudget REAL NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (userId) REFERENCES users(id),
          UNIQUE(userId, name)
        );

        CREATE TABLE IF NOT EXISTS expense_categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          subjectId INTEGER NOT NULL,
          name TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (subjectId) REFERENCES management_subjects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS expense_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          categoryId INTEGER NOT NULL,
          amount REAL NOT NULL,
          description TEXT NOT NULL,
          date TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (userId) REFERENCES users(id),
          FOREIGN KEY (categoryId) REFERENCES expense_categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_expense_entries_category_date
          ON expense_entries(categoryId, date);
      `);

      database.pragma('user_version = 5');
    })();
  }

  // --- Migration v6: Move budget from management_subjects to expense_categories ---
  const currentVersionV6 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV6 < 6) {
    database.transaction(() => {
      // Add budget column to expense_categories
      const cols = database.prepare("PRAGMA table_info(expense_categories)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'budget')) {
        database.exec(`ALTER TABLE expense_categories ADD COLUMN budget REAL NOT NULL DEFAULT 0`);
      }
      database.pragma('user_version = 6');
    })();
  }

  // --- Migration v7: Add travel_orders table and travelOrderId to expense_entries ---
  const currentVersionV7 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV7 < 7) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS travel_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          categoryId INTEGER NOT NULL,
          title TEXT NOT NULL,
          departureDate TEXT NOT NULL,
          returnDate TEXT NOT NULL,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (userId) REFERENCES users(id),
          FOREIGN KEY (categoryId) REFERENCES expense_categories(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_travel_orders_category
          ON travel_orders(categoryId);
      `);

      // Add travelOrderId column to expense_entries
      const cols = database.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'travelOrderId')) {
        database.exec(`ALTER TABLE expense_entries ADD COLUMN travelOrderId INTEGER DEFAULT NULL REFERENCES travel_orders(id) ON DELETE CASCADE`);
      }
      // Add subType column to expense_entries for travel sub-categories
      if (!cols.some(c => c.name === 'subType')) {
        database.exec(`ALTER TABLE expense_entries ADD COLUMN subType TEXT DEFAULT NULL`);
      }

      database.pragma('user_version = 7');
    })();
  }

  // --- Migration v8: Add travel_policy table ---
  const currentVersionV8 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV8 < 8) {
    database.transaction(() => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS travel_policy (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          dailyAllowance REAL NOT NULL DEFAULT 100,
          hotelTier1BeijingLow REAL NOT NULL DEFAULT 500,
          hotelTier1BeijingHigh REAL NOT NULL DEFAULT 600,
          hotelTier1Other REAL NOT NULL DEFAULT 500,
          hotelTier2Low REAL NOT NULL DEFAULT 400,
          hotelTier2High REAL NOT NULL DEFAULT 400,
          hotelTier3 REAL NOT NULL DEFAULT 370,
          hotelTier4 REAL NOT NULL DEFAULT 320,
          createdAt TEXT NOT NULL DEFAULT (datetime('now')),
          updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (userId) REFERENCES users(id),
          UNIQUE(userId)
        );
      `);
      database.pragma('user_version = 8');
    })();
  }

  // --- Migration v9: Add destination and destinationCity to travel_orders ---
  const currentVersionV9 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV9 < 9) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(travel_orders)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'destination')) {
        database.exec(`ALTER TABLE travel_orders ADD COLUMN destination TEXT NOT NULL DEFAULT '境内'`);
      }
      if (!cols.some(c => c.name === 'destinationCity')) {
        database.exec(`ALTER TABLE travel_orders ADD COLUMN destinationCity TEXT NOT NULL DEFAULT ''`);
      }
      database.pragma('user_version = 9');
    })();
  }

  // --- Migration v10: Add endDate column to expense_entries (for hotel date ranges) ---
  const currentVersionV10 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV10 < 10) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'endDate')) {
        database.exec(`ALTER TABLE expense_entries ADD COLUMN endDate TEXT DEFAULT NULL`);
      }
      database.pragma('user_version = 10');
    })();
  }

  // --- Migration v11: Add paid column to expense_entries (for 补贴 已发/未发) ---
  const currentVersionV11 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV11 < 11) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'paid')) {
        database.exec(`ALTER TABLE expense_entries ADD COLUMN paid INTEGER NOT NULL DEFAULT 0`);
      }
      database.pragma('user_version = 11');
    })();
  }

  // --- Migration v12: Add overseas travel policy columns ---
  const currentVersionV12 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV12 < 12) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(travel_policy)").all() as { name: string }[];
      const overseasCols = [
        { name: 'overseasHotelTier1', def: 230 }, { name: 'overseasHotelTier2', def: 210 },
        { name: 'overseasHotelTier3', def: 180 }, { name: 'overseasHotelTier4', def: 150 },
        { name: 'overseasHotelTier5', def: 130 }, { name: 'overseasHotelTier6', def: 110 },
        { name: 'overseasHotelTier7', def: 90 },
        { name: 'overseasAllowanceTier1', def: 60 }, { name: 'overseasAllowanceTier2', def: 55 },
        { name: 'overseasAllowanceTier3', def: 50 }, { name: 'overseasAllowanceTier4', def: 45 },
        { name: 'overseasAllowanceTier5', def: 40 }, { name: 'overseasAllowanceTier6', def: 35 },
        { name: 'overseasAllowanceTier7', def: 30 },
      ];
      for (const c of overseasCols) {
        if (!cols.some(col => col.name === c.name)) {
          database.exec(`ALTER TABLE travel_policy ADD COLUMN ${c.name} REAL NOT NULL DEFAULT ${c.def}`);
        }
      }
      database.pragma('user_version = 12');
    })();
  }

  // --- Migration v13: Add currency and exchangeRate to management_subjects ---
  const currentVersionV13 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV13 < 13) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(management_subjects)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'currency')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'`);
      }
      if (!cols.some(c => c.name === 'exchangeRate')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN exchangeRate REAL NOT NULL DEFAULT 1.0`);
      }
      database.pragma('user_version = 13');
    })();
  }

  // --- Migration v14: Add currency column to expense_entries ---
  const currentVersionV14 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV14 < 14) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(expense_entries)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'currency')) {
        database.exec(`ALTER TABLE expense_entries ADD COLUMN currency TEXT NOT NULL DEFAULT 'CNY'`);
      }
      database.pragma('user_version = 14');
    })();
  }

  // --- Migration v15: Backfill currency for existing expenses under EUR subjects ---
  const currentVersionV15 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV15 < 15) {
    database.transaction(() => {
      // For EUR subjects: set non-补贴 expenses to EUR, 境内补贴 stays CNY, 境外补贴 stays as-is
      database.exec(`
        UPDATE expense_entries SET currency = 'EUR'
        WHERE currency = 'CNY'
          AND categoryId IN (
            SELECT ec.id FROM expense_categories ec
            JOIN management_subjects ms ON ms.id = ec.subjectId
            WHERE ms.currency = 'EUR'
          )
          AND (subType IS NULL OR subType != '补贴')
      `);
      // 境外补贴: set to travel order's destination-based currency
      // For simplicity, leave 境内补贴 as CNY (correct) and 境外补贴 as CNY (will be manually corrected if needed)
      database.pragma('user_version = 15');
    })();
  }

  // --- Migration v16: Add travelBudgetCode, entertainBudgetCode, costCenterCode to management_subjects ---
  const currentVersionV16 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV16 < 16) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(management_subjects)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'travelBudgetCode')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN travelBudgetCode TEXT NOT NULL DEFAULT ''`);
      }
      if (!cols.some(c => c.name === 'entertainBudgetCode')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN entertainBudgetCode TEXT NOT NULL DEFAULT ''`);
      }
      if (!cols.some(c => c.name === 'costCenterCode')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN costCenterCode TEXT NOT NULL DEFAULT ''`);
      }
      if (!cols.some(c => c.name === 'collaborationBudgetCode')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN collaborationBudgetCode TEXT NOT NULL DEFAULT ''`);
      }
      database.pragma('user_version = 16');
    })();
  }

  // --- Migration v17: Add collaborationBudgetCode to management_subjects ---
  const currentVersionV17 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV17 < 17) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(management_subjects)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'collaborationBudgetCode')) {
        database.exec(`ALTER TABLE management_subjects ADD COLUMN collaborationBudgetCode TEXT NOT NULL DEFAULT ''`);
      }
      database.pragma('user_version = 17');
    })();
  }

  // --- Migration v18: Add used and imageData columns to inspiration_entries ---
  const currentVersionV18 = database.pragma('user_version', { simple: true }) as number;

  if (currentVersionV18 < 18) {
    database.transaction(() => {
      const cols = database.prepare("PRAGMA table_info(inspiration_entries)").all() as { name: string }[];
      if (!cols.some(c => c.name === 'used')) {
        database.exec(`ALTER TABLE inspiration_entries ADD COLUMN used INTEGER NOT NULL DEFAULT 0`);
      }
      if (!cols.some(c => c.name === 'imageData')) {
        database.exec(`ALTER TABLE inspiration_entries ADD COLUMN imageData TEXT DEFAULT NULL`);
      }
      database.pragma('user_version = 18');
    })();
  }

  return database;
}

export function closeDb(): void {
  if (db) {
    db.close();
  }
}
