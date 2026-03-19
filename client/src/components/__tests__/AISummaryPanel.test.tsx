import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AISummaryPanel from '../AISummaryPanel';
import { apiClient } from '../../api/client';
import type { Summary } from '../../types';

vi.mock('../../api/client', () => ({
  apiClient: {
    summaries: {
      generate: vi.fn(),
      list: vi.fn(),
      getById: vi.fn(),
    },
  },
}));

const mockSummary: Summary = {
  id: 1,
  type: 'daily',
  target: '2025-01-06',
  content: '今日工作总结：\n\n## OKR 推进分析\n完成了项目A的核心功能开发。',
  createdAt: '2025-01-06T18:00:00',
};

const mockHistorySummaries: Summary[] = [
  mockSummary,
  {
    id: 2,
    type: 'weekly',
    target: '2025-W02',
    content: '本周工作总结...',
    createdAt: '2025-01-10T18:00:00',
  },
];

describe('AISummaryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.summaries.generate).mockResolvedValue(mockSummary);
    vi.mocked(apiClient.summaries.list).mockResolvedValue(mockHistorySummaries);
  });

  it('renders collapsed by default with header', () => {
    render(<AISummaryPanel />);
    expect(screen.getByText('🤖 AI 总结')).toBeInTheDocument();
    // Should show expand button, not the type selector
    expect(screen.queryByText('日总结')).not.toBeInTheDocument();
  });

  it('expands when clicking the header', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    expect(screen.getByText('日总结')).toBeInTheDocument();
    expect(screen.getByText('周总结')).toBeInTheDocument();
    expect(screen.getByText('月总结')).toBeInTheDocument();
    expect(screen.getByText('季度总结')).toBeInTheDocument();
  });

  it('collapses when clicking the header again', () => {
    render(<AISummaryPanel />);
    // Expand
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    expect(screen.getByText('日总结')).toBeInTheDocument();
    // Collapse
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    expect(screen.queryByText('日总结')).not.toBeInTheDocument();
  });

  it('shows type selector tabs with daily selected by default', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));

    const dailyTab = screen.getByRole('tab', { name: '日总结' });
    expect(dailyTab).toHaveAttribute('aria-selected', 'true');
  });

  it('switches summary type when clicking tabs', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));

    fireEvent.click(screen.getByText('周总结'));
    const weeklyTab = screen.getByRole('tab', { name: '周总结' });
    expect(weeklyTab).toHaveAttribute('aria-selected', 'true');

    const dailyTab = screen.getByRole('tab', { name: '日总结' });
    expect(dailyTab).toHaveAttribute('aria-selected', 'false');
  });

  it('shows date input for daily type', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    expect(screen.getByLabelText('选择日期')).toBeInTheDocument();
  });

  it('shows week input for weekly type', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('周总结'));
    expect(screen.getByLabelText('选择周')).toBeInTheDocument();
  });

  it('shows month input for monthly type', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('月总结'));
    expect(screen.getByLabelText('选择月份')).toBeInTheDocument();
  });

  it('shows quarter select for quarterly type', () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('季度总结'));
    expect(screen.getByLabelText('选择季度')).toBeInTheDocument();
  });

  it('calls API to generate summary and displays content', async () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));

    fireEvent.click(screen.getByText('生成总结'));

    // Should show loading
    expect(screen.getByText('生成中...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('summary-content')).toBeInTheDocument();
    });

    expect(apiClient.summaries.generate).toHaveBeenCalledWith('daily', expect.any(String));
    expect(screen.getByTestId('summary-content').textContent).toContain('OKR 推进分析');
  });

  it('shows error message when API fails', async () => {
    vi.mocked(apiClient.summaries.generate).mockRejectedValue(new Error('API error'));

    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('生成总结'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('AI 总结生成失败，请稍后重试');
    });
  });

  it('copies summary content to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('生成总结'));

    await waitFor(() => {
      expect(screen.getByTestId('summary-content')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('复制到剪贴板'));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(mockSummary.content);
      expect(screen.getByText('已复制 ✓')).toBeInTheDocument();
    });
  });

  it('loads and displays history summaries', async () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('历史总结'));

    await waitFor(() => {
      expect(apiClient.summaries.list).toHaveBeenCalled();
      expect(screen.getByTestId('history-item-1')).toBeInTheDocument();
      expect(screen.getByTestId('history-item-2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no history summaries', async () => {
    vi.mocked(apiClient.summaries.list).mockResolvedValue([]);

    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('历史总结'));

    await waitFor(() => {
      expect(screen.getByText('暂无历史总结')).toBeInTheDocument();
    });
  });

  it('displays selected history summary content', async () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('历史总结'));

    await waitFor(() => {
      expect(screen.getByTestId('history-item-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('history-item-1'));

    await waitFor(() => {
      expect(screen.getByTestId('summary-content')).toBeInTheDocument();
      expect(screen.getByTestId('summary-content').textContent).toContain('OKR 推进分析');
    });
  });

  it('disables generate button while loading', async () => {
    vi.mocked(apiClient.summaries.generate).mockReturnValue(new Promise(() => {}));

    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('生成总结'));

    expect(screen.getByText('生成中...')).toBeDisabled();
  });

  it('renders summary content with pre-wrap whitespace', async () => {
    render(<AISummaryPanel />);
    fireEvent.click(screen.getByTestId('ai-summary-header'));
    fireEvent.click(screen.getByText('生成总结'));

    await waitFor(() => {
      const content = screen.getByTestId('summary-content');
      expect(content).toHaveStyle({ whiteSpace: 'pre-wrap' });
    });
  });
});
