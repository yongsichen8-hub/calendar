import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/api/client';
import { getQuarter } from '@/utils/dateUtils';
import type {
  Category,
  Objective,
  KeyResult,
  CreateObjectiveDTO,
  UpdateObjectiveDTO,
  CreateKeyResultDTO,
  UpdateKeyResultDTO,
  MilestoneSuggestion,
} from '@/types';

/* ── Quarter helpers ── */

function parseQuarter(q: string): { year: number; quarter: number } {
  const [yearStr, qStr] = q.split('-Q');
  return { year: parseInt(yearStr, 10), quarter: parseInt(qStr, 10) };
}

function prevQuarter(q: string): string {
  const { year, quarter } = parseQuarter(q);
  if (quarter === 1) return `${year - 1}-Q4`;
  return `${year}-Q${quarter - 1}`;
}

function nextQuarter(q: string): string {
  const { year, quarter } = parseQuarter(q);
  if (quarter === 4) return `${year + 1}-Q1`;
  return `${year}-Q${quarter + 1}`;
}

/* ── Progress helpers ── */

function calculateObjectiveProgress(keyResults: KeyResult[]): number {
  if (keyResults.length === 0) return 0;
  const sum = keyResults.reduce((acc, kr) => acc + kr.progress, 0);
  return Math.round(sum / keyResults.length);
}

/* ── Sub-components ── */

interface QuarterSelectorProps {
  quarter: string;
  onPrev: () => void;
  onNext: () => void;
}

function QuarterSelector({ quarter, onPrev, onNext }: QuarterSelectorProps) {
  return (
    <div className="quarter-selector">
      <button className="btn btn-secondary btn-sm" onClick={onPrev} aria-label="上一季度">
        ← 上一季度
      </button>
      <span className="quarter-selector__label">{quarter}</span>
      <button className="btn btn-secondary btn-sm" onClick={onNext} aria-label="下一季度">
        下一季度 →
      </button>
    </div>
  );
}

/* ── ProgressBar ── */

interface ProgressBarProps {
  progress: number;
  size?: 'sm' | 'md';
}

function ProgressBar({ progress, size = 'md' }: ProgressBarProps) {
  const cls = `progress-bar${size === 'sm' ? ' progress-bar--sm' : ''}${progress === 100 ? ' progress-bar--complete' : ''}`;
  return (
    <div className={cls}>
      <div className="progress-bar__track">
        <div
          className="progress-bar__fill"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <span className="progress-bar__text">{progress}%</span>
    </div>
  );
}

/* ── ProgressInput ── */

interface ProgressInputProps {
  currentProgress: number;
  onSave: (progress: number) => void;
  onCancel: () => void;
}

function ProgressInput({ currentProgress, onSave, onCancel }: ProgressInputProps) {
  const [value, setValue] = useState(String(currentProgress));
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(value);
    if (!Number.isInteger(num) || num < 0 || num > 100) {
      setError('请输入 0-100 之间的整数');
      return;
    }
    onSave(num);
  };

  return (
    <form className="progress-input" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        className="input input-sm progress-input__field"
        value={value}
        onChange={(e) => { setValue(e.target.value); setError(''); }}
        min={0}
        max={100}
        autoFocus
        aria-label="进度值"
      />
      <span className="progress-input__unit">%</span>
      <button type="submit" className="btn btn-primary btn-sm" aria-label="保存进度">✓</button>
      <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} aria-label="取消编辑">✕</button>
      {error && <span className="form-error progress-input__error">{error}</span>}
    </form>
  );
}

/* ── KeyResultItem ── */

interface KeyResultItemProps {
  kr: KeyResult;
  onUpdateProgress: (id: number, progress: number) => void;
  onEdit: (kr: KeyResult) => void;
  onDelete: (id: number) => void;
  onMilestoneChanged: () => void;
}

function KeyResultItem({ kr, onUpdateProgress, onEdit, onDelete, onMilestoneChanged }: KeyResultItemProps) {
  const [editing, setEditing] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDate, setEditDate] = useState('');

  const startEditMilestone = (m: { id: number; content: string; date: string }) => {
    setEditingMilestoneId(m.id);
    setEditContent(m.content);
    setEditDate(m.date);
  };

  const cancelEditMilestone = () => {
    setEditingMilestoneId(null);
    setEditContent('');
    setEditDate('');
  };

  const saveMilestone = async (id: number) => {
    if (!editContent.trim()) return;
    try {
      await apiClient.milestones.update(id, { content: editContent.trim(), date: editDate });
      setEditingMilestoneId(null);
      onMilestoneChanged();
    } catch { /* ignore */ }
  };

  const deleteMilestone = async (id: number) => {
    try {
      await apiClient.milestones.delete(id);
      onMilestoneChanged();
    } catch { /* ignore */ }
  };

  return (
    <div className="key-result-item">
      <div className="key-result-item__main">
        <span className={`key-result-item__desc${kr.progress === 100 ? ' key-result-item__desc--done' : ''}`}>
          {kr.description}
        </span>
        <div className="key-result-item__actions">
          <button className="btn-icon btn-sm" onClick={() => onEdit(kr)} aria-label="编辑 Key Result" title="编辑">
            ✏️
          </button>
          <button className="btn-icon btn-sm" onClick={() => onDelete(kr.id)} aria-label="删除 Key Result" title="删除">
            🗑️
          </button>
        </div>
      </div>
      {editing ? (
        <ProgressInput
          currentProgress={kr.progress}
          onSave={(p) => { onUpdateProgress(kr.id, p); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="key-result-item__progress" onClick={() => setEditing(true)} title="点击编辑进度">
          <ProgressBar progress={kr.progress} size="sm" />
        </div>
      )}
      {kr.milestones && kr.milestones.length > 0 && (
        <ul className="kr-milestones">
          {kr.milestones.map((m) => (
            <li key={m.id} className="kr-milestone">
              {editingMilestoneId === m.id ? (
                <div className="kr-milestone__edit">
                  <input
                    className="input input-sm kr-milestone__edit-content"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    aria-label="编辑里程碑内容"
                  />
                  <input
                    type="date"
                    className="input input-sm kr-milestone__edit-date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    aria-label="编辑里程碑日期"
                  />
                  <button className="btn-icon btn-sm" onClick={() => saveMilestone(m.id)} aria-label="保存里程碑" title="保存">✓</button>
                  <button className="btn-icon btn-sm" onClick={cancelEditMilestone} aria-label="取消编辑里程碑" title="取消">✕</button>
                </div>
              ) : (
                <>
                  <span className="kr-milestone__content">🏁 {m.content}</span>
                  <span className="kr-milestone__date">{m.date}</span>
                  <div className="kr-milestone__actions">
                    <button className="btn-icon btn-sm" onClick={() => startEditMilestone(m)} aria-label="编辑里程碑" title="编辑">✏️</button>
                    <button className="btn-icon btn-sm" onClick={() => deleteMilestone(m.id)} aria-label="删除里程碑" title="删除">🗑️</button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── ObjectiveCard ── */

interface ObjectiveCardProps {
  objective: Objective;
  category: Category | undefined;
  onEditObjective: (obj: Objective) => void;
  onDeleteObjective: (id: number) => void;
  onAddKeyResult: (objectiveId: number) => void;
  onUpdateProgress: (id: number, progress: number) => void;
  onEditKeyResult: (kr: KeyResult) => void;
  onDeleteKeyResult: (id: number) => void;
  onMilestoneChanged: () => void;
}

function ObjectiveCard({
  objective,
  category,
  onEditObjective,
  onDeleteObjective,
  onAddKeyResult,
  onUpdateProgress,
  onEditKeyResult,
  onDeleteKeyResult,
  onMilestoneChanged,
}: ObjectiveCardProps) {
  const objProgress = calculateObjectiveProgress(objective.keyResults);

  return (
    <div className="objective-card card">
      <div className="card-header">
        <div className="objective-card__title-row">
          {category && (
            <span
              className="category-tag category-tag--sm"
              style={{ backgroundColor: category.color, color: '#4a4a4a' }}
            >
              {category.name}
            </span>
          )}
          <h3>{objective.title}</h3>
        </div>
        <div className="objective-card__actions">
          <button className="btn-icon" onClick={() => onEditObjective(objective)} aria-label="编辑 Objective" title="编辑">
            ✏️
          </button>
          <button className="btn-icon" onClick={() => onDeleteObjective(objective.id)} aria-label="删除 Objective" title="删除">
            🗑️
          </button>
        </div>
      </div>

      {/* Objective aggregate progress */}
      {objective.keyResults.length > 0 && (
        <div className="objective-card__progress">
          <ProgressBar progress={objProgress} />
        </div>
      )}

      {objective.description && (
        <div className="objective-card__desc">
          <p>{objective.description}</p>
        </div>
      )}
      <div className="card-body">
        <div className="objective-card__kr-header">
          <span className="text-sm font-medium text-secondary">Key Results</span>
          <button className="btn btn-sm btn-secondary" onClick={() => onAddKeyResult(objective.id)}>
            + 添加 Key Result
          </button>
        </div>
        {objective.keyResults.length === 0 ? (
          <p className="text-sm text-secondary mt-sm">暂无 Key Result</p>
        ) : (
          <div className="objective-card__kr-list">
            {objective.keyResults.map((kr) => (
              <KeyResultItem
                key={kr.id}
                kr={kr}
                onUpdateProgress={onUpdateProgress}
                onEdit={onEditKeyResult}
                onDelete={onDeleteKeyResult}
                onMilestoneChanged={onMilestoneChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Objective Form (create / edit) ── */

interface ObjectiveFormProps {
  categories: Category[];
  initial?: { categoryId: number; title: string; description: string };
  onSubmit: (data: { categoryId: number; title: string; description: string }) => void;
  onCancel: () => void;
  submitLabel: string;
}

function ObjectiveForm({ categories, initial, onSubmit, onCancel, submitLabel }: ObjectiveFormProps) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? (categories[0]?.id ?? 0));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!categoryId) {
      setError('请选择分类');
      return;
    }
    onSubmit({ categoryId, title: title.trim(), description: description.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{submitLabel}</h3>
          <button className="btn-icon" onClick={onCancel} aria-label="关闭">✕</button>
        </div>
        <form className="modal-body okr-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">分类</label>
            <select
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">标题</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入 Objective 标题"
            />
          </div>
          <div className="form-group">
            <label className="form-label">描述</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入 Objective 描述（可选）"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Key Result Form (create / edit) ── */

interface KeyResultFormProps {
  initial?: { description: string };
  onSubmit: (description: string) => void;
  onCancel: () => void;
  submitLabel: string;
}

function KeyResultForm({ initial, onSubmit, onCancel, submitLabel }: KeyResultFormProps) {
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setError('请输入 Key Result 描述');
      return;
    }
    onSubmit(description.trim());
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{submitLabel}</h3>
          <button className="btn-icon" onClick={onCancel} aria-label="关闭">✕</button>
        </div>
        <form className="modal-body okr-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="form-group">
            <label className="form-label">描述</label>
            <textarea
              className="textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入 Key Result 描述"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>取消</button>
            <button type="submit" className="btn btn-primary">{submitLabel}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Confirm Dialog ── */

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ message, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content modal-content--sm" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>确认操作</h3>
        </div>
        <div className="modal-body">
          <p>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>取消</button>
          <button className="btn btn-danger" onClick={onConfirm}>确认删除</button>
        </div>
      </div>
    </div>
  );
}

/* ── MilestonePanel ── */

function MilestonePanel({ onMilestonesSaved }: { onMilestonesSaved: () => void }) {
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [suggestions, setSuggestions] = useState<MilestoneSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [identified, setIdentified] = useState(false);

  const handleIdentify = async () => {
    setLoading(true);
    setError('');
    setSuggestions([]);
    setIdentified(false);
    try {
      const result = await apiClient.milestones.identify(startDate, endDate);
      setSuggestions(result.suggestions);
      setIdentified(true);
    } catch {
      setError('里程碑识别失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (suggestion: MilestoneSuggestion) => {
    setSaving(suggestion.keyResultId);
    try {
      await apiClient.milestones.save(suggestion.keyResultId, startDate, suggestion.milestones);
      setSuggestions((prev) => prev.filter((s) => s.keyResultId !== suggestion.keyResultId));
      onMilestonesSaved();
    } catch {
      setError('保存里程碑失败');
    } finally {
      setSaving(null);
    }
  };

  const handleIgnore = (suggestion: MilestoneSuggestion) => {
    setSuggestions((prev) => prev.filter((s) => s.keyResultId !== suggestion.keyResultId));
  };

  return (
    <div className="milestone-panel card">
      <div className="card-header">
        <h3>🏆 AI 里程碑识别</h3>
      </div>
      <div className="card-body">
        <div className="milestone-panel__controls">
          <input
            type="date"
            className="input input-sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="开始日期"
          />
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>至</span>
          <input
            type="date"
            className="input input-sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="结束日期"
          />
          <button
            className="btn btn-primary btn-sm"
            onClick={handleIdentify}
            disabled={loading}
          >
            {loading ? '识别中...' : '识别里程碑'}
          </button>
        </div>

        {error && <div className="auth-error mt-sm">{error}</div>}

        {loading && (
          <div className="loading-overlay" style={{ padding: '24px 0' }}>
            <div className="loading-spinner" />
            <span>正在分析工作条目...</span>
          </div>
        )}

        {identified && suggestions.length === 0 && !loading && (
          <p className="text-sm text-secondary mt-sm">该日期未识别到里程碑事项</p>
        )}

        {suggestions.length > 0 && (
          <div className="milestone-panel__suggestions mt-sm">
            {suggestions.map((s) => (
              <div key={s.keyResultId} className="milestone-suggestion">
                <div className="milestone-suggestion__header">
                  <span className="milestone-suggestion__obj">{s.objectiveTitle}</span>
                  <span className="milestone-suggestion__kr">{s.keyResultDescription}</span>
                </div>
                {s.milestones.length > 0 && (
                  <ul className="milestone-suggestion__list">
                    {s.milestones.map((m, i) => (
                      <li key={i}>🏁 {m}</li>
                    ))}
                  </ul>
                )}
                <div className="milestone-suggestion__actions">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleSave(s)}
                    disabled={saving === s.keyResultId}
                  >
                    {saving === s.keyResultId ? '保存中...' : '保存到 KR'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleIgnore(s)}>忽略</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal state types ── */

type ModalState =
  | { type: 'none' }
  | { type: 'createObjective' }
  | { type: 'editObjective'; objective: Objective }
  | { type: 'deleteObjective'; objectiveId: number }
  | { type: 'createKeyResult'; objectiveId: number }
  | { type: 'editKeyResult'; kr: KeyResult }
  | { type: 'deleteKeyResult'; krId: number };

/* ── Main OKRPage ── */

export interface OKRPageProps {
  initialQuarter?: string;
}

function OKRPage({ initialQuarter }: OKRPageProps) {
  const [quarter, setQuarter] = useState(() => initialQuarter ?? getQuarter(new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [error, setError] = useState('');

  // Filter out "其他" (isDefault=true) for Objective category selection
  const selectableCategories = useMemo(
    () => categories.filter((c) => !c.isDefault),
    [categories],
  );

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const fetchData = useCallback(async (q: string, silent = false) => {
    if (!silent) { setLoading(true); setError(''); }
    try {
      const [cats, okrData] = await Promise.all([
        apiClient.categories.list(),
        apiClient.okr.getByQuarter(q),
      ]);
      setCategories(cats);
      setObjectives(okrData.objectives);
    } catch {
      setError('加载 OKR 数据失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(quarter);
  }, [quarter, fetchData]);

  const handlePrevQuarter = () => setQuarter(prevQuarter(quarter));
  const handleNextQuarter = () => setQuarter(nextQuarter(quarter));

  /* ── Objective CRUD ── */

  const handleCreateObjective = async (data: { categoryId: number; title: string; description: string }) => {
    try {
      const dto: CreateObjectiveDTO = { ...data, quarter };
      await apiClient.okr.createObjective(dto);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('创建 Objective 失败');
    }
  };

  const handleUpdateObjective = async (id: number, data: { categoryId: number; title: string; description: string }) => {
    try {
      const dto: UpdateObjectiveDTO = data;
      await apiClient.okr.updateObjective(id, dto);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('更新 Objective 失败');
    }
  };

  const handleDeleteObjective = async (id: number) => {
    try {
      await apiClient.okr.deleteObjective(id);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('删除 Objective 失败');
    }
  };

  /* ── Key Result CRUD ── */

  const handleCreateKeyResult = async (objectiveId: number, description: string) => {
    try {
      const dto: CreateKeyResultDTO = { objectiveId, description };
      await apiClient.okr.createKeyResult(dto);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('创建 Key Result 失败');
    }
  };

  const handleUpdateKeyResult = async (id: number, data: UpdateKeyResultDTO) => {
    try {
      await apiClient.okr.updateKeyResult(id, data);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('更新 Key Result 失败');
    }
  };

  const handleDeleteKeyResult = async (id: number) => {
    try {
      await apiClient.okr.deleteKeyResult(id);
      setModal({ type: 'none' });
      fetchData(quarter, true);
    } catch {
      setError('删除 Key Result 失败');
    }
  };

  const handleUpdateProgress = (id: number, progress: number) => {
    handleUpdateKeyResult(id, { progress });
  };

  /* ── Render ── */

  if (loading) {
    return (
      <div className="okr-page">
        <div className="loading-overlay">
          <div className="loading-spinner loading-spinner--lg" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="okr-page">
      <QuarterSelector quarter={quarter} onPrev={handlePrevQuarter} onNext={handleNextQuarter} />

      {error && <div className="auth-error mt-md">{error}</div>}

      <div className="okr-page__toolbar">
        <button className="btn btn-primary" onClick={() => setModal({ type: 'createObjective' })}>
          + 新增 Objective
        </button>
      </div>

      {objectives.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <p>本季度暂无 OKR，点击上方按钮新增目标</p>
        </div>
      ) : (
        <div className="okr-page__cards">
          {objectives.map((obj) => (
            <ObjectiveCard
              key={obj.id}
              objective={obj}
              category={categoryMap.get(obj.categoryId)}
              onEditObjective={(o) => setModal({ type: 'editObjective', objective: o })}
              onDeleteObjective={(id) => setModal({ type: 'deleteObjective', objectiveId: id })}
              onAddKeyResult={(oid) => setModal({ type: 'createKeyResult', objectiveId: oid })}
              onUpdateProgress={handleUpdateProgress}
              onEditKeyResult={(kr) => setModal({ type: 'editKeyResult', kr })}
              onDeleteKeyResult={(id) => setModal({ type: 'deleteKeyResult', krId: id })}
              onMilestoneChanged={() => fetchData(quarter, true)}
            />
          ))}
        </div>
      )}

      {/* Milestone Panel */}
      <MilestonePanel onMilestonesSaved={() => fetchData(quarter, true)} />

      {/* ── Modals ── */}

      {modal.type === 'createObjective' && (
        <ObjectiveForm
          categories={selectableCategories}
          onSubmit={handleCreateObjective}
          onCancel={() => setModal({ type: 'none' })}
          submitLabel="新增 Objective"
        />
      )}

      {modal.type === 'editObjective' && (
        <ObjectiveForm
          categories={selectableCategories}
          initial={{
            categoryId: modal.objective.categoryId,
            title: modal.objective.title,
            description: modal.objective.description,
          }}
          onSubmit={(data) => handleUpdateObjective(modal.objective.id, data)}
          onCancel={() => setModal({ type: 'none' })}
          submitLabel="保存修改"
        />
      )}

      {modal.type === 'deleteObjective' && (
        <ConfirmDialog
          message="确定要删除此 Objective 吗？其下所有 Key Result 也将被删除。"
          onConfirm={() => handleDeleteObjective(modal.objectiveId)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'createKeyResult' && (
        <KeyResultForm
          onSubmit={(desc) => handleCreateKeyResult(modal.objectiveId, desc)}
          onCancel={() => setModal({ type: 'none' })}
          submitLabel="添加 Key Result"
        />
      )}

      {modal.type === 'editKeyResult' && (
        <KeyResultForm
          initial={{ description: modal.kr.description }}
          onSubmit={(desc) => handleUpdateKeyResult(modal.kr.id, { description: desc })}
          onCancel={() => setModal({ type: 'none' })}
          submitLabel="保存修改"
        />
      )}

      {modal.type === 'deleteKeyResult' && (
        <ConfirmDialog
          message="确定要删除此 Key Result 吗？"
          onConfirm={() => handleDeleteKeyResult(modal.krId)}
          onCancel={() => setModal({ type: 'none' })}
        />
      )}
    </div>
  );
}

export default OKRPage;
