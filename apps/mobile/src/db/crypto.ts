/**
 * Field-level encryption for the one field class the spec calls out as sensitive:
 * a tracked item's identifier (serial / IMEI / loyalty or gift-card account
 * number). See ARCHITECTURE.md §6.
 *
 * Design:
 *  - Only the identifier is encrypted, so every other column stays indexable and
 *    searchable in plaintext.
 *  - Encryption is AEAD (AES-256-GCM). The data key is held by a `KeyProvider`
 *    backed by the Android Keystore in production — the key never lives in the
 *    JS heap as raw bytes longer than a call, and never syncs.
 *  - The stored format is self-describing: `v1:<iv>:<ciphertext>:<tag>` (all
 *    base64). A version prefix lets us rotate algorithms later.
 *
 * This module defines the contract + envelope handling. The actual AES-GCM
 * primitive is injected (`Aead`) so it can be wired to a Keystore-backed native
 * module without this file importing any native code — which is also what lets
 * the envelope logic be unit-tested with a stub AEAD.
 */

export interface AeadPayload {
  iv: string; // base64
  ciphertext: string; // base64
  tag: string; // base64 (GCM auth tag)
}

/** AES-256-GCM primitive. Implemented by a Keystore-backed native module. */
export interface Aead {
  encrypt(plaintext: string): Promise<AeadPayload>;
  decrypt(payload: AeadPayload): Promise<string>;
}

/** Encrypts/decrypts a single nullable string column. */
export interface FieldCipher {
  encryptField(plaintext: string | null | undefined): Promise<string | null>;
  decryptField(stored: string | null | undefined): Promise<string | null>;
}

const VERSION = 'v1';

export class EnvelopeFieldCipher implements FieldCipher {
  constructor(private readonly aead: Aead) {}

  async encryptField(plaintext: string | null | undefined): Promise<string | null> {
    if (plaintext == null || plaintext === '') {
      return null;
    }
    const { iv, ciphertext, tag } = await this.aead.encrypt(plaintext);
    return `${VERSION}:${iv}:${ciphertext}:${tag}`;
  }

  async decryptField(stored: string | null | undefined): Promise<string | null> {
    if (stored == null || stored === '') {
      return null;
    }
    const parts = stored.split(':');
    if (parts.length !== 4 || parts[0] !== VERSION) {
      throw new Error('unrecognized encrypted field envelope');
    }
    return this.aead.decrypt({ iv: parts[1]!, ciphertext: parts[2]!, tag: parts[3]! });
  }
}

/**
 * INSECURE placeholder AEAD for development and tests ONLY. It base64-encodes
 * rather than encrypting. The production build must inject a Keystore-backed
 * AES-GCM implementation; a startup assertion should refuse to run this in
 * release mode.
 */
export class InsecureDevAead implements Aead {
  async encrypt(plaintext: string): Promise<AeadPayload> {
    return {
      iv: 'dev',
      ciphertext: Buffer.from(plaintext, 'utf8').toString('base64'),
      tag: 'dev',
    };
  }

  async decrypt(payload: AeadPayload): Promise<string> {
    return Buffer.from(payload.ciphertext, 'base64').toString('utf8');
  }
}
