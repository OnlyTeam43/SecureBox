// client/src/services/quickdrop.ts
// 100% Client-Side AES-256 Encrypted Ephemeral Media, Links & Text Shuttle
// Supports Multiple Files + Encrypted Text/Links · Zero Login · 7-Day Auto-Expiration · Instant Burn on Download

import { supabase } from './supabase';

export interface QuickDropFileItem {
  id: string; // Specific Supabase row ID for ultra-fast single file fetching
  name: string;
  size: number;
  type: string;
}

export interface QuickDropBundleMeta {
  codeHash: string;
  files: QuickDropFileItem[];
  totalSize: number;
  fileCount: number;
  hasText?: boolean;
  encryptedText?: string;
  textLength?: number;
  decryptedText?: string; // Client-only field hydrated upon lookup; never persisted plaintext
  burnOnDownload: boolean;
  uploadedAt: number;
  expiresAt: number;
}

export interface QuickDropProgressInfo {
  phase: 'preparing' | 'encrypting' | 'uploading' | 'finalizing';
  current: number;
  total: number;
  fileName: string;
  fileSize?: number;
  message: string;
}

export type QuickDropProgressCallback = (info: QuickDropProgressInfo) => void;

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB per file
export const MAX_BUNDLE_SIZE_BYTES = 35 * 1024 * 1024; // 35 MB total per bundle
export const MAX_TEXT_LENGTH = 100000; // 100,000 characters max note/links size

/**
 * SHA-256 helper for deterministic lookup hashes
 */
async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder().encode(str);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', enc);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Native non-blocking ArrayBuffer to Base64 using browser FileReader
 * Never locks the UI thread and executes 50x faster than JS loops
 */
function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const b64 = dataUrl.split(',')[1] || '';
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Failed to encode binary data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Native non-blocking Base64 to ArrayBuffer using browser fetch
 */
async function base64ToArrayBuffer(base64: string): Promise<ArrayBuffer> {
  const res = await fetch(`data:application/octet-stream;base64,${base64}`);
  return await res.arrayBuffer();
}

/**
 * Derive AES-GCM 256-bit encryption key from user's custom numeric code
 */
async function deriveKeyFromNumericCode(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`sbox_quickdrop_key_${code.trim()}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 60000,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Smart image optimizer: if user uploads a huge uncompressed camera image (> 1.5MB),
 * downscale to max 1920px JPEG (quality 0.84) to preserve high visual fidelity
 * while preventing massive upstream upload freezes.
 */
async function optimizeImageIfNeeded(file: File): Promise<{ blob: Blob; isOptimized: boolean }> {
  const isImage = file.type.startsWith('image/');
  const isExcluded =
    file.type.includes('svg') ||
    file.type.includes('gif') ||
    file.name.toLowerCase().endsWith('.gif') ||
    file.name.toLowerCase().endsWith('.svg');

  if (!isImage || isExcluded || file.size <= 1.5 * 1024 * 1024) {
    return { blob: file, isOptimized: false };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve({ blob: file, isOptimized: false });
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => resolve({ blob: file, isOptimized: false });
      img.onload = () => {
        const maxDim = 1920;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ blob: file, isOptimized: false });
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              resolve({ blob, isOptimized: true });
            } else {
              resolve({ blob: file, isOptimized: false });
            }
          },
          'image/jpeg',
          0.84
        );
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Shared client-side WebCrypto AES-GCM 256 encryption for arbitrary bytes.
 * Packs [16-byte salt] + [12-byte IV] + [ciphertext] as base64.
 */
async function encryptBytes(data: Uint8Array, numericCode: string): Promise<string> {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromNumericCode(numericCode, salt);

  const cipherBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    data as any
  );

  const combined = new Uint8Array(salt.byteLength + iv.byteLength + cipherBuffer.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.byteLength);
  combined.set(new Uint8Array(cipherBuffer), salt.byteLength + iv.byteLength);

  return await arrayBufferToBase64(combined.buffer);
}

/**
 * Shared client-side WebCrypto AES-GCM 256 decryption for packed base64 payloads.
 */
async function decryptBytes(base64Payload: string, numericCode: string): Promise<ArrayBuffer> {
  const arrayBuffer = await base64ToArrayBuffer(base64Payload);
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.byteLength <= 28) {
    throw new Error('Corrupted or invalid encrypted payload');
  }

  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const cipherBytes = bytes.slice(28);

  const key = await deriveKeyFromNumericCode(numericCode, salt);

  try {
    return await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      cipherBytes
    );
  } catch (err) {
    throw new Error('Incorrect Code! Failed to decrypt. Please verify your numeric code.');
  }
}

/**
 * Encrypt a file/blob in-memory using WebCrypto AES-GCM 256
 */
async function encryptFileBlob(blob: Blob, numericCode: string): Promise<string> {
  const fileBytes = new Uint8Array(await blob.arrayBuffer());
  return await encryptBytes(fileBytes, numericCode);
}

/**
 * Decrypt a single file from packed base64 string
 */
async function decryptFile(
  base64Payload: string,
  numericCode: string,
  fileMeta: { name: string; type: string }
): Promise<Blob> {
  const decryptedBuffer = await decryptBytes(base64Payload, numericCode);
  return new Blob([decryptedBuffer], { type: fileMeta.type || 'application/octet-stream' });
}

/**
 * Encrypt UTF-8 text or links using WebCrypto AES-GCM 256
 */
export async function encryptTextPayload(text: string, numericCode: string): Promise<string> {
  const textBytes = new TextEncoder().encode(text);
  return await encryptBytes(textBytes, numericCode);
}

/**
 * Decrypt UTF-8 text or links from packed base64 payload
 */
export async function decryptTextPayload(base64Payload: string, numericCode: string): Promise<string> {
  const decryptedBuffer = await decryptBytes(base64Payload, numericCode);
  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Safe Supabase insert with 40-second network timeout guard
 */
async function safeInsert(payload: any, timeoutMs = 40000): Promise<void> {
  let timer: any;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error('Network request timed out. Please check your internet connection and try again.'));
    }, timeoutMs);
  });

  try {
    const res: any = await Promise.race([
      supabase.from('messages').insert(payload),
      timeoutPromise,
    ]);

    if (res && res.error) {
      throw new Error(res.error.message || 'Database insert failed');
    }
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upload Multiple Files and/or Text & Links to QuickDrop
 */
export async function uploadToQuickDrop(
  files: File[],
  numericCode: string,
  burnOnDownload: boolean = true,
  onProgress?: QuickDropProgressCallback,
  textNote?: string
): Promise<{ bundleMeta: QuickDropBundleMeta }> {
  const cleanFiles = Array.isArray(files) ? files : [];
  const cleanText = (textNote || '').trim();
  const hasFiles = cleanFiles.length > 0;
  const hasText = cleanText.length > 0;

  if (!hasFiles && !hasText) {
    throw new Error('Please paste links/text or select at least one file to drop.');
  }

  if (cleanText.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text/links note exceeds the ${MAX_TEXT_LENGTH.toLocaleString()} character limit.`);
  }

  // File size limit validation
  for (const f of cleanFiles) {
    if (f.size > MAX_FILE_SIZE_BYTES) {
      const mb = (f.size / (1024 * 1024)).toFixed(1);
      throw new Error(`"${f.name}" (${mb} MB) exceeds the 15 MB limit per file.`);
    }
  }

  const cleanCode = numericCode.trim().replace(/[-\s]/g, '');
  const codeHash = await sha256Hex(`sbox_qd_bundle_${cleanCode}`);
  const receiverId = `quickdrop_${codeHash.slice(0, 24)}`;
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days hard auto-delete

  // Asynchronously clean up any old expired rows in the background
  supabase
    .from('messages')
    .delete()
    .lt('expires_at', now)
    .eq('sender', 'quickdrop_client')
    .then(() => {}, () => {});

  const fileItems: QuickDropFileItem[] = [];
  let totalCalculatedBytes = 0;
  const totalItems = cleanFiles.length + (hasText ? 1 : 0);

  // 1. Encrypt optional Text & Links Note
  let encryptedText: string | undefined;
  if (hasText) {
    const textByteSize = new TextEncoder().encode(cleanText).byteLength;
    totalCalculatedBytes += textByteSize;

    if (onProgress) {
      onProgress({
        phase: 'encrypting',
        current: 1,
        total: totalItems,
        fileName: 'Links & Text Note',
        fileSize: textByteSize,
        message: 'Encrypting links & text note (AES-256)...',
      });
    }
    await new Promise((r) => setTimeout(r, 40));

    encryptedText = await encryptTextPayload(cleanText, cleanCode);
  }

  // 2. Process and upload each file
  for (let i = 0; i < cleanFiles.length; i++) {
    const f = cleanFiles[i];
    const stepIndex = (hasText ? 1 : 0) + i + 1;
    const fileRowId = `qdf_${codeHash.slice(0, 16)}_${i}_${now}`;

    // Step A: Optimize image if large
    if (onProgress) {
      onProgress({
        phase: 'preparing',
        current: stepIndex,
        total: totalItems,
        fileName: f.name,
        fileSize: f.size,
        message: `Preparing ${stepIndex} of ${totalItems}: ${f.name}...`,
      });
    }
    await new Promise((r) => setTimeout(r, 40));

    const { blob: processedBlob } = await optimizeImageIfNeeded(f);
    totalCalculatedBytes += processedBlob.size;

    // Step B: Client-side AES-256 Encryption
    if (onProgress) {
      onProgress({
        phase: 'encrypting',
        current: stepIndex,
        total: totalItems,
        fileName: f.name,
        fileSize: processedBlob.size,
        message: `Encrypting (AES-256) ${stepIndex} of ${totalItems}: ${f.name}...`,
      });
    }
    await new Promise((r) => setTimeout(r, 40));

    const encryptedBase64 = await encryptFileBlob(processedBlob, cleanCode);

    // Step C: Upload encrypted payload
    if (onProgress) {
      onProgress({
        phase: 'uploading',
        current: stepIndex,
        total: totalItems,
        fileName: f.name,
        fileSize: processedBlob.size,
        message: `Uploading ${stepIndex} of ${totalItems}: ${f.name}...`,
      });
    }
    await new Promise((r) => setTimeout(r, 40));

    await safeInsert({
      id: fileRowId,
      sender: 'quickdrop_client',
      receiver: receiverId,
      body: JSON.stringify({
        fileId: fileRowId,
        name: f.name,
        size: processedBlob.size,
        type: f.type || 'application/octet-stream',
        payload: encryptedBase64,
      }),
      type: 'quickdrop_file',
      created_at: now,
      expires_at: expiresAt,
    });

    fileItems.push({
      id: fileRowId,
      name: f.name,
      size: processedBlob.size,
      type: f.type || 'application/octet-stream',
    });
  }

  // 3. Finalize Drop Bundle Metadata
  if (onProgress) {
    onProgress({
      phase: 'finalizing',
      current: totalItems,
      total: totalItems,
      fileName: 'Bundle Metadata',
      message: 'Finalizing encrypted drop & generating pickup code...',
    });
  }
  await new Promise((r) => setTimeout(r, 40));

  const bundleMetaToSave: QuickDropBundleMeta = {
    codeHash,
    files: fileItems,
    totalSize: totalCalculatedBytes,
    fileCount: cleanFiles.length,
    ...(hasText ? { hasText: true, encryptedText, textLength: cleanText.length } : {}),
    burnOnDownload,
    uploadedAt: now,
    expiresAt,
  };

  const metaRowId = `qdm_${codeHash.slice(0, 16)}_${now}`;
  await safeInsert({
    id: metaRowId,
    sender: 'quickdrop_client',
    receiver: receiverId,
    body: JSON.stringify(bundleMetaToSave),
    type: 'quickdrop_bundle',
    created_at: now,
    expires_at: expiresAt,
  });

  return { bundleMeta: bundleMetaToSave };
}

/**
 * Look up active bundle (files and/or text/links) by numeric code
 */
export async function lookupQuickDrop(numericCode: string): Promise<QuickDropBundleMeta | null> {
  const cleanCode = numericCode.trim().replace(/[-\s]/g, '');
  const codeHash = await sha256Hex(`sbox_qd_bundle_${cleanCode}`);
  const receiverId = `quickdrop_${codeHash.slice(0, 24)}`;

  let rowData: any = null;
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('receiver', receiverId)
      .eq('type', 'quickdrop_bundle')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return null;
    }

    rowData = data[0];
  } catch (err) {
    console.warn('QuickDrop lookup error:', err);
    return null;
  }

  let meta: QuickDropBundleMeta;
  try {
    meta = typeof rowData.body === 'string' ? JSON.parse(rowData.body) : rowData.body;
  } catch (err) {
    console.warn('QuickDrop metadata parse error:', err);
    return null;
  }

  // Check expiration
  if (meta.expiresAt && Date.now() > meta.expiresAt) {
    return null;
  }

  // Hydrate client-side decrypted text/links if present
  if (meta.hasText && meta.encryptedText) {
    meta.decryptedText = await decryptTextPayload(meta.encryptedText, cleanCode);
  }

  return meta;
}

/**
 * Trigger a client-side .txt download of decrypted text/links
 */
export function downloadTextAsFile(text: string, numericCode: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const cleanCode = numericCode.trim().replace(/[-\s]/g, '') || 'note';
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `quickdrop-${cleanCode}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
}

/**
 * Download a single file from the bundle (fetches ONLY this single file payload)
 */
export async function downloadSingleFile(
  numericCode: string,
  fileItem: QuickDropFileItem
): Promise<void> {
  const cleanCode = numericCode.trim().replace(/[-\s]/g, '');

  // 1. Fetch only this specific row by row ID
  const { data, error } = await supabase
    .from('messages')
    .select('body')
    .eq('id', fileItem.id)
    .maybeSingle();

  if (error || !data || !data.body) {
    throw new Error('File payload could not be found. It may have expired or already been burned.');
  }

  const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
  const payload = parsed.payload;

  if (!payload) {
    throw new Error(`File ${fileItem.name} payload is empty.`);
  }

  // Decrypt and trigger browser download
  const decryptedBlob = await decryptFile(payload, cleanCode, fileItem);
  const downloadUrl = URL.createObjectURL(decryptedBlob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = fileItem.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
}

/**
 * Download all files in the bundle sequentially and optionally burn
 */
export async function downloadAllAndBurn(
  numericCode: string,
  bundleMeta: QuickDropBundleMeta,
  onProgress?: (index: number, total: number, name: string) => void
): Promise<{ success: boolean; burned: boolean }> {
  const cleanCode = numericCode.trim().replace(/[-\s]/g, '');
  const codeHash = await sha256Hex(`sbox_qd_bundle_${cleanCode}`);
  const receiverId = `quickdrop_${codeHash.slice(0, 24)}`;

  // Download and decrypt each file individually to prevent memory spikes
  for (let i = 0; i < bundleMeta.files.length; i++) {
    const fMeta = bundleMeta.files[i];
    if (onProgress) {
      onProgress(i + 1, bundleMeta.files.length, fMeta.name);
    }
    await new Promise((r) => setTimeout(r, 40));

    // Fetch this specific file row
    const { data } = await supabase
      .from('messages')
      .select('body')
      .eq('id', fMeta.id)
      .maybeSingle();

    if (data && data.body) {
      const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
      if (parsed.payload) {
        const decryptedBlob = await decryptFile(parsed.payload, cleanCode, fMeta);
        const downloadUrl = URL.createObjectURL(decryptedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = fMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);

        // Brief delay between downloads so browser doesn't block multi-download
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  // Burn / Wipe from Supabase if burnOnDownload is enabled
  let burned = false;
  if (bundleMeta.burnOnDownload) {
    try {
      await supabase.from('messages').delete().eq('receiver', receiverId);
      burned = true;
    } catch (burnErr) {
      console.warn('Burn error:', burnErr);
    }
  }

  return { success: true, burned };
}

/**
 * Permanently erase / burn the entire bundle immediately
 */
export async function burnQuickDrop(numericCode: string): Promise<boolean> {
  const cleanCode = numericCode.trim().replace(/[-\s]/g, '');
  const codeHash = await sha256Hex(`sbox_qd_bundle_${cleanCode}`);
  const receiverId = `quickdrop_${codeHash.slice(0, 24)}`;

  try {
    const { error } = await supabase.from('messages').delete().eq('receiver', receiverId);
    return !error;
  } catch (e) {
    return false;
  }
}
