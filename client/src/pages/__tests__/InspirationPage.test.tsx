import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InspirationPage from '../InspirationPage';
import { apiClient } from '../../api/client';
import type { InspirationCategory, InspirationEntry } from '../../types';

vi.mock('../../api/client', () => ({
  apiClient: {
    inspirations: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    inspirationCategories: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockCategories: InspirationCategory[] = [
  { id: 1, name: '工作', createdAt: '2025-01-01T00:00:00Z' },
  { id: 2, name: '学习', createdAt: '2025-01-01T00:00:00Z' },
  { id: 3, name: '项目', createdAt: '2025-01-01T00:00:00Z' },
];

const mockEntries: InspirationEntry[] = [
  {
    id: 1, categoryId: 1, content: '优化API性能', type: 'inspiration',
    completed: false, deadline: null, used: false, imageData: null,
    createdAt: '2025-01-03T10:00:00Z', updatedAt: '2025-01-03T10:00:00Z',
  },
  {
    id: 2, categoryId: 2, content: '学习React 19新特性', type: 'todo',
    completed: false, deadline: null, used: false, imageData: null,
    createdAt: '2025-01-02T09:00:00Z', updatedAt: '2025-01-02T09:00:00Z',
  },
  {
    id: 3, categoryId: 1, content: '已完成的待办', type: 'todo',
    completed: true, deadline: null, used: false, imageData: null,
    createdAt: '2025-01-01T08:00:00Z', updatedAt: '2025-01-01T08:00:00Z',
  },
];

function renderInspirationPage() {
  return render(
    <MemoryRouter>
      <InspirationPage />
    </MemoryRouter>,
  );
}

describe('InspirationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.inspirationCategories.list).mockResolvedValue(mockCategories);
    vi.mocked(apiClient.inspirations.list).mockResolvedValue(mockEntries);
  });

  it('shows loading state initially', () => {
    vi.mocked(apiClient.inspirationCategories.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.inspirations.list).mockReturnValue(new Promise(() => {}));
    renderInspirationPage();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('fetches categories and entries on mount', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(apiClient.inspirationCategories.list).toHaveBeenCalled();
      expect(apiClient.inspirations.list).toHaveBeenCalledWith(undefined);
    });
  });

  it('displays entries sorted by createdAt descending', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
      expect(screen.getByText('学习React 19新特性')).toBeInTheDocument();
      expect(screen.getByText('已完成的待办')).toBeInTheDocument();
    });

    // Verify order: newest first
    const items = screen.getAllByText(/优化API性能|学习React 19新特性|已完成的待办/);
    expect(items[0].textContent).toBe('优化API性能');
    expect(items[1].textContent).toBe('学习React 19新特性');
    expect(items[2].textContent).toBe('已完成的待办');
  });

  it('displays category filter with "全部" and all categories', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('全部')).toBeInTheDocument();
      // Use getAllByText since category names appear in multiple places
      expect(screen.getAllByText('工作').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('学习').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('项目').length).toBeGreaterThanOrEqual(1);
    });

    // Verify the filter bar specifically has the buttons
    const filterBar = document.querySelector('.category-filter');
    expect(filterBar).toBeInTheDocument();
    const filterButtons = filterBar!.querySelectorAll('.category-filter__btn');
    expect(filterButtons).toHaveLength(4); // 全部 + 3 categories
  });

  it('filters entries by category when clicking a category button', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });

    // Clear mock call history after initial load
    vi.mocked(apiClient.inspirations.list).mockClear();
    vi.mocked(apiClient.inspirationCategories.list).mockClear();
    vi.mocked(apiClient.inspirations.list).mockResolvedValue([mockEntries[0], mockEntries[2]]);
    vi.mocked(apiClient.inspirationCategories.list).mockResolvedValue(mockCategories);

    // Click on "工作" category filter button specifically within the filter bar
    const filterBar = document.querySelector('.category-filter')!;
    const filterButtons = filterBar.querySelectorAll('.category-filter__btn');
    // filterButtons[0] = 全部, filterButtons[1] = 工作
    fireEvent.click(filterButtons[1]);

    await waitFor(() => {
      expect(apiClient.inspirations.list).toHaveBeenCalledWith(1);
    });
  });

  it('shows empty state when no entries exist', async () => {
    vi.mocked(apiClient.inspirations.list).mockResolvedValue([]);
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('暂无灵感记录，快来添加一条吧')).toBeInTheDocument();
    });
  });

  it('displays type icons correctly (💡 for inspiration, ✅ for todo)', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });
    // Check that type icons are present
    const icons = screen.getAllByTitle('灵感');
    expect(icons.length).toBeGreaterThanOrEqual(1);
    const todoIcons = screen.getAllByTitle('待办');
    expect(todoIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows checkbox for todo entries and not for inspiration entries', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });

    // There should be checkboxes for the 2 todo entries
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
  });

  it('shows completed todo with strikethrough styling', async () => {
    renderInspirationPage();
    await waitFor(() => {
      const completedContent = screen.getByText('已完成的待办');
      expect(completedContent).toHaveClass('line-through');
      expect(completedContent).toHaveClass('opacity-50');
    });
  });

  it('toggles todo completion status', async () => {
    vi.mocked(apiClient.inspirations.update).mockResolvedValue({
      ...mockEntries[1], completed: true,
    });

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('学习React 19新特性')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    // First unchecked checkbox is for "学习React 19新特性"
    fireEvent.click(checkboxes[0]);

    await waitFor(() => {
      expect(apiClient.inspirations.update).toHaveBeenCalledWith(2, { completed: true });
    });
  });

  it('creates a new inspiration entry via the form', async () => {
    vi.mocked(apiClient.inspirations.create).mockResolvedValue({
      id: 4, categoryId: 1, content: '新灵感', type: 'inspiration',
      completed: false, deadline: null, used: false, imageData: null,
      createdAt: '2025-01-04T00:00:00Z', updatedAt: '2025-01-04T00:00:00Z',
    });

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('记录一个灵感或待办...（可直接粘贴图片）')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('记录一个灵感或待办...（可直接粘贴图片）'), { target: { value: '新灵感' } });
    fireEvent.click(screen.getByText('添加'));

    await waitFor(() => {
      expect(apiClient.inspirations.create).toHaveBeenCalledWith({
        content: '新灵感',
        type: 'inspiration',
        categoryId: 1,
      });
    });
  });

  it('shows validation error when submitting empty content', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('添加')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('添加'));
    expect(screen.getByText('请输入内容或粘贴图片')).toBeInTheDocument();
    expect(apiClient.inspirations.create).not.toHaveBeenCalled();
  });

  it('opens edit modal and updates entry', async () => {
    vi.mocked(apiClient.inspirations.update).mockResolvedValue({
      ...mockEntries[0], content: '更新后的内容',
    });

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });

    // Click edit button on first entry
    const editButtons = screen.getAllByLabelText('编辑');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('编辑条目')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue('优化API性能'), { target: { value: '更新后的内容' } });
    fireEvent.click(screen.getByText('保存修改'));

    await waitFor(() => {
      expect(apiClient.inspirations.update).toHaveBeenCalledWith(1, {
        content: '更新后的内容',
        type: 'inspiration',
        categoryId: 1,
        deadline: null,
        imageData: null,
      });
    });
  });

  it('opens delete confirm dialog and deletes entry', async () => {
    vi.mocked(apiClient.inspirations.delete).mockResolvedValue(undefined);

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('删除');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('确定要删除此条目吗？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('确认删除'));

    await waitFor(() => {
      expect(apiClient.inspirations.delete).toHaveBeenCalledWith(1);
    });
  });

  it('handles API error gracefully', async () => {
    vi.mocked(apiClient.inspirationCategories.list).mockRejectedValue(new Error('Network error'));
    vi.mocked(apiClient.inspirations.list).mockRejectedValue(new Error('Network error'));

    renderInspirationPage();

    await waitFor(() => {
      expect(screen.getByText('加载灵感数据失败')).toBeInTheDocument();
    });
  });

  it('adds a new inspiration category', async () => {
    vi.mocked(apiClient.inspirationCategories.create).mockResolvedValue({
      id: 4, name: '新分类', createdAt: '2025-01-04T00:00:00Z',
    });

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('新分类名称')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('新分类名称'), { target: { value: '新分类' } });
    fireEvent.click(screen.getByText('新增分类'));

    await waitFor(() => {
      expect(apiClient.inspirationCategories.create).toHaveBeenCalledWith('新分类');
    });
  });

  it('edits an inspiration category', async () => {
    vi.mocked(apiClient.inspirationCategories.update).mockResolvedValue({
      id: 1, name: '工作改名', createdAt: '2025-01-01T00:00:00Z',
    });

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('📂 灵感分类管理')).toBeInTheDocument();
    });

    // Click edit button on first category
    const editCatButtons = screen.getAllByLabelText('编辑分类 工作');
    fireEvent.click(editCatButtons[0]);

    // Find the edit input specifically within the categories section
    const catSection = document.querySelector('.inspiration-categories__list')!;
    const editInput = catSection.querySelector('input.input') as HTMLInputElement;
    expect(editInput).toBeTruthy();
    fireEvent.change(editInput, { target: { value: '工作改名' } });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(apiClient.inspirationCategories.update).toHaveBeenCalledWith(1, '工作改名');
    });
  });

  it('deletes an inspiration category with confirmation', async () => {
    vi.mocked(apiClient.inspirationCategories.delete).mockResolvedValue(undefined);

    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('📂 灵感分类管理')).toBeInTheDocument();
    });

    const deleteCatButtons = screen.getAllByLabelText('删除分类 工作');
    fireEvent.click(deleteCatButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('确定要删除此灵感分类吗？')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('确认删除'));

    await waitFor(() => {
      expect(apiClient.inspirationCategories.delete).toHaveBeenCalledWith(1);
    });
  });

  it('can cancel the edit entry modal', async () => {
    renderInspirationPage();
    await waitFor(() => {
      expect(screen.getByText('优化API性能')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByLabelText('编辑');
    fireEvent.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('编辑条目')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('取消'));

    await waitFor(() => {
      expect(screen.queryByText('编辑条目')).not.toBeInTheDocument();
    });
  });

  it('displays category name badge on each entry', async () => {
    renderInspirationPage();
    await waitFor(() => {
      // "工作" appears in filter and as badges on entries
      const workBadges = screen.getAllByText('工作');
      // At least 1 in filter + entries with categoryId=1
      expect(workBadges.length).toBeGreaterThanOrEqual(2);
    });
  });
});
