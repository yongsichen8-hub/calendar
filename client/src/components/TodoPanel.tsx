import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/api/client';
import type { TodoItem } from '@/types';

function getToday(): { display: string; iso: string } {
  const d = new Date();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const iso = `${d.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { display: `${month}月${day}日 待办`, iso };
}

function formatDeadline(deadline: string): string {
  const [, m, d] = deadline.split('-').map(Number);
  return `${m}/${d}`;
}

function TodoPanel() {
  const { display, iso } = getToday();

  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [input, setInput] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deadlineReminders, setDeadlineReminders] = useState<TodoItem[]>([]);
  const [dismissedReminders, setDismissedReminders] = useState<Set<number>>(new Set());

  const loadTodos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await apiClient.todos.getByDate(iso);
      setTodos(items);
    } catch {
      setError('加载待办失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [iso]);

  // Check deadline reminders at noon
  const checkDeadlineReminders = useCallback(async () => {
    const now = new Date();
    const hour = now.getHours();
    // Show reminders from 12:00 onwards
    if (hour >= 12) {
      try {
        const reminders = await apiClient.todos.getDeadlineReminders();
        setDeadlineReminders(reminders);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    loadTodos();
    checkDeadlineReminders();
    // Re-check every 10 minutes
    const interval = setInterval(checkDeadlineReminders, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadTodos, checkDeadlineReminders]);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const newTodo = await apiClient.todos.create(iso, trimmed, deadline || undefined);
      setTodos((prev) => [...prev, newTodo]);
      setInput('');
      setDeadline('');
    } catch {
      setError('添加待办失败，请稍后重试');
    }
  }, [input, iso, deadline]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleToggleCompleted = useCallback(async (todo: TodoItem) => {
    setError(null);
    try {
      const updated = await apiClient.todos.updateCompleted(todo.id, !todo.completed);
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError('更新状态失败，请稍后重试');
    }
  }, []);

  const handlePostpone = useCallback(async (id: number) => {
    setError(null);
    try {
      await apiClient.todos.postpone(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('延后待办失败，请稍后重试');
    }
  }, []);

  const handleDelete = useCallback(async (id: number) => {
    setError(null);
    try {
      await apiClient.todos.delete(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('删除待办失败，请稍后重试');
    }
  }, []);

  const handleDismissReminder = (id: number) => {
    setDismissedReminders((prev) => new Set(prev).add(id));
  };

  const visibleReminders = deadlineReminders.filter((r) => !dismissedReminders.has(r.id));

  return (
    <div className="todo-panel">
      <div className="todo-panel-header">
        <h3>{display}</h3>
      </div>

      <div className="todo-input-area">
        <input
          className="input"
          placeholder="添加待办..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="btn btn-primary btn-sm" onClick={handleSubmit}>
          +
        </button>
      </div>
      <div className="todo-deadline-row">
        <label className="todo-deadline-label">DDL</label>
        <input
          type="date"
          className="input input-sm todo-deadline-input"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          aria-label="截止日期"
        />
      </div>

      {error && (
        <div className="auth-error" role="alert">
          {error}
        </div>
      )}

      {visibleReminders.length > 0 && (
        <div className="todo-deadline-reminders">
          {visibleReminders.map((r) => (
            <div key={r.id} className="todo-deadline-reminder">
              <span>⏰ 「{r.content}」明天截止 (DDL: {r.deadline})</span>
              <button className="btn-icon" onClick={() => handleDismissReminder(r.id)} title="关闭">✕</button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}

      {!loading && todos.length === 0 && (
        <div className="empty-state">
          <p>今天还没有待办事项</p>
        </div>
      )}

      {todos.length > 0 && (
        <div className="todo-list">
          {todos.map((todo) => (
            <div className="todo-item" key={todo.id}>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => handleToggleCompleted(todo)}
              />
              <div className="todo-item__text">
                <span className={todo.completed ? 'completed' : ''}>
                  {todo.content}
                </span>
                {todo.deadline && (
                  <span className="todo-item__deadline" title={`截止: ${todo.deadline}`}>
                    📅 {formatDeadline(todo.deadline)}
                  </span>
                )}
              </div>
              {!todo.completed && (
                <button
                  className="btn-icon"
                  title="延后到明天"
                  onClick={() => handlePostpone(todo.id)}
                >
                  →
                </button>
              )}
              <button
                className="btn-icon"
                title="删除"
                onClick={() => handleDelete(todo.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TodoPanel;
