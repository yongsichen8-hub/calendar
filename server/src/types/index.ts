// ============================================================
// User
// ============================================================

export interface User {
  id: number;
  username: string;
  createdAt: string;
}

// ============================================================
// Category
// ============================================================

export interface Category {
  id: number;
  userId: number;
  name: string;
  color: string;
  isDefault: boolean;
  createdAt: string;
}

export interface CategoryWithCount extends Category {
  workEntryCount: number;
  objectiveCount: number;
}

// ============================================================
// Work Entry
// ============================================================

export interface WorkEntry {
  id: number;
  userId: number;
  categoryId: number;
  date: string;          // ISO 8601: "2025-01-06"
  timeSlot: string;      // "09:00-10:00"
  subCategory: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkEntryDTO {
  date: string;
  timeSlot: string;
  categoryId: number;
  subCategory: string;
  description: string;
}


// ============================================================
// OKR
// ============================================================

export interface Objective {
  id: number;
  userId: number;
  categoryId: number;
  quarter: string;       // "2025-Q1"
  title: string;
  description: string;
  keyResults: KeyResult[];
  createdAt: string;
  updatedAt: string;
}

export interface KeyResult {
  id: number;
  objectiveId: number;
  description: string;
  progress: number;
  milestones: KRMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateObjectiveDTO {
  categoryId: number;
  quarter: string;
  title: string;
  description: string;
}

export interface UpdateObjectiveDTO {
  categoryId?: number;
  title?: string;
  description?: string;
}

export interface CreateKeyResultDTO {
  objectiveId: number;
  description: string;
}

export interface UpdateKeyResultDTO {
  description?: string;
  progress?: number;
}

export interface OKRData {
  quarter: string;
  objectives: Objective[];
}

export interface MilestoneResult {
  date: string;
  suggestions: MilestoneSuggestion[];
}

export interface MilestoneSuggestion {
  objectiveTitle: string;
  keyResultId: number;
  keyResultDescription: string;
  milestones: string[];    // 识别出的里程碑事项描述列表
}

export interface KRMilestone {
  id: number;
  keyResultId: number;
  content: string;
  date: string;
  createdAt: string;
}

// ============================================================
// Inspiration
// ============================================================

export interface InspirationEntry {
  id: number;
  userId: number;
  categoryId: number;
  content: string;
  type: 'inspiration' | 'todo';
  completed: boolean;
  deadline: string | null;
  used: boolean;
  imageData: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspirationCategory {
  id: number;
  userId: number;
  name: string;
  createdAt: string;
}

export interface CreateInspirationDTO {
  content: string;
  type: 'inspiration' | 'todo';
  categoryId: number;
  deadline?: string;
  imageData?: string;
}

export interface UpdateInspirationDTO {
  content?: string;
  type?: 'inspiration' | 'todo';
  categoryId?: number;
  completed?: boolean;
  deadline?: string | null;
  used?: boolean;
  imageData?: string | null;
}

// ============================================================
// AI Summary
// ============================================================

export type SummaryType = 'daily' | 'weekly' | 'monthly' | 'quarterly';

export interface Summary {
  id: number;
  userId: number;
  type: SummaryType;
  target: string;        // "2025-01-06" | "2025-W02" | "2025-01" | "2025-Q1"
  content: string;
  createdAt: string;
}

// ============================================================
// Auth
// ============================================================

export interface AuthResponse {
  user: User;
  token: string;
}

// ============================================================
// Todo
// ============================================================

export interface TodoItem {
  id: number;
  userId: number;
  date: string;           // "2025-01-06"
  content: string;
  completed: boolean;
  deadline: string | null; // "2025-01-10" or null
  createdAt: string;
  updatedAt: string;
}

export interface CreateTodoDTO {
  date: string;
  content: string;
  deadline?: string;
}

export interface UpdateTodoDTO {
  completed: boolean;
}

// ============================================================
// Reminder
// ============================================================

export interface ReminderState {
  skipped: Set<string>;              // "2025-01-06_09:00-10:00"
  snoozed: Map<string, number>;     // timeSlot -> snooze until timestamp
}

// ============================================================
// Ledger (台账)
// ============================================================

export type SubjectCurrency = 'CNY' | 'EUR';
export type ExpenseCurrencyType = 'CNY' | 'EUR' | 'USD';

export interface ManagementSubject {
  id: number;
  userId: number;
  name: string;
  currency: SubjectCurrency;
  exchangeRate: number;      // 1 EUR = ? CNY (仅 EUR 时有意义)
  travelBudgetCode: string;  // 差旅预算号
  entertainBudgetCode: string; // 招待费预算号
  costCenterCode: string;    // 成本中心完整代码
  collaborationBudgetCode: string; // 横向协同费预算号
  createdAt: string;
  updatedAt: string;
}

export interface ManagementSubjectWithSummary extends ManagementSubject {
  totalBudget: number;     // 三个分类额度之和 (CNY)
  usedAmount: number;      // 原始货币金额
  usedAmountCNY: number;   // 换算后人民币金额
  remainingBudget: number; // CNY
  usagePercent: number;    // 基于 CNY
}

export interface CreateSubjectDTO {
  name: string;
  currency?: SubjectCurrency;
  exchangeRate?: number;
  travelBudgetCode?: string;
  entertainBudgetCode?: string;
  costCenterCode?: string;
  collaborationBudgetCode?: string;
}

export interface UpdateSubjectDTO {
  name?: string;
  currency?: SubjectCurrency;
  exchangeRate?: number;
  travelBudgetCode?: string;
  entertainBudgetCode?: string;
  costCenterCode?: string;
  collaborationBudgetCode?: string;
}

export interface ExpenseCategory {
  id: number;
  subjectId: number;
  name: string;
  budget: number;
  createdAt: string;
}

export interface ExpenseCategoryWithSummary extends ExpenseCategory {
  usedAmount: number;
  usedAmountCNY: number;     // 换算后人民币金额
  remainingBudget: number;   // CNY
  usagePercent: number;      // 基于 CNY
}

export interface UpdateCategoryBudgetDTO {
  budget: number;
}

export interface ExpenseEntry {
  id: number;
  userId: number;
  categoryId: number;
  categoryName: string;
  amount: number;
  currency: ExpenseCurrencyType;
  description: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseDTO {
  categoryName: string;
  amount: number;
  description: string;
  date: string;
  currency?: ExpenseCurrencyType;
}

export interface UpdateExpenseDTO {
  amount?: number;
  description?: string;
  date?: string;
  currency?: ExpenseCurrencyType;
}

export interface ExpenseFilters {
  startDate?: string;
  endDate?: string;
  keyword?: string;
  categoryName?: string;
}

export interface SubjectBudgetSummary {
  subjectId: number;
  totalBudget: number;       // CNY
  usedAmount: number;        // 原始货币
  usedAmountCNY: number;     // CNY
  remainingBudget: number;   // CNY
  usagePercent: number;
  categoryBreakdown: ExpenseCategoryWithSummary[];
}

// ============================================================
// Travel Order (出差单)
// ============================================================

export type TravelExpenseSubType = '酒店' | '机票' | '其他' | '补贴';
export type TravelDestination = '境内' | '境外';
export type OverseasCurrency = 'EUR' | 'USD' | 'CNY';

export interface TravelOrder {
  id: number;
  userId: number;
  categoryId: number;
  title: string;
  destination: TravelDestination;
  destinationCity: string;
  departureDate: string;
  returnDate: string;
  totalAmount: number;
  budgetAmount: number;      // 预算占用金额（酒店超额部分不计入）
  hotelLimit: number;        // 酒店标准上限（每间夜）
  hotelExcess: number;       // 酒店超标金额
  currency: OverseasCurrency; // 货币单位
  expenses: TravelExpenseEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TravelExpenseEntry {
  id: number;
  travelOrderId: number;
  subType: TravelExpenseSubType;
  amount: number;
  currency: ExpenseCurrencyType;
  description: string;
  date: string;
  endDate: string | null;   // 退房日期（仅酒店）
  nights: number;            // 间夜数（仅酒店，由 endDate - date 计算）
  paid: boolean;             // 是否已发（仅补贴）
  createdAt: string;
  updatedAt: string;
}

export interface CreateTravelOrderDTO {
  title: string;
  destination: TravelDestination;
  destinationCity: string;
  departureDate: string;
  returnDate: string;
}

export interface UpdateTravelOrderDTO {
  title?: string;
  destination?: TravelDestination;
  destinationCity?: string;
  departureDate?: string;
  returnDate?: string;
}

export interface CreateTravelExpenseDTO {
  subType: TravelExpenseSubType;
  amount: number;
  description: string;
  date: string;
  endDate?: string;   // 退房日期（仅酒店需要）
  currency?: ExpenseCurrencyType;
}

export interface UpdateTravelExpenseDTO {
  amount?: number;
  description?: string;
  date?: string;
  endDate?: string;
  paid?: boolean;
  currency?: ExpenseCurrencyType;
}

// ============================================================
// Travel Policy (差旅政策)
// ============================================================

export interface TravelPolicy {
  id: number;
  userId: number;
  dailyAllowance: number;
  hotelTier1BeijingLow: number;
  hotelTier1BeijingHigh: number;
  hotelTier1Other: number;
  hotelTier2Low: number;
  hotelTier2High: number;
  hotelTier3: number;
  hotelTier4: number;
  // 海外住宿标准 (美元/欧元 per night)
  overseasHotelTier1: number;
  overseasHotelTier2: number;
  overseasHotelTier3: number;
  overseasHotelTier4: number;
  overseasHotelTier5: number;
  overseasHotelTier6: number;
  overseasHotelTier7: number;
  // 海外补贴标准 (美元 per day)
  overseasAllowanceTier1: number;
  overseasAllowanceTier2: number;
  overseasAllowanceTier3: number;
  overseasAllowanceTier4: number;
  overseasAllowanceTier5: number;
  overseasAllowanceTier6: number;
  overseasAllowanceTier7: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateTravelPolicyDTO {
  dailyAllowance?: number;
  hotelTier1BeijingLow?: number;
  hotelTier1BeijingHigh?: number;
  hotelTier1Other?: number;
  hotelTier2Low?: number;
  hotelTier2High?: number;
  hotelTier3?: number;
  hotelTier4?: number;
  overseasHotelTier1?: number;
  overseasHotelTier2?: number;
  overseasHotelTier3?: number;
  overseasHotelTier4?: number;
  overseasHotelTier5?: number;
  overseasHotelTier6?: number;
  overseasHotelTier7?: number;
  overseasAllowanceTier1?: number;
  overseasAllowanceTier2?: number;
  overseasAllowanceTier3?: number;
  overseasAllowanceTier4?: number;
  overseasAllowanceTier5?: number;
  overseasAllowanceTier6?: number;
  overseasAllowanceTier7?: number;
}
