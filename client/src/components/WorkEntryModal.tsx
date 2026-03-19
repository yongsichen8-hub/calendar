import { useState } from 'react';
import { apiClient } from '@/api/client';
import type { WorkEntry, Category, CreateWorkEntryDTO } from '@/types';

interface NewEntryForm {
  categoryId: number;
  subCategory: string;
  description: string;
}

function createEmptyForm(categories: Category[]): NewEntryForm {
  return {
    categoryId: categories.length > 0 ? categories[0].id : 0,
    subCategory: '',
    description: '',
  };
}

export interface WorkEntryModalProps {
  date: string;
  timeSlot: string;
  existingEntries: WorkEntry[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

function WorkEntryModal({
  date,
  timeSlot,
  existingEntries,
  categories,
  onClose,
  onSaved,
}: WorkEntryModalProps) {
  const [entries, setEntries] = useState<WorkEntry[]>(existingEntries);
  const [newForms, setNewForms] = useState<NewEntryForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const categoryMap = new Map<number, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  const handleAddForm = () => {
    setNewForms((prev) => [...prev, createEmptyForm(categories)]);
  };

  const handleFormChange = (index: number, field: keyof NewEntryForm, value: string | number) => {
    setNewForms((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRemoveForm = (index: number) => {
    setNewForms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const entriesToSave: CreateWorkEntryDTO[] = newForms.map((form) => ({
      date,
      timeSlot,
      categoryId: form.categoryId,
      subCategory: form.subCategory,
      description: form.description,
    }));

    if (entriesToSave.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    setError('');
    try {
      await apiClient.workEntries.save(entriesToSave);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    try {
      await apiClient.workEntries.delete(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败，请重试');
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content work-entry-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{date} {timeSlot}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="关闭">✕</button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error mb-md">{error}</div>}

          {entries.length > 0 && (
            <div className="existing-entries mb-md">
              <div className="form-label mb-sm">已有条目</div>
              {entries.map((entry) => {
                const cat = categoryMap.get(entry.categoryId);
                return (
                  <div key={entry.id} className="existing-entry">
                    <span
                      className="existing-entry__color"
                      style={{ backgroundColor: cat?.color ?? '#e0e0e0' }}
                    />
                    <span className="existing-entry__category">{cat?.name ?? '未知'}</span>
                    {entry.subCategory && (
                      <span className="existing-entry__sub">/ {entry.subCategory}</span>
                    )}
                    <span className="existing-entry__desc">{entry.description}</span>
                    <button
                      className="btn btn-danger btn-sm existing-entry__delete"
                      onClick={() => setConfirmDeleteId(entry.id)}
                    >
                      删除
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {newForms.map((form, index) => (
            <div key={index} className="entry-form mb-md">
              <div className="entry-form__header">
                <span className="form-label">新条目 {index + 1}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleRemoveForm(index)}
                >
                  移除
                </button>
              </div>
              <div className="form-group">
                <label className="form-label">分类</label>
                <select
                  className="select"
                  value={form.categoryId}
                  onChange={(e) => handleFormChange(index, 'categoryId', Number(e.target.value))}
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">子分类</label>
                <input
                  className="input"
                  type="text"
                  placeholder="子分类（可选）"
                  value={form.subCategory}
                  onChange={(e) => handleFormChange(index, 'subCategory', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">描述</label>
                <textarea
                  className="textarea"
                  placeholder="工作内容描述"
                  value={form.description}
                  onChange={(e) => handleFormChange(index, 'description', e.target.value)}
                />
              </div>
            </div>
          ))}

          <button className="btn btn-secondary w-full" onClick={handleAddForm}>
            + 添加条目
          </button>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || newForms.length === 0}
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      {confirmDeleteId !== null && (
        <div className="modal-overlay" onClick={() => setConfirmDeleteId(null)}>
          <div className="modal-content modal-content--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>确认删除</h3>
            </div>
            <div className="modal-body">
              <p>确定要删除这条工作记录吗？此操作不可撤销。</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setConfirmDeleteId(null)}>取消</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkEntryModal;
