import {
  daysUntil,
  estimateCreditScore,
  interestIfUnpaidCents,
  minimumDueCents,
  rewardCoinsFor,
  scoreBand,
  summarizeCards,
  utilization,
  type ScoreInput,
} from './cards';

const TODAY = '2026-07-10';

describe('utilization', () => {
  it('is the outstanding/limit fraction', () => {
    expect(utilization(50000, 100000)).toBeCloseTo(0.5, 10);
  });
  it('clamps above 1 when overspent', () => {
    expect(utilization(150000, 100000)).toBe(1);
  });
  it('clamps below 0 for negative (credit) balances', () => {
    expect(utilization(-5000, 100000)).toBe(0);
  });
  it('is 0 when limit is zero or negative', () => {
    expect(utilization(50000, 0)).toBe(0);
    expect(utilization(50000, -100)).toBe(0);
  });
});

describe('minimumDueCents', () => {
  it('computes 5% rounded by default', () => {
    expect(minimumDueCents(8745000, 5)).toBe(437250);
  });
  it('defaults pct to 5', () => {
    expect(minimumDueCents(8745000)).toBe(437250);
  });
  it('never exceeds the outstanding balance', () => {
    expect(minimumDueCents(1000, 200)).toBe(1000);
  });
  it('is never negative and 0 for 0 balance', () => {
    expect(minimumDueCents(0)).toBe(0);
  });
});

describe('rewardCoinsFor', () => {
  it('floors coins per ₹100 at the given rate', () => {
    expect(rewardCoinsFor(8745000, 2)).toBe(1749);
  });
  it('defaults the rate to 1', () => {
    expect(rewardCoinsFor(8745000)).toBe(874);
  });
  it('is never negative', () => {
    expect(rewardCoinsFor(-5000, 2)).toBe(0);
  });
});

describe('daysUntil', () => {
  it('counts whole days to a future due date', () => {
    expect(daysUntil('2026-07-10', '2026-07-14')).toBe(4);
  });
  it('is 0 on the due date', () => {
    expect(daysUntil('2026-07-10', '2026-07-10')).toBe(0);
  });
  it('is negative when overdue', () => {
    expect(daysUntil('2026-07-10', '2026-07-05')).toBe(-5);
  });
  it('does not drift across month/year boundaries', () => {
    expect(daysUntil('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('estimateCreditScore', () => {
  it('returns 750 with no cards', () => {
    expect(estimateCreditScore({ cards: [], onTimePayments: 0, latePayments: 0 })).toBe(750);
  });
  it('stays within 300..900', () => {
    const worst: ScoreInput = {
      cards: [{ outstandingCents: 100000, limitCents: 100000 }],
      onTimePayments: 0,
      latePayments: 20,
    };
    const s = estimateCreditScore(worst);
    expect(s).toBeGreaterThanOrEqual(300);
    expect(s).toBeLessThanOrEqual(900);
  });
  it('scores higher for lower utilization', () => {
    const low = estimateCreditScore({
      cards: [{ outstandingCents: 10000, limitCents: 100000 }],
      onTimePayments: 0,
      latePayments: 0,
    });
    const high = estimateCreditScore({
      cards: [{ outstandingCents: 90000, limitCents: 100000 }],
      onTimePayments: 0,
      latePayments: 0,
    });
    expect(low).toBeGreaterThan(high);
  });
  it('returns an integer', () => {
    const s = estimateCreditScore({
      cards: [{ outstandingCents: 33333, limitCents: 100000 }],
      onTimePayments: 5,
      latePayments: 1,
    });
    expect(Number.isInteger(s)).toBe(true);
  });
});

describe('scoreBand', () => {
  it('applies the documented thresholds', () => {
    expect(scoreBand(649)).toBe('poor');
    expect(scoreBand(650)).toBe('fair');
    expect(scoreBand(699)).toBe('fair');
    expect(scoreBand(700)).toBe('good');
    expect(scoreBand(749)).toBe('good');
    expect(scoreBand(750)).toBe('excellent');
    expect(scoreBand(900)).toBe('excellent');
  });
});

describe('interestIfUnpaidCents', () => {
  it('computes simple interest over the period', () => {
    // 100000 * 36/100 * 30/365 = 2958.9 -> 2959
    expect(interestIfUnpaidCents(100000, 36, 30)).toBe(2959);
  });
  it('defaults days to 30', () => {
    expect(interestIfUnpaidCents(100000, 36)).toBe(2959);
  });
  it('guards non-finite inputs to 0', () => {
    expect(interestIfUnpaidCents(100000, Infinity, 30)).toBe(0);
    expect(interestIfUnpaidCents(100000, NaN, 30)).toBe(0);
  });
});

describe('summarizeCards', () => {
  const cards = [
    { outstandingCents: 8745000, limitCents: 20000000, dueDateISO: '2026-07-20' },
    { outstandingCents: 3000000, limitCents: 10000000, dueDateISO: '2026-07-14' },
  ];

  it('totals outstanding and limit and blends utilization', () => {
    const s = summarizeCards(cards, TODAY);
    expect(s.totalOutstandingCents).toBe(11745000);
    expect(s.totalLimitCents).toBe(30000000);
    expect(s.utilization).toBeCloseTo(11745000 / 30000000, 10);
  });

  it('picks the soonest future-or-today due date', () => {
    const s = summarizeCards(cards, TODAY);
    expect(s.nearestDueISO).toBe('2026-07-14');
    expect(s.nearestDueDays).toBe(4);
  });

  it('picks the least-overdue card when all are overdue', () => {
    const overdue = [
      { outstandingCents: 1000, limitCents: 10000, dueDateISO: '2026-07-01' },
      { outstandingCents: 1000, limitCents: 10000, dueDateISO: '2026-07-08' },
    ];
    const s = summarizeCards(overdue, TODAY);
    expect(s.nearestDueISO).toBe('2026-07-08');
    expect(s.nearestDueDays).toBe(-2);
  });

  it('returns nulls with no cards', () => {
    const s = summarizeCards([], TODAY);
    expect(s.totalOutstandingCents).toBe(0);
    expect(s.totalLimitCents).toBe(0);
    expect(s.utilization).toBe(0);
    expect(s.nearestDueISO).toBeNull();
    expect(s.nearestDueDays).toBeNull();
  });
});
