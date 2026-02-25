// src/utils/crypto.js

const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Derive an AES-GCM key from a user password using PBKDF2
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a secret key (Uint8Array) with a password
 * Returns a base64 string safe for storage
 */
export async function encryptSecretKey(secretKey, password) {
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    secretKey
  );

  // Combine salt + iv + encrypted into one Uint8Array
  const combined = new Uint8Array(
    SALT_LENGTH + IV_LENGTH + encrypted.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(encrypted), SALT_LENGTH + IV_LENGTH);

  // Return as base64 string
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a stored base64 string back to a secret key (Uint8Array)
 */
export async function decryptSecretKey(encryptedBase64, password) {
  const combined = Uint8Array.from(
    atob(encryptedBase64),
    c => c.charCodeAt(0)
  );

  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    return new Uint8Array(decrypted);
  } catch {
    throw new Error('Incorrect password or corrupted data');
  }
}

/**
 * Check if encrypted wallets exist in storage
 */
export function hasStoredWallets(savedWallets) {
  return Array.isArray(savedWallets) && savedWallets.length > 0;
}

/**
 * Generate a backup object for a wallet
 * Returns both Base58 and JSON array formats
 */
export function generateBackup(wallet) {
  const secretKeyArray = Array.from(wallet.keypair.secretKey);
  const secretKeyBase58 = btoa(String.fromCharCode(...wallet.keypair.secretKey));

  return {
    name: wallet.name,
    publicKey: wallet.publicKey,
    secretKeyArray,
    secretKeyBase58,
    createdAt: new Date().toISOString(),
    warning: 'KEEP THIS SAFE. Anyone with this key has full control of this wallet.'
  };
}

/**
 * Download wallet backup as a JSON file
 */
export function downloadBackup(wallet) {
  const backup = generateBackup(wallet);
  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${wallet.name.replace(/\s+/g, '_')}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

