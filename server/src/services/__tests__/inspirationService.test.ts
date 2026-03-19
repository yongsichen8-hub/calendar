import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../db';
import { ValidationError, NotFoundError, ForbiddenError } from '../../errors';

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

import {
  ensureDefaults,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  list,
  create,
  update,
  deleteEntry,
} from '../inspirationService';

function createTestUser(username = 'testuser'): number {
  const result = testDb.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, 'hash');
  return result.lastInsertRowid as number;
}

describe('inspirationService', () => {
  let userId: number;

  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
    userId = createTestUser();
  });

  afterEach(() => {
    testDb.close();
  });

  // ============================================================
  // Inspiration Categories
  // ============================================================

  describe('ensureDefaults', () => {
    it('should create 5 default inspiration categories', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      expect(categories).toHaveLength(5);
      const names = categories.map(c => c.name);
      expect(names).toContain('工作');
      expect(names).toContain('学习');
      expect(names).toContain('项目');
      expect(names).toContain('个人');
      expect(names).toContain('其他');
    });

    it('should not duplicate defaults if called twice', () => {
      ensureDefaults(userId);
      ensureDefaults(userId);
      const categories = listCategories(userId);
      expect(categories).toHaveLength(5);
    });

    it('should isolate defaults between users', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);

      const cats1 = listCategories(userId);
      const cats2 = listCategories(user2);
      expect(cats1.every(c => c.userId === userId)).toBe(true);
      expect(cats2.every(c => c.userId === user2)).toBe(true);
    });
  });

  describe('listCategories', () => {
    it('should return empty list for user with no categories', () => {
      const categories = listCategories(userId);
      expect(categories).toHaveLength(0);
    });

    it('should return categories ordered by id', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      for (let i = 1; i < categories.length; i++) {
        expect(categories[i].id).toBeGreaterThan(categories[i - 1].id);
      }
    });
  });

  describe('createCategory', () => {
    it('should create a new inspiration category', () => {
      const cat = createCategory(userId, '技术');
      expect(cat.name).toBe('技术');
      expect(cat.userId).toBe(userId);
    });

    it('should reject empty name', () => {
      expect(() => createCategory(userId, '')).toThrow(ValidationError);
      expect(() => createCategory(userId, '  ')).toThrow(ValidationError);
    });

    it('should reject duplicate name', () => {
      ensureDefaults(userId);
      expect(() => createCategory(userId, '工作')).toThrow(ValidationError);
      expect(() => createCategory(userId, '工作')).toThrow('灵感分类名称已存在');
    });

    it('should trim whitespace from name', () => {
      const cat = createCategory(userId, '  技术  ');
      expect(cat.name).toBe('技术');
    });
  });

  describe('updateCategory', () => {
    it('should update category name', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const cat = categories[0];
      const updated = updateCategory(userId, cat.id, '新名称');
      expect(updated.name).toBe('新名称');
    });

    it('should reject empty name', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      expect(() => updateCategory(userId, categories[0].id, '')).toThrow(ValidationError);
    });

    it('should reject duplicate name', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const cat = categories.find(c => c.name === '工作')!;
      expect(() => updateCategory(userId, cat.id, '学习')).toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent category', () => {
      expect(() => updateCategory(userId, 9999, '新名称')).toThrow(NotFoundError);
    });

    it('should not allow updating another user\'s category', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);
      const cats1 = listCategories(userId);
      expect(() => updateCategory(user2, cats1[0].id, '偷改')).toThrow(NotFoundError);
    });
  });

  describe('deleteCategory', () => {
    it('should delete a category with no associated entries', () => {
      const cat = createCategory(userId, '临时');
      deleteCategory(userId, cat.id);
      const categories = listCategories(userId);
      expect(categories.find(c => c.id === cat.id)).toBeUndefined();
    });

    it('should reject deleting a category with associated entries', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const cat = categories[0];
      // Create an entry under this category
      create(userId, { content: '测试', type: 'inspiration', categoryId: cat.id });
      expect(() => deleteCategory(userId, cat.id)).toThrow(ValidationError);
      expect(() => deleteCategory(userId, cat.id)).toThrow('该灵感分类下有关联条目，无法删除');
    });

    it('should throw NotFoundError for non-existent category', () => {
      expect(() => deleteCategory(userId, 9999)).toThrow(NotFoundError);
    });

    it('should not allow deleting another user\'s category', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      const cats1 = listCategories(userId);
      expect(() => deleteCategory(user2, cats1[0].id)).toThrow(NotFoundError);
    });
  });

  // ============================================================
  // Inspiration Entries
  // ============================================================

  describe('list', () => {
    it('should return empty list for user with no entries', () => {
      const entries = list(userId);
      expect(entries).toHaveLength(0);
    });

    it('should return entries ordered by createdAt descending', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const catId = categories[0].id;

      create(userId, { content: '第一条', type: 'inspiration', categoryId: catId });
      create(userId, { content: '第二条', type: 'todo', categoryId: catId });
      create(userId, { content: '第三条', type: 'inspiration', categoryId: catId });

      const entries = list(userId);
      expect(entries).toHaveLength(3);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i - 1].createdAt >= entries[i].createdAt).toBe(true);
      }
    });

    it('should filter by categoryId', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const cat1 = categories[0];
      const cat2 = categories[1];

      create(userId, { content: 'A', type: 'inspiration', categoryId: cat1.id });
      create(userId, { content: 'B', type: 'inspiration', categoryId: cat2.id });
      create(userId, { content: 'C', type: 'todo', categoryId: cat1.id });

      const filtered = list(userId, cat1.id);
      expect(filtered).toHaveLength(2);
      expect(filtered.every(e => e.categoryId === cat1.id)).toBe(true);
    });

    it('should isolate data between users', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);

      const cats1 = listCategories(userId);
      const cats2 = listCategories(user2);

      create(userId, { content: 'User1 entry', type: 'inspiration', categoryId: cats1[0].id });
      create(user2, { content: 'User2 entry', type: 'todo', categoryId: cats2[0].id });

      const entries1 = list(userId);
      const entries2 = list(user2);
      expect(entries1).toHaveLength(1);
      expect(entries2).toHaveLength(1);
      expect(entries1[0].content).toBe('User1 entry');
      expect(entries2[0].content).toBe('User2 entry');
    });
  });

  describe('create', () => {
    it('should create an inspiration entry', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '好想法',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(entry.content).toBe('好想法');
      expect(entry.type).toBe('inspiration');
      expect(entry.completed).toBe(false);
      expect(entry.userId).toBe(userId);
    });

    it('should create a todo entry', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '待办事项',
        type: 'todo',
        categoryId: categories[0].id,
      });
      expect(entry.type).toBe('todo');
      expect(entry.completed).toBe(false);
    });

    it('should reject empty content', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      expect(() => create(userId, {
        content: '',
        type: 'inspiration',
        categoryId: categories[0].id,
      })).toThrow(ValidationError);
    });

    it('should reject invalid type', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      expect(() => create(userId, {
        content: '测试',
        type: 'invalid' as any,
        categoryId: categories[0].id,
      })).toThrow(ValidationError);
    });

    it('should reject non-existent category', () => {
      expect(() => create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: 9999,
      })).toThrow(NotFoundError);
    });

    it('should trim content whitespace', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '  好想法  ',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(entry.content).toBe('好想法');
    });
  });

  describe('update', () => {
    it('should update entry content', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '原始内容',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      const updated = update(userId, entry.id, { content: '更新内容' });
      expect(updated.content).toBe('更新内容');
    });

    it('should toggle todo completed status', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '待办',
        type: 'todo',
        categoryId: categories[0].id,
      });
      expect(entry.completed).toBe(false);

      const updated = update(userId, entry.id, { completed: true });
      expect(updated.completed).toBe(true);

      const toggled = update(userId, entry.id, { completed: false });
      expect(toggled.completed).toBe(false);
    });

    it('should update category', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      const updated = update(userId, entry.id, { categoryId: categories[1].id });
      expect(updated.categoryId).toBe(categories[1].id);
    });

    it('should reject empty content on update', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(() => update(userId, entry.id, { content: '  ' })).toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent entry', () => {
      expect(() => update(userId, 9999, { content: '更新' })).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s entry', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(() => update(user2, entry.id, { content: '偷改' })).toThrow(ForbiddenError);
    });

    it('should reject non-existent category on update', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(() => update(userId, entry.id, { categoryId: 9999 })).toThrow(NotFoundError);
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry', () => {
      ensureDefaults(userId);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '删除我',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      deleteEntry(userId, entry.id);
      const entries = list(userId);
      expect(entries.find(e => e.id === entry.id)).toBeUndefined();
    });

    it('should throw NotFoundError for non-existent entry', () => {
      expect(() => deleteEntry(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s entry', () => {
      ensureDefaults(userId);
      const user2 = createTestUser('user2');
      ensureDefaults(user2);
      const categories = listCategories(userId);
      const entry = create(userId, {
        content: '测试',
        type: 'inspiration',
        categoryId: categories[0].id,
      });
      expect(() => deleteEntry(user2, entry.id)).toThrow(ForbiddenError);
    });
  });
});
