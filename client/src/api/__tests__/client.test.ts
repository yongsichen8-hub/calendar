import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from '../client';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status, headers: { 'content-length': '0' } });
}

describe('apiClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    // Prevent actual navigation
    delete (window as any).location;
    (window as any).location = { href: '' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request wrapper', () => {
    it('sends credentials: include on every request', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.categories.list();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/categories',
        expect.objectContaining({ credentials: 'include' }),
      );
    });

    it('sets Content-Type to application/json', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.categories.list();
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.headers['Content-Type']).toBe('application/json');
    });

    it('redirects to /login on 401 response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      );
      await expect(apiClient.categories.list()).rejects.toThrow(ApiError);
      expect(window.location.href).toBe('/calendar/login');
    });

    it('throws ApiError with status and message on non-ok response', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Not Found' }), { status: 404 }),
      );
      try {
        await apiClient.categories.list();
        expect.fail('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(ApiError);
        expect((e as ApiError).status).toBe(404);
        expect((e as ApiError).message).toBe('Not Found');
      }
    });

    it('handles 204 no-content responses', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      const result = await apiClient.workEntries.delete(1);
      expect(result).toBeUndefined();
    });
  });

  describe('auth', () => {
    it('register sends POST with username and password', async () => {
      const user = { user: { id: 1, username: 'test', createdAt: '' }, token: 'tok' };
      mockFetch.mockResolvedValue(jsonResponse(user));
      const result = await apiClient.auth.register('test', 'pass123');
      expect(result).toEqual(user);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ username: 'test', password: 'pass123' }),
        }),
      );
    });

    it('login sends POST with username and password', async () => {
      const user = { user: { id: 1, username: 'test', createdAt: '' }, token: 'tok' };
      mockFetch.mockResolvedValue(jsonResponse(user));
      const result = await apiClient.auth.login('test', 'pass123');
      expect(result).toEqual(user);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/login',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('logout sends POST', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.auth.logout();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/auth/logout',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('workEntries', () => {
    it('getByWeek sends week as query param', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.workEntries.getByWeek('2025-01-06');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/work-entries?week=2025-01-06',
        expect.anything(),
      );
    });

    it('save sends POST with entries wrapped in object', async () => {
      const entries = [{ date: '2025-01-06', timeSlot: '09:00-10:00', categoryId: 1, subCategory: 'test', description: 'desc' }];
      mockFetch.mockResolvedValue(jsonResponse(entries));
      await apiClient.workEntries.save(entries);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/work-entries',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ entries }),
        }),
      );
    });

    it('delete sends DELETE with id', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.workEntries.delete(42);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/work-entries/42',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('categories', () => {
    it('list fetches GET /api/categories', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.categories.list();
      expect(mockFetch).toHaveBeenCalledWith('/api/categories', expect.anything());
    });

    it('create sends POST with name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'New' }));
      await apiClient.categories.create('New');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/categories',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New' }),
        }),
      );
    });

    it('update sends PUT with name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'Updated' }));
      await apiClient.categories.update(1, 'Updated');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/categories/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Updated' }),
        }),
      );
    });

    it('delete sends DELETE without migrateToId', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.categories.delete(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/categories/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('delete sends DELETE with migrateToId query param', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.categories.delete(1, 2);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/categories/1?migrateToId=2',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('okr', () => {
    it('getByQuarter sends quarter as query param', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ quarter: '2025-Q1', objectives: [] }));
      await apiClient.okr.getByQuarter('2025-Q1');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr?quarter=2025-Q1',
        expect.anything(),
      );
    });

    it('createObjective sends POST', async () => {
      const obj = { categoryId: 1, quarter: '2025-Q1', title: 'T', description: 'D' };
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, ...obj }));
      await apiClient.okr.createObjective(obj);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/objectives',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(obj) }),
      );
    });

    it('updateObjective sends PUT', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, title: 'Updated' }));
      await apiClient.okr.updateObjective(1, { title: 'Updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/objectives/1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deleteObjective sends DELETE', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.okr.deleteObjective(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/objectives/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });

    it('createKeyResult sends POST', async () => {
      const kr = { objectiveId: 1, description: 'KR1' };
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, ...kr }));
      await apiClient.okr.createKeyResult(kr);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/key-results',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(kr) }),
      );
    });

    it('updateKeyResult sends PUT', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, progress: 75 }));
      await apiClient.okr.updateKeyResult(1, { progress: 75 });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/key-results/1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('deleteKeyResult sends DELETE', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.okr.deleteKeyResult(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/okr/key-results/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('inspirations', () => {
    it('list fetches without categoryId', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.inspirations.list();
      expect(mockFetch).toHaveBeenCalledWith('/api/inspirations', expect.anything());
    });

    it('list fetches with categoryId filter', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.inspirations.list(3);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspirations?categoryId=3',
        expect.anything(),
      );
    });

    it('create sends POST', async () => {
      const entry = { content: 'idea', type: 'inspiration' as const, categoryId: 1 };
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, ...entry }));
      await apiClient.inspirations.create(entry);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspirations',
        expect.objectContaining({ method: 'POST', body: JSON.stringify(entry) }),
      );
    });

    it('update sends PUT', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, content: 'updated' }));
      await apiClient.inspirations.update(1, { content: 'updated' });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspirations/1',
        expect.objectContaining({ method: 'PUT' }),
      );
    });

    it('delete sends DELETE', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.inspirations.delete(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspirations/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('inspirationCategories', () => {
    it('list fetches GET', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.inspirationCategories.list();
      expect(mockFetch).toHaveBeenCalledWith('/api/inspiration-categories', expect.anything());
    });

    it('create sends POST with name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'Work' }));
      await apiClient.inspirationCategories.create('Work');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspiration-categories',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Work' }) }),
      );
    });

    it('update sends PUT with name', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, name: 'Study' }));
      await apiClient.inspirationCategories.update(1, 'Study');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspiration-categories/1',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ name: 'Study' }) }),
      );
    });

    it('delete sends DELETE', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.inspirationCategories.delete(1);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/inspiration-categories/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('milestones', () => {
    it('identify sends POST with date range', async () => {
      const result = { date: '2025-01-06', suggestions: [] };
      mockFetch.mockResolvedValue(jsonResponse(result));
      const res = await apiClient.milestones.identify('2025-01-06');
      expect(res).toEqual(result);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/milestones/identify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ date: '2025-01-06', endDate: '2025-01-06' }),
        }),
      );
    });

    it('save sends POST with keyResultId, date, and milestones', async () => {
      const saved = [{ id: 1, keyResultId: 10, content: '完成文档', date: '2025-01-06', createdAt: '' }];
      mockFetch.mockResolvedValue(jsonResponse(saved));
      const res = await apiClient.milestones.save(10, '2025-01-06', ['完成文档']);
      expect(res).toEqual(saved);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/milestones/save',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ keyResultId: 10, date: '2025-01-06', milestones: ['完成文档'] }),
        }),
      );
    });

    it('update sends PUT with content and date', async () => {
      const updated = { id: 1, keyResultId: 10, content: '更新内容', date: '2025-02-01', createdAt: '' };
      mockFetch.mockResolvedValue(jsonResponse(updated));
      const res = await apiClient.milestones.update(1, { content: '更新内容', date: '2025-02-01' });
      expect(res).toEqual(updated);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/milestones/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ content: '更新内容', date: '2025-02-01' }),
        }),
      );
    });

    it('delete sends DELETE with id', async () => {
      mockFetch.mockResolvedValue(emptyResponse());
      await apiClient.milestones.delete(5);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/milestones/5',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('summaries', () => {
    it('generate sends POST with type and target', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1, type: 'weekly', target: '2025-W02', content: 'summary' }));
      await apiClient.summaries.generate('weekly', '2025-W02');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/summaries/generate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ type: 'weekly', target: '2025-W02' }),
        }),
      );
    });

    it('list fetches GET /api/summaries', async () => {
      mockFetch.mockResolvedValue(jsonResponse([]));
      await apiClient.summaries.list();
      expect(mockFetch).toHaveBeenCalledWith('/api/summaries', expect.anything());
    });

    it('getById fetches GET /api/summaries/:id', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 5, type: 'daily', content: 'test' }));
      await apiClient.summaries.getById(5);
      expect(mockFetch).toHaveBeenCalledWith('/api/summaries/5', expect.anything());
    });
  });
});
