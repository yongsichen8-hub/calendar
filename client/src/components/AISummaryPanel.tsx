import { useState, useCallback } from 'react';
import { apiClient } from '@/api/client';
import type { Summary, SummaryType } from '@/types';

const TYPE_LABELS: Record<SummaryType, string> = {
  daily: '日总结',
  weekly: '周总结',
  monthly: '月总结',
  quarterly: '季度总结',
};

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrentWeekISO(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d.getTime() - jan1.getTime()) / 86400000) + 1;
  const dayOfWeek = jan1.getDay() || 7; // Mon=1..Sun=7
  const weekNum = Math.ceil((dayOfYear + dayOfWeek - 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function getCurrentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function getCurrentQuarterISO(): string {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getDefaultTarget(type: SummaryType): string {
  switch (type) {
    case 'daily': return getTodayISO();
    case 'weekly': return getCurrentWeekISO();
    case 'monthly': return getCurrentMonthISO();
    case 'quarterly': return getCurrentQuarterISO();
  }
}

function formatTarget(type: SummaryType, target: string): string {
  switch (type) {
    case 'daily': return target;
    case 'weekly': return target;
    case 'monthly': return target;
    case 'quarterly': return target;
  }
}

function AISummaryPanel() {
  const [expanded, setExpanded] = useState(false);
  const [summaryType, setSummaryType] = useState<SummaryType>('daily');
  const [target, setTarget] = useState(() => getDefaultTarget('daily'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentSummary, setCurrentSummary] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);
  const [historySummaries, setHistorySummaries] = useState<Summary[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<Summary | null>(null);

  const handleTypeChange = (type: SummaryType) => {
    setSummaryType(type);
    setTarget(getDefaultTarget(type));
    setError('');
    setCurrentSummary(null);
    setSelectedHistory(null);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setCurrentSummary(null);
    setSelectedHistory(null);
    try {
      const summary = await apiClient.summaries.generate(summaryType, target);
      setCurrentSummary(summary);
    } catch {
      setError('AI 总结生成失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const text = selectedHistory?.content ?? currentSummary?.content;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: ignore
    }
  };

  const loadHistory = useCallback(async () => {
    try {
      const list = await apiClient.summaries.list();
      setHistorySummaries(list);
    } catch {
      // silently fail
    }
  }, []);

  const handleToggleHistory = () => {
    if (!showHistory) {
      loadHistory();
    }
    setShowHistory(!showHistory);
  };

  const handleSelectHistory = (summary: Summary) => {
    setSelectedHistory(summary);
    setCurrentSummary(null);
    setShowHistory(false);
  };

  const displayedSummary = selectedHistory ?? currentSummary;

  if (!expanded) {
    return (
      <div className="card">
        <div
          className="card-header cursor-pointer"
          onClick={() => setExpanded(true)}
          data-testid="ai-summary-header"
        >
          <h3>🤖 AI 总结</h3>
          <button className="btn btn-ghost btn-sm" aria-label="展开">▼</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div
        className="card-header cursor-pointer"
        onClick={() => setExpanded(false)}
        data-testid="ai-summary-header"
      >
        <h3>🤖 AI 总结</h3>
        <button className="btn btn-ghost btn-sm" aria-label="收起">▲</button>
      </div>
      <div className="card-body">
        {/* Type selector */}
        <div className="flex gap-sm mb-md" role="tablist">
          {(Object.keys(TYPE_LABELS) as SummaryType[]).map((type) => (
            <button
              key={type}
              role="tab"
              aria-selected={summaryType === type}
              className={`category-filter__btn${summaryType === type ? ' category-filter__btn--active' : ''}`}
              onClick={() => handleTypeChange(type)}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {/* Target selector */}
        <div className="flex items-center gap-sm mb-md">
          {summaryType === 'daily' && (
            <input
              type="date"
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="选择日期"
            />
          )}
          {summaryType === 'weekly' && (
            <input
              type="week"
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="选择周"
            />
          )}
          {summaryType === 'monthly' && (
            <input
              type="month"
              className="input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="选择月份"
            />
          )}
          {summaryType === 'quarterly' && (
            <select
              className="select"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="选择季度"
            >
              {generateQuarterOptions().map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          )}
        </div>

        {/* Generate button */}
        <div className="flex gap-sm mb-md">
          <button
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={loading || !target}
          >
            {loading ? '生成中...' : '生成总结'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleToggleHistory}
          >
            {showHistory ? '隐藏历史' : '历史总结'}
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner loading-spinner--lg" />
            <span>正在生成 AI 总结...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-danger text-sm mb-md" role="alert">{error}</div>
        )}

        {/* Summary content */}
        {displayedSummary && !loading && (
          <div className="mb-md">
            <div className="flex items-center justify-between mb-sm">
              <span className="text-sm text-secondary">
                {TYPE_LABELS[displayedSummary.type]} - {formatTarget(displayedSummary.type, displayedSummary.target)}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleCopy}
              >
                {copied ? '已复制 ✓' : '复制到剪贴板'}
              </button>
            </div>
            <div
              className="p-md"
              style={{ whiteSpace: 'pre-wrap', background: 'var(--bg-warm)', borderRadius: 'var(--radius-sm)' }}
              data-testid="summary-content"
            >
              {displayedSummary.content}
            </div>
          </div>
        )}

        {/* History list */}
        {showHistory && (
          <div>
            <div className="divider" />
            <h4 className="text-sm font-semibold mb-sm">历史总结</h4>
            {historySummaries.length === 0 ? (
              <div className="empty-state">
                <p>暂无历史总结</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {historySummaries.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-sm cursor-pointer"
                    style={{ background: 'var(--bg-cream)', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => handleSelectHistory(s)}
                    data-testid={`history-item-${s.id}`}
                  >
                    <span className="text-sm">
                      {TYPE_LABELS[s.type]} - {s.target}
                    </span>
                    <span className="text-sm text-secondary">{s.createdAt}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function generateQuarterOptions(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const options: string[] = [];
  // Previous year Q1-Q4, current year Q1-Q4, next year Q1-Q4
  for (let y = year - 1; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push(`${y}-Q${q}`);
    }
  }
  return options;
}

export default AISummaryPanel;
