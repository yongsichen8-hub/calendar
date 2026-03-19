import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../api/client';
import type { CategoryWithCount } from '../types';

const COLOR_CLASS_MAP: Record<string, string> = {
  '#f5c6c6': 'category-tag--pink',
  '#c6ddf5': 'category-tag--blue',
  '#c6f5d5': 'category-tag--green',
  '#f5ecc6': 'category-tag--yellow',
  '#dcc6f5': 'category-tag--purple',
  '#f5d6c6': 'category-tag--orange',
  '#c6f5ef': 'category-tag--mint',
  '#f5d1c6': 'category-tag--peach',
  '#e0c6f5': 'category-tag--lavender',
  '#f5c6d6': 'category-tag--rose',
  '#c6e8f5': 'category-tag--sky',
};

function getColorClass(color: string): string {
  return COLOR_CLASS_MAP[color] || '';
}

function CategoryManagementPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add form
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<CategoryWithCount | null>(null);
  const [migrateToId, setMigrateToId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiClient.categories.list() as unknown as CategoryWithCount[];
      setCategories(data);
    } catch {
      setError('加载分类数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setAddError('请输入分类名称');
      return;
    }
    try {
      setAdding(true);
      setAddError('');
      await apiClient.categories.create(trimmed);
      setNewName('');
      await fetchCategories();
    } catch {
      setAddError('新增分类失败');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (cat: CategoryWithCount) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditError('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditError('分类名称不能为空');
      return;
    }
    try {
      setSaving(true);
      setEditError('');
      await apiClient.categories.update(editingId, trimmed);
      setEditingId(null);
      setEditName('');
      await fetchCategories();
    } catch {
      setEditError('编辑分类失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (cat: CategoryWithCount) => {
    setDeleteTarget(cat);
    setMigrateToId(null);
  };

  const cancelDelete = () => {
    setDeleteTarget(null);
    setMigrateToId(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await apiClient.categories.delete(
        deleteTarget.id,
        migrateToId ?? undefined,
      );
      setDeleteTarget(null);
      setMigrateToId(null);
      await fetchCategories();
    } catch {
      // keep dialog open on error
    } finally {
      setDeleting(false);
    }
  };

  const hasRecords = (cat: CategoryWithCount) =>
    (cat.workEntryCount || 0) + (cat.objectiveCount || 0) > 0;

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-overlay">
          <div className="loading-spinner loading-spinner--lg" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <p className="text-danger">{error}</p>
          <button className="btn btn-secondary mt-md" onClick={fetchCategories}>
            重试
          </button>
        </div>
      </div>
    );
  }

  const migrationOptions = deleteTarget
    ? categories.filter((c) => c.id !== deleteTarget.id)
    : [];

  return (
    <div className="page-container category-management">
      <h2>🏷️ 分类管理</h2>
      <p className="text-secondary mb-lg">管理工作分类，OKR 和日历共用同一套分类体系</p>

      {/* Add category form */}
      <div className="card mb-lg">
        <div className="card-body">
          <div className="flex items-center gap-sm">
            <input
              className="input"
              placeholder="输入新分类名称"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setAddError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              disabled={adding}
            />
            <button
              className="btn btn-primary"
              onClick={handleAdd}
              disabled={adding}
            >
              {adding ? '添加中...' : '新增分类'}
            </button>
          </div>
          {addError && <p className="form-error mt-sm">{addError}</p>}
        </div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <p>暂无分类，请添加一个新分类</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <h3>所有分类</h3>
            <span className="badge badge--info">{categories.length} 个分类</span>
          </div>
          <div className="card-body flex flex-col gap-sm">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="category-row flex items-center gap-sm"
                style={{
                  padding: 'var(--space-sm) var(--space-md)',
                  background: 'var(--bg-cream)',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {/* Color indicator */}
                <span
                  className={`category-tag ${getColorClass(cat.color)}`}
                  style={
                    !getColorClass(cat.color)
                      ? { backgroundColor: cat.color }
                      : undefined
                  }
                >
                  {editingId === cat.id ? '' : cat.name}
                </span>

                {editingId === cat.id ? (
                  /* Edit mode */
                  <div className="flex items-center gap-sm flex-1">
                    <input
                      className="input input-sm"
                      value={editName}
                      onChange={(e) => {
                        setEditName(e.target.value);
                        setEditError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      disabled={saving}
                      autoFocus
                    />
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveEdit}
                      disabled={saving}
                    >
                      保存
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      取消
                    </button>
                    {editError && (
                      <span className="form-error">{editError}</span>
                    )}
                  </div>
                ) : (
                  /* Display mode */
                  <>
                    <span className="flex-1" />
                    <span className="text-sm text-secondary">
                      工时 {cat.workEntryCount ?? 0} · 目标 {cat.objectiveCount ?? 0}
                    </span>
                    {cat.isDefault && (
                      <span className="badge badge--info">默认</span>
                    )}
                    <button
                      className="btn-icon"
                      onClick={() => startEdit(cat)}
                      aria-label={`编辑分类 ${cat.name}`}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    {!cat.isDefault && (
                      <button
                        className="btn-icon"
                        onClick={() => handleDeleteClick(cat)}
                        aria-label={`删除分类 ${cat.name}`}
                        title="删除"
                      >
                        🗑️
                      </button>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete confirmation / migration dialog */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div
            className={`modal-content ${hasRecords(deleteTarget) ? '' : 'modal-content--sm'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>
                {hasRecords(deleteTarget)
                  ? '删除分类 - 记录迁移'
                  : '确认删除'}
              </h3>
            </div>
            <div className="modal-body">
              {hasRecords(deleteTarget) ? (
                <>
                  <p className="mb-md">
                    分类「{deleteTarget.name}」有{' '}
                    <strong>{deleteTarget.workEntryCount ?? 0}</strong> 条工时记录和{' '}
                    <strong>{deleteTarget.objectiveCount ?? 0}</strong> 个目标关联。
                    请选择将这些记录迁移到哪个分类：
                  </p>
                  <select
                    className="select"
                    value={migrateToId ?? ''}
                    onChange={(e) =>
                      setMigrateToId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">请选择迁移目标分类</option>
                    {migrationOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <p>确定要删除分类「{deleteTarget.name}」吗？</p>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={cancelDelete}
                disabled={deleting}
              >
                取消
              </button>
              <button
                className="btn btn-danger"
                onClick={confirmDelete}
                disabled={
                  deleting ||
                  (hasRecords(deleteTarget) && migrateToId == null)
                }
              >
                {deleting ? '删除中...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoryManagementPage;
