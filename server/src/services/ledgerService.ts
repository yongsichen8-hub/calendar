import { getDb } from '../db';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors';
import { getHotelStandard, getOverseasCurrency } from './travelPolicyService';
import type {
  ManagementSubject,
  ManagementSubjectWithSummary,
  CreateSubjectDTO,
  UpdateSubjectDTO,
  ExpenseEntry,
  CreateExpenseDTO,
  UpdateExpenseDTO,
  ExpenseFilters,
  SubjectBudgetSummary,
  ExpenseCategoryWithSummary,
  UpdateCategoryBudgetDTO,
  SubjectCurrency,
} from '../types';

const DEFAULT_EXPENSE_CATEGORIES = ['差旅', '招待', '团建'];

// ============================================================
// Management Subject CRUD
// ============================================================

export function createSubject(userId: number, data: CreateSubjectDTO): ManagementSubject {
  const name = data.name;
  if (!name || name.trim().length === 0) {
    throw new ValidationError('名称不能为空');
  }

  const db = getDb();
  const trimmedName = name.trim();
  const currency: SubjectCurrency = data.currency || 'CNY';
  const exchangeRate = currency === 'EUR' ? (data.exchangeRate || 7.8) : 1.0;
  const travelBudgetCode = (data.travelBudgetCode || '').trim();
  const entertainBudgetCode = (data.entertainBudgetCode || '').trim();
  const costCenterCode = (data.costCenterCode || '').trim();
  const collaborationBudgetCode = (data.collaborationBudgetCode || '').trim();

  const existing = db.prepare(
    'SELECT id FROM management_subjects WHERE userId = ? AND name = ?'
  ).get(userId, trimmedName);
  if (existing) {
    throw new ValidationError('名称已存在');
  }

  const subject = db.transaction(() => {
    const result = db.prepare(
      'INSERT INTO management_subjects (userId, name, totalBudget, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode) VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?)'
    ).run(userId, trimmedName, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode);

    const subjectId = result.lastInsertRowid as number;

    const insertCategory = db.prepare(
      'INSERT INTO expense_categories (subjectId, name, budget) VALUES (?, ?, 0)'
    );
    for (const catName of DEFAULT_EXPENSE_CATEGORIES) {
      insertCategory.run(subjectId, catName);
    }

    return db.prepare(
      'SELECT id, userId, name, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode, createdAt, updatedAt FROM management_subjects WHERE id = ?'
    ).get(subjectId) as ManagementSubject;
  })();

  return subject;
}

export function listSubjects(userId: number): ManagementSubjectWithSummary[] {
  const db = getDb();

  const subjects = db.prepare(
    'SELECT id, userId, name, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode, createdAt, updatedAt FROM management_subjects WHERE userId = ? ORDER BY id ASC'
  ).all(userId) as ManagementSubject[];

  return subjects.map(s => {
    const rate = s.currency === 'EUR' ? s.exchangeRate : 1;

    // For proper CNY conversion, use listCategoriesWithSummary which handles mixed currencies
    const cats = db.prepare('SELECT id FROM expense_categories WHERE subjectId = ? ORDER BY id ASC').all(s.id) as { id: number }[];
    const catSummaries = cats.map(c => getCategoryWithSummary(c.id, rate));

    const totalBudget = catSummaries.reduce((sum, c) => sum + c.budget, 0);
    const usedAmount = catSummaries.reduce((sum, c) => sum + c.usedAmount, 0);
    const usedAmountCNY = catSummaries.reduce((sum, c) => sum + c.usedAmountCNY, 0);
    const remainingBudget = totalBudget - usedAmountCNY;
    const usagePercent = totalBudget > 0 ? (usedAmountCNY / totalBudget) * 100 : 0;

    return { ...s, totalBudget, usedAmount, usedAmountCNY, remainingBudget, usagePercent };
  });
}

export function updateSubject(userId: number, id: number, data: UpdateSubjectDTO): ManagementSubject {
  const db = getDb();

  const row = db.prepare(
    'SELECT id, userId, name, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode, createdAt, updatedAt FROM management_subjects WHERE id = ?'
  ).get(id) as ManagementSubject | undefined;

  if (!row) throw new NotFoundError('管理对象不存在');
  if (row.userId !== userId) throw new ForbiddenError('禁止访问');

  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    if (!data.name || data.name.trim().length === 0) {
      throw new ValidationError('名称不能为空');
    }
    const trimmedName = data.name.trim();
    const duplicate = db.prepare(
      'SELECT id FROM management_subjects WHERE userId = ? AND name = ? AND id != ?'
    ).get(userId, trimmedName, id);
    if (duplicate) throw new ValidationError('名称已存在');
    updates.push('name = ?');
    params.push(trimmedName);
  }

  if (data.currency !== undefined) {
    updates.push('currency = ?');
    params.push(data.currency);
  }

  if (data.exchangeRate !== undefined) {
    updates.push('exchangeRate = ?');
    params.push(data.exchangeRate);
  }

  if (data.travelBudgetCode !== undefined) {
    updates.push('travelBudgetCode = ?');
    params.push(data.travelBudgetCode.trim());
  }

  if (data.entertainBudgetCode !== undefined) {
    updates.push('entertainBudgetCode = ?');
    params.push(data.entertainBudgetCode.trim());
  }

  if (data.costCenterCode !== undefined) {
    updates.push('costCenterCode = ?');
    params.push(data.costCenterCode.trim());
  }

  if (data.collaborationBudgetCode !== undefined) {
    updates.push('collaborationBudgetCode = ?');
    params.push(data.collaborationBudgetCode.trim());
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE management_subjects SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  return db.prepare(
    'SELECT id, userId, name, currency, exchangeRate, travelBudgetCode, entertainBudgetCode, costCenterCode, collaborationBudgetCode, createdAt, updatedAt FROM management_subjects WHERE id = ?'
  ).get(id) as ManagementSubject;
}

export function deleteSubject(userId: number, id: number): void {
  const db = getDb();
  const row = db.prepare('SELECT id, userId FROM management_subjects WHERE id = ?').get(id) as { id: number; userId: number } | undefined;
  if (!row) throw new NotFoundError('管理对象不存在');
  if (row.userId !== userId) throw new ForbiddenError('禁止访问');
  db.prepare('DELETE FROM management_subjects WHERE id = ?').run(id);
}

// ============================================================
// Expense Category Budget
// ============================================================

export function updateCategoryBudget(userId: number, categoryId: number, data: UpdateCategoryBudgetDTO): ExpenseCategoryWithSummary {
  const db = getDb();

  const cat = db.prepare(`
    SELECT ec.id, ec.subjectId, ec.name, ec.budget, ec.createdAt, ms.userId, ms.currency, ms.exchangeRate
    FROM expense_categories ec
    JOIN management_subjects ms ON ms.id = ec.subjectId
    WHERE ec.id = ?
  `).get(categoryId) as { id: number; subjectId: number; name: string; budget: number; createdAt: string; userId: number; currency: string; exchangeRate: number } | undefined;

  if (!cat) throw new NotFoundError('开销分类不存在');
  if (cat.userId !== userId) throw new ForbiddenError('禁止访问');

  if (data.budget < 0) throw new ValidationError('预算额度不能为负数');

  db.prepare('UPDATE expense_categories SET budget = ? WHERE id = ?').run(data.budget, categoryId);

  const rate = cat.currency === 'EUR' ? cat.exchangeRate : 1;
  return getCategoryWithSummary(categoryId, rate);
}

export function listCategoriesWithSummary(userId: number, subjectId: number): ExpenseCategoryWithSummary[] {
  const db = getDb();
  const subject = db.prepare('SELECT id, userId, currency, exchangeRate FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number; currency: string; exchangeRate: number } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  const rate = subject.currency === 'EUR' ? subject.exchangeRate : 1;
  const cats = db.prepare('SELECT id FROM expense_categories WHERE subjectId = ? ORDER BY id ASC').all(subjectId) as { id: number }[];
  return cats.map(c => getCategoryWithSummary(c.id, rate));
}

function getCategoryWithSummary(categoryId: number, exchangeRate: number = 1): ExpenseCategoryWithSummary {
  const db = getDb();
  const cat = db.prepare('SELECT id, subjectId, name, budget, createdAt FROM expense_categories WHERE id = ?').get(categoryId) as { id: number; subjectId: number; name: string; budget: number; createdAt: string };
  const usedRow = db.prepare('SELECT COALESCE(SUM(amount), 0) as usedAmount FROM expense_entries WHERE categoryId = ?').get(categoryId) as { usedAmount: number };
  const usedAmount = usedRow.usedAmount;

  // Convert each expense to CNY based on its own currency field
  // For 差旅 category: hotel expenses are capped at standard limit (excess is self-paid)
  const entries = db.prepare(
    'SELECT ee.amount, ee.currency, ee.subType, ee.date, ee.endDate, ee.travelOrderId FROM expense_entries ee WHERE ee.categoryId = ?'
  ).all(categoryId) as { amount: number; currency: string; subType: string | null; date: string; endDate: string | null; travelOrderId: number | null }[];

  // Pre-fetch hotel limits and destination info for travel orders (only for 差旅 category)
  const hotelLimitCache = new Map<number, { limit: number; limitCurrency: string }>();
  if (cat.name === '差旅') {
    const orderIds = [...new Set(entries.filter(e => e.travelOrderId).map(e => e.travelOrderId!))];
    for (const oid of orderIds) {
      const orderRow = db.prepare('SELECT userId, destinationCity, departureDate, destination FROM travel_orders WHERE id = ?').get(oid) as { userId: number; destinationCity: string; departureDate: string; destination: string } | undefined;
      if (orderRow && orderRow.destinationCity) {
        const limit = getHotelStandard(orderRow.userId, orderRow.destinationCity, orderRow.departureDate, orderRow.destination);
        // Hotel limit currency: 境内=CNY, 境外=order currency (determined by destination)
        const limitCurrency = orderRow.destination === '境内' ? 'CNY' : getOverseasCurrency(orderRow.destinationCity);
        hotelLimitCache.set(oid, { limit, limitCurrency });
      }
    }
  }

  // Helper: convert between currencies
  const convertCur = (amt: number, from: string, to: string) => {
    if (from === to) return amt;
    const toCNY = from === 'CNY' ? amt : amt * exchangeRate;
    return to === 'CNY' ? toCNY : toCNY / exchangeRate;
  };

  let usedAmountCNY = 0;
  for (const e of entries) {
    let amtCNY: number;
    // Cap hotel expenses at standard limit for 差旅 category
    if (cat.name === '差旅' && e.subType === '酒店' && e.travelOrderId) {
      const cached = hotelLimitCache.get(e.travelOrderId);
      if (cached && cached.limit > 0) {
        let nights = 1;
        if (e.endDate && e.date) {
          const d1 = new Date(e.date);
          const d2 = new Date(e.endDate);
          nights = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
        }
        const maxAllowed = nights * cached.limit;
        // Convert expense to limit currency for comparison
        const amtInLimitCur = convertCur(e.amount, e.currency, cached.limitCurrency);
        const cappedInLimitCur = Math.min(amtInLimitCur, maxAllowed);
        // Convert capped amount to CNY
        amtCNY = convertCur(cappedInLimitCur, cached.limitCurrency, 'CNY');
      } else {
        amtCNY = e.currency === 'CNY' ? e.amount : e.amount * exchangeRate;
      }
    } else {
      amtCNY = e.currency === 'CNY' ? e.amount : e.amount * exchangeRate;
    }
    usedAmountCNY += amtCNY;
  }

  const remainingBudget = cat.budget - usedAmountCNY;
  const usagePercent = cat.budget > 0 ? (usedAmountCNY / cat.budget) * 100 : 0;
  return { ...cat, usedAmount, usedAmountCNY, remainingBudget, usagePercent };
}

// ============================================================
// Expense Entry CRUD
// ============================================================

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function createExpense(userId: number, subjectId: number, data: CreateExpenseDTO): ExpenseEntry {
  const db = getDb();
  const subject = db.prepare('SELECT id, userId, currency FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number; currency: string } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  if (data.amount <= 0) throw new ValidationError('金额必须为正数');
  if (!data.description || data.description.trim().length === 0) throw new ValidationError('明细不能为空');
  if (!ISO_DATE_REGEX.test(data.date)) throw new ValidationError('日期格式无效');

  const category = db.prepare('SELECT id, name FROM expense_categories WHERE subjectId = ? AND name = ?').get(subjectId, data.categoryName) as { id: number; name: string } | undefined;
  if (!category) throw new ValidationError('开销分类不存在');

  const currency = data.currency || subject.currency || 'CNY';

  const result = db.prepare('INSERT INTO expense_entries (userId, categoryId, amount, description, date, currency) VALUES (?, ?, ?, ?, ?, ?)').run(userId, category.id, data.amount, data.description.trim(), data.date, currency);

  return db.prepare(`
    SELECT ee.id, ee.userId, ee.categoryId, ec.name as categoryName, ee.amount, ee.currency, ee.description, ee.date, ee.createdAt, ee.updatedAt
    FROM expense_entries ee JOIN expense_categories ec ON ec.id = ee.categoryId WHERE ee.id = ?
  `).get(result.lastInsertRowid) as ExpenseEntry;
}

export function listExpenses(userId: number, subjectId: number, filters?: ExpenseFilters): ExpenseEntry[] {
  const db = getDb();
  const subject = db.prepare('SELECT id, userId FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  let sql = `
    SELECT ee.id, ee.userId, ee.categoryId, ec.name as categoryName, ee.amount, ee.currency, ee.description, ee.date, ee.createdAt, ee.updatedAt
    FROM expense_entries ee JOIN expense_categories ec ON ec.id = ee.categoryId WHERE ec.subjectId = ?
  `;
  const params: any[] = [subjectId];

  if (filters?.categoryName) { sql += ' AND ec.name = ?'; params.push(filters.categoryName); }
  if (filters?.startDate) { sql += ' AND ee.date >= ?'; params.push(filters.startDate); }
  if (filters?.endDate) { sql += ' AND ee.date <= ?'; params.push(filters.endDate); }
  if (filters?.keyword) { sql += ' AND ee.description LIKE ?'; params.push(`%${filters.keyword}%`); }

  sql += ' ORDER BY ee.date DESC, ee.id DESC';
  return db.prepare(sql).all(...params) as ExpenseEntry[];
}

export function updateExpense(userId: number, id: number, data: UpdateExpenseDTO): ExpenseEntry {
  const db = getDb();
  const entry = db.prepare(`
    SELECT ee.id, ee.userId FROM expense_entries ee WHERE ee.id = ?
  `).get(id) as { id: number; userId: number } | undefined;

  if (!entry) throw new NotFoundError('开销条目不存在');
  if (entry.userId !== userId) throw new ForbiddenError('禁止访问');

  if (data.amount !== undefined && data.amount <= 0) throw new ValidationError('金额必须为正数');
  if (data.description !== undefined && (!data.description || data.description.trim().length === 0)) throw new ValidationError('明细不能为空');
  if (data.date !== undefined && !ISO_DATE_REGEX.test(data.date)) throw new ValidationError('日期格式无效');

  const updates: string[] = [];
  const params: any[] = [];
  if (data.amount !== undefined) { updates.push('amount = ?'); params.push(data.amount); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description.trim()); }
  if (data.date !== undefined) { updates.push('date = ?'); params.push(data.date); }
  if (data.currency !== undefined) { updates.push('currency = ?'); params.push(data.currency); }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(id);
    db.prepare(`UPDATE expense_entries SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  return db.prepare(`
    SELECT ee.id, ee.userId, ee.categoryId, ec.name as categoryName, ee.amount, ee.currency, ee.description, ee.date, ee.createdAt, ee.updatedAt
    FROM expense_entries ee JOIN expense_categories ec ON ec.id = ee.categoryId WHERE ee.id = ?
  `).get(id) as ExpenseEntry;
}

export function deleteExpense(userId: number, id: number): void {
  const db = getDb();
  const entry = db.prepare('SELECT id, userId FROM expense_entries WHERE id = ?').get(id) as { id: number; userId: number } | undefined;
  if (!entry) throw new NotFoundError('开销条目不存在');
  if (entry.userId !== userId) throw new ForbiddenError('禁止访问');
  db.prepare('DELETE FROM expense_entries WHERE id = ?').run(id);
}

// ============================================================
// Budget Summary
// ============================================================

export function getSubjectSummary(userId: number, subjectId: number): SubjectBudgetSummary {
  const db = getDb();
  const subject = db.prepare('SELECT id, userId, currency, exchangeRate FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number; currency: string; exchangeRate: number } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  const categoryBreakdown = listCategoriesWithSummary(userId, subjectId);
  const totalBudget = categoryBreakdown.reduce((sum, c) => sum + c.budget, 0);
  const usedAmount = categoryBreakdown.reduce((sum, c) => sum + c.usedAmount, 0);
  const usedAmountCNY = categoryBreakdown.reduce((sum, c) => sum + c.usedAmountCNY, 0);
  const remainingBudget = totalBudget - usedAmountCNY;
  const usagePercent = totalBudget > 0 ? (usedAmountCNY / totalBudget) * 100 : 0;

  return { subjectId, totalBudget, usedAmount, usedAmountCNY, remainingBudget, usagePercent, categoryBreakdown };
}
