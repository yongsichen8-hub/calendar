import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CalendarPage from '../CalendarPage';
import { apiClient } from '../../api/client';
import type { Category, WorkEntry } from '../../types';

vi.mock('../../api/client', () => ({
  apiClient: {
    categories: { list: vi.fn() },
    workEntries: { getByWeek: vi.fn(), save: vi.fn(), delete: vi.fn() },
    todos: { getByDate: vi.fn(), getDeadlineReminders: vi.fn() },
  },
}));

const mockCategories: Category[] = [
  { id: 1, name: '高管', color: '#f5c6c6', isDefault: false, createdAt: '' },
  { id: 2, name: '培训', color: '#c6ddf5', isDefault: false, createdAt: '' },
  { id: 3, name: '其他', color: '#dcc6f5', isDefault: true, createdAt: '' },
];

// Use a fixed Wednesday so the week is stable: 2025-01-08 is a Wednesday
// Week: Mon 2025-01-06 to Fri 2025-01-10
const fixedDate = new Date(2025, 0, 8); // Jan 8, 2025

const mockEntries: WorkEntry[] = [
  {
    id: 1,
    categoryId: 1,
    date: '2025-01-06',
    timeSlot: '09:00-10:00',
    subCategory: '会议',
    description: '晨会讨论项目进度',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    categoryId: 2,
    date: '2025-01-06',
    timeSlot: '09:00-10:00',
    subCategory: '培训',
    description: '新员工培训',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 3,
    categoryId: 1,
    date: '2025-01-07',
    timeSlot: '10:00-11:00',
    subCategory: '',
    description: 'A very long description that should be truncated in the cell display',
    createdAt: '',
    updatedAt: '',
  },
];

function renderCalendarPage() {
  return render(
    <MemoryRouter>
      <CalendarPage initialDate={fixedDate} />
    </MemoryRouter>,
  );
}

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.categories.list).mockResolvedValue(mockCategories);
    vi.mocked(apiClient.workEntries.getByWeek).mockResolvedValue(mockEntries);
    vi.mocked(apiClient.todos.getByDate).mockResolvedValue([]);
    vi.mocked(apiClient.todos.getDeadlineReminders).mockResolvedValue([]);
  });

  it('shows loading state initially', () => {
    // Make the API call hang
    vi.mocked(apiClient.categories.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.workEntries.getByWeek).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.todos.getByDate).mockResolvedValue([]);
    vi.mocked(apiClient.todos.getDeadlineReminders).mockResolvedValue([]);
    renderCalendarPage();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders week navigator with date range and navigation buttons', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('← 上一周')).toBeInTheDocument();
      expect(screen.getByText('下一周 →')).toBeInTheDocument();
      // The date range for Jan 6-12, 2025
      const rangeEl = document.querySelector('.week-navigator__range');
      expect(rangeEl).toBeTruthy();
      expect(rangeEl!.textContent).toContain('1月6日');
      expect(rangeEl!.textContent).toContain('1月12日');
    });
  });

  it('renders calendar grid with 7 day columns and 12 time slot rows', async () => {
    renderCalendarPage();
    await waitFor(() => {
      // Day headers
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
      expect(screen.getByText('周二 1/7')).toBeInTheDocument();
      expect(screen.getByText('周三 1/8')).toBeInTheDocument();
      expect(screen.getByText('周四 1/9')).toBeInTheDocument();
      expect(screen.getByText('周五 1/10')).toBeInTheDocument();
      expect(screen.getByText('周六 1/11')).toBeInTheDocument();
      expect(screen.getByText('周日 1/12')).toBeInTheDocument();
    });

    // Time slot headers
    expect(screen.getByText('09:00-10:00')).toBeInTheDocument();
    expect(screen.getByText('20:00-21:00')).toBeInTheDocument();
  });

  it('fetches categories and work entries on mount', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(apiClient.categories.list).toHaveBeenCalled();
      expect(apiClient.workEntries.getByWeek).toHaveBeenCalledWith('2025-01-06');
    });
  });

  it('displays work entries with category color and truncated description', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('晨会讨论项目进度')).toBeInTheDocument();
      expect(screen.getByText('新员工培训')).toBeInTheDocument();
    });
    // Long description should be truncated
    expect(screen.getByText('A very long …')).toBeInTheDocument();
  });

  it('supports multiple entries in a single cell', async () => {
    renderCalendarPage();
    await waitFor(() => {
      // Both entries for 2025-01-06 09:00-10:00 should be visible
      expect(screen.getByText('晨会讨论项目进度')).toBeInTheDocument();
      expect(screen.getByText('新员工培训')).toBeInTheDocument();
    });
  });

  it('navigates to previous week when clicking prev button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
    });

    // Reset mock for the new week fetch
    vi.mocked(apiClient.workEntries.getByWeek).mockResolvedValue([]);
    fireEvent.click(screen.getByText('← 上一周'));

    await waitFor(() => {
      expect(apiClient.workEntries.getByWeek).toHaveBeenCalledWith('2024-12-30');
    });
  });

  it('navigates to next week when clicking next button', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
    });

    vi.mocked(apiClient.workEntries.getByWeek).mockResolvedValue([]);
    fireEvent.click(screen.getByText('下一周 →'));

    await waitFor(() => {
      expect(apiClient.workEntries.getByWeek).toHaveBeenCalledWith('2025-01-13');
    });
  });

  it('sets selectedCell state when clicking a cell', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
    });

    // Click on a cell with entries
    const cell = screen.getByRole('gridcell', { name: '2025-01-06 09:00-10:00' });
    fireEvent.click(cell);

    await waitFor(() => {
      // WorkEntryModal should appear with date and timeSlot in header
      expect(screen.getByText('2025-01-06 09:00-10:00')).toBeInTheDocument();
    });
  });

  it('can close the selected cell modal', async () => {
    renderCalendarPage();
    await waitFor(() => {
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
    });

    const cell = screen.getByRole('gridcell', { name: '2025-01-06 09:00-10:00' });
    fireEvent.click(cell);

    await waitFor(() => {
      expect(screen.getByText('2025-01-06 09:00-10:00')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('取消'));

    await waitFor(() => {
      expect(screen.queryByText('2025-01-06 09:00-10:00')).not.toBeInTheDocument();
    });
  });

  it('handles API errors gracefully and shows empty grid', async () => {
    vi.mocked(apiClient.categories.list).mockRejectedValue(new Error('Network error'));
    vi.mocked(apiClient.workEntries.getByWeek).mockRejectedValue(new Error('Network error'));

    renderCalendarPage();

    await waitFor(() => {
      // Should still render the grid structure
      expect(screen.getByText('周一 1/6')).toBeInTheDocument();
      expect(screen.getByText('09:00-10:00')).toBeInTheDocument();
    });
  });
});
