import { getDb } from '../db';
import { ForbiddenError, NotFoundError } from '../errors';
import type { WorkEntry, CreateWorkEntryDTO } from '../types';

export function getByWeek(userId: number, weekStart: string): WorkEntry[] {
  // weekStart is a Monday date string like "2025-01-06"
  // Calculate Friday by adding 4 days
  const [year, month, day] = weekStart.split('-').map(Number);
  const monday = new Date(year, month - 1, day);
  const friday = new Date(year, month - 1, day + 4);

  const endDate = `${friday.getFullYear()}-${String(friday.getMonth() + 1).padStart(2, '0')}-${String(friday.getDate()).padStart(2, '0')}`;

  return getByDateRange(userId, weekStart, endDate);
}

export function getByDateRange(userId: number, startDate: string, endDate: string): WorkEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, userId, categoryId, date, timeSlot, subCategory, description, createdAt, updatedAt
    FROM work_entries
    WHERE userId = ? AND date >= ? AND date <= ?
    ORDER BY date ASC, timeSlot ASC
  `).all(userId, startDate, endDate) as WorkEntry[];

  return rows;
}

export function save(userId: number, entries: CreateWorkEntryDTO[]): WorkEntry[] {
  const db = getDb();

  const insert = db.prepare(`
    INSERT INTO work_entries (userId, categoryId, date, timeSlot, subCategory, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const savedEntries: WorkEntry[] = [];

  const transaction = db.transaction(() => {
    for (const entry of entries) {
      const result = insert.run(
        userId,
        entry.categoryId,
        entry.date,
        entry.timeSlot,
        entry.subCategory || '',
        entry.description || ''
      );

      const saved = db.prepare(
        'SELECT id, userId, categoryId, date, timeSlot, subCategory, description, createdAt, updatedAt FROM work_entries WHERE id = ?'
      ).get(result.lastInsertRowid) as WorkEntry;

      savedEntries.push(saved);
    }
  });

  transaction();

  return savedEntries;
}

export function deleteEntry(userId: number, entryId: number): void {
  const db = getDb();

  const row = db.prepare(
    'SELECT id, userId FROM work_entries WHERE id = ?'
  ).get(entryId) as { id: number; userId: number } | undefined;

  if (!row) {
    throw new NotFoundError('工作条目不存在');
  }

  if (row.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  db.prepare('DELETE FROM work_entries WHERE id = ?').run(entryId);
}
