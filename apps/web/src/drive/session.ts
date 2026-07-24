/**
 * Holds the current Drive access token and transparently refreshes it —
 * proactively before it expires, or reactively on a 401 — so every call site
 * in driveStore.ts can just await a Drive operation without touching tokens.
 */
import { refreshAccessToken } from '../auth/google';
import { DriveHttpError } from './driveClient';

export class DriveSession {
  private token: string;
  private expiresAt: number;

  constructor(
    initial: { accessToken: string; expiresAt: number },
    private onRefreshed?: (p: { accessToken: string; expiresAt: number }) => void,
  ) {
    this.token = initial.accessToken;
    this.expiresAt = initial.expiresAt;
  }

  private async freshToken(): Promise<string> {
    if (Date.now() < this.expiresAt - 60_000) return this.token;
    const fresh = await refreshAccessToken();
    if (fresh) {
      this.token = fresh.accessToken;
      this.expiresAt = fresh.expiresAt;
      this.onRefreshed?.(fresh);
    }
    return this.token;
  }

  /** Current token as last known — for sign-out revocation, not for making Drive calls (use `call`, which refreshes first). */
  getAccessToken(): string {
    return this.token;
  }

  /** Run a Drive call with a valid token, retrying once on a 401 via silent re-auth. */
  async call<T>(fn: (accessToken: string) => Promise<T>): Promise<T> {
    const token = await this.freshToken();
    try {
      return await fn(token);
    } catch (err) {
      if (err instanceof DriveHttpError && err.status === 401) {
        const fresh = await refreshAccessToken();
        if (fresh) {
          this.token = fresh.accessToken;
          this.expiresAt = fresh.expiresAt;
          this.onRefreshed?.(fresh);
          return fn(this.token);
        }
      }
      throw err;
    }
  }
}
