import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config module', () => {
  const originalEnv = process.env;
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    mockExit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as any);
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should read all environment variables with correct values', async () => {
    process.env.JWT_SECRET = 'test-secret-123';
    process.env.DEEPSEEK_API_KEY = 'dk-abc123';
    process.env.PORT = '4000';
    process.env.DATABASE_PATH = '/tmp/test.db';

    const { config } = await import('../index');

    expect(config.jwtSecret).toBe('test-secret-123');
    expect(config.deepseekApiKey).toBe('dk-abc123');
    expect(config.port).toBe(4000);
    expect(config.databasePath).toBe('/tmp/test.db');
  });

  it('should use default values when optional env vars are not set', async () => {
    process.env.JWT_SECRET = 'my-secret';
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.PORT;
    delete process.env.DATABASE_PATH;

    const { config } = await import('../index');

    expect(config.jwtSecret).toBe('my-secret');
    expect(config.deepseekApiKey).toBe('');
    expect(config.port).toBe(3200);
    expect(config.databasePath).toBe('./data/calendar.db');
  });

  it('should terminate when JWT_SECRET is missing', async () => {
    delete process.env.JWT_SECRET;

    await expect(() => import('../index')).rejects.toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Missing required environment variable: JWT_SECRET'
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});
