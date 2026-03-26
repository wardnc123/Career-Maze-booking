import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt, getEncryptionKey } from './encryption';

function makeKey(): Buffer {
  return randomBytes(32);
}

describe('encryption', () => {
  describe('round-trip', () => {
    it('encrypt then decrypt returns original plaintext', () => {
      const key = makeKey();
      const plaintext = 'John Doe, john@example.com';
      const ciphertext = encrypt(plaintext, key);
      expect(decrypt(ciphertext, key)).toBe(plaintext);
    });

    it('works with empty string', () => {
      const key = makeKey();
      const ciphertext = encrypt('', key);
      expect(decrypt(ciphertext, key)).toBe('');
    });

    it('works with unicode characters', () => {
      const key = makeKey();
      const plaintext = 'José García — rôle: développeur 🚀';
      const ciphertext = encrypt(plaintext, key);
      expect(decrypt(ciphertext, key)).toBe(plaintext);
    });
  });

  describe('ciphertext uniqueness', () => {
    it('same plaintext produces different ciphertexts (random IV)', () => {
      const key = makeKey();
      const plaintext = 'sensitive data';
      const c1 = encrypt(plaintext, key);
      const c2 = encrypt(plaintext, key);
      expect(c1).not.toBe(c2);
    });
  });

  describe('wrong key', () => {
    it('decryption with a different key throws', () => {
      const key1 = makeKey();
      const key2 = makeKey();
      const ciphertext = encrypt('secret', key1);
      expect(() => decrypt(ciphertext, key2)).toThrow();
    });
  });

  describe('invalid inputs', () => {
    it('rejects key that is not 32 bytes', () => {
      const shortKey = randomBytes(16);
      expect(() => encrypt('test', shortKey)).toThrow('Encryption key must be 32 bytes');
      expect(() => decrypt('dGVzdA==', shortKey)).toThrow('Encryption key must be 32 bytes');
    });

    it('rejects truncated ciphertext', () => {
      const key = makeKey();
      expect(() => decrypt('c2hvcnQ=', key)).toThrow('Invalid ciphertext');
    });
  });

  describe('getEncryptionKey', () => {
    it('throws when ENCRYPTION_KEY is not set', () => {
      const original = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;
      expect(() => getEncryptionKey()).toThrow('ENCRYPTION_KEY environment variable is not set');
      if (original !== undefined) process.env.ENCRYPTION_KEY = original;
    });

    it('returns a 32-byte buffer from valid hex', () => {
      const original = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = randomBytes(32).toString('hex');
      const key = getEncryptionKey();
      expect(key.length).toBe(32);
      if (original !== undefined) {
        process.env.ENCRYPTION_KEY = original;
      } else {
        delete process.env.ENCRYPTION_KEY;
      }
    });
  });
});
