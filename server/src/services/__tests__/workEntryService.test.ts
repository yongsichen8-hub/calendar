import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../db';
import { ForbiddenError, NotFoundError } from '../../errors';

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

import { getByWeek, getByDateRange, save, deleteEntry } from '../workEntryService';

function createTestUser(username = 'testuser'): number {
  const result = testDb.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, 'hash');
  return result.lastInsertRowid as number;
}

function createTestCategory(userId: number, name = '高管'): number {
  const result = testDb.prepare(
    'INSERT INTO categories (userId, name, color, isDefault) VALUES (?, ?, ?, 0)'
  ).run(userId, name, '#FFB5B5');
  return result.lastInsertRowid as number;
}

describe('workEntryService', () => {
  let userId: number;
  let categoryId: number;

  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
    userId = createTestUser();
    categoryId = createTestCategory(userId);
  });

  afterEach(() => {
    testDb.close();
  });

  describe('save', () => {
    it('should save a single work entry and return it', () => {
      const entries = save(userId, [{
        date: '2025-01-06',
        timeSlot: '09:00-10:00',
        categoryId,
        subCategory: '周会',
        description: '团队周会',
      }]);

      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe(userId);
      expect(entries[0].categoryId).toBe(categoryId);
      expect(entries[0].date).toBe('2025-01-06');
      expect(entries[0].timeSlot).toBe('09:00-10:00');
      expect(entries[0].subCategory).toBe('周会');
      expect(entries[0].description).toBe('团队周会');
      expect(entries[0].id).toBeDefined();
    });

    it('should save multiple entries in a batch', () => {
      const entries = save(userId, [
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: 'A', description: 'desc A' },
        { date: '2025-01-06', timeSlot: '10:00-11:00', categoryId, subCategory: 'B', description: 'desc B' },
      ]);

      expect(entries).toHaveLength(2);
      expect(entries[0].timeSlot).toBe('09:00-10:00');
      expect(entries[1].timeSlot).toBe('10:00-11:00');
    });

    it('should default subCategory and description to empty string', () => {
      const entries = save(userId, [{
        date: '2025-01-06',
        timeSlot: '09:00-10:00',
        categoryId,
        subCategory: '',
        description: '',
      }]);

      expect(entries[0].subCategory).toBe('');
      expect(entries[0].description).toBe('');
    });
  });

  describe('getByWeek', () => {
    it('should return entries for Monday through Friday', () => {
      save(userId, [
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'Monday' },
        { date: '2025-01-08', timeSlot: '10:00-11:00', categoryId, subCategory: '', description: 'Wednesday' },
        { date: '2025-01-10', timeSlot: '14:00-15:00', categoryId, subCategory: '', description: 'Friday' },
      ]);

      const results = getByWeek(userId, '2025-01-06');
      expect(results).toHaveLength(3);
      expect(results[0].description).toBe('Monday');
      expect(results[1].description).toBe('Wednesday');
      expect(results[2].description).toBe('Friday');
    });

    it('should not return entries outside the week', () => {
      save(userId, [
        { date: '2025-01-05', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'Sunday before' },
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'Monday' },
        { date: '2025-01-11', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'Saturday after' },
      ]);

      const results = getByWeek(userId, '2025-01-06');
      expect(results).toHaveLength(1);
      expect(results[0].description).toBe('Monday');
    });

    it('should return empty array for a week with no entries', () => {
      const results = getByWeek(userId, '2025-01-06');
      expect(results).toHaveLength(0);
    });
  });

  describe('getByDateRange', () => {
    it('should return entries within the date range', () => {
      save(userId, [
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'A' },
        { date: '2025-01-07', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'B' },
        { date: '2025-01-08', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'C' },
      ]);

      const results = getByDateRange(userId, '2025-01-06', '2025-01-07');
      expect(results).toHaveLength(2);
    });

    it('should isolate data between users', () => {
      const user2 = createTestUser('user2');
      const cat2 = createTestCategory(user2, '培训');

      save(userId, [{ date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: '', description: 'User1' }]);
      save(user2, [{ date: '2025-01-06', timeSlot: '09:00-10:00', categoryId: cat2, subCategory: '', description: 'User2' }]);

      const results1 = getByDateRange(userId, '2025-01-06', '2025-01-06');
      const results2 = getByDateRange(user2, '2025-01-06', '2025-01-06');

      expect(results1).toHaveLength(1);
      expect(results1[0].description).toBe('User1');
      expect(results2).toHaveLength(1);
      expect(results2[0].description).toBe('User2');
    });
  });

  describe('deleteEntry', () => {
    it('should delete an entry owned by the user', () => {
      const entries = save(userId, [{
        date: '2025-01-06',
        timeSlot: '09:00-10:00',
        categoryId,
        subCategory: '',
        description: 'to delete',
      }]);

      deleteEntry(userId, entries[0].id);

      const remaining = getByDateRange(userId, '2025-01-06', '2025-01-06');
      expect(remaining).toHaveLength(0);
    });

    it('should throw NotFoundError for non-existent entry', () => {
      expect(() => deleteEntry(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when userId does not match', () => {
      const user2 = createTestUser('user2');
      const entries = save(userId, [{
        date: '2025-01-06',
        timeSlot: '09:00-10:00',
        categoryId,
        subCategory: '',
        description: 'owned by user1',
      }]);

      expect(() => deleteEntry(user2, entries[0].id)).toThrow(ForbiddenError);
    });

    it('should throw ForbiddenError with correct message for cross-user delete', () => {
      const user2 = createTestUser('user2');
      const entries = save(userId, [{
        date: '2025-01-06',
        timeSlot: '09:00-10:00',
        categoryId,
        subCategory: '',
        description: 'owned by user1',
      }]);

      expect(() => deleteEntry(user2, entries[0].id)).toThrow('无权限访问该资源');
    });
  });
});
