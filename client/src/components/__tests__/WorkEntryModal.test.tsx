import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkEntryModal from '../WorkEntryModal';
import type { WorkEntry, Category } from '@/types';

const mockCategories: Category[] = [
  { id: 1, name: '高管', color: '#f5c6c6', isDefault: false, createdAt: '2025-01-01' },
  { id: 2, name: '培训', color: '#c6ddf5', isDefault: false, createdAt: '2025-01-01' },
  { id: 3, name: '其他', color: '#e0e0e0', isDefault: true, createdAt: '2025-01-01' },
];

const mockEntries: WorkEntry[] = [
  {
    id: 101,
    categoryId: 1,
    date: '2025-01-06',
    timeSlot: '09:00-10:00',
    subCategory: '会议',
    description: '周会讨论',
    createdAt: '2025-01-06T09:00:00',
    updatedAt: '2025-01-06T09:00:00',
  },
  {
    id: 102,
    categoryId: 2,
    date: '2025-01-06',
    timeSlot: '09:00-10:00',
    subCategory: '',
    description: '新人培训',
    createdAt: '2025-01-06T09:00:00',
    updatedAt: '2025-01-06T09:00:00',
  },
];

vi.mock('@/api/client', () => ({
  apiClient: {
    workEntries: {
      save: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { apiClient } from '@/api/client';
const mockSave = vi.mocked(apiClient.workEntries.save);
const mockDelete = vi.mocked(apiClient.workEntries.delete);

describe('WorkEntryModal', () => {
  const defaultProps = {
    date: '2025-01-06',
    timeSlot: '09:00-10:00',
    existingEntries: mockEntries,
    categories: mockCategories,
    onClose: vi.fn(),
    onSaved: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders existing entries', () => {
    render(<WorkEntryModal {...defaultProps} />);

    expect(screen.getByText('2025-01-06 09:00-10:00')).toBeInTheDocument();
    expect(screen.getByText('高管')).toBeInTheDocument();
    expect(screen.getByText('周会讨论')).toBeInTheDocument();
    expect(screen.getByText('培训')).toBeInTheDocument();
    expect(screen.getByText('新人培训')).toBeInTheDocument();
  });

  it('shows add form when clicking 添加条目', () => {
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('+ 添加条目'));

    expect(screen.getByText('新条目 1')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('子分类（可选）')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('工作内容描述')).toBeInTheDocument();
  });

  it('calls save API with correct data', async () => {
    mockSave.mockResolvedValue([]);
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('+ 添加条目'));

    const categorySelect = screen.getByRole('combobox');
    fireEvent.change(categorySelect, { target: { value: '2' } });

    const subInput = screen.getByPlaceholderText('子分类（可选）');
    fireEvent.change(subInput, { target: { value: '技术培训' } });

    const descInput = screen.getByPlaceholderText('工作内容描述');
    fireEvent.change(descInput, { target: { value: 'React 培训' } });

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith([
        {
          date: '2025-01-06',
          timeSlot: '09:00-10:00',
          categoryId: 2,
          subCategory: '技术培训',
          description: 'React 培训',
        },
      ]);
    });

    expect(defaultProps.onSaved).toHaveBeenCalled();
  });

  it('shows error on save failure and keeps form content', async () => {
    mockSave.mockRejectedValue(new Error('网络错误'));
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('+ 添加条目'));

    const descInput = screen.getByPlaceholderText('工作内容描述');
    fireEvent.change(descInput, { target: { value: '测试内容' } });

    fireEvent.click(screen.getByText('保存'));

    await waitFor(() => {
      expect(screen.getByText('网络错误')).toBeInTheDocument();
    });

    // Form content should be preserved
    expect(screen.getByPlaceholderText('工作内容描述')).toHaveValue('测试内容');
    expect(defaultProps.onSaved).not.toHaveBeenCalled();
  });

  it('calls delete API after confirmation', async () => {
    mockDelete.mockResolvedValue(undefined);
    render(<WorkEntryModal {...defaultProps} />);

    const deleteButtons = screen.getAllByText('删除');
    fireEvent.click(deleteButtons[0]);

    // Confirm dialog should appear
    expect(screen.getByText('确定要删除这条工作记录吗？此操作不可撤销。')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith(101);
    });

    // Entry should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('周会讨论')).not.toBeInTheDocument();
    });
  });

  it('closes on cancel', () => {
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('取消'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('renders empty state when no existing entries', () => {
    render(<WorkEntryModal {...defaultProps} existingEntries={[]} />);

    expect(screen.queryByText('已有条目')).not.toBeInTheDocument();
    expect(screen.getByText('+ 添加条目')).toBeInTheDocument();
  });

  it('can add multiple new entry forms', () => {
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('+ 添加条目'));
    fireEvent.click(screen.getByText('+ 添加条目'));

    expect(screen.getByText('新条目 1')).toBeInTheDocument();
    expect(screen.getByText('新条目 2')).toBeInTheDocument();
  });

  it('can remove a new entry form', () => {
    render(<WorkEntryModal {...defaultProps} />);

    fireEvent.click(screen.getByText('+ 添加条目'));
    expect(screen.getByText('新条目 1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('移除'));
    expect(screen.queryByText('新条目 1')).not.toBeInTheDocument();
  });
});
