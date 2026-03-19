import { useState, useEffect, useRef, useCallback } from 'react';
import {
  shouldTriggerReminder,
  getTimeSlotForReminder,
  createReminderState,
  snoozeReminder,
  skipReminder,
  isReminderSnoozed,
  isReminderSkipped,
} from '../utils/reminderUtils';
import type { ReminderState } from '../types';

const CHECK_INTERVAL_MS = 60_000; // 1 minute

export interface ActiveReminder {
  key: string;      // "YYYY-MM-DD_HH:MM-HH:MM"
  timeSlot: string; // "09:00-10:00"
  date: string;     // "YYYY-MM-DD"
}

export interface UseReminderResult {
  activeReminder: ActiveReminder | null;
  snooze: () => void;
  skip: () => void;
  dismiss: () => void;
  notificationPermission: NotificationPermission | 'unsupported';
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') {
    return Promise.resolve('unsupported');
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission();
}

// 注册 Service Worker 以支持后台通知
let swRegistration: ServiceWorkerRegistration | null = null;

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  } catch {
    // SW registration may fail in dev or insecure contexts
  }
}

function showDesktopNotification(timeSlot: string): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  const title = '⏰ 工时填写提醒';
  const body = `请填写过去一小时的工作内容：${timeSlot}`;
  const tag = `workhour-${timeSlot}-${Date.now()}`;

  // 优先使用 Service Worker 发送通知（支持后台/最小化场景）
  if (swRegistration?.active) {
    swRegistration.showNotification(title, {
      body,
      tag,
      requireInteraction: true,
    }).catch(() => {
      // fallback to regular Notification
      showFallbackNotification(title, body, tag);
    });
  } else {
    showFallbackNotification(title, body, tag);
  }
}

function showFallbackNotification(title: string, body: string, tag: string): void {
  try {
    const notification = new Notification(title, { body, tag, requireInteraction: true });
    notification.onclick = () => {
      window.focus();
      if (!window.location.pathname.includes('/calendar')) {
        window.location.href = '/calendar';
      }
      notification.close();
    };
  } catch {
    // ignore
  }
}

/**
 * useReminder hook - manages the reminder lifecycle.
 * @param filledSlots - Set of slot keys ("YYYY-MM-DD_HH:MM-HH:MM") that already have work entries
 * @param enabled - whether the reminder service should be active (e.g., user is authenticated)
 */
export function useReminder(
  filledSlots: Set<string>,
  enabled: boolean,
): UseReminderResult {
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const stateRef = useRef<ReminderState>(createReminderState());

  // Request notification permission and register SW on mount when enabled
  useEffect(() => {
    if (!enabled) return;
    requestNotificationPermission().then(setNotificationPermission);
    registerServiceWorker();
  }, [enabled]);

  // Check function
  const checkReminder = useCallback(() => {
    const now = new Date();
    if (!shouldTriggerReminder(now)) return;

    const timeSlot = getTimeSlotForReminder(now);
    if (!timeSlot) return;

    const dateStr = formatDate(now);
    const key = `${dateStr}_${timeSlot}`;

    // Skip if already filled
    if (filledSlots.has(key)) return;

    // Skip if snoozed or skipped
    const state = stateRef.current;
    if (isReminderSnoozed(state, key, now)) return;
    if (isReminderSkipped(state, key)) return;

    // Show reminder
    setActiveReminder({ key, timeSlot, date: dateStr });
    showDesktopNotification(timeSlot);
  }, [filledSlots]);

  // Set up interval
  useEffect(() => {
    if (!enabled) {
      setActiveReminder(null);
      return;
    }

    // Check immediately on mount
    checkReminder();

    const intervalId = setInterval(checkReminder, CHECK_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [enabled, checkReminder]);

  const snoozeAction = useCallback(() => {
    if (activeReminder) {
      snoozeReminder(stateRef.current, activeReminder.key);
      setActiveReminder(null);
    }
  }, [activeReminder]);

  const skipAction = useCallback(() => {
    if (activeReminder) {
      skipReminder(stateRef.current, activeReminder.key);
      setActiveReminder(null);
    }
  }, [activeReminder]);

  const dismiss = useCallback(() => {
    setActiveReminder(null);
  }, []);

  return {
    activeReminder,
    snooze: snoozeAction,
    skip: skipAction,
    dismiss,
    notificationPermission,
  };
}
