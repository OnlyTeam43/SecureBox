/**
 * web/crypto.js
 * Browser-native Web Crypto API (SubtleCrypto)
 * Zero external cryptographic dependencies.
 * Uses AES-GCM 256-bit with 96-bit (12-byte) random IV per message.
 */

// Helper: Uint8Array <-> Base64
function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return window.btoa(binary);
}

function base64ToUint8(base64) {
  const binary = window.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// URL-safe Base64 helpers for URL hash parameters
function toBase64Url(base64) {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64url) {
  let str = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4 !== 0) {
    str += '=';
  }
  return str;
}

/**
 * Generate a new random 256-bit AES-GCM key as a URL-safe string
 */
export async function generateSecretKey() {
  const rawKey = window.crypto.getRandomValues(new Uint8Array(32));
  return toBase64Url(uint8ToBase64(rawKey));
}

/**
 * Generate a unique random room ID
 */
export function generateRoomId() {
  const bytes = window.crypto.getRandomValues(new Uint8Array(12));
  return 'rm_' + toBase64Url(uint8ToBase64(bytes)).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
}

/**
 * Import a URL-safe secret key string into a CryptoKey for AES-GCM
 */
export async function importSecretKey(keyString) {
  const base64 = fromBase64Url(keyString);
  const rawKey = base64ToUint8(base64);
  return await window.crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a plaintext string or object with AES-GCM
 * Returns { iv: string, data: string } (both base64)
 */
export async function encryptData(cryptoKey, plainData) {
  const text = typeof plainData === 'string' ? plainData : JSON.stringify(plainData);
  const encoded = new TextEncoder().encode(text);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded
  );

  return {
    iv: uint8ToBase64(iv),
    data: uint8ToBase64(new Uint8Array(cipherBuffer)),
  };
}

/**
 * Decrypt ciphertext { iv, data } with AES-GCM
 * Returns the decrypted string
 */
export async function decryptData(cryptoKey, { iv, data }) {
  const ivBytes = base64ToUint8(iv);
  const dataBytes = base64ToUint8(data);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    cryptoKey,
    dataBytes
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Hash PIN using SHA-256 for local verification
 */
export async function hashPin(pin) {
  const encoded = new TextEncoder().encode('securebox_pin_salt_' + pin.trim());
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
  return uint8ToBase64(new Uint8Array(hashBuffer));
}
