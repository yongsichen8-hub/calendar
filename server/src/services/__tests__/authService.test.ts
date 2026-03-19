import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { initializeDatabase } from '../../db';
import { ValidationError, AuthError } from '../../errors';

// Mock config before importing authService
vi.mock('../../config', () => ({
  config: {
    jwtSecret: 'test-secret-key-for-unit-tests',
    databasePath: ':memory:',
    port: 3200,
    deepseekApiKey: '',
  },
}));

let testDb: Database.Database;

// Mock getDb to return our in-memory test database
vi.mock('../../db', async () => {
  const actual = await vi.importActual('../../db');
  return {
    ...actual,
    getDb: () => testDb,
  };
});

// Import after mocks are set up
import { register, login, verifyToken } from '../authService';

describe('authService', () => {
  beforeEach(() => {
    testDb = initializeDatabase(':memory:');
  });

  afterEach(() => {
    testDb.close();
  });

  describe('register', () => {
    it('should register a new user and return user + token', async () => {
      const result = await register('testuser', 'password123');
      expect(result.user.username).toBe('testuser');
      expect(result.user.id).toBeGreaterThan(0);
      expect(result.token).toBeTruthy();
    });

    it('should reject username shorter than 3 characters', async () => {
      await expect(register('ab', 'password123')).rejects.toThrow(ValidationError);
      await expect(register('ab', 'password123')).rejects.toThrow('用户名长度必须为 3 至 20 个字符');
    });

    it('should reject username longer than 20 characters', async () => {
      const longName = 'a'.repeat(21);
      await expect(register(longName, 'password123')).rejects.toThrow(ValidationError);
    });

    it('should reject password shorter than 6 characters', async () => {
      await expect(register('testuser', '12345')).rejects.toThrow(ValidationError);
      await expect(register('testuser', '12345')).rejects.toThrow('密码长度必须为 6 至 30 个字符');
    });

    it('should reject password longer than 30 characters', async () => {
      const longPass = 'a'.repeat(31);
      await expect(register('testuser', longPass)).rejects.toThrow(ValidationError);
    });

    it('should accept boundary username length 3', async () => {
      const result = await register('abc', 'password123');
      expect(result.user.username).toBe('abc');
    });

    it('should accept boundary username length 20', async () => {
      const name = 'a'.repeat(20);
      const result = await register(name, 'password123');
      expect(result.user.username).toBe(name);
    });

    it('should accept boundary password length 6', async () => {
      const result = await register('testuser', '123456');
      expect(result.user.username).toBe('testuser');
    });

    it('should accept boundary password length 30', async () => {
      const pass = 'a'.repeat(30);
      const result = await register('testuser', pass);
      expect(result.user.username).toBe('testuser');
    });

    it('should reject duplicate username', async () => {
      await register('testuser', 'password123');
      await expect(register('testuser', 'different456')).rejects.toThrow(ValidationError);
      await expect(register('testuser', 'different456')).rejects.toThrow('用户名已存在');
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      await register('loginuser', 'password123');
    });

    it('should login with correct credentials', async () => {
      const result = await login('loginuser', 'password123');
      expect(result.user.username).toBe('loginuser');
      expect(result.token).toBeTruthy();
    });

    it('should reject non-existent username with generic error', async () => {
      await expect(login('nouser', 'password123')).rejects.toThrow(AuthError);
      await expect(login('nouser', 'password123')).rejects.toThrow('用户名或密码错误');
    });

    it('should reject wrong password with generic error', async () => {
      await expect(login('loginuser', 'wrongpass')).rejects.toThrow(AuthError);
      await expect(login('loginuser', 'wrongpass')).rejects.toThrow('用户名或密码错误');
    });

    it('should return same error message for wrong username and wrong password', async () => {
      let wrongUserMsg = '';
      let wrongPassMsg = '';
      try { await login('nouser', 'password123'); } catch (e: any) { wrongUserMsg = e.message; }
      try { await login('loginuser', 'wrongpass'); } catch (e: any) { wrongPassMsg = e.message; }
      expect(wrongUserMsg).toBe(wrongPassMsg);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return userId + username', async () => {
      const { user, token } = await register('verifyuser', 'password123');
      const payload = verifyToken(token);
      expect(payload.userId).toBe(user.id);
      expect(payload.username).toBe('verifyuser');
    });

    it('should reject an invalid token', () => {
      expect(() => verifyToken('invalid-token')).toThrow(AuthError);
    });

    it('should reject a tampered token', async () => {
      const { token } = await register('tampuser', 'password123');
      const tampered = token + 'x';
      expect(() => verifyToken(tampered)).toThrow(AuthError);
    });
  });
});
