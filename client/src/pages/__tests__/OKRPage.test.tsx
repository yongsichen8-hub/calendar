import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OKRPage from '../OKRPage';
import { apiClient } from '../../api/client';
import type { Category, Objective } from '../../types';

vi.mock('../../api/client', () => ({
  apiClient: {
    categories: { list: vi.fn() },
    okr: {
      getByQuarter: vi.fn(),
      createObjective: vi.fn(),
      updateObjective: vi.fn(),
      deleteObjective: vi.fn(),
      createKeyResult: vi.fn(),
      updateKeyResult: vi.fn(),
      deleteKeyResult: vi.fn(),
    },
    milestones: {
      identify: vi.fn(),
      save: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const mockCategories: Category[] = [
  { id: 1, name: '高管', color: '#f5c6c6', isDefault: false, createdAt: '' },
  { id: 2, name: '培训', color: '#c6ddf5', isDefault: false, createdAt: '' },
  { id: 3, name: '其他', color: '#dcc6f5', isDefault: true, createdAt: '' },
];

const mockObjectives: Objective[] = [
  {
    id: 1,
    categoryId: 1,
    quarter: '2025-Q1',
    title: '提升团队效率',
    description: '通过流程优化提升团队整体效率',
    keyResults: [
      { id: 10, objectiveId: 1, description: '完成流程梳理', progress: 30, milestones: [], createdAt: '', updatedAt: '' },
      {
        id: 11, objectiveId: 1, description: '培训完成率达到90%', progress: 100,
        milestones: [
          { id: 1, keyResultId: 11, content: '完成第一批培训', date: '2025-01-10', createdAt: '' },
        ],
        createdAt: '', updatedAt: '',
      },
    ],
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    categoryId: 2,
    quarter: '2025-Q1',
    title: '完成培训计划',
    description: '',
    keyResults: [],
    createdAt: '',
    updatedAt: '',
  },
];

function renderOKRPage() {
  return render(
    <MemoryRouter>
      <OKRPage initialQuarter="2025-Q1" />
    </MemoryRouter>,
  );
}

describe('OKRPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.categories.list).mockResolvedValue(mockCategories);
    vi.mocked(apiClient.okr.getByQuarter).mockResolvedValue({
      quarter: '2025-Q1',
      objectives: mockObjectives,
    });
  });

  it('shows loading state initially', () => {
    vi.mocked(apiClient.categories.list).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiClient.okr.getByQuarter).mockReturnValue(new Promise(() => {}));
    renderOKRPage();
    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });

  it('renders quarter selector with current quarter and navigation buttons', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('2025-Q1')).toBeInTheDocument();
      expect(screen.getByText('← 上一季度')).toBeInTheDocument();
      expect(screen.getByText('下一季度 →')).toBeInTheDocument();
    });
  });

  it('fetches categories and OKR data on mount', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(apiClient.categories.list).toHaveBeenCalled();
      expect(apiClient.okr.getByQuarter).toHaveBeenCalledWith('2025-Q1');
    });
  });

  it('displays objective cards with category tags and titles', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('提升团队效率')).toBeInTheDocument();
      expect(screen.getByText('完成培训计划')).toBeInTheDocument();
      expect(screen.getByText('高管')).toBeInTheDocument();
      expect(screen.getByText('培训')).toBeInTheDocument();
    });
  });

  it('displays objective description', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('通过流程优化提升团队整体效率')).toBeInTheDocument();
    });
  });

  it('displays key results with progress bars', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('完成流程梳理')).toBeInTheDocument();
      expect(screen.getByText('培训完成率达到90%')).toBeInTheDocument();
    });

    const progressTexts = screen.getAllByText(/^\d+%$/);
    const values = progressTexts.map((el) => el.textContent);
    expect(values).toContain('30%');
    expect(values).toContain('100%');
    expect(values).toContain('65%');
  });

  it('displays milestones under key results', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
      expect(screen.getByText('2025-01-10')).toBeInTheDocument();
    });
  });

  it('displays objective aggregate progress bar', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  it('shows empty state when no objectives exist', async () => {
    vi.mocked(apiClient.okr.getByQuarter).mockResolvedValue({
      quarter: '2025-Q1',
      objectives: [],
    });
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('本季度暂无 OKR，点击上方按钮新增目标')).toBeInTheDocument();
    });
  });

  it('navigates to previous quarter', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('2025-Q1')).toBeInTheDocument();
    });

    vi.mocked(apiClient.okr.getByQuarter).mockResolvedValue({ quarter: '2024-Q4', objectives: [] });
    fireEvent.click(screen.getByText('← 上一季度'));

    await waitFor(() => {
      expect(apiClient.okr.getByQuarter).toHaveBeenCalledWith('2024-Q4');
      expect(screen.getByText('2024-Q4')).toBeInTheDocument();
    });
  });

  it('navigates to next quarter', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('2025-Q1')).toBeInTheDocument();
    });

    vi.mocked(apiClient.okr.getByQuarter).mockResolvedValue({ quarter: '2025-Q2', objectives: [] });
    fireEvent.click(screen.getByText('下一季度 →'));

    await waitFor(() => {
      expect(apiClient.okr.getByQuarter).toHaveBeenCalledWith('2025-Q2');
      expect(screen.getByText('2025-Q2')).toBeInTheDocument();
    });
  });

  it('opens create objective form and filters out "其他" category', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('+ 新增 Objective')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ 新增 Objective'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 Objective 标题')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option'));
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain('高管');
    expect(optionTexts).toContain('培训');
    expect(optionTexts).not.toContain('其他');
  });

  it('creates a new objective via the form', async () => {
    vi.mocked(apiClient.okr.createObjective).mockResolvedValue({
      id: 3, categoryId: 1, quarter: '2025-Q1', title: '新目标',
      description: '描述', keyResults: [], createdAt: '', updatedAt: '',
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('+ 新增 Objective')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ 新增 Objective'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 Objective 标题')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('输入 Objective 标题'), { target: { value: '新目标' } });
    fireEvent.change(screen.getByPlaceholderText('输入 Objective 描述（可选）'), { target: { value: '描述' } });

    const submitButtons = screen.getAllByText('新增 Objective');
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(apiClient.okr.createObjective).toHaveBeenCalledWith({
        categoryId: 1,
        quarter: '2025-Q1',
        title: '新目标',
        description: '描述',
      });
    });
  });

  it('shows validation error when title is empty on create', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('+ 新增 Objective')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ 新增 Objective'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 Objective 标题')).toBeInTheDocument();
    });

    const submitButtons = screen.getAllByText('新增 Objective');
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    expect(screen.getByText('请输入标题')).toBeInTheDocument();
    expect(apiClient.okr.createObjective).not.toHaveBeenCalled();
  });

  it('opens delete objective confirm dialog and deletes', async () => {
    vi.mocked(apiClient.okr.deleteObjective).mockResolvedValue(undefined);

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('提升团队效率')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByLabelText('删除 Objective');
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('确定要删除此 Objective 吗？其下所有 Key Result 也将被删除。')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('确认删除'));

    await waitFor(() => {
      expect(apiClient.okr.deleteObjective).toHaveBeenCalledWith(1);
    });
  });

  it('opens add key result form and creates', async () => {
    vi.mocked(apiClient.okr.createKeyResult).mockResolvedValue({
      id: 12, objectiveId: 1, description: '新KR', progress: 0, milestones: [], createdAt: '', updatedAt: '',
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('提升团队效率')).toBeInTheDocument();
    });

    const addKrButtons = screen.getAllByText('+ 添加 Key Result');
    fireEvent.click(addKrButtons[0]);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 Key Result 描述')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('输入 Key Result 描述'), { target: { value: '新KR' } });

    const submitButtons = screen.getAllByText('添加 Key Result');
    fireEvent.click(submitButtons[submitButtons.length - 1]);

    await waitFor(() => {
      expect(apiClient.okr.createKeyResult).toHaveBeenCalledWith({
        objectiveId: 1,
        description: '新KR',
      });
    });
  });

  it('handles API error gracefully', async () => {
    vi.mocked(apiClient.categories.list).mockRejectedValue(new Error('Network error'));
    vi.mocked(apiClient.okr.getByQuarter).mockRejectedValue(new Error('Network error'));

    renderOKRPage();

    await waitFor(() => {
      expect(screen.getByText('加载 OKR 数据失败')).toBeInTheDocument();
    });
  });

  it('can cancel the create objective modal', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('+ 新增 Objective')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('+ 新增 Objective'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 Objective 标题')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('取消'));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('输入 Objective 标题')).not.toBeInTheDocument();
    });
  });

  it('renders milestone panel with date range pickers and identify button', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('🏆 AI 里程碑识别')).toBeInTheDocument();
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
      expect(screen.getByLabelText('开始日期')).toBeInTheDocument();
      expect(screen.getByLabelText('结束日期')).toBeInTheDocument();
    });
  });

  it('calls milestone identify API and displays suggestions with save button', async () => {
    vi.mocked(apiClient.milestones.identify).mockResolvedValue({
      date: '2025-01-06',
      suggestions: [
        {
          objectiveTitle: '提升团队效率',
          keyResultId: 10,
          keyResultDescription: '完成流程梳理',
          milestones: ['完成流程文档编写'],
        },
      ],
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('识别里程碑'));

    await waitFor(() => {
      expect(apiClient.milestones.identify).toHaveBeenCalled();
      expect(screen.getByText('保存到 KR')).toBeInTheDocument();
      expect(screen.getByText('忽略')).toBeInTheDocument();
    });
  });

  it('saves milestones to KR when clicking save button', async () => {
    vi.mocked(apiClient.milestones.identify).mockResolvedValue({
      date: '2025-01-06',
      suggestions: [
        {
          objectiveTitle: '提升团队效率',
          keyResultId: 10,
          keyResultDescription: '完成流程梳理',
          milestones: ['完成流程文档编写'],
        },
      ],
    });
    vi.mocked(apiClient.milestones.save).mockResolvedValue([
      { id: 5, keyResultId: 10, content: '完成流程文档编写', date: '2025-01-06', createdAt: '' },
    ]);

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('识别里程碑'));

    await waitFor(() => {
      expect(screen.getByText('保存到 KR')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('保存到 KR'));

    await waitFor(() => {
      expect(apiClient.milestones.save).toHaveBeenCalledWith(10, expect.any(String), ['完成流程文档编写']);
    });
  });

  it('ignores milestone suggestion without saving', async () => {
    vi.mocked(apiClient.milestones.identify).mockResolvedValue({
      date: '2025-01-06',
      suggestions: [
        {
          objectiveTitle: '提升团队效率',
          keyResultId: 10,
          keyResultDescription: '完成流程梳理',
          milestones: ['完成流程文档编写'],
        },
      ],
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('识别里程碑'));

    await waitFor(() => {
      expect(screen.getByText('忽略')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('忽略'));

    await waitFor(() => {
      expect(screen.queryByText('保存到 KR')).not.toBeInTheDocument();
    });
    expect(apiClient.milestones.save).not.toHaveBeenCalled();
  });

  it('shows error when milestone identification fails', async () => {
    vi.mocked(apiClient.milestones.identify).mockRejectedValue(new Error('API error'));

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('识别里程碑'));

    await waitFor(() => {
      expect(screen.getByText('里程碑识别失败，请稍后重试')).toBeInTheDocument();
    });
  });

  it('shows no milestone message when no suggestions returned', async () => {
    vi.mocked(apiClient.milestones.identify).mockResolvedValue({
      date: '2025-01-06',
      suggestions: [],
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText('识别里程碑')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('识别里程碑'));

    await waitFor(() => {
      expect(screen.getByText('该日期未识别到里程碑事项')).toBeInTheDocument();
    });
  });

  it('applies done style to 100% progress key results', async () => {
    renderOKRPage();
    await waitFor(() => {
      const doneKr = screen.getByText('培训完成率达到90%');
      expect(doneKr.className).toContain('key-result-item__desc--done');
    });
  });

  it('shows edit and delete buttons on milestone hover', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
    });
    expect(screen.getByLabelText('编辑里程碑')).toBeInTheDocument();
    expect(screen.getByLabelText('删除里程碑')).toBeInTheDocument();
  });

  it('enters edit mode for a milestone and saves', async () => {
    vi.mocked(apiClient.milestones.update).mockResolvedValue({
      id: 1, keyResultId: 11, content: '更新后的里程碑', date: '2025-02-01', createdAt: '',
    });

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('编辑里程碑'));

    await waitFor(() => {
      expect(screen.getByLabelText('编辑里程碑内容')).toBeInTheDocument();
      expect(screen.getByLabelText('编辑里程碑日期')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('编辑里程碑内容'), { target: { value: '更新后的里程碑' } });
    fireEvent.change(screen.getByLabelText('编辑里程碑日期'), { target: { value: '2025-02-01' } });
    fireEvent.click(screen.getByLabelText('保存里程碑'));

    await waitFor(() => {
      expect(apiClient.milestones.update).toHaveBeenCalledWith(1, { content: '更新后的里程碑', date: '2025-02-01' });
    });
  });

  it('cancels milestone editing', async () => {
    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('编辑里程碑'));

    await waitFor(() => {
      expect(screen.getByLabelText('编辑里程碑内容')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('取消编辑里程碑'));

    await waitFor(() => {
      expect(screen.queryByLabelText('编辑里程碑内容')).not.toBeInTheDocument();
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
    });
  });

  it('deletes a milestone', async () => {
    vi.mocked(apiClient.milestones.delete).mockResolvedValue(undefined);

    renderOKRPage();
    await waitFor(() => {
      expect(screen.getByText(/完成第一批培训/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('删除里程碑'));

    await waitFor(() => {
      expect(apiClient.milestones.delete).toHaveBeenCalledWith(1);
    });
  });
});
