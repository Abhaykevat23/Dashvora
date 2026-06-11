import 'server-only';

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * The encryption key is derived from an environment variable.
 * If not set, a development-only fallback is used (WARNING: not secure for production).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (keyHex) {
    return Buffer.from(keyHex, 'hex');
  }
  // Dev-only fallback key (32 bytes for AES-256)
  return Buffer.from(
    'dashvora-dev-encryption-key-32bytes!',
    'utf-8'
  ).subarray(0, 32);
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export interface EncryptedData {
  iv: string;       // hex
  tag: string;      // hex
  ciphertext: string; // hex
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf-8', 'hex');
  ciphertext += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    tag,
    ciphertext,
  };
}

/**
 * Decrypt an encrypted payload back to plaintext.
 */
export function decrypt(encrypted: EncryptedData): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(encrypted.iv, 'hex');
  const tag = Buffer.from(encrypted.tag, 'hex');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf-8');
  plaintext += decipher.final('utf-8');
  return plaintext;
}

/**
 * Serialize encrypted data to a single string for DB storage.
 * Format: iv.tag.ciphertext (all hex)
 */
export function serializeEncrypted(data: EncryptedData): string {
  return `${data.iv}.${data.tag}.${data.ciphertext}`;
}

/**
 * Parse a serialized encrypted string back into EncryptedData.
 */
export function parseEncrypted(serialized: string): EncryptedData {
  const parts = serialized.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  return {
    iv: parts[0],
    tag: parts[1],
    ciphertext: parts[2],
  };
}
