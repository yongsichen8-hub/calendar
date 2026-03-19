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
  getByQuarter,
  createObjective,
  updateObjective,
  deleteObjective,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
} from '../okrService';
import { ensureDefaults } from '../categoryService';

function createTestUser(username = 'testuser'): number {
  const result = testDb.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, 'hash');
  return result.lastInsertRowid as number;
}

function getNonDefaultCategoryId(userId: number): number {
  const row = testDb.prepare(
    'SELECT id FROM categories WHERE userId = ? AND isDefault = 0 LIMIT 1'
  ).get(userId) as { id: number };
  return row.id;
}

function getDefaultCategoryId(userId: number): number {
  const row = testDb.prepare(
    'SELECT id FROM categories WHERE userId = ? AND isDefault = 1 LIMIT 1'
  ).get(userId) as { id: number };
  return row.id;
}

describe('okrService', () => {
  let userId: number;

  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
    userId = createTestUser();
    ensureDefaults(userId);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('getByQuarter', () => {
    it('should return empty objectives for a quarter with no data', () => {
      const data = getByQuarter(userId, '2025-Q1');
      expect(data.quarter).toBe('2025-Q1');
      expect(data.objectives).toHaveLength(0);
    });

    it('should return objectives with their key results', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test Objective',
        description: 'Description',
      });
      createKeyResult(userId, { objectiveId: obj.id, description: 'KR 1' });
      createKeyResult(userId, { objectiveId: obj.id, description: 'KR 2' });

      const data = getByQuarter(userId, '2025-Q1');
      expect(data.objectives).toHaveLength(1);
      expect(data.objectives[0].title).toBe('Test Objective');
      expect(data.objectives[0].keyResults).toHaveLength(2);
    });

    it('should not return objectives from other quarters', () => {
      const catId = getNonDefaultCategoryId(userId);
      createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Q1 Objective',
        description: '',
      });
      createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q2',
        title: 'Q2 Objective',
        description: '',
      });

      const q1 = getByQuarter(userId, '2025-Q1');
      expect(q1.objectives).toHaveLength(1);
      expect(q1.objectives[0].title).toBe('Q1 Objective');
    });

    it('should isolate data between users', () => {
      const catId = getNonDefaultCategoryId(userId);
      createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'User1 Obj',
        description: '',
      });

      const user2 = createTestUser('user2');
      ensureDefaults(user2);
      const data = getByQuarter(user2, '2025-Q1');
      expect(data.objectives).toHaveLength(0);
    });
  });

  describe('createObjective', () => {
    it('should create an objective with valid data', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'My Objective',
        description: 'Some description',
      });
      expect(obj.id).toBeDefined();
      expect(obj.title).toBe('My Objective');
      expect(obj.description).toBe('Some description');
      expect(obj.categoryId).toBe(catId);
      expect(obj.quarter).toBe('2025-Q1');
      expect(obj.keyResults).toHaveLength(0);
    });

    it('should reject empty title', () => {
      const catId = getNonDefaultCategoryId(userId);
      expect(() => createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: '',
        description: '',
      })).toThrow(ValidationError);
    });

    it('should reject empty quarter', () => {
      const catId = getNonDefaultCategoryId(userId);
      expect(() => createObjective(userId, {
        categoryId: catId,
        quarter: '',
        title: 'Test',
        description: '',
      })).toThrow(ValidationError);
    });

    it('should reject categoryId pointing to default "其他" category', () => {
      const defaultCatId = getDefaultCategoryId(userId);
      expect(() => createObjective(userId, {
        categoryId: defaultCatId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      })).toThrow(ValidationError);
      expect(() => createObjective(userId, {
        categoryId: defaultCatId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      })).toThrow("Objective 不可关联'其他'分类");
    });

    it('should reject non-existent categoryId', () => {
      expect(() => createObjective(userId, {
        categoryId: 9999,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      })).toThrow(NotFoundError);
    });

    it('should trim title and quarter', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '  2025-Q1  ',
        title: '  My Objective  ',
        description: '',
      });
      expect(obj.title).toBe('My Objective');
      expect(obj.quarter).toBe('2025-Q1');
    });
  });

  describe('updateObjective', () => {
    it('should update objective title', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Original',
        description: '',
      });
      const updated = updateObjective(userId, obj.id, { title: 'Updated' });
      expect(updated.title).toBe('Updated');
    });

    it('should update objective categoryId', () => {
      const cats = testDb.prepare(
        'SELECT id FROM categories WHERE userId = ? AND isDefault = 0'
      ).all(userId) as Array<{ id: number }>;
      const obj = createObjective(userId, {
        categoryId: cats[0].id,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const updated = updateObjective(userId, obj.id, { categoryId: cats[1].id });
      expect(updated.categoryId).toBe(cats[1].id);
    });

    it('should reject updating categoryId to default category', () => {
      const catId = getNonDefaultCategoryId(userId);
      const defaultCatId = getDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      expect(() => updateObjective(userId, obj.id, { categoryId: defaultCatId }))
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent objective', () => {
      expect(() => updateObjective(userId, 9999, { title: 'Test' }))
        .toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s objective', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const user2 = createTestUser('user2');
      expect(() => updateObjective(user2, obj.id, { title: 'Hacked' }))
        .toThrow(ForbiddenError);
    });

    it('should return key results with the updated objective', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      createKeyResult(userId, { objectiveId: obj.id, description: 'KR 1' });
      const updated = updateObjective(userId, obj.id, { title: 'Updated' });
      expect(updated.keyResults).toHaveLength(1);
    });
  });

  describe('deleteObjective', () => {
    it('should delete an objective and its key results', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'To Delete',
        description: '',
      });
      createKeyResult(userId, { objectiveId: obj.id, description: 'KR 1' });

      deleteObjective(userId, obj.id);

      const data = getByQuarter(userId, '2025-Q1');
      expect(data.objectives).toHaveLength(0);

      // Verify key results are also deleted
      const krCount = testDb.prepare(
        'SELECT COUNT(*) as cnt FROM key_results WHERE objectiveId = ?'
      ).get(obj.id) as { cnt: number };
      expect(krCount.cnt).toBe(0);
    });

    it('should throw NotFoundError for non-existent objective', () => {
      expect(() => deleteObjective(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s objective', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const user2 = createTestUser('user2');
      expect(() => deleteObjective(user2, obj.id)).toThrow(ForbiddenError);
    });
  });

  describe('createKeyResult', () => {
    it('should create a key result', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'Complete task X',
      });
      expect(kr.id).toBeDefined();
      expect(kr.description).toBe('Complete task X');
      expect(kr.progress).toBe(0);
      expect(kr.objectiveId).toBe(obj.id);
    });

    it('should reject empty description', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      expect(() => createKeyResult(userId, {
        objectiveId: obj.id,
        description: '',
      })).toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent objective', () => {
      expect(() => createKeyResult(userId, {
        objectiveId: 9999,
        description: 'Test',
      })).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s objective', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const user2 = createTestUser('user2');
      expect(() => createKeyResult(user2, {
        objectiveId: obj.id,
        description: 'Hacked KR',
      })).toThrow(ForbiddenError);
    });
  });

  describe('updateKeyResult', () => {
    it('should update key result description', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'Original',
      });
      const updated = updateKeyResult(userId, kr.id, { description: 'Updated' });
      expect(updated.description).toBe('Updated');
    });

    it('should update key result progress', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      expect(kr.progress).toBe(0);
      const updated = updateKeyResult(userId, kr.id, { progress: 75 });
      expect(updated.progress).toBe(75);
    });

    it('should reject non-integer progress value', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      expect(() => updateKeyResult(userId, kr.id, { progress: 50.5 }))
        .toThrow(ValidationError);
    });

    it('should reject progress value below 0', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      expect(() => updateKeyResult(userId, kr.id, { progress: -1 }))
        .toThrow(ValidationError);
    });

    it('should reject progress value above 100', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      expect(() => updateKeyResult(userId, kr.id, { progress: 101 }))
        .toThrow(ValidationError);
    });

    it('should reject empty description', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      expect(() => updateKeyResult(userId, kr.id, { description: '  ' }))
        .toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent key result', () => {
      expect(() => updateKeyResult(userId, 9999, { description: 'Test' }))
        .toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s key result', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      const user2 = createTestUser('user2');
      expect(() => updateKeyResult(user2, kr.id, { progress: 50 }))
        .toThrow(ForbiddenError);
    });
  });

  describe('deleteKeyResult', () => {
    it('should delete a key result', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'To Delete',
      });
      deleteKeyResult(userId, kr.id);

      const data = getByQuarter(userId, '2025-Q1');
      expect(data.objectives[0].keyResults).toHaveLength(0);
    });

    it('should throw NotFoundError for non-existent key result', () => {
      expect(() => deleteKeyResult(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for another user\'s key result', () => {
      const catId = getNonDefaultCategoryId(userId);
      const obj = createObjective(userId, {
        categoryId: catId,
        quarter: '2025-Q1',
        title: 'Test',
        description: '',
      });
      const kr = createKeyResult(userId, {
        objectiveId: obj.id,
        description: 'KR',
      });
      const user2 = createTestUser('user2');
      expect(() => deleteKeyResult(user2, kr.id)).toThrow(ForbiddenError);
    });
  });
});
