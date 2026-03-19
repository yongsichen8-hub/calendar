import { getDb } from '../db';
import { ValidationError, NotFoundError, ForbiddenError } from '../errors';
import { calculateAllowance, getHotelStandard, getOverseasCurrency } from './travelPolicyService';
import type {
  TravelOrder,
  TravelExpenseEntry,
  CreateTravelOrderDTO,
  UpdateTravelOrderDTO,
  CreateTravelExpenseDTO,
  UpdateTravelExpenseDTO,
  TravelExpenseSubType,
  TravelDestination,
} from '../types';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SUB_TYPES: TravelExpenseSubType[] = ['酒店', '机票', '其他', '补贴'];
const VALID_DESTINATIONS: TravelDestination[] = ['境内', '境外'];

/**
 * Convert amount between currencies using the subject's exchange rate.
 * exchangeRate = how many CNY per 1 unit of foreign currency (e.g. 7.9 for EUR)
 */
function convertCurrency(amount: number, fromCurrency: string, toCurrency: string, exchangeRate: number): number {
  if (fromCurrency === toCurrency) return amount;
  // Convert to CNY first, then to target
  let amountCNY: number;
  if (fromCurrency === 'CNY') {
    amountCNY = amount;
  } else {
    // EUR or USD → CNY
    amountCNY = amount * exchangeRate;
  }
  if (toCurrency === 'CNY') return amountCNY;
  // CNY → EUR or USD
  return amountCNY / exchangeRate;
}

// ============================================================
// Helpers
// ============================================================

function getTravelCategoryId(subjectId: number): number {
  const db = getDb();
  const cat = db.prepare(
    "SELECT id FROM expense_categories WHERE subjectId = ? AND name = '差旅'"
  ).get(subjectId) as { id: number } | undefined;
  if (!cat) throw new NotFoundError('差旅分类不存在');
  return cat.id;
}

function buildTravelOrder(orderId: number): TravelOrder {
  const db = getDb();
  const order = db.prepare(
    'SELECT id, userId, categoryId, title, destination, destinationCity, departureDate, returnDate, createdAt, updatedAt FROM travel_orders WHERE id = ?'
  ).get(orderId) as Omit<TravelOrder, 'totalAmount' | 'budgetAmount' | 'hotelLimit' | 'hotelExcess' | 'expenses'> | undefined;
  if (!order) throw new NotFoundError('出差单不存在');

  // Get subject exchange rate for currency conversion
  const subjectRow = db.prepare(`
    SELECT ms.currency, ms.exchangeRate FROM management_subjects ms
    JOIN expense_categories ec ON ec.subjectId = ms.id
    WHERE ec.id = ?
  `).get(order.categoryId) as { currency: string; exchangeRate: number } | undefined;
  const subjectExchangeRate = subjectRow?.exchangeRate || 1;

  const rawExpenses = db.prepare(`
    SELECT id, travelOrderId, subType, amount, currency, description, date, endDate, paid, createdAt, updatedAt
    FROM expense_entries WHERE travelOrderId = ? ORDER BY date ASC, id ASC
  `).all(orderId) as (Omit<TravelExpenseEntry, 'nights' | 'paid'> & { endDate: string | null; paid: number })[];

  // Compute nights for each expense
  const expenses: TravelExpenseEntry[] = rawExpenses.map(e => {
    let nights = 0;
    if (e.subType === '酒店' && e.endDate && e.date) {
      const d1 = new Date(e.date);
      const d2 = new Date(e.endDate);
      nights = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)));
    }
    return { ...e, nights, paid: !!e.paid };
  });

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Determine the order's currency (for overseas) and the hotel limit currency
  const orderCurrency = order.destination === '境外' ? getOverseasCurrency(order.destinationCity) : 'CNY' as const;

  // Compute hotel limit (per night) — this is in the hotel standard's native currency:
  //   境内: CNY, 境外: the overseas policy currency (USD/EUR)
  let hotelLimit = 0;
  let hotelExcess = 0;
  if (order.destinationCity) {
    hotelLimit = getHotelStandard(order.userId, order.destinationCity, order.departureDate, order.destination);

    // hotelLimit currency: 境内 = CNY, 境外 = orderCurrency (USD/EUR)
    const hotelLimitCurrency = order.destination === '境内' ? 'CNY' : orderCurrency;

    const hotelExpenses = expenses.filter(e => e.subType === '酒店');
    for (const he of hotelExpenses) {
      const nights = he.nights || 1;
      const maxAllowed = nights * hotelLimit;

      // Convert hotel expense to the same currency as hotelLimit for comparison
      const expenseInLimitCurrency = convertCurrency(he.amount, he.currency, hotelLimitCurrency, subjectExchangeRate);

      if (expenseInLimitCurrency > maxAllowed) {
        // Excess always in CNY for unified display
        const excessInLimitCur = expenseInLimitCurrency - maxAllowed;
        hotelExcess += convertCurrency(excessInLimitCur, hotelLimitCurrency, 'CNY', subjectExchangeRate);
      }
    }
  }

  // Budget amount: hotel expenses capped at standard limit (excess is self-paid)
  const hotelLimitCurrency = order.destination === '境内' ? 'CNY' : orderCurrency;
  const budgetAmount = expenses.reduce((sum, e) => {
    if (e.subType === '酒店' && hotelLimit > 0) {
      const nights = e.nights || 1;
      const maxAllowed = nights * hotelLimit;
      const expenseInLimitCurrency = convertCurrency(e.amount, e.currency, hotelLimitCurrency, subjectExchangeRate);
      // Cap at standard, then convert back to expense's own currency for consistent summing
      const cappedInLimitCurrency = Math.min(expenseInLimitCurrency, maxAllowed);
      const cappedInExpenseCurrency = convertCurrency(cappedInLimitCurrency, hotelLimitCurrency, e.currency, subjectExchangeRate);
      return sum + cappedInExpenseCurrency;
    }
    return sum + e.amount;
  }, 0);

  return { ...order, totalAmount, budgetAmount, hotelLimit, hotelExcess, currency: orderCurrency, expenses };
}

// ============================================================
// Travel Order CRUD
// ============================================================

export function createTravelOrder(userId: number, subjectId: number, data: CreateTravelOrderDTO): TravelOrder {
  const db = getDb();

  // Verify subject ownership
  const subject = db.prepare('SELECT id, userId FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  if (!data.title || data.title.trim().length === 0) throw new ValidationError('标题不能为空');
  if (!data.destination || !VALID_DESTINATIONS.includes(data.destination)) throw new ValidationError('请选择境内/境外');
  if (!data.destinationCity || data.destinationCity.trim().length === 0) throw new ValidationError('请选择目标城市');
  if (!ISO_DATE_REGEX.test(data.departureDate)) throw new ValidationError('去程日期格式无效');
  if (!ISO_DATE_REGEX.test(data.returnDate)) throw new ValidationError('返程日期格式无效');
  if (data.departureDate > data.returnDate) throw new ValidationError('去程日期不能晚于返程日期');

  const categoryId = getTravelCategoryId(subjectId);

  const result = db.prepare(
    'INSERT INTO travel_orders (userId, categoryId, title, destination, destinationCity, departureDate, returnDate) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, categoryId, data.title.trim(), data.destination, data.destinationCity.trim(), data.departureDate, data.returnDate);

  const orderId = result.lastInsertRowid as number;

  // Auto-generate 补贴 expense
  const allowance = calculateAllowance(userId, data.departureDate, data.returnDate, data.destination, data.destinationCity);
  if (allowance.amount > 0) {
    // 境内补贴 = CNY, 境外补贴 = travel order currency (from policy)
    const allowanceCurrency = data.destination === '境内' ? 'CNY' : getOverseasCurrency(data.destinationCity);
    db.prepare(
      'INSERT INTO expense_entries (userId, categoryId, amount, description, date, travelOrderId, subType, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, categoryId, allowance.amount, `出差补贴 ${allowance.days}天×${allowance.dailyRate}元`, data.departureDate, orderId, '补贴', allowanceCurrency);
  }

  return buildTravelOrder(orderId);
}

export function listTravelOrders(userId: number, subjectId: number): TravelOrder[] {
  const db = getDb();

  const subject = db.prepare('SELECT id, userId FROM management_subjects WHERE id = ?').get(subjectId) as { id: number; userId: number } | undefined;
  if (!subject) throw new NotFoundError('管理对象不存在');
  if (subject.userId !== userId) throw new ForbiddenError('禁止访问');

  const categoryId = getTravelCategoryId(subjectId);

  const orders = db.prepare(
    'SELECT id FROM travel_orders WHERE userId = ? AND categoryId = ? ORDER BY departureDate DESC, id DESC'
  ).all(userId, categoryId) as { id: number }[];

  return orders.map(o => buildTravelOrder(o.id));
}

export function updateTravelOrder(userId: number, orderId: number, data: UpdateTravelOrderDTO): TravelOrder {
  const db = getDb();

  const order = db.prepare('SELECT id, userId FROM travel_orders WHERE id = ?').get(orderId) as { id: number; userId: number } | undefined;
  if (!order) throw new NotFoundError('出差单不存在');
  if (order.userId !== userId) throw new ForbiddenError('禁止访问');

  const updates: string[] = [];
  const params: any[] = [];

  if (data.title !== undefined) {
    if (!data.title || data.title.trim().length === 0) throw new ValidationError('标题不能为空');
    updates.push('title = ?'); params.push(data.title.trim());
  }
  if (data.destination !== undefined) {
    if (!VALID_DESTINATIONS.includes(data.destination)) throw new ValidationError('请选择境内/境外');
    updates.push('destination = ?'); params.push(data.destination);
  }
  if (data.destinationCity !== undefined) {
    updates.push('destinationCity = ?'); params.push(data.destinationCity.trim());
  }
  if (data.departureDate !== undefined) {
    if (!ISO_DATE_REGEX.test(data.departureDate)) throw new ValidationError('去程日期格式无效');
    updates.push('departureDate = ?'); params.push(data.departureDate);
  }
  if (data.returnDate !== undefined) {
    if (!ISO_DATE_REGEX.test(data.returnDate)) throw new ValidationError('返程日期格式无效');
    updates.push('returnDate = ?'); params.push(data.returnDate);
  }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(orderId);
    db.prepare(`UPDATE travel_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  // Recalculate 补贴 if dates or destination changed
  if (data.departureDate !== undefined || data.returnDate !== undefined || data.destination !== undefined || data.destinationCity !== undefined) {
    const updatedOrder = db.prepare('SELECT departureDate, returnDate, categoryId, destination, destinationCity FROM travel_orders WHERE id = ?').get(orderId) as { departureDate: string; returnDate: string; categoryId: number; destination: string; destinationCity: string };
    const allowance = calculateAllowance(userId, updatedOrder.departureDate, updatedOrder.returnDate, updatedOrder.destination, updatedOrder.destinationCity);

    // Update existing 补贴 entry or create one
    const existing = db.prepare("SELECT id FROM expense_entries WHERE travelOrderId = ? AND subType = '补贴'").get(orderId) as { id: number } | undefined;
    const allowanceCurrency = updatedOrder.destination === '境内' ? 'CNY' : getOverseasCurrency(updatedOrder.destinationCity);
    if (existing) {
      db.prepare("UPDATE expense_entries SET amount = ?, description = ?, date = ?, currency = ?, updatedAt = datetime('now') WHERE id = ?")
        .run(allowance.amount, `出差补贴 ${allowance.days}天×${allowance.dailyRate}元`, updatedOrder.departureDate, allowanceCurrency, existing.id);
    } else if (allowance.amount > 0) {
      db.prepare('INSERT INTO expense_entries (userId, categoryId, amount, description, date, travelOrderId, subType, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(userId, updatedOrder.categoryId, allowance.amount, `出差补贴 ${allowance.days}天×${allowance.dailyRate}元`, updatedOrder.departureDate, orderId, '补贴', allowanceCurrency);
    }
  }

  return buildTravelOrder(orderId);
}

export function deleteTravelOrder(userId: number, orderId: number): void {
  const db = getDb();
  const order = db.prepare('SELECT id, userId FROM travel_orders WHERE id = ?').get(orderId) as { id: number; userId: number } | undefined;
  if (!order) throw new NotFoundError('出差单不存在');
  if (order.userId !== userId) throw new ForbiddenError('禁止访问');

  db.transaction(() => {
    // Delete associated expense entries first
    db.prepare('DELETE FROM expense_entries WHERE travelOrderId = ?').run(orderId);
    db.prepare('DELETE FROM travel_orders WHERE id = ?').run(orderId);
  })();
}

// ============================================================
// Travel Expense CRUD (within a travel order)
// ============================================================

export function addTravelExpense(userId: number, orderId: number, data: CreateTravelExpenseDTO): TravelOrder {
  const db = getDb();

  const order = db.prepare('SELECT id, userId, categoryId, destination, destinationCity FROM travel_orders WHERE id = ?').get(orderId) as { id: number; userId: number; categoryId: number; destination: string; destinationCity: string } | undefined;
  if (!order) throw new NotFoundError('出差单不存在');
  if (order.userId !== userId) throw new ForbiddenError('禁止访问');

  if (!VALID_SUB_TYPES.includes(data.subType)) throw new ValidationError('无效的开销分类');
  if (data.amount <= 0) throw new ValidationError('金额必须为正数');
  if (!data.description || data.description.trim().length === 0) throw new ValidationError('明细不能为空');
  if (!ISO_DATE_REGEX.test(data.date)) throw new ValidationError('日期格式无效');

  // Hotel requires endDate
  let endDate: string | null = null;
  if (data.subType === '酒店') {
    if (!data.endDate || !ISO_DATE_REGEX.test(data.endDate)) throw new ValidationError('酒店需要退房日期');
    if (data.endDate <= data.date) throw new ValidationError('退房日期必须晚于入住日期');
    endDate = data.endDate;
  }

  // Determine currency: use provided, or default based on context
  let currency = data.currency;
  if (!currency) {
    // Look up subject currency as default
    const subject = db.prepare(`
      SELECT ms.currency FROM management_subjects ms
      JOIN expense_categories ec ON ec.subjectId = ms.id
      WHERE ec.id = ?
    `).get(order.categoryId) as { currency: string } | undefined;
    currency = (subject?.currency as any) || 'CNY';
  }

  db.prepare(
    'INSERT INTO expense_entries (userId, categoryId, amount, description, date, endDate, travelOrderId, subType, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, order.categoryId, data.amount, data.description.trim(), data.date, endDate, orderId, data.subType, currency);

  return buildTravelOrder(orderId);
}

export function updateTravelExpense(userId: number, expenseId: number, data: UpdateTravelExpenseDTO): TravelOrder {
  const db = getDb();

  const entry = db.prepare(
    'SELECT ee.id, ee.userId, ee.travelOrderId FROM expense_entries ee WHERE ee.id = ? AND ee.travelOrderId IS NOT NULL'
  ).get(expenseId) as { id: number; userId: number; travelOrderId: number } | undefined;
  if (!entry) throw new NotFoundError('开销条目不存在');
  if (entry.userId !== userId) throw new ForbiddenError('禁止访问');

  if (data.amount !== undefined && data.amount <= 0) throw new ValidationError('金额必须为正数');
  if (data.description !== undefined && (!data.description || data.description.trim().length === 0)) throw new ValidationError('明细不能为空');
  if (data.date !== undefined && !ISO_DATE_REGEX.test(data.date)) throw new ValidationError('日期格式无效');
  if (data.endDate !== undefined && data.endDate !== null && !ISO_DATE_REGEX.test(data.endDate)) throw new ValidationError('退房日期格式无效');

  const updates: string[] = [];
  const params: any[] = [];
  if (data.amount !== undefined) { updates.push('amount = ?'); params.push(data.amount); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description.trim()); }
  if (data.date !== undefined) { updates.push('date = ?'); params.push(data.date); }
  if (data.endDate !== undefined) { updates.push('endDate = ?'); params.push(data.endDate); }
  if (data.paid !== undefined) { updates.push('paid = ?'); params.push(data.paid ? 1 : 0); }
  if (data.currency !== undefined) { updates.push('currency = ?'); params.push(data.currency); }

  if (updates.length > 0) {
    updates.push("updatedAt = datetime('now')");
    params.push(expenseId);
    db.prepare(`UPDATE expense_entries SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  return buildTravelOrder(entry.travelOrderId);
}

export function deleteTravelExpense(userId: number, expenseId: number): TravelOrder {
  const db = getDb();

  const entry = db.prepare(
    'SELECT ee.id, ee.userId, ee.travelOrderId FROM expense_entries ee WHERE ee.id = ? AND ee.travelOrderId IS NOT NULL'
  ).get(expenseId) as { id: number; userId: number; travelOrderId: number } | undefined;
  if (!entry) throw new NotFoundError('开销条目不存在');
  if (entry.userId !== userId) throw new ForbiddenError('禁止访问');

  const orderId = entry.travelOrderId;
  db.prepare('DELETE FROM expense_entries WHERE id = ?').run(expenseId);

  return buildTravelOrder(orderId);
}
