import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiClient } from '@/api/client';
import { getWeekRange, getNextWeek, getPrevWeek, formatDateRange, TIME_SLOTS } from '@/utils/dateUtils';
import WorkEntryModal from '@/components/WorkEntryModal';
import AISummaryPanel from '@/components/AISummaryPanel';
import TodoPanel from '@/components/TodoPanel';
import type { Category, WorkEntry } from '@/types';

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function getTodayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayHeader(dateStr: string, label: string): string {
  const parts = dateStr.split('-');
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${label} ${month}/${day}`;
}

export interface CalendarPageProps {
  initialDate?: Date;
}

function CalendarPage({ initialDate }: CalendarPageProps) {
  const [weekRange, setWeekRange] = useState(() => getWeekRange(initialDate ?? new Date()));
  const [categories, setCategories] = useState<Category[]>([]);
  const [entries, setEntries] = useState<WorkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<{ date: string; timeSlot: string } | null>(null);
  const [dragData, setDragData] = useState<{ categoryId: number; subCategory: string; description: string } | null>(null);

  const todayISO = useMemo(() => getTodayISO(), []);

  const categoryMap = useMemo(() => {
    const map = new Map<number, Category>();
    for (const cat of categories) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  const entryMap = useMemo(() => {
    const map = new Map<string, WorkEntry[]>();
    for (const entry of entries) {
      const key = `${entry.date}_${entry.timeSlot}`;
      const list = map.get(key);
      if (list) {
        list.push(entry);
      } else {
        map.set(key, [entry]);
      }
    }
    return map;
  }, [entries]);

  const fetchData = useCallback(async (weekStart: string) => {
    setLoading(true);
    try {
      const [cats, wEntries] = await Promise.all([
        apiClient.categories.list(),
        apiClient.workEntries.getByWeek(weekStart),
      ]);
      setCategories(cats);
      setEntries(wEntries);
    } catch {
      // silently handle - user sees empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(weekRange.start);
  }, [weekRange.start, fetchData]);

  const handlePrevWeek = () => {
    const prevStart = getPrevWeek(weekRange.start);
    setWeekRange(getWeekRange(new Date(prevStart + 'T00:00:00')));
  };

  const handleNextWeek = () => {
    const nextStart = getNextWeek(weekRange.start);
    setWeekRange(getWeekRange(new Date(nextStart + 'T00:00:00')));
  };

  const handleCellClick = (date: string, timeSlot: string) => {
    setSelectedCell({ date, timeSlot });
  };

  const getEntriesForCell = (date: string, timeSlot: string): WorkEntry[] => {
    return entryMap.get(`${date}_${timeSlot}`) ?? [];
  };

  const handleDragStart = (entry: WorkEntry) => {
    setDragData({
      categoryId: entry.categoryId,
      subCategory: entry.subCategory,
      description: entry.description,
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (dragData) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = async (e: React.DragEvent, date: string, timeSlot: string) => {
    e.preventDefault();
    if (!dragData) return;
    try {
      await apiClient.workEntries.save([{
        date,
        timeSlot,
        categoryId: dragData.categoryId,
        subCategory: dragData.subCategory,
        description: dragData.description,
      }]);
      fetchData(weekRange.start);
    } catch { /* ignore */ }
    setDragData(null);
  };

  const handleDragEnd = () => {
    setDragData(null);
  };

  if (loading) {
    return (
      <div className="calendar-page">
        <TodoPanel />
        <div className="calendar-content">
          <div className="loading-overlay">
            <div className="loading-spinner loading-spinner--lg" />
            <span>加载中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <TodoPanel />
      <div className="calendar-content">
      <div className="week-navigator">
        <button
          className="btn btn-secondary btn-sm"
          onClick={handlePrevWeek}
          aria-label="上一周"
        >
          ← 上一周
        </button>
        <span className="week-navigator__range">
          {formatDateRange(weekRange.start, weekRange.end)}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          onClick={handleNextWeek}
          aria-label="下一周"
        >
          下一周 →
        </button>
      </div>

      <div className="calendar-grid-wrapper">
        <table className="calendar-grid" role="grid">
          <thead>
            <tr>
              <th className="time-header time-header--corner">时间</th>
              {weekRange.dates.map((date, i) => (
                <th
                  key={date}
                  className={`day-header${date === todayISO ? ' day-header--today' : ''}`}
                >
                  {formatDayHeader(date, DAY_LABELS[i])}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIME_SLOTS.map((slot) => (
              <tr key={slot}>
                <td className="time-header">{slot}</td>
                {weekRange.dates.map((date) => {
                  const cellEntries = getEntriesForCell(date, slot);
                  const isToday = date === todayISO;
                  return (
                    <td
                      key={`${date}_${slot}`}
                      className={`time-slot-cell${isToday ? ' time-slot-cell--today' : ''}`}
                      onClick={() => handleCellClick(date, slot)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, date, slot)}
                      role="gridcell"
                      aria-label={`${date} ${slot}`}
                    >
                      {cellEntries.length === 0 ? (
                        <span className="time-slot-cell__empty">+</span>
                      ) : (
                        cellEntries.map((entry) => {
                          const cat = categoryMap.get(entry.categoryId);
                          return (
                            <div
                              key={entry.id}
                              className="entry-badge"
                              title={`${entry.description} (拖拽复制到其他格子)`}
                              draggable
                              onDragStart={() => handleDragStart(entry)}
                              onDragEnd={handleDragEnd}
                            >
                              <span
                                className="entry-badge__color"
                                style={{ backgroundColor: cat?.color ?? '#e0e0e0' }}
                              />
                              <span className="entry-badge__text">
                                {entry.description
                                  ? entry.description.length > 12
                                    ? entry.description.slice(0, 12) + '…'
                                    : entry.description
                                  : cat?.name ?? ''}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AISummaryPanel />

      {selectedCell && (
        <WorkEntryModal
          date={selectedCell.date}
          timeSlot={selectedCell.timeSlot}
          existingEntries={getEntriesForCell(selectedCell.date, selectedCell.timeSlot)}
          categories={categories}
          onClose={() => setSelectedCell(null)}
          onSaved={() => {
            setSelectedCell(null);
            fetchData(weekRange.start);
          }}
        />
      )}
      </div>
    </div>
  );
}

export default CalendarPage;
