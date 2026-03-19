import { getDb } from '../db';
import { ValidationError, NotFoundError } from '../errors';
import type { Category, CategoryWithCount } from '../types';

// Default category definitions with assigned colors
const DEFAULT_CATEGORIES: { name: string; color: string; isDefault: boolean }[] = [
  { name: '高管', color: '#FFB5B5', isDefault: false },
  { name: '培训', color: '#B5D8FF', isDefault: false },
  { name: '语言组', color: '#B5FFB5', isDefault: false },
  { name: '自我提升', color: '#FFE5B5', isDefault: false },
  { name: '其他', color: '#D5B5FF', isDefault: true },
];

// Additional colors for user-created categories
const EXTRA_COLORS = [
  '#FFD5E5', '#E5FFD5', '#D5E5FF', '#FFE5D5', '#E5D5FF', '#D5FFE5',
];

// All colors in order (default + extra)
const ALL_COLORS = [
  ...DEFAULT_CATEGORIES.map(c => c.color),
  ...EXTRA_COLORS,
];

export function ensureDefaults(userId: number): void {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM categories WHERE userId = ?').get(userId) as { count: number };

  if (existing.count > 0) return;

  const insert = db.prepare(
    'INSERT INTO categories (userId, name, color, isDefault) VALUES (?, ?, ?, ?)'
  );

  const transaction = db.transaction(() => {
    for (const cat of DEFAULT_CATEGORIES) {
      insert.run(userId, cat.name, cat.color, cat.isDefault ? 1 : 0);
    }
  });

  transaction();
}

export function list(userId: number): CategoryWithCount[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      c.id, c.userId, c.name, c.color, c.isDefault, c.createdAt,
      COALESCE(we.cnt, 0) as workEntryCount,
      COALESCE(obj.cnt, 0) as objectiveCount
    FROM categories c
    LEFT JOIN (
      SELECT categoryId, COUNT(*) as cnt FROM work_entries WHERE userId = ? GROUP BY categoryId
    ) we ON we.categoryId = c.id
    LEFT JOIN (
      SELECT categoryId, COUNT(*) as cnt FROM objectives WHERE userId = ? GROUP BY categoryId
    ) obj ON obj.categoryId = c.id
    WHERE c.userId = ?
    ORDER BY c.id ASC
  `).all(userId, userId, userId) as Array<{
    id: number; userId: number; name: string; color: string;
    isDefault: number; createdAt: string; workEntryCount: number; objectiveCount: number;
  }>;

  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    color: row.color,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
    workEntryCount: row.workEntryCount,
    objectiveCount: row.objectiveCount,
  }));
}

export function create(userId: number, name: string): Category {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('分类名称不能为空');
  }

  const db = getDb();

  // Check duplicate name
  const existing = db.prepare(
    'SELECT id FROM categories WHERE userId = ? AND name = ?'
  ).get(userId, name.trim());
  if (existing) {
    throw new ValidationError('分类名称已存在');
  }

  // Pick the next available color
  const usedColors = db.prepare(
    'SELECT color FROM categories WHERE userId = ?'
  ).all(userId) as Array<{ color: string }>;
  const usedSet = new Set(usedColors.map(r => r.color));

  let color = ALL_COLORS.find(c => !usedSet.has(c));
  if (!color) {
    // All colors used, cycle back from the beginning
    color = ALL_COLORS[usedColors.length % ALL_COLORS.length];
  }

  const result = db.prepare(
    'INSERT INTO categories (userId, name, color, isDefault) VALUES (?, ?, ?, 0)'
  ).run(userId, name.trim(), color);

  return {
    id: result.lastInsertRowid as number,
    userId,
    name: name.trim(),
    color,
    isDefault: false,
    createdAt: new Date().toISOString(),
  };
}

export function update(userId: number, id: number, name: string): Category {
  if (!name || name.trim().length === 0) {
    throw new ValidationError('分类名称不能为空');
  }

  const db = getDb();

  const row = db.prepare(
    'SELECT id, userId, name, color, isDefault, createdAt FROM categories WHERE id = ? AND userId = ?'
  ).get(id, userId) as { id: number; userId: number; name: string; color: string; isDefault: number; createdAt: string } | undefined;

  if (!row) {
    throw new NotFoundError('分类不存在');
  }

  // Check duplicate name (excluding current category)
  const duplicate = db.prepare(
    'SELECT id FROM categories WHERE userId = ? AND name = ? AND id != ?'
  ).get(userId, name.trim(), id);
  if (duplicate) {
    throw new ValidationError('分类名称已存在');
  }

  db.prepare('UPDATE categories SET name = ? WHERE id = ? AND userId = ?')
    .run(name.trim(), id, userId);

  return {
    id: row.id,
    userId: row.userId,
    name: name.trim(),
    color: row.color,
    isDefault: row.isDefault === 1,
    createdAt: row.createdAt,
  };
}

export function deleteCategory(userId: number, id: number, migrateToId?: number): void {
  const db = getDb();

  const row = db.prepare(
    'SELECT id, isDefault FROM categories WHERE id = ? AND userId = ?'
  ).get(id, userId) as { id: number; isDefault: number } | undefined;

  if (!row) {
    throw new NotFoundError('分类不存在');
  }

  if (row.isDefault === 1) {
    throw new ValidationError('默认分类不可删除');
  }

  // Check for associated records
  const workEntryCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM work_entries WHERE categoryId = ? AND userId = ?'
  ).get(id, userId) as { cnt: number }).cnt;

  const objectiveCount = (db.prepare(
    'SELECT COUNT(*) as cnt FROM objectives WHERE categoryId = ? AND userId = ?'
  ).get(id, userId) as { cnt: number }).cnt;

  const hasAssociations = workEntryCount > 0 || objectiveCount > 0;

  if (hasAssociations && migrateToId === undefined) {
    throw new ValidationError('该分类有关联记录，请指定迁移目标');
  }

  const transaction = db.transaction(() => {
    if (hasAssociations) {
      // Determine migration target
      let targetId = migrateToId!;

      // If no explicit target, migrate to default "其他" category
      if (!targetId) {
        const defaultCat = db.prepare(
          'SELECT id FROM categories WHERE userId = ? AND isDefault = 1'
        ).get(userId) as { id: number } | undefined;
        if (!defaultCat) {
          throw new ValidationError('默认分类不存在，无法迁移');
        }
        targetId = defaultCat.id;
      }

      // Verify target category exists and belongs to user
      const target = db.prepare(
        'SELECT id FROM categories WHERE id = ? AND userId = ?'
      ).get(targetId, userId);
      if (!target) {
        throw new NotFoundError('迁移目标分类不存在');
      }

      // Migrate work entries
      db.prepare(
        'UPDATE work_entries SET categoryId = ? WHERE categoryId = ? AND userId = ?'
      ).run(targetId, id, userId);

      // Migrate objectives
      db.prepare(
        'UPDATE objectives SET categoryId = ? WHERE categoryId = ? AND userId = ?'
      ).run(targetId, id, userId);
    }

    // Delete the category
    db.prepare('DELETE FROM categories WHERE id = ? AND userId = ?').run(id, userId);
  });

  transaction();
}
