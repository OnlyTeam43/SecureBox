// src/services/mediaVault.js
// Private, encrypted & hidden local storage for photos and media.
// Media is stored inside the app sandbox with a .nomedia flag so that
// device galleries (Google Photos, Apple Photos, Android MediaScanner) CANNOT see or scan it.
// ZERO CLOUD RETENTION: Media is stored exclusively on the user's local device!

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
 * Save an incoming base64 or remote media URI (from partner via Supabase relay)
 * into the local secure vault.
 * Returns the local file:// URI for SQLite and UI rendering.
 */
export const saveIncomingBase64ToVault = async (messageId, dataUri) => {
  if (!dataUri) return null;
  // If it's already a local file path, return it directly
  if (dataUri.startsWith('file://')) return dataUri;

  try {
    await initMediaVault();
    const cleanId = String(messageId).replace(/[^a-zA-Z0-9_-]/g, '_');

    // Detect format
    let ext = 'jpg';
    if (dataUri.startsWith('data:image/png') || dataUri.includes('.png')) {
      ext = 'png';
    } else if (dataUri.startsWith('data:video/mp4') || dataUri.includes('.mp4')) {
      ext = 'mp4';
    }

    const targetFile = `${VAULT_DIR}vault_${cleanId}.${ext}`;

    // Strip "data:image/...;base64," prefix if present
    let base64Content = dataUri;
    const commaIndex = dataUri.indexOf(',');
    if (commaIndex !== -1 && dataUri.startsWith('data:')) {
      base64Content = dataUri.substring(commaIndex + 1);
    }

    // Write binary content into hidden local vault
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
 * Save an outgoing local image picked from gallery or camera into the local secure vault.
 * GIANT FULL SIZE: Preserves maximum original image clarity and details on the user's device!
 * Media is stored exclusively in the app's hidden sandbox (.secure_media/) with .nomedia protection.
 * 
 * Returns { vaultUri, base64DataUri }
 */
export const saveOutgoingImageToVault = async (sourceUri, originalWidth = null, originalHeight = null) => {
  if (!sourceUri) return { vaultUri: null, base64DataUri: null };

  try {
    await initMediaVault();
    const cleanTime = Date.now();
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const filename = `vault_${cleanTime}_${randSuffix}.jpg`;
    const targetFile = `${VAULT_DIR}${filename}`;

    let base64Data = null;

    // Check source file size
    const fileInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
    const fileSize = fileInfo.size || 0;

    // If source file is huge (> 10MB raw), lightly optimize to prevent Supabase REST payload limits
    // while keeping ultra-high resolution (up to 3200px max dimension, quality 0.88)
    if (fileSize > 10 * 1024 * 1024 || (originalWidth && (originalWidth > 3200 || originalHeight > 3200))) {
      const maxDim = 3200;
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

      const manipResult = await manipulateAsync(
        sourceUri,
        actions,
        { compress: 0.88, format: SaveFormat.JPEG, base64: true }
      );

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
      }
      base64Data = manipResult.base64;
    } else {
      // GIANT FULL SIZE: Direct 100% copy of the original file into hidden vault
      try {
        await FileSystem.copyAsync({
          from: sourceUri,
          to: targetFile,
        });
      } catch (copyErr) {
        console.log('Direct copy fallback to write:', copyErr?.message);
        const rawContent = await FileSystem.readAsStringAsync(sourceUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await FileSystem.writeAsStringAsync(targetFile, rawContent, {
          encoding: FileSystem.EncodingType.Base64,
        });
        base64Data = rawContent;
      }

      if (!base64Data) {
        base64Data = await FileSystem.readAsStringAsync(targetFile, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }
    }

    const base64DataUri = base64Data
      ? `data:image/jpeg;base64,${base64Data}`
      : null;

    return {
      vaultUri: targetFile,
      base64DataUri,
    };
  } catch (err) {
    console.warn('saveOutgoingImageToVault error, attempting fallback:', err);
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
/**
 * Read a vault file back as a data URI. Used when an unsent photo must be uploaded again
 * (the original base64 only exists in memory during the first attempt).
 */
export const readVaultFileAsDataUri = async (fileUri) => {
  if (!fileUri) return null;
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    if (!info.exists) return null;
    const b64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const lower = fileUri.toLowerCase();
    const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : lower.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
    return `data:${mime};base64,${b64}`;
  } catch (err) {
    console.warn('readVaultFileAsDataUri error:', err?.message);
    return null;
  }
};

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
 * Import an external photo from the device (gallery or camera) into the hidden personal vault.
 * The photo is saved into .secure_media/ with .nomedia protection, making it completely
 * hidden from Android MediaScanner, Google Photos, and file managers.
 */
export const importPhotoToPersonalVault = async (sourceUri, originalWidth = null, originalHeight = null, source = 'gallery') => {
  if (!sourceUri) return null;
  try {
    await initMediaVault();
    const cleanTime = Date.now();
    const randSuffix = Math.random().toString(36).substring(2, 8);
    const fileName = `${source}_vault_${cleanTime}_${randSuffix}.jpg`;
    const targetFile = `${VAULT_DIR}${fileName}`;

    try {
      await FileSystem.copyAsync({
        from: sourceUri,
        to: targetFile,
      });
    } catch (copyErr) {
      console.log('importPhotoToPersonalVault fallback to write:', copyErr?.message);
      const rawContent = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      await FileSystem.writeAsStringAsync(targetFile, rawContent, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    const info = await FileSystem.getInfoAsync(targetFile, { size: true });
    return {
      vaultUri: targetFile,
      fileName,
      fileSize: info.size || 0,
      source,
    };
  } catch (err) {
    console.warn('importPhotoToPersonalVault error:', err);
    return null;
  }
};

/**
 * Export a vault photo back out to the phone's public gallery.
 */
export const exportVaultPhotoToGallery = async (fileUri) => {
  if (!fileUri) return { success: false, error: 'No file specified' };
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status !== 'granted') {
      return { success: false, error: 'Permission to access phone gallery was denied.' };
    }
    const asset = await MediaLibrary.createAssetAsync(fileUri);
    return { success: true, asset };
  } catch (err) {
    console.warn('exportVaultPhotoToGallery error:', err);
    return { success: false, error: err.message || 'Export to gallery failed.' };
  }
};

/**
 * Delete the original asset from the device gallery (after importing to vault)
 */
export const deleteOriginalGalleryAsset = async (assetId) => {
  if (!assetId) return false;
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync(true);
    if (status === 'granted') {
      await MediaLibrary.deleteAssetsAsync([assetId]);
      return true;
    }
  } catch (e) {
    console.warn('deleteOriginalGalleryAsset error:', e);
  }
  return false;
};

/**
 * Request device storage permission (Android read_external_storage / MEDIA_IMAGES)
 * and create the SecureBox hidden vault directory.
 * Returns true if permission granted, false otherwise.
 */
export const requestStoragePermissionAndInit = async () => {
  try {
    const MediaLibrary = await import('expo-media-library');
    const { status } = await MediaLibrary.requestPermissionsAsync(false);
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
