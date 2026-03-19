import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../db';
import { ValidationError, AuthError } from '../errors';
import type { User } from '../types';

const SALT_ROUNDS = 10;
const JWT_EXPIRY = '7d';

export interface AuthResult {
  user: User;
  token: string;
}

export async function register(username: string, password: string): Promise<AuthResult> {
  if (username.length < 3 || username.length > 20) {
    throw new ValidationError('用户名长度必须为 3 至 20 个字符');
  }
  if (password.length < 6 || password.length > 30) {
    throw new ValidationError('密码长度必须为 6 至 30 个字符');
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    throw new ValidationError('用户名已存在');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const result = db.prepare(
    'INSERT INTO users (username, passwordHash) VALUES (?, ?)'
  ).run(username, passwordHash);

  const user: User = {
    id: result.lastInsertRowid as number,
    username,
    createdAt: new Date().toISOString(),
  };

  const token = generateToken(user.id, user.username);
  return { user, token };
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const db = getDb();
  const row = db.prepare(
    'SELECT id, username, passwordHash, createdAt FROM users WHERE username = ?'
  ).get(username) as { id: number; username: string; passwordHash: string; createdAt: string } | undefined;

  if (!row) {
    throw new AuthError('用户名或密码错误');
  }

  const valid = await bcrypt.compare(password, row.passwordHash);
  if (!valid) {
    throw new AuthError('用户名或密码错误');
  }

  const user: User = {
    id: row.id,
    username: row.username,
    createdAt: row.createdAt,
  };

  const token = generateToken(user.id, user.username);
  return { user, token };
}

export function verifyToken(token: string): { userId: number; username: string } {
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: number; username: string };
    return { userId: payload.userId, username: payload.username };
  } catch {
    throw new AuthError('未授权，请重新登录');
  }
}

function generateToken(userId: number, username: string): string {
  return jwt.sign({ userId, username }, config.jwtSecret, { expiresIn: JWT_EXPIRY });
}
