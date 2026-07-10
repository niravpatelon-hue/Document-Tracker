import { buildSettleUpLink } from './deeplinks';

function query(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
}

describe('venmo deep link', () => {
  it('builds a paycharge link with pre-filled amount and note', () => {
    const url = buildSettleUpLink(
      { provider: 'venmo', username: '@alice' },
      { amount: 1250, note: 'Team lunch' },
    );
    expect(url.startsWith('venmo://paycharge?')).toBe(true);
    const q = query(url);
    expect(q.get('txn')).toBe('pay');
    expect(q.get('recipients')).toBe('alice'); // leading @ stripped
    expect(q.get('amount')).toBe('12.50');
    expect(q.get('note')).toBe('Team lunch'); // round-trips through encoding
  });
});

describe('paypal deep link', () => {
  it('builds a PayPal.me link with amount and currency', () => {
    const url = buildSettleUpLink({ provider: 'paypal', handle: 'bob' }, { amount: 500 });
    expect(url).toBe('https://paypal.me/bob/5.00USD');
  });
});

describe('upi deep link', () => {
  it('builds a upi pay intent', () => {
    const url = buildSettleUpLink(
      { provider: 'upi', vpa: 'carol@okbank', payeeName: 'Carol' },
      { amount: 20000, note: 'Trip' },
    );
    expect(url.startsWith('upi://pay?')).toBe(true);
    const q = query(url);
    expect(q.get('pa')).toBe('carol@okbank');
    expect(q.get('pn')).toBe('Carol');
    expect(q.get('am')).toBe('200.00');
    expect(q.get('cu')).toBe('INR');
    expect(q.get('tn')).toBe('Trip');
  });

  it('rejects a malformed VPA', () => {
    expect(() =>
      buildSettleUpLink({ provider: 'upi', vpa: 'not-a-vpa', payeeName: 'x' }, { amount: 100 }),
    ).toThrow();
  });
});

describe('validation', () => {
  it('rejects a non-positive amount', () => {
    expect(() =>
      buildSettleUpLink({ provider: 'venmo', username: 'a' }, { amount: 0 }),
    ).toThrow();
    expect(() =>
      buildSettleUpLink({ provider: 'venmo', username: 'a' }, { amount: -100 }),
    ).toThrow();
  });

  it('rejects a missing recipient', () => {
    expect(() =>
      buildSettleUpLink({ provider: 'venmo', username: '' }, { amount: 100 }),
    ).toThrow();
  });
});
