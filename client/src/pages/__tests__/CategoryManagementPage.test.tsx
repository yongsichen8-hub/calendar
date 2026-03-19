import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CategoryManagementPage from '../CategoryManagementPage';
import { apiClient } from '../../api/client';
import type { CategoryWithCount } from '../../types';

vi.mock('../../api/client', () => ({
  apiClient: {
    categories: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockCategories: CategoryWithCount[] = [
  {
    id: 1, name: '高管', color: '#f5c6c6', isDefault: false,
    createdAt: '2025-01-01T00:00:00Z', workEntryCount: 5, objectiveCount: 2,
  },
  {
    id: 2, name: '培训', color: '#c6ddf5', isDefault: false,
    createdAt: '2025-01-01T00:00:00Z', workEntryCount: 0, objectiveCount: 0,
  },
  {
    id: 3, name: '其他', color: '#c6f5d5', isDefault: true,
    createdAt: '2025-01-01T00:00:00Z', workEntryCount: 3, objectiveCount: 0,
  },
];

function renderPage() {
  return render(
    <MemoryRouter>
      <CategoryManagementPage />
    </MemoryRouter>,
  );
}

describe('CategoryManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.categories.list).mockResolvedValue(
      mockCategories as any,
    );
  });

  it('shows loading state initially', () => {
    vi.mocked(apiClient.categories.list).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('fetches and displays categories on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(apiClient.categories.list).toHaveBeenCalled();
      expect(screen.getByText('高管')).toBeInTheDocument();
      expect(screen.getByText('培训')).toBeInTheDocument();
      expect(screen.getByText('其他')).toBeInTheDocument();
    });
  });

  it('displays usage counts for each category', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('工时 5 · 目标 2')).toBeInTheDocument();
      expect(screen.getByText('工时 0 · 目标 0')).toBeInTheDocument();
      expect(screen.getByText('工时 3 · 目标 0')).toBeInTheDocument();
    });
  });

  it('shows "默认" badge for the default category', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('默认')).toBeInTheDocument();
    });
  });

  it('hides delete button for the default "其他" category', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('其他')).toBeInTheDocument();
    });
    // "其他" is default, should not have a delete button
    expect(screen.queryByLabelText('删除分类 其他')).not.toBeInTheDocument();
    // Non-default categories should have delete buttons
    expect(screen.getByLabelText('删除分类 高管')).toBeInTheDocument();
    expect(screen.getByLabelText('删除分类 培训')).toBeInTheDocument();
  });

  it('adds a new category via the form', async () => {
    vi.mocked(apiClient.categories.create).mockResolvedValue({
      id: 4, name: '新分类', color: '#f5ecc6', isDefault: false,
      createdAt: '2025-01-02T00:00:00Z',
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入新分类名称')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('输入新分类名称'), {
      target: { value: '新分类' },
    });
    fireEvent.click(screen.getByText('新增分类'));

    await waitFor(() => {
      expect(apiClient.categories.create).toHaveBeenCalledWith('新分类');
    });
  });

  it('shows validation error when adding empty name', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('新增分类')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新增分类'));
    expect(screen.getByText('请输入分类名称')).toBeInTheDocument();
    expect(apiClient.categories.create).not.toHaveBeenCalled();
  });

  it('enters edit mode and saves changes', async () => {
    vi.mocked(apiClient.categories.update).mockResolvedValue({
      id: 1, name: '高管改名', color: '#f5c6c6', isDefault: false,
      createdAt: '2025-01-01T00:00:00Z',
    });

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('编辑分类 高管'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('高管')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue('高管'), {
      target: { value: '高管改名' },
    });
    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(apiClient.categories.update).toHaveBeenCalledWith(1, '高管改名');
    });
  });

  it('cancels edit mode', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('编辑分类 高管'));
    await waitFor(() => {
      expect(screen.getByText('取消')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('取消'));
    await waitFor(() => {
      expect(screen.queryByDisplayValue('高管')).not.toBeInTheDocument();
    });
  });

  it('shows simple confirm dialog for category with no records', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('培训')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 培训'));

    await waitFor(() => {
      expect(screen.getByText('确定要删除分类「培训」吗？')).toBeInTheDocument();
    });
    // Both header and button say "确认删除"
    const confirmButtons = screen.getAllByText('确认删除');
    expect(confirmButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes category with no records after confirmation', async () => {
    vi.mocked(apiClient.categories.delete).mockResolvedValue(undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('培训')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 培训'));
    await waitFor(() => {
      expect(screen.getByText('确定要删除分类「培训」吗？')).toBeInTheDocument();
    });

    // Click the confirm button (btn-danger)
    const confirmBtn = screen.getByRole('button', { name: '确认删除' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(apiClient.categories.delete).toHaveBeenCalledWith(2, undefined);
    });
  });

  it('shows migration dialog for category with records', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 高管'));

    await waitFor(() => {
      expect(screen.getByText('删除分类 - 记录迁移')).toBeInTheDocument();
      expect(screen.getByText('请选择迁移目标分类')).toBeInTheDocument();
    });
  });

  it('disables confirm button until migration target is selected', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 高管'));

    await waitFor(() => {
      expect(screen.getByText('删除分类 - 记录迁移')).toBeInTheDocument();
    });

    // Confirm button should be disabled
    const confirmBtn = screen.getByText('确认删除');
    expect(confirmBtn).toBeDisabled();

    // Select a migration target
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '2' },
    });

    expect(confirmBtn).not.toBeDisabled();
  });

  it('deletes category with migration target', async () => {
    vi.mocked(apiClient.categories.delete).mockResolvedValue(undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 高管'));
    await waitFor(() => {
      expect(screen.getByText('删除分类 - 记录迁移')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '3' },
    });
    fireEvent.click(screen.getByText('确认删除'));

    await waitFor(() => {
      expect(apiClient.categories.delete).toHaveBeenCalledWith(1, 3);
    });
  });

  it('cancels delete dialog', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('培训')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除分类 培训'));
    await waitFor(() => {
      expect(screen.getByText('确定要删除分类「培训」吗？')).toBeInTheDocument();
    });

    // Click the cancel button in the modal footer
    const cancelBtn = screen.getByRole('button', { name: '取消' });
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByText('确定要删除分类「培训」吗？')).not.toBeInTheDocument();
    });
  });

  it('handles API error on load', async () => {
    vi.mocked(apiClient.categories.list).mockRejectedValue(new Error('Network error'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('加载分类数据失败')).toBeInTheDocument();
    });
  });

  it('displays color tags for categories', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('高管')).toBeInTheDocument();
    });

    // Check that color tag classes are applied
    const pinkTag = screen.getByText('高管').closest('.category-tag');
    expect(pinkTag).toHaveClass('category-tag--pink');

    const blueTag = screen.getByText('培训').closest('.category-tag');
    expect(blueTag).toHaveClass('category-tag--blue');
  });

  it('shows total category count badge', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('3 个分类')).toBeInTheDocument();
    });
  });
});
