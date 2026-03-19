import { getDb } from '../db';
import { NotFoundError, ForbiddenError, ValidationError } from '../errors';
import type { TodoItem } from '../types';

export function getByDate(userId: number, date: string): TodoItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt
    FROM todo_items
    WHERE userId = ? AND date = ?
    ORDER BY createdAt ASC
  `).all(userId, date) as Array<Omit<TodoItem, 'completed'> & { completed: number }>;

  return rows.map(row => ({ ...row, completed: row.completed === 1 }));
}

export function create(userId: number, date: string, content: string, deadline?: string): TodoItem {
  if (!content || !content.trim()) {
    throw new ValidationError('待办内容不能为空');
  }

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO todo_items (userId, date, content, completed, deadline)
    VALUES (?, ?, ?, 0, ?)
  `).run(userId, date, content, deadline ?? null);

  const row = db.prepare(
    'SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt FROM todo_items WHERE id = ?'
  ).get(result.lastInsertRowid) as Omit<TodoItem, 'completed'> & { completed: number };

  return { ...row, completed: row.completed === 1 };
}

export function updateCompleted(userId: number, id: number, completed: boolean): TodoItem {
  const row = findAndVerifyOwnership(userId, id);

  const db = getDb();
  db.prepare(`
    UPDATE todo_items SET completed = ?, updatedAt = datetime('now') WHERE id = ?
  `).run(completed ? 1 : 0, id);

  const updated = db.prepare(
    'SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt FROM todo_items WHERE id = ?'
  ).get(id) as Omit<TodoItem, 'completed'> & { completed: number };

  return { ...updated, completed: updated.completed === 1 };
}

export function postpone(userId: number, id: number): TodoItem {
  const row = findAndVerifyOwnership(userId, id);

  if (row.completed === 1) {
    throw new ValidationError('已完成的待办不能延后');
  }

  // Calculate tomorrow's date
  const [year, month, day] = row.date.split('-').map(Number);
  const currentDate = new Date(year, month - 1, day);
  currentDate.setDate(currentDate.getDate() + 1);
  const tomorrow = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;

  const db = getDb();
  db.prepare(`
    UPDATE todo_items SET date = ?, updatedAt = datetime('now') WHERE id = ?
  `).run(tomorrow, id);

  const updated = db.prepare(
    'SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt FROM todo_items WHERE id = ?'
  ).get(id) as Omit<TodoItem, 'completed'> & { completed: number };

  return { ...updated, completed: updated.completed === 1 };
}

export function deleteTodo(userId: number, id: number): void {
  findAndVerifyOwnership(userId, id);

  const db = getDb();
  db.prepare('DELETE FROM todo_items WHERE id = ?').run(id);
}

/**
 * Get incomplete todos with deadlines that need reminding.
 * Returns todos where deadline's previous workday is today.
 */
export function getDeadlineReminders(userId: number, today: string): TodoItem[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt
    FROM todo_items
    WHERE userId = ? AND completed = 0 AND deadline IS NOT NULL
  `).all(userId) as Array<Omit<TodoItem, 'completed'> & { completed: number }>;

  return rows
    .filter(row => {
      if (!row.deadline) return false;
      const prevWorkday = getPreviousWorkday(row.deadline);
      return prevWorkday === today;
    })
    .map(row => ({ ...row, completed: row.completed === 1 }));
}

function getPreviousWorkday(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  // Go back one day
  d.setDate(d.getDate() - 1);
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function findAndVerifyOwnership(userId: number, id: number): Omit<TodoItem, 'completed'> & { completed: number } {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, userId, date, content, completed, deadline, createdAt, updatedAt FROM todo_items WHERE id = ?'
  ).get(id) as (Omit<TodoItem, 'completed'> & { completed: number }) | undefined;

  if (!row) {
    throw new NotFoundError('待办事项不存在');
  }

  if (row.userId !== userId) {
    throw new ForbiddenError('无权限访问该资源');
  }

  return row;
}
