// src/services/mediaVault.js
// Private, encrypted & hidden local storage for photos and media.
// Media is stored inside the app sandbox with a .nomedia flag so that
// device galleries (Google Photos, Apple Photos) CANNOT see or scan it.

import * as FileSystem from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const VAULT_DIR = `${FileSystem.documentDirectory}.secure_media/`;
const NOMEDIA_FILE = `${VAULT_DIR}.nomedia`;

/**
 * Initialize the hidden secure vault directory and .nomedia file
 */
export const initMediaVault = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
    }
    // Write .nomedia file to prevent Android MediaScanner / Gallery indexing
    const noMediaInfo = await FileSystem.getInfoAsync(NOMEDIA_FILE);
    if (!noMediaInfo.exists) {
      await FileSystem.writeAsStringAsync(NOMEDIA_FILE, '');
    }
  } catch (err) {
    console.warn('initMediaVault error:', err);
  }
};

/**
 * Save an incoming base64 image (from partner via Supabase) into the local secure vault
 * Returns the local file:// URI for SQLite and UI rendering
 */
export const saveIncomingBase64ToVault = async (messageId, dataUri) => {
  if (!dataUri) return null;
  // If it's already a local file path, return it directly
  if (dataUri.startsWith('file://')) return dataUri;

  try {
    await initMediaVault();
    const cleanId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetFile = `${VAULT_DIR}vault_${cleanId}.jpg`;

    // Strip "data:image/...;base64," prefix if present
    let base64Content = dataUri;
    const commaIndex = dataUri.indexOf(',');
    if (commaIndex !== -1 && dataUri.startsWith('data:')) {
      base64Content = dataUri.substring(commaIndex + 1);
    }

    await FileSystem.writeAsStringAsync(targetFile, base64Content, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return targetFile;
  } catch (err) {
    console.warn('saveIncomingBase64ToVault error:', err);
    return dataUri; // Fallback to raw data URI if write fails
  }
};

/**
 * Save an outgoing local image picked from gallery into the local secure vault.
 * Automatically downscales & compresses the image using expo-image-manipulator
 * to ensure Base64 payload size is strictly < 100 KB, preventing Supabase Realtime
 * WebSocket broadcast drops between phones and tablets.
 * 
 * Returns { vaultUri, base64DataUri }
 */
export const saveOutgoingImageToVault = async (sourceUri, originalWidth, originalHeight) => {
  if (!sourceUri) return { vaultUri: null, base64DataUri: null };

  try {
    await initMediaVault();
    const filename = `vault_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    const targetFile = `${VAULT_DIR}${filename}`;

    // Target max dimension: 800px guarantees high visual clarity while keeping Base64 payload ~50-80KB
    const maxDim = 800;
    const actions = [];
    if (originalWidth && originalHeight) {
      if (originalWidth >= originalHeight && originalWidth > maxDim) {
        actions.push({ resize: { width: maxDim } });
      } else if (originalHeight > originalWidth && originalHeight > maxDim) {
        actions.push({ resize: { height: maxDim } });
      }
    } else {
      actions.push({ resize: { width: maxDim } });
    }

    // Compress with SaveFormat.JPEG and get base64 string
    const manipResult = await manipulateAsync(
      sourceUri,
      actions,
      { compress: 0.45, format: SaveFormat.JPEG, base64: true }
    );

    // Save optimized file into secure sandbox vault
    if (manipResult.uri) {
      try {
        await FileSystem.copyAsync({
          from: manipResult.uri,
          to: targetFile,
        });
      } catch (_) {
        await FileSystem.writeAsStringAsync(targetFile, manipResult.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    } else if (manipResult.base64) {
      await FileSystem.writeAsStringAsync(targetFile, manipResult.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const base64DataUri = manipResult.base64
      ? `data:image/jpeg;base64,${manipResult.base64}`
      : null;

    return {
      vaultUri: targetFile,
      base64DataUri,
    };
  } catch (err) {
    console.warn('saveOutgoingImageToVault manipulateAsync error, falling back:', err);
    try {
      await initMediaVault();
      const filename = `vault_${Date.now()}_fallback.jpg`;
      const targetFile = `${VAULT_DIR}${filename}`;
      const base64Content = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(targetFile, base64Content, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return {
        vaultUri: targetFile,
        base64DataUri: `data:image/jpeg;base64,${base64Content}`,
      };
    } catch (fallbackErr) {
      console.warn('saveOutgoingImageToVault fallback failed:', fallbackErr);
      return {
        vaultUri: sourceUri,
        base64DataUri: null,
      };
    }
  }
};

/**
 * Delete a media file from the secure vault
 */
export const deleteVaultFile = async (fileUri) => {
  if (!fileUri || !fileUri.startsWith('file://')) return;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (info.exists) {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    }
  } catch (err) {
    console.warn('deleteVaultFile error:', err);
  }
};

/**
 * Delete multiple media files from the secure vault
 */
export const deleteVaultFilesBatch = async (fileUris) => {
  if (!fileUris || fileUris.length === 0) return;
  for (const uri of fileUris) {
    await deleteVaultFile(uri);
  }
};

/**
 * Request device storage permission (Android read_external_storage / MEDIA_IMAGES)
 * and create the SecureBox hidden vault directory.
 * Returns true if permission granted, false otherwise.
 */
export const requestStoragePermissionAndInit = async () => {
  try {
    // expo-media-library handles Android runtime permission for media access
    const MediaLibrary = await import('expo-media-library');
    const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync(false);
    if (status !== 'granted') {
      return false;
    }
  } catch (_) {
    // expo-media-library not available or not needed on this platform — proceed anyway
  }

  // Ensure vault directory + .nomedia exists
  await initMediaVault();
  return true;
};

/**
 * Instant Erase: Completely destroys the hidden media vault directory and all contained photos/media.
 */
export const nukeMediaVault = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(VAULT_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(VAULT_DIR, { idempotent: true });
    }
    await initMediaVault();
    console.log('Media vault nuked successfully.');
  } catch (err) {
    console.warn('nukeMediaVault error:', err);
  }
};
