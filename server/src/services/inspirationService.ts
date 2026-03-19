import { getDb } from '../db';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors';
import type { InspirationEntry, InspirationCategory, CreateInspirationDTO, UpdateInspirationDTO } from '../types';

const DEFAULT_INSPIRATION_CATEGORIES = ['工作', '学习', '项目', '个人', '其他'];

const ENTRY_COLUMNS = 'id, userId, categoryId, content, type, completed, deadline, used, imageData, createdAt, updatedAt';

type EntryRow = {
  id: number; userId: number; categoryId: number; content: string;
  type: 'inspiration' | 'todo'; completed: number; deadline: string | null;
  used: number; imageData: string | null; createdAt: string; updatedAt: string;
};

function rowToEntry(row: EntryRow): InspirationEntry {
  return { ...row, completed: row.completed === 1, used: row.used === 1 };
}

export function ensureDefaults(userId: number): void {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM inspiration_categories WHERE userId = ?').get(userId) as { count: number };
  if (existing.count > 0) return;
  const insert = db.prepare('INSERT INTO inspiration_categories (userId, name) VALUES (?, ?)');
  const transaction = db.transaction(() => {
    for (const name of DEFAULT_INSPIRATION_CATEGORIES) {
      insert.run(userId, name);
    }
  });
  transaction();
}

export function listCategories(userId: number): InspirationCategory[] {
  const db = getDb();
  return db.prepare('SELECT id, userId, name, createdAt FROM inspiration_categories WHERE userId = ? ORDER BY id ASC').all(userId) as InspirationCategory[];
}

export function createCategory(userId: number, name: string): InspirationCategory {
  if (!name || name.trim().length === 0) throw new ValidationError('灵感分类名称不能为空');
  const db = getDb();
  const trimmed = name.trim();
  const dup = db.prepare('SELECT id FROM inspiration_categories WHERE userId = ? AND name = ?').get(userId, trimmed);
  if (dup) throw new ValidationError('灵感分类名称已存在');
  const result = db.prepare('INSERT INTO inspiration_categories (userId, name) VALUES (?, ?)').run(userId, trimmed);
  return { id: result.lastInsertRowid as number, userId, name: trimmed, createdAt: new Date().toISOString() };
}

export function updateCategory(userId: number, id: number, name: string): InspirationCategory {
  if (!name || name.trim().length === 0) throw new ValidationError('灵感分类名称不能为空');
  const db = getDb();
  const trimmed = name.trim();
  const row = db.prepare('SELECT id, userId, name, createdAt FROM inspiration_categories WHERE id = ? AND userId = ?').get(id, userId) as InspirationCategory | undefined;
  if (!row) throw new NotFoundError('灵感分类不存在');
  const dup = db.prepare('SELECT id FROM inspiration_categories WHERE userId = ? AND name = ? AND id != ?').get(userId, trimmed, id);
  if (dup) throw new ValidationError('灵感分类名称已存在');
  db.prepare('UPDATE inspiration_categories SET name = ? WHERE id = ? AND userId = ?').run(trimmed, id, userId);
  return { ...row, name: trimmed };
}

export function deleteCategory(userId: number, id: number): void {
  const db = getDb();
  const row = db.prepare('SELECT id FROM inspiration_categories WHERE id = ? AND userId = ?').get(id, userId) as { id: number } | undefined;
  if (!row) throw new NotFoundError('灵感分类不存在');
  const entryCount = (db.prepare('SELECT COUNT(*) as cnt FROM inspiration_entries WHERE categoryId = ? AND userId = ?').get(id, userId) as { cnt: number }).cnt;
  if (entryCount > 0) throw new ValidationError('该灵感分类下有关联条目，无法删除');
  db.prepare('DELETE FROM inspiration_categories WHERE id = ? AND userId = ?').run(id, userId);
}

export function list(userId: number, categoryId?: number): InspirationEntry[] {
  const db = getDb();
  let sql = `SELECT ${ENTRY_COLUMNS} FROM inspiration_entries WHERE userId = ?`;
  const params: unknown[] = [userId];
  if (categoryId !== undefined) { sql += ' AND categoryId = ?'; params.push(categoryId); }
  sql += ' ORDER BY createdAt DESC';
  const rows = db.prepare(sql).all(...params) as EntryRow[];
  return rows.map(rowToEntry);
}

export function create(userId: number, entry: CreateInspirationDTO): InspirationEntry {
  const hasContent = entry.content && entry.content.trim().length > 0;
  const hasImage = entry.imageData && entry.imageData.length > 0;
  if (!hasContent && !hasImage) throw new ValidationError('灵感内容不能为空');
  if (!entry.type || !['inspiration', 'todo'].includes(entry.type)) throw new ValidationError('灵感类型必须为 inspiration 或 todo');
  const db = getDb();
  const category = db.prepare('SELECT id FROM inspiration_categories WHERE id = ? AND userId = ?').get(entry.categoryId, userId);
  if (!category) throw new NotFoundError('灵感分类不存在');
  const contentVal = (entry.content || '').trim();
  const result = db.prepare(
    'INSERT INTO inspiration_entries (userId, categoryId, content, type, completed, deadline, used, imageData) VALUES (?, ?, ?, ?, 0, ?, 0, ?)'
  ).run(userId, entry.categoryId, contentVal, entry.type, entry.deadline ?? null, entry.imageData ?? null);
  const row = db.prepare(`SELECT ${ENTRY_COLUMNS} FROM inspiration_entries WHERE id = ?`).get(result.lastInsertRowid) as EntryRow;
  return rowToEntry(row);
}
export function update(userId: number, id: number, entry: UpdateInspirationDTO): InspirationEntry {
  const db = getDb();
  const existing = db.prepare('SELECT id, userId FROM inspiration_entries WHERE id = ?').get(id) as { id: number; userId: number } | undefined;
  if (!existing) throw new NotFoundError('灵感条目不存在');
  if (existing.userId !== userId) throw new ForbiddenError('无权限访问该资源');
  const updates: string[] = [];
  const params: unknown[] = [];
  if (entry.content !== undefined) {
    if (entry.content.trim().length === 0) throw new ValidationError('灵感内容不能为空');
    updates.push('content = ?'); params.push(entry.content.trim());
  }
  if (entry.type !== undefined) {
    if (!['inspiration', 'todo'].includes(entry.type)) throw new ValidationError('灵感类型必须为 inspiration 或 todo');
    updates.push('type = ?'); params.push(entry.type);
  }
  if (entry.categoryId !== undefined) {
    const cat = db.prepare('SELECT id FROM inspiration_categories WHERE id = ? AND userId = ?').get(entry.categoryId, userId);
    if (!cat) throw new NotFoundError('灵感分类不存在');
    updates.push('categoryId = ?'); params.push(entry.categoryId);
  }
  if (entry.completed !== undefined) { updates.push('completed = ?'); params.push(entry.completed ? 1 : 0); }
  if (entry.deadline !== undefined) { updates.push('deadline = ?'); params.push(entry.deadline); }
  if (entry.used !== undefined) { updates.push('used = ?'); params.push(entry.used ? 1 : 0); }
  if (entry.imageData !== undefined) { updates.push('imageData = ?'); params.push(entry.imageData); }
  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(id, userId);
    db.prepare('UPDATE inspiration_entries SET ' + updates.join(', ') + ' WHERE id = ? AND userId = ?').run(...params);
  }
  const row = db.prepare(`SELECT ${ENTRY_COLUMNS} FROM inspiration_entries WHERE id = ?`).get(id) as EntryRow;
  return rowToEntry(row);
}

export function deleteEntry(userId: number, id: number): void {
  const db = getDb();
  const existing = db.prepare('SELECT id, userId FROM inspiration_entries WHERE id = ?').get(id) as { id: number; userId: number } | undefined;
  if (!existing) throw new NotFoundError('灵感条目不存在');
  if (existing.userId !== userId) throw new ForbiddenError('无权限访问该资源');
  db.prepare('DELETE FROM inspiration_entries WHERE id = ? AND userId = ?').run(id, userId);
}
