import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../db';
import { ValidationError, NotFoundError } from '../../errors';

vi.mock('../../config', () => ({
  config: {
    jwtSecret: 'test-secret-key',
    databasePath: ':memory:',
    port: 3200,
    deepseekApiKey: '',
  },
}));

let testDb: Database.Database;

vi.mock('../../db', async () => {
  const actual = await vi.importActual('../../db');
  return {
    ...actual,
    getDb: () => testDb,
  };
});

import { ensureDefaults, list, create, update, deleteCategory } from '../categoryService';

function createTestUser(username = 'testuser'): number {
  const result = testDb.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, 'hash');
  return result.lastInsertRowid as number;
}

describe('categoryService', () => {
  let userId: number;

  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
    userId = createTestUser();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('ensureDefaults', () => {
    it('should create 5 default categories for a new user', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      expect(categories).toHaveLength(5);
      const names = categories.map(c => c.name);
      expect(names).toContain('高管');
      expect(names).toContain('培训');
      expect(names).toContain('语言组');
      expect(names).toContain('自我提升');
      expect(names).toContain('其他');
    });

    it('should mark "其他" as isDefault=true', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const other = categories.find(c => c.name === '其他');
      expect(other?.isDefault).toBe(true);
      const nonDefaults = categories.filter(c => c.name !== '其他');
      nonDefaults.forEach(c => expect(c.isDefault).toBe(false));
    });

    it('should not duplicate defaults if called twice', () => {
      ensureDefaults(userId);
      ensureDefaults(userId);
      const categories = list(userId);
      expect(categories).toHaveLength(5);
    });

    it('should assign correct colors to default categories', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const colorMap: Record<string, string> = {};
      categories.forEach(c => { colorMap[c.name] = c.color; });
      expect(colorMap['高管']).toBe('#FFB5B5');
      expect(colorMap['培训']).toBe('#B5D8FF');
      expect(colorMap['语言组']).toBe('#B5FFB5');
      expect(colorMap['自我提升']).toBe('#FFE5B5');
      expect(colorMap['其他']).toBe('#D5B5FF');
    });
  });

  describe('list', () => {
    it('should return empty list for user with no categories', () => {
      const categories = list(userId);
      expect(categories).toHaveLength(0);
    });

    it('should include workEntryCount and objectiveCount', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const cat = categories[0];
      // Add a work entry for this category
      testDb.prepare(
        'INSERT INTO work_entries (userId, categoryId, date, timeSlot) VALUES (?, ?, ?, ?)'
      ).run(userId, cat.id, '2025-01-06', '09:00-10:00');
      // Add an objective for this category
      testDb.prepare(
        'INSERT INTO objectives (userId, categoryId, quarter, title) VALUES (?, ?, ?, ?)'
      ).run(userId, cat.id, '2025-Q1', 'Test Objective');

      const updated = list(userId);
      const updatedCat = updated.find(c => c.id === cat.id)!;
      expect(updatedCat.workEntryCount).toBe(1);
      expect(updatedCat.objectiveCount).toBe(1);
    });

    it('should isolate data between users', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);

      const cats1 = list(userId);
      const cats2 = list(user2);
      expect(cats1.every(c => c.userId === userId)).toBe(true);
      expect(cats2.every(c => c.userId === user2)).toBe(true);
    });
  });

  describe('create', () => {
    it('should create a new category with a color', () => {
      ensureDefaults(userId);
      const cat = create(userId, '新分类');
      expect(cat.name).toBe('新分类');
      expect(cat.color).toBeTruthy();
      expect(cat.isDefault).toBe(false);
    });

    it('should assign unique colors to new categories', () => {
      ensureDefaults(userId);
      const cat1 = create(userId, '分类A');
      const cat2 = create(userId, '分类B');
      expect(cat1.color).not.toBe(cat2.color);
    });

    it('should reject empty name', () => {
      expect(() => create(userId, '')).toThrow(ValidationError);
      expect(() => create(userId, '  ')).toThrow(ValidationError);
    });

    it('should reject duplicate name', () => {
      ensureDefaults(userId);
      expect(() => create(userId, '高管')).toThrow(ValidationError);
      expect(() => create(userId, '高管')).toThrow('分类名称已存在');
    });

    it('should trim whitespace from name', () => {
      const cat = create(userId, '  测试分类  ');
      expect(cat.name).toBe('测试分类');
    });
  });

  describe('update', () => {
    it('should update category name', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const cat = categories.find(c => c.name === '高管')!;
      const updated = update(userId, cat.id, '高管会议');
      expect(updated.name).toBe('高管会议');
      expect(updated.color).toBe(cat.color);
    });

    it('should reject empty name', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      expect(() => update(userId, categories[0].id, '')).toThrow(ValidationError);
    });

    it('should reject duplicate name', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const cat = categories.find(c => c.name === '高管')!;
      expect(() => update(userId, cat.id, '培训')).toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent category', () => {
      expect(() => update(userId, 9999, '新名称')).toThrow(NotFoundError);
    });

    it('should not allow updating another user\'s category', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);
      const cats1 = list(userId);
      expect(() => update(user2, cats1[0].id, '偷改')).toThrow(NotFoundError);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category with no associations', () => {
      ensureDefaults(userId);
      const cat = create(userId, '临时分类');
      deleteCategory(userId, cat.id);
      const categories = list(userId);
      expect(categories.find(c => c.id === cat.id)).toBeUndefined();
    });

    it('should reject deleting default "其他" category', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const other = categories.find(c => c.isDefault)!;
      expect(() => deleteCategory(userId, other.id)).toThrow(ValidationError);
      expect(() => deleteCategory(userId, other.id)).toThrow('默认分类不可删除');
    });

    it('should require migrateToId when category has associations', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const cat = categories.find(c => c.name === '高管')!;
      testDb.prepare(
        'INSERT INTO work_entries (userId, categoryId, date, timeSlot) VALUES (?, ?, ?, ?)'
      ).run(userId, cat.id, '2025-01-06', '09:00-10:00');

      expect(() => deleteCategory(userId, cat.id)).toThrow(ValidationError);
      expect(() => deleteCategory(userId, cat.id)).toThrow('该分类有关联记录，请指定迁移目标');
    });

    it('should migrate work entries and objectives to target category', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const source = categories.find(c => c.name === '高管')!;
      const target = categories.find(c => c.name === '培训')!;

      testDb.prepare(
        'INSERT INTO work_entries (userId, categoryId, date, timeSlot) VALUES (?, ?, ?, ?)'
      ).run(userId, source.id, '2025-01-06', '09:00-10:00');
      testDb.prepare(
        'INSERT INTO objectives (userId, categoryId, quarter, title) VALUES (?, ?, ?, ?)'
      ).run(userId, source.id, '2025-Q1', 'Test');

      deleteCategory(userId, source.id, target.id);

      // Source category should be gone
      const remaining = list(userId);
      expect(remaining.find(c => c.id === source.id)).toBeUndefined();

      // Records should be migrated
      const targetUpdated = remaining.find(c => c.id === target.id)!;
      expect(targetUpdated.workEntryCount).toBe(1);
      expect(targetUpdated.objectiveCount).toBe(1);
    });

    it('should throw NotFoundError for non-existent category', () => {
      expect(() => deleteCategory(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw NotFoundError for non-existent migration target', () => {
      ensureDefaults(userId);
      const categories = list(userId);
      const cat = categories.find(c => c.name === '高管')!;
      testDb.prepare(
        'INSERT INTO work_entries (userId, categoryId, date, timeSlot) VALUES (?, ?, ?, ?)'
      ).run(userId, cat.id, '2025-01-06', '09:00-10:00');

      expect(() => deleteCategory(userId, cat.id, 9999)).toThrow(NotFoundError);
    });
  });
});
