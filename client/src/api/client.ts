import type {
  AuthResponse,
  WorkEntry,
  CreateWorkEntryDTO,
  Category,
  OKRData,
  Objective,
  CreateObjectiveDTO,
  UpdateObjectiveDTO,
  KeyResult,
  CreateKeyResultDTO,
  UpdateKeyResultDTO,
  InspirationEntry,
  CreateInspirationDTO,
  UpdateInspirationDTO,
  InspirationCategory,
  Summary,
  SummaryType,
  TodoItem,
  MilestoneResult,
  KRMilestone,
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
  TravelOrder,
  CreateTravelOrderDTO,
  UpdateTravelOrderDTO,
  CreateTravelExpenseDTO,
  UpdateTravelExpenseDTO,
  TravelPolicy,
  UpdateTravelPolicyDTO,
  CityListData,
} from '@/types';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_PATH = '/calendar';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_PATH}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    window.location.href = `${BASE_PATH}/login`;
    throw new ApiError('Unauthorized', 401);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || res.statusText, res.status);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json();
}

export const apiClient = {
  auth: {
    register(username: string, password: string): Promise<AuthResponse> {
      return request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    login(username: string, password: string): Promise<AuthResponse> {
      return request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    },
    logout(): Promise<void> {
      return request('/api/auth/logout', { method: 'POST' });
    },
  },

  workEntries: {
    getByWeek(weekStart: string): Promise<WorkEntry[]> {
      return request(`/api/work-entries?week=${encodeURIComponent(weekStart)}`);
    },
    save(entries: CreateWorkEntryDTO[]): Promise<WorkEntry[]> {
      return request('/api/work-entries', {
        method: 'POST',
        body: JSON.stringify({ entries }),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/work-entries/${id}`, { method: 'DELETE' });
    },
  },

  categories: {
    list(): Promise<Category[]> {
      return request('/api/categories');
    },
    create(name: string): Promise<Category> {
      return request('/api/categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    update(id: number, name: string): Promise<Category> {
      return request(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },
    delete(id: number, migrateToId?: number): Promise<void> {
      const query = migrateToId != null ? `?migrateToId=${migrateToId}` : '';
      return request(`/api/categories/${id}${query}`, { method: 'DELETE' });
    },
  },

  okr: {
    getByQuarter(quarter: string): Promise<OKRData> {
      return request(`/api/okr?quarter=${encodeURIComponent(quarter)}`);
    },
    createObjective(obj: CreateObjectiveDTO): Promise<Objective> {
      return request('/api/okr/objectives', {
        method: 'POST',
        body: JSON.stringify(obj),
      });
    },
    updateObjective(id: number, obj: UpdateObjectiveDTO): Promise<Objective> {
      return request(`/api/okr/objectives/${id}`, {
        method: 'PUT',
        body: JSON.stringify(obj),
      });
    },
    deleteObjective(id: number): Promise<void> {
      return request(`/api/okr/objectives/${id}`, { method: 'DELETE' });
    },
    createKeyResult(kr: CreateKeyResultDTO): Promise<KeyResult> {
      return request('/api/okr/key-results', {
        method: 'POST',
        body: JSON.stringify(kr),
      });
    },
    updateKeyResult(id: number, kr: UpdateKeyResultDTO): Promise<KeyResult> {
      return request(`/api/okr/key-results/${id}`, {
        method: 'PUT',
        body: JSON.stringify(kr),
      });
    },
    deleteKeyResult(id: number): Promise<void> {
      return request(`/api/okr/key-results/${id}`, { method: 'DELETE' });
    },
  },

  inspirations: {
    list(categoryId?: number): Promise<InspirationEntry[]> {
      const query = categoryId != null ? `?categoryId=${categoryId}` : '';
      return request(`/api/inspirations${query}`);
    },
    create(entry: CreateInspirationDTO): Promise<InspirationEntry> {
      return request('/api/inspirations', {
        method: 'POST',
        body: JSON.stringify(entry),
      });
    },
    update(id: number, entry: UpdateInspirationDTO): Promise<InspirationEntry> {
      return request(`/api/inspirations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(entry),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/inspirations/${id}`, { method: 'DELETE' });
    },
  },

  inspirationCategories: {
    list(): Promise<InspirationCategory[]> {
      return request('/api/inspiration-categories');
    },
    create(name: string): Promise<InspirationCategory> {
      return request('/api/inspiration-categories', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    update(id: number, name: string): Promise<InspirationCategory> {
      return request(`/api/inspiration-categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/inspiration-categories/${id}`, { method: 'DELETE' });
    },
  },

  summaries: {
    generate(type: SummaryType, target: string): Promise<Summary> {
      return request('/api/summaries/generate', {
        method: 'POST',
        body: JSON.stringify({ type, target }),
      });
    },
    list(): Promise<Summary[]> {
      return request('/api/summaries');
    },
    getById(id: number): Promise<Summary> {
      return request(`/api/summaries/${id}`);
    },
  },

  milestones: {
    identify(startDate: string, endDate?: string): Promise<MilestoneResult> {
      return request('/api/milestones/identify', {
        method: 'POST',
        body: JSON.stringify({ date: startDate, endDate: endDate || startDate }),
      });
    },
    save(keyResultId: number, date: string, milestones: string[]): Promise<KRMilestone[]> {
      return request('/api/milestones/save', {
        method: 'POST',
        body: JSON.stringify({ keyResultId, date, milestones }),
      });
    },
    update(id: number, data: { content?: string; date?: string }): Promise<KRMilestone> {
      return request(`/api/milestones/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/milestones/${id}`, { method: 'DELETE' });
    },
  },

  todos: {
    getByDate(date: string): Promise<TodoItem[]> {
      return request(`/api/todos?date=${encodeURIComponent(date)}`);
    },
    create(date: string, content: string, deadline?: string): Promise<TodoItem> {
      return request('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ date, content, deadline: deadline || undefined }),
      });
    },
    updateCompleted(id: number, completed: boolean): Promise<TodoItem> {
      return request(`/api/todos/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed }),
      });
    },
    postpone(id: number): Promise<TodoItem> {
      return request(`/api/todos/${id}/postpone`, {
        method: 'POST',
      });
    },
    delete(id: number): Promise<void> {
      return request(`/api/todos/${id}`, { method: 'DELETE' });
    },
    getDeadlineReminders(): Promise<TodoItem[]> {
      return request('/api/todos/deadline-reminders');
    },
  },

  ledger: {
    listSubjects(): Promise<ManagementSubjectWithSummary[]> {
      return request('/api/ledger/subjects');
    },
    createSubject(data: CreateSubjectDTO): Promise<ManagementSubject> {
      return request('/api/ledger/subjects', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateSubject(id: number, data: UpdateSubjectDTO): Promise<ManagementSubject> {
      return request(`/api/ledger/subjects/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteSubject(id: number): Promise<void> {
      return request(`/api/ledger/subjects/${id}`, { method: 'DELETE' });
    },
    listCategories(subjectId: number): Promise<ExpenseCategoryWithSummary[]> {
      return request(`/api/ledger/subjects/${subjectId}/categories`);
    },
    updateCategoryBudget(categoryId: number, data: UpdateCategoryBudgetDTO): Promise<ExpenseCategoryWithSummary> {
      return request(`/api/ledger/categories/${categoryId}/budget`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    analyzeCategoryBudget(categoryId: number): Promise<{ content: string }> {
      return request(`/api/ledger/categories/${categoryId}/analyze`, {
        method: 'POST',
      });
    },
    listExpenses(subjectId: number, filters?: ExpenseFilters): Promise<ExpenseEntry[]> {
      const params = new URLSearchParams();
      if (filters?.categoryName) params.set('categoryName', filters.categoryName);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      if (filters?.keyword) params.set('keyword', filters.keyword);
      const query = params.toString() ? `?${params.toString()}` : '';
      return request(`/api/ledger/subjects/${subjectId}/expenses${query}`);
    },
    createExpense(subjectId: number, data: CreateExpenseDTO): Promise<ExpenseEntry> {
      return request(`/api/ledger/subjects/${subjectId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateExpense(id: number, data: UpdateExpenseDTO): Promise<ExpenseEntry> {
      return request(`/api/ledger/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteExpense(id: number): Promise<void> {
      return request(`/api/ledger/expenses/${id}`, { method: 'DELETE' });
    },
    getSummary(subjectId: number): Promise<SubjectBudgetSummary> {
      return request(`/api/ledger/subjects/${subjectId}/summary`);
    },
    analyzeBudget(subjectId: number): Promise<{ content: string }> {
      return request(`/api/ledger/subjects/${subjectId}/analyze`, {
        method: 'POST',
      });
    },
    // Travel orders
    listTravelOrders(subjectId: number): Promise<TravelOrder[]> {
      return request(`/api/ledger/subjects/${subjectId}/travel-orders`);
    },
    createTravelOrder(subjectId: number, data: CreateTravelOrderDTO): Promise<TravelOrder> {
      return request(`/api/ledger/subjects/${subjectId}/travel-orders`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateTravelOrder(orderId: number, data: UpdateTravelOrderDTO): Promise<TravelOrder> {
      return request(`/api/ledger/travel-orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteTravelOrder(orderId: number): Promise<void> {
      return request(`/api/ledger/travel-orders/${orderId}`, { method: 'DELETE' });
    },
    addTravelExpense(orderId: number, data: CreateTravelExpenseDTO): Promise<TravelOrder> {
      return request(`/api/ledger/travel-orders/${orderId}/expenses`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    updateTravelExpense(expenseId: number, data: UpdateTravelExpenseDTO): Promise<TravelOrder> {
      return request(`/api/ledger/travel-expenses/${expenseId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    deleteTravelExpense(expenseId: number): Promise<TravelOrder> {
      return request(`/api/ledger/travel-expenses/${expenseId}`, { method: 'DELETE' });
    },
    // Travel policy
    getTravelPolicy(): Promise<TravelPolicy> {
      return request('/api/ledger/travel-policy');
    },
    updateTravelPolicy(data: UpdateTravelPolicyDTO): Promise<TravelPolicy> {
      return request('/api/ledger/travel-policy', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    getCityList(): Promise<CityListData> {
      return request('/api/ledger/travel-policy/cities');
    },
  },
};

export { ApiError };
export type { ApiClient };

interface ApiClient {
  auth: typeof apiClient.auth;
  workEntries: typeof apiClient.workEntries;
  categories: typeof apiClient.categories;
  okr: typeof apiClient.okr;
  milestones: typeof apiClient.milestones;
  inspirations: typeof apiClient.inspirations;
  inspirationCategories: typeof apiClient.inspirationCategories;
  summaries: typeof apiClient.summaries;
  todos: typeof apiClient.todos;
  ledger: typeof apiClient.ledger;
}
