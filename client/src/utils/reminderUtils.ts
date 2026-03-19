/**
 * 提醒工具函数
 * 用于工作时间提醒的触发判定、时间段计算和状态管理
 */

import type { ReminderState } from '../types';

/** 提醒触发时间点（小时:分钟） — 18:30 为最后一次提醒 */
const TRIGGER_TIMES: ReadonlyArray<{ hour: number; minute: number }> = [
  { hour: 10, minute: 0 },
  { hour: 11, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 0 },
  { hour: 18, minute: 0 },
  { hour: 18, minute: 30 },
];

/** 触发时间 → 对应的前一个时间段 */
const TRIGGER_TO_SLOT: ReadonlyMap<string, string> = new Map([
  ['10:00', '09:00-10:00'],
  ['11:00', '10:00-11:00'],
  ['12:00', '11:00-12:00'],
  ['13:00', '12:00-13:00'],
  ['14:00', '13:00-14:00'],
  ['15:00', '14:00-15:00'],
  ['16:00', '15:00-16:00'],
  ['17:00', '16:00-17:00'],
  ['18:00', '17:00-18:00'],
  ['18:30', '18:00-19:00'],
]);

/** 延迟提醒时长（毫秒）：15 分钟 */
const SNOOZE_DURATION_MS = 15 * 60 * 1000;

/**
 * 判断给定日期时间是否处于提醒触发窗口内。
 * 在指定时间点后5分钟内返回 true。
 * 使用窗口而非精确匹配，避免1分钟检查间隔错过触发时间。
 */
export function shouldTriggerReminder(date: Date): boolean {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  return TRIGGER_TIMES.some((t) => {
    const triggerMinutes = t.hour * 60 + t.minute;
    return totalMinutes >= triggerMinutes && totalMinutes < triggerMinutes + 5;
  });
}

/**
 * 计算提醒触发时间对应的时间段字符串。
 * 返回前一个小时的时间段，如 10:00~10:04 → "09:00-10:00"。
 * 非触发窗口内返回 null。
 */
export function getTimeSlotForReminder(date: Date): string | null {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();

  for (const t of TRIGGER_TIMES) {
    const triggerMinutes = t.hour * 60 + t.minute;
    if (totalMinutes >= triggerMinutes && totalMinutes < triggerMinutes + 5) {
      const key = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
      return TRIGGER_TO_SLOT.get(key) ?? null;
    }
  }
  return null;
}

/**
 * 创建初始空提醒状态。
 */
export function createReminderState(): ReminderState {
  return {
    skipped: new Set<string>(),
    snoozed: new Map<string, number>(),
  };
}

/**
 * 延迟提醒：标记某个时间段为 snoozed，15 分钟后恢复。
 * @param state 提醒状态
 * @param key 时间段键，格式 "YYYY-MM-DD_HH:MM-HH:MM"
 */
export function snoozeReminder(state: ReminderState, key: string): void {
  state.snoozed.set(key, Date.now() + SNOOZE_DURATION_MS);
}

/**
 * 永久跳过提醒：标记某个时间段为 skipped。
 * @param state 提醒状态
 * @param key 时间段键，格式 "YYYY-MM-DD_HH:MM-HH:MM"
 */
export function skipReminder(state: ReminderState, key: string): void {
  state.skipped.add(key);
}

/**
 * 检查某个时间段是否处于延迟提醒状态（snoozed 且未过期）。
 */
export function isReminderSnoozed(state: ReminderState, key: string, now: Date): boolean {
  const snoozeUntil = state.snoozed.get(key);
  if (snoozeUntil === undefined) return false;
  return now.getTime() < snoozeUntil;
}

/**
 * 检查某个时间段是否已被永久跳过。
 */
export function isReminderSkipped(state: ReminderState, key: string): boolean {
  return state.skipped.has(key);
}
