/**
 * Settle-up deep-link builders (ARCHITECTURE.md §11).
 *
 * The app NEVER moves money. Each builder produces a URL that hands off to the
 * counterparty's own payment app with the payment pre-filled for the user to
 * confirm. There is no payment API, no key, no held funds — which is what keeps
 * the app out of money-transmitter territory.
 */
import type { Cents } from '../money';
import { assertIntegerCents, formatAmount } from '../money';

export type SettleUpProvider = 'venmo' | 'paypal' | 'upi';

export interface SettleUpRequest {
  amount: Cents;
  /** Free-text memo shown in the payment app. Optional. */
  note?: string;
  /** ISO-4217 code, used by UPI (cu) and PayPal.me. Defaults per provider. */
  currency?: string;
}

export interface VenmoTarget {
  provider: 'venmo';
  /** Venmo username (without the leading @). */
  username: string;
}

export interface PayPalTarget {
  provider: 'paypal';
  /** PayPal.me handle (the part after paypal.me/). */
  handle: string;
}

export interface UpiTarget {
  provider: 'upi';
  /** Payee VPA, e.g. name@bank. */
  vpa: string;
  /** Payee display name. */
  payeeName: string;
}

export type SettleUpTarget = VenmoTarget | PayPalTarget | UpiTarget;

function requireNonEmpty(value: string, field: string): void {
  if (!value || value.trim() === '') {
    throw new Error(`${field} is required to build a settle-up link`);
  }
}

function requirePositiveAmount(amount: Cents): void {
  assertIntegerCents(amount, 'amount');
  if (amount <= 0) {
    throw new Error(`settle-up amount must be positive, got ${amount}`);
  }
}

// Basic VPA shape: <id>@<handle>. Deliberately permissive — the UPI app does the
// authoritative validation; we only guard against obviously malformed input.
const VPA_RE = /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/i;

/**
 * Build the deep link for a given target + request. The returned string is what
 * the app passes to `Linking.openURL`.
 */
export function buildSettleUpLink(target: SettleUpTarget, request: SettleUpRequest): string {
  requirePositiveAmount(request.amount);
  const amount = formatAmount(request.amount); // major units, 2dp, e.g. "12.50"
  const note = request.note ?? '';

  switch (target.provider) {
    case 'venmo': {
      requireNonEmpty(target.username, 'venmo username');
      const params = new URLSearchParams({
        txn: 'pay',
        recipients: target.username.replace(/^@/, ''),
        amount,
        note,
      });
      return `venmo://paycharge?${params.toString()}`;
    }
    case 'paypal': {
      requireNonEmpty(target.handle, 'paypal handle');
      const currency = request.currency ?? 'USD';
      // PayPal.me accepts /<handle>/<amount><CURRENCY>. Opens the app if
      // installed, else the web flow — no API key involved.
      return `https://paypal.me/${encodeURIComponent(target.handle)}/${amount}${currency}`;
    }
    case 'upi': {
      requireNonEmpty(target.vpa, 'upi vpa');
      requireNonEmpty(target.payeeName, 'upi payee name');
      if (!VPA_RE.test(target.vpa)) {
        throw new Error(`invalid UPI VPA: ${target.vpa}`);
      }
      const currency = request.currency ?? 'INR';
      const params = new URLSearchParams({
        pa: target.vpa,
        pn: target.payeeName,
        am: amount,
        cu: currency,
      });
      if (note) {
        params.set('tn', note);
      }
      return `upi://pay?${params.toString()}`;
    }
    default: {
      // Exhaustiveness guard: a new provider must be handled explicitly.
      const _never: never = target;
      throw new Error(`unsupported settle-up provider: ${JSON.stringify(_never)}`);
    }
  }
}
