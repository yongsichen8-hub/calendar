import { describe, it, expect } from 'vitest';
import {
  shouldTriggerReminder,
  getTimeSlotForReminder,
  createReminderState,
  snoozeReminder,
  skipReminder,
  isReminderSnoozed,
  isReminderSkipped,
} from '../reminderUtils';

describe('reminderUtils', () => {
  // ============================================================
  // shouldTriggerReminder
  // ============================================================
  describe('shouldTriggerReminder', () => {
    it('returns true for trigger times', () => {
      // Monday 10:00
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 10, 0))).toBe(true);
      // Wednesday 13:00
      expect(shouldTriggerReminder(new Date(2025, 0, 8, 13, 0))).toBe(true);
      // Thursday 18:00
      expect(shouldTriggerReminder(new Date(2025, 0, 9, 18, 0))).toBe(true);
      // Thursday 18:30 (last reminder)
      expect(shouldTriggerReminder(new Date(2025, 0, 9, 18, 30))).toBe(true);
    });

    it('returns true within 5-minute window after trigger time', () => {
      // Monday 10:03 (within window of 10:00)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 10, 3))).toBe(true);
      // Monday 18:33 (within window of 18:30)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 18, 33))).toBe(true);
    });

    it('returns false for non-trigger times', () => {
      // Monday 9:00 (not a trigger time)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 9, 0))).toBe(false);
      // Monday 10:30 (outside any window)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 10, 30))).toBe(false);
      // Monday 19:00 (after last reminder)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 19, 0))).toBe(false);
      // Monday 20:00 (after last reminder)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 20, 0))).toBe(false);
      // Monday 21:00 (after last reminder)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 21, 0))).toBe(false);
      // Monday 8:00
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 8, 0))).toBe(false);
      // Monday 10:05 (just outside 5-min window)
      expect(shouldTriggerReminder(new Date(2025, 0, 6, 10, 5))).toBe(false);
    });

    it('returns true for weekends at trigger times', () => {
      // Saturday 10:00
      expect(shouldTriggerReminder(new Date(2025, 0, 4, 10, 0))).toBe(true);
      // Sunday 13:00
      expect(shouldTriggerReminder(new Date(2025, 0, 5, 13, 0))).toBe(true);
    });

    it('returns true for all 10 trigger times', () => {
      const triggerTimes = [
        [10, 0], [11, 0], [12, 0], [13, 0], [14, 0],
        [15, 0], [16, 0], [17, 0], [18, 0], [18, 30],
      ];
      // Tuesday 2025-01-07
      for (const [h, m] of triggerTimes) {
        expect(shouldTriggerReminder(new Date(2025, 0, 7, h, m))).toBe(true);
      }
    });
  });

  // ============================================================
  // getTimeSlotForReminder
  // ============================================================
  describe('getTimeSlotForReminder', () => {
    it('maps trigger times to correct previous time slots', () => {
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 10, 0))).toBe('09:00-10:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 11, 0))).toBe('10:00-11:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 12, 0))).toBe('11:00-12:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 13, 0))).toBe('12:00-13:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 14, 0))).toBe('13:00-14:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 15, 0))).toBe('14:00-15:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 16, 0))).toBe('15:00-16:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 17, 0))).toBe('16:00-17:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 18, 0))).toBe('17:00-18:00');
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 18, 30))).toBe('18:00-19:00');
    });

    it('maps times within window to correct slots', () => {
      // 10:03 is within 10:00 window → still maps to 09:00-10:00
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 10, 3))).toBe('09:00-10:00');
      // 18:33 is within 18:30 window → maps to 18:00-19:00
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 18, 33))).toBe('18:00-19:00');
    });

    it('returns null for non-trigger times', () => {
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 9, 0))).toBeNull();
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 10, 15))).toBeNull();
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 22, 0))).toBeNull();
      expect(getTimeSlotForReminder(new Date(2025, 0, 6, 0, 0))).toBeNull();
    });
  });

  // ============================================================
  // createReminderState
  // ============================================================
  describe('createReminderState', () => {
    it('creates empty state with Set and Map', () => {
      const state = createReminderState();
      expect(state.skipped).toBeInstanceOf(Set);
      expect(state.snoozed).toBeInstanceOf(Map);
      expect(state.skipped.size).toBe(0);
      expect(state.snoozed.size).toBe(0);
    });
  });

  // ============================================================
  // snoozeReminder / isReminderSnoozed
  // ============================================================
  describe('snooze reminder', () => {
    it('marks a key as snoozed and suppresses within 15 min', () => {
      const state = createReminderState();
      const key = '2025-01-06_09:00-10:00';

      snoozeReminder(state, key);

      // Immediately after snooze → still snoozed
      const now = new Date();
      expect(isReminderSnoozed(state, key, now)).toBe(true);
    });

    it('snooze expires after 15 minutes', () => {
      const state = createReminderState();
      const key = '2025-01-06_09:00-10:00';

      snoozeReminder(state, key);

      // 16 minutes later → no longer snoozed
      const later = new Date(Date.now() + 16 * 60 * 1000);
      expect(isReminderSnoozed(state, key, later)).toBe(false);
    });

    it('returns false for non-snoozed key', () => {
      const state = createReminderState();
      expect(isReminderSnoozed(state, '2025-01-06_09:00-10:00', new Date())).toBe(false);
    });
  });

  // ============================================================
  // skipReminder / isReminderSkipped
  // ============================================================
  describe('skip reminder', () => {
    it('permanently skips a time slot', () => {
      const state = createReminderState();
      const key = '2025-01-06_09:00-10:00';

      skipReminder(state, key);
      expect(isReminderSkipped(state, key)).toBe(true);
    });

    it('skip persists regardless of time', () => {
      const state = createReminderState();
      const key = '2025-01-06_09:00-10:00';

      skipReminder(state, key);

      // Even far in the future, still skipped
      expect(isReminderSkipped(state, key)).toBe(true);
    });

    it('returns false for non-skipped key', () => {
      const state = createReminderState();
      expect(isReminderSkipped(state, '2025-01-06_09:00-10:00')).toBe(false);
    });

    it('can skip multiple different keys', () => {
      const state = createReminderState();
      const key1 = '2025-01-06_09:00-10:00';
      const key2 = '2025-01-06_10:00-11:00';

      skipReminder(state, key1);
      skipReminder(state, key2);

      expect(isReminderSkipped(state, key1)).toBe(true);
      expect(isReminderSkipped(state, key2)).toBe(true);
      expect(isReminderSkipped(state, '2025-01-06_11:00-12:00')).toBe(false);
    });
  });
});
