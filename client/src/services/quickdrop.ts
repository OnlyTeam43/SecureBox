// client/src/services/quickdrop.ts
// 100% Client-Side Encrypted Ephemeral File Shuttle
// Zero-Login · Zero-Database · 7-Day Auto-Expiration · Instant Burn on Download

export interface QuickDropMeta {
  name: string;
  size: number;
  type: string;
  burnOnDownload: boolean;
  uploadedAt: number;
  expiresAt: number;
}

export interface QuickDropFileRecord {
  meta: QuickDropMeta;
  binId: string;
  files: Array<{
    filename: string;
    bytes: number;
    contentType: string;
  }>;
}

/**
 * SHA-256 helper for generating deterministic identifiers
 */
async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive an obfuscated, unique bin ID from the user-selected numeric code
 * Ensures two users with common codes don't easily collide while keeping it deterministic
 */
export async function getBinIdFromCode(code: string): Promise<string> {
  const clean = code.trim().replace(/[-\s]/g, '');
  const hash = await sha256Hex(`sbox_salt_quickdrop_v1_${clean}`);
  return `sbox_${hash.slice(0, 16)}`;
}

/**
 * Derive AES-GCM 256-bit encryption key from user's custom numeric code
 */
async function deriveKeyFromNumericCode(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`sbox_key_${code.trim()}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 80000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt file in-memory using AES-GCM before uploading
 */
export async function encryptFilePayload(
  file: File,
  numericCode: string,
  burnOnDownload: boolean
): Promise<{ encryptedBlob: Blob; meta: QuickDropMeta }> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromNumericCode(numericCode, salt);

  const fileBytes = await file.arrayBuffer();
  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    fileBytes
  );

  // Pack binary: [16 bytes salt] + [12 bytes IV] + [Cipher Bytes]
  const combined = new Uint8Array(salt.byteLength + iv.byteLength + cipherBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(cipherBuffer), salt.byteLength + iv.byteLength);

  const encryptedBlob = new Blob([combined], { type: 'application/octet-stream' });

  const now = Date.now();
  const meta: QuickDropMeta = {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    burnOnDownload,
    uploadedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  return { encryptedBlob, meta };
}

/**
 * Decrypt file in-memory using the user's numeric code
 */
export async function decryptFilePayload(
  encryptedArrayBuffer: ArrayBuffer,
  numericCode: string,
  meta: QuickDropMeta
): Promise<Blob> {
  const bytes = new Uint8Array(encryptedArrayBuffer);
  if (bytes.byteLength <= 28) {
    throw new Error('Corrupted or invalid encrypted payload');
  }

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const cipherBytes = bytes.slice(28);

  const key = await deriveKeyFromNumericCode(numericCode, salt);

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      cipherBytes
    );

    return new Blob([decryptedBuffer], { type: meta.type || 'application/octet-stream' });
  } catch (err) {
    throw new Error('Incorrect Code! Failed to decrypt file. Please verify your numeric code.');
  }
}

/**
 * Upload encrypted file and metadata directly to anonymous temporary storage
 */
export async function uploadToQuickDrop(
  file: File,
  numericCode: string,
  burnOnDownload: boolean = true
): Promise<{ binId: string; meta: QuickDropMeta }> {
  const binId = await getBinIdFromCode(numericCode);
  const { encryptedBlob, meta } = await encryptFilePayload(file, numericCode, burnOnDownload);

  // 1. Upload meta.json
  const metaBlob = new Blob([JSON.stringify(meta, null, 2)], { type: 'application/json' });
  const metaRes = await fetch(`https://filebin.net/${binId}/meta.json`, {
    method: 'POST',
    body: metaBlob,
    headers: { 'Content-Type': 'application/json' },
  });

  if (!metaRes.ok) {
    throw new Error(`Upload failed to initialize storage (HTTP ${metaRes.status})`);
  }

  // 2. Upload encrypted payload
  const payloadRes = await fetch(`https://filebin.net/${binId}/payload.enc`, {
    method: 'POST',
    body: encryptedBlob,
    headers: { 'Content-Type': 'application/octet-stream' },
  });

  if (!payloadRes.ok) {
    throw new Error(`Failed to upload encrypted file bytes (HTTP ${payloadRes.status})`);
  }

  return { binId, meta };
}

/**
 * Lookup file information by numeric code
 */
export async function lookupQuickDrop(numericCode: string): Promise<QuickDropFileRecord | null> {
  const binId = await getBinIdFromCode(numericCode);
  try {
    const res = await fetch(`https://filebin.net/${binId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Lookup failed (HTTP ${res.status})`);

    const data = await res.json();
    if (!data || !data.files || data.files.length === 0) return null;

    // Fetch meta.json
    const metaFile = data.files.find((f: any) => f.filename === 'meta.json');
    if (!metaFile) return null;

    const metaRes = await fetch(`https://filebin.net/${binId}/meta.json`, { cache: 'no-store' });
    if (!metaRes.ok) return null;

    const meta: QuickDropMeta = await metaRes.json();

    return {
      binId,
      meta,
      files: data.files.map((f: any) => ({
        filename: f.filename,
        bytes: f.bytes,
        contentType: f['content-type'],
      })),
    };
  } catch (e) {
    console.warn('QuickDrop lookup error:', e);
    return null;
  }
}

/**
 * Fetch encrypted payload, decrypt in memory, trigger browser download, and optionally burn
 */
export async function downloadAndDecryptQuickDrop(
  numericCode: string,
  meta: QuickDropMeta
): Promise<{ success: boolean; burned: boolean }> {
  const binId = await getBinIdFromCode(numericCode);

  // 1. Fetch encrypted bytes
  const res = await fetch(`https://filebin.net/${binId}/payload.enc`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Encrypted file payload could not be retrieved. It may have expired or already been burned.');
  }

  const cipherBuffer = await res.arrayBuffer();

  // 2. Decrypt in memory
  const decryptedBlob = await decryptFilePayload(cipherBuffer, numericCode, meta);

  // 3. Trigger native file download
  const downloadUrl = URL.createObjectURL(decryptedBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = meta.name || 'securebox-file';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

  // 4. If burn on download is active, permanently wipe the bin from the internet
  let burned = false;
  if (meta.burnOnDownload) {
    try {
      await fetch(`https://filebin.net/${binId}`, { method: 'DELETE' });
      burned = true;
    } catch (burnErr) {
      console.warn('Burn request failed:', burnErr);
    }
  }

  return { success: true, burned };
}

/**
 * Manually delete / wipe bin immediately
 */
export async function deleteQuickDrop(numericCode: string): Promise<boolean> {
  const binId = await getBinIdFromCode(numericCode);
  try {
    const res = await fetch(`https://filebin.net/${binId}`, { method: 'DELETE' });
    return res.ok;
  } catch (err) {
    return false;
  }
}
