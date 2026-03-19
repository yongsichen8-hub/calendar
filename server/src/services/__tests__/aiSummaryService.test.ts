import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../db';
import { NotFoundError } from '../../errors';

vi.mock('../../config', () => ({
  config: {
    jwtSecret: 'test-secret-key',
    databasePath: ':memory:',
    port: 3200,
    deepseekApiKey: 'test-api-key',
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
  calculateDateRange,
  groupWorkEntries,
  matchOkrToEntries,
  generate,
  list,
  getById,
} from '../aiSummaryService';
import * as categoryService from '../categoryService';
import * as workEntryService from '../workEntryService';
import type { WorkEntry, CategoryWithCount, Objective } from '../../types';

function createTestUser(username = 'testuser'): number {
  const result = testDb.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, 'hash');
  return result.lastInsertRowid as number;
}

function createTestCategory(userId: number, name: string, isDefault = false): number {
  const result = testDb.prepare(
    'INSERT INTO categories (userId, name, color, isDefault) VALUES (?, ?, ?, ?)'
  ).run(userId, name, '#FFB5B5', isDefault ? 1 : 0);
  return result.lastInsertRowid as number;
}

describe('aiSummaryService', () => {
  let userId: number;

  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
    userId = createTestUser();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('calculateDateRange', () => {
    it('should return single date for daily', () => {
      const result = calculateDateRange('daily', '2025-01-06');
      expect(result).toEqual({ startDate: '2025-01-06', endDate: '2025-01-06' });
    });

    it('should return Monday-Friday for weekly (2025-W02)', () => {
      const result = calculateDateRange('weekly', '2025-W02');
      expect(result.startDate).toBe('2025-01-06');
      expect(result.endDate).toBe('2025-01-10');
    });

    it('should return Monday-Friday for weekly (2025-W01)', () => {
      const result = calculateDateRange('weekly', '2025-W01');
      // 2025-W01: Dec 30, 2024 (Mon) - Jan 3, 2025 (Fri)
      expect(result.startDate).toBe('2024-12-30');
      expect(result.endDate).toBe('2025-01-03');
    });

    it('should return first and last day for monthly', () => {
      const result = calculateDateRange('monthly', '2025-01');
      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-01-31');
    });

    it('should handle February correctly', () => {
      const result = calculateDateRange('monthly', '2025-02');
      expect(result.startDate).toBe('2025-02-01');
      expect(result.endDate).toBe('2025-02-28');
    });

    it('should handle leap year February', () => {
      const result = calculateDateRange('monthly', '2024-02');
      expect(result.startDate).toBe('2024-02-01');
      expect(result.endDate).toBe('2024-02-29');
    });

    it('should return Q1 range (Jan-Mar)', () => {
      const result = calculateDateRange('quarterly', '2025-Q1');
      expect(result.startDate).toBe('2025-01-01');
      expect(result.endDate).toBe('2025-03-31');
    });

    it('should return Q2 range (Apr-Jun)', () => {
      const result = calculateDateRange('quarterly', '2025-Q2');
      expect(result.startDate).toBe('2025-04-01');
      expect(result.endDate).toBe('2025-06-30');
    });

    it('should return Q3 range (Jul-Sep)', () => {
      const result = calculateDateRange('quarterly', '2025-Q3');
      expect(result.startDate).toBe('2025-07-01');
      expect(result.endDate).toBe('2025-09-30');
    });

    it('should return Q4 range (Oct-Dec)', () => {
      const result = calculateDateRange('quarterly', '2025-Q4');
      expect(result.startDate).toBe('2025-10-01');
      expect(result.endDate).toBe('2025-12-31');
    });
  });

  describe('groupWorkEntries', () => {
    it('should group entries by category', () => {
      const categories: CategoryWithCount[] = [
        { id: 1, userId: 1, name: '高管', color: '#FFB5B5', isDefault: false, createdAt: '', workEntryCount: 0, objectiveCount: 0 },
        { id: 2, userId: 1, name: '培训', color: '#B5D8FF', isDefault: false, createdAt: '', workEntryCount: 0, objectiveCount: 0 },
      ];
      const entries: WorkEntry[] = [
        { id: 1, userId: 1, categoryId: 1, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'A', createdAt: '', updatedAt: '' },
        { id: 2, userId: 1, categoryId: 2, date: '2025-01-06', timeSlot: '10:00-11:00', subCategory: '', description: 'B', createdAt: '', updatedAt: '' },
        { id: 3, userId: 1, categoryId: 1, date: '2025-01-06', timeSlot: '11:00-12:00', subCategory: '', description: 'C', createdAt: '', updatedAt: '' },
      ];

      const result = groupWorkEntries(entries, categories);
      expect(result.categoryGroups).toHaveLength(2);
      const gaoguanGroup = result.categoryGroups.find(g => g.categoryName === '高管');
      expect(gaoguanGroup!.entries).toHaveLength(2);
      const peixunGroup = result.categoryGroups.find(g => g.categoryName === '培训');
      expect(peixunGroup!.entries).toHaveLength(1);
      expect(result.nonOkrEntries).toHaveLength(0);
    });

    it('should separate "其他" (isDefault) entries as nonOkrEntries', () => {
      const categories: CategoryWithCount[] = [
        { id: 1, userId: 1, name: '高管', color: '#FFB5B5', isDefault: false, createdAt: '', workEntryCount: 0, objectiveCount: 0 },
        { id: 2, userId: 1, name: '其他', color: '#D5B5FF', isDefault: true, createdAt: '', workEntryCount: 0, objectiveCount: 0 },
      ];
      const entries: WorkEntry[] = [
        { id: 1, userId: 1, categoryId: 1, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'OKR work', createdAt: '', updatedAt: '' },
        { id: 2, userId: 1, categoryId: 2, date: '2025-01-06', timeSlot: '10:00-11:00', subCategory: '', description: 'Other work', createdAt: '', updatedAt: '' },
      ];

      const result = groupWorkEntries(entries, categories);
      expect(result.categoryGroups).toHaveLength(1);
      expect(result.categoryGroups[0].categoryName).toBe('高管');
      expect(result.nonOkrEntries).toHaveLength(1);
      expect(result.nonOkrEntries[0].description).toBe('Other work');
    });

    it('should handle entries with unknown categoryId as nonOkrEntries', () => {
      const categories: CategoryWithCount[] = [];
      const entries: WorkEntry[] = [
        { id: 1, userId: 1, categoryId: 999, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'Unknown', createdAt: '', updatedAt: '' },
      ];

      const result = groupWorkEntries(entries, categories);
      expect(result.categoryGroups).toHaveLength(0);
      expect(result.nonOkrEntries).toHaveLength(1);
    });

    it('should return empty groups for no entries', () => {
      const categories: CategoryWithCount[] = [
        { id: 1, userId: 1, name: '高管', color: '#FFB5B5', isDefault: false, createdAt: '', workEntryCount: 0, objectiveCount: 0 },
      ];

      const result = groupWorkEntries([], categories);
      expect(result.categoryGroups).toHaveLength(0);
      expect(result.nonOkrEntries).toHaveLength(0);
    });
  });

  describe('matchOkrToEntries', () => {
    it('should match objectives to entries by categoryId', () => {
      const objectives: Objective[] = [
        { id: 1, userId: 1, categoryId: 10, quarter: '2025-Q1', title: 'Obj1', description: '', keyResults: [], createdAt: '', updatedAt: '' },
        { id: 2, userId: 1, categoryId: 20, quarter: '2025-Q1', title: 'Obj2', description: '', keyResults: [], createdAt: '', updatedAt: '' },
      ];
      const entries: WorkEntry[] = [
        { id: 1, userId: 1, categoryId: 10, date: '2025-01-06', timeSlot: '09:00-10:00', subCategory: '', description: 'A', createdAt: '', updatedAt: '' },
        { id: 2, userId: 1, categoryId: 10, date: '2025-01-06', timeSlot: '10:00-11:00', subCategory: '', description: 'B', createdAt: '', updatedAt: '' },
        { id: 3, userId: 1, categoryId: 30, date: '2025-01-06', timeSlot: '11:00-12:00', subCategory: '', description: 'C', createdAt: '', updatedAt: '' },
      ];

      const result = matchOkrToEntries(objectives, entries);
      expect(result).toHaveLength(2);
      expect(result[0].objective.title).toBe('Obj1');
      expect(result[0].matchedEntries).toHaveLength(2);
      expect(result[1].objective.title).toBe('Obj2');
      expect(result[1].matchedEntries).toHaveLength(0);
    });

    it('should return empty matched entries when no entries match', () => {
      const objectives: Objective[] = [
        { id: 1, userId: 1, categoryId: 10, quarter: '2025-Q1', title: 'Obj1', description: '', keyResults: [], createdAt: '', updatedAt: '' },
      ];

      const result = matchOkrToEntries(objectives, []);
      expect(result).toHaveLength(1);
      expect(result[0].matchedEntries).toHaveLength(0);
    });
  });

  describe('generate', () => {
    let categoryId: number;
    let defaultCategoryId: number;

    beforeEach(() => {
      categoryId = createTestCategory(userId, '高管', false);
      defaultCategoryId = createTestCategory(userId, '其他', true);
    });

    it('should generate summary and save to database', async () => {
      // Create work entries
      workEntryService.save(userId, [
        { date: '2025-01-06', timeSlot: '09:00-10:00', categoryId, subCategory: '周会', description: '团队周会' },
      ]);

      // Mock fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '这是AI生成的总结内容' } }],
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const summary = await generate(userId, 'daily', '2025-01-06');

      expect(summary.userId).toBe(userId);
      expect(summary.type).toBe('daily');
      expect(summary.target).toBe('2025-01-06');
      expect(summary.content).toBe('这是AI生成的总结内容');
      expect(summary.id).toBeDefined();
      expect(summary.createdAt).toBeDefined();

      // Verify fetch was called with correct params
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.deepseek.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
          }),
        }),
      );

      vi.unstubAllGlobals();
    });

    it('should throw error when API call fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(generate(userId, 'daily', '2025-01-06'))
        .rejects.toThrow('AI 总结生成失败，请稍后重试');

      vi.unstubAllGlobals();
    });

    it('should throw error when fetch throws network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      vi.stubGlobal('fetch', mockFetch);

      await expect(generate(userId, 'daily', '2025-01-06'))
        .rejects.toThrow('AI 总结生成失败，请稍后重试');

      vi.unstubAllGlobals();
    });

    it('should throw error when API returns empty choices', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ choices: [] }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await expect(generate(userId, 'daily', '2025-01-06'))
        .rejects.toThrow('AI 总结生成失败，请稍后重试');

      vi.unstubAllGlobals();
    });
  });

  describe('list', () => {
    it('should return summaries ordered by createdAt DESC', () => {
      testDb.prepare(
        "INSERT INTO summaries (userId, type, target, content, createdAt) VALUES (?, ?, ?, ?, datetime('now', '-1 hour'))"
      ).run(userId, 'daily', '2025-01-06', 'Summary 1');
      testDb.prepare(
        'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
      ).run(userId, 'weekly', '2025-W02', 'Summary 2');

      const summaries = list(userId);
      expect(summaries).toHaveLength(2);
      // Most recent first
      expect(summaries[0].target).toBe('2025-W02');
      expect(summaries[1].target).toBe('2025-01-06');
    });

    it('should only return summaries for the given user', () => {
      const user2 = createTestUser('user2');
      testDb.prepare(
        'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
      ).run(userId, 'daily', '2025-01-06', 'User1 summary');
      testDb.prepare(
        'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
      ).run(user2, 'daily', '2025-01-06', 'User2 summary');

      const summaries = list(userId);
      expect(summaries).toHaveLength(1);
      expect(summaries[0].content).toBe('User1 summary');
    });

    it('should return empty array when no summaries exist', () => {
      const summaries = list(userId);
      expect(summaries).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('should return summary by id for the correct user', () => {
      const result = testDb.prepare(
        'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
      ).run(userId, 'daily', '2025-01-06', 'Test summary');
      const id = result.lastInsertRowid as number;

      const summary = getById(userId, id);
      expect(summary.id).toBe(id);
      expect(summary.content).toBe('Test summary');
      expect(summary.type).toBe('daily');
    });

    it('should throw NotFoundError when summary does not exist', () => {
      expect(() => getById(userId, 9999)).toThrow(NotFoundError);
    });

    it('should throw NotFoundError when summary belongs to another user', () => {
      const user2 = createTestUser('user2');
      const result = testDb.prepare(
        'INSERT INTO summaries (userId, type, target, content) VALUES (?, ?, ?, ?)'
      ).run(user2, 'daily', '2025-01-06', 'User2 summary');
      const id = result.lastInsertRowid as number;

      expect(() => getById(userId, id)).toThrow(NotFoundError);
    });
  });
});
