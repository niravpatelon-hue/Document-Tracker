import {
  addDays,
  addMonths,
  computeStatus,
  daysBetween,
  dueReminders,
  parseISODate,
  reminderSchedule,
  resolveTriggerDate,
} from './status';

describe('date arithmetic', () => {
  it('adds months clamping to month end (leap-aware)', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-01-15', 13)).toBe('2025-02-15');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
  });

  it('adds days across month/year boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-01-01', -1)).toBe('2023-12-31');
  });

  it('computes signed day differences', () => {
    expect(daysBetween('2024-01-01', '2024-01-31')).toBe(30);
    expect(daysBetween('2024-01-31', '2024-01-01')).toBe(-30);
  });

  it('rejects non-calendar dates', () => {
    expect(() => parseISODate('2024-02-30')).toThrow();
    expect(() => parseISODate('2024-13-01')).toThrow();
    expect(() => parseISODate('not-a-date')).toThrow();
  });
});

describe('resolveTriggerDate', () => {
  it('returns the fixed date directly', () => {
    expect(
      resolveTriggerDate({ triggerType: 'fixed_date', triggerDate: '2025-01-01' }),
    ).toBe('2025-01-01');
  });

  it('derives a duration-based expiry from the purchase date', () => {
    expect(
      resolveTriggerDate({
        triggerType: 'duration_from_purchase',
        anchorDate: '2024-01-15',
        durationMonths: 12,
      }),
    ).toBe('2025-01-15');
  });

  it('returns null when duration inputs are missing', () => {
    expect(
      resolveTriggerDate({ triggerType: 'duration_from_purchase', anchorDate: '2024-01-15' }),
    ).toBeNull();
  });
});

describe('computeStatus', () => {
  const trigger = '2025-01-01';
  it('is active well before expiry', () => {
    expect(computeStatus(trigger, '2024-01-01')).toBe('active');
  });
  it('is expiring_soon within the window', () => {
    expect(computeStatus(trigger, '2024-12-20')).toBe('expiring_soon');
  });
  it('is expiring_soon on the trigger day itself', () => {
    expect(computeStatus(trigger, '2025-01-01')).toBe('expiring_soon');
  });
  it('is expired the day after', () => {
    expect(computeStatus(trigger, '2025-01-02')).toBe('expired');
  });
});

describe('reminders', () => {
  it('schedules reminders as trigger-minus-offset, earliest first', () => {
    const schedule = reminderSchedule('2025-01-01', [30, 15, 7, 1]);
    expect(schedule).toEqual([
      { offsetDays: 30, dateISO: '2024-12-02' },
      { offsetDays: 15, dateISO: '2024-12-17' },
      { offsetDays: 7, dateISO: '2024-12-25' },
      { offsetDays: 1, dateISO: '2024-12-31' },
    ]);
  });

  it('reports only reminders whose date has arrived and item not expired', () => {
    const due = dueReminders('2025-01-01', '2024-12-18', [30, 15, 7, 1]);
    expect(due.map((d) => d.offsetDays)).toEqual([30, 15]);
  });

  it('reports no reminders once expired', () => {
    expect(dueReminders('2025-01-01', '2025-02-01')).toEqual([]);
  });
});
