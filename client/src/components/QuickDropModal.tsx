// client/src/components/QuickDropModal.tsx
// Zero-Login Ephemeral Media, Links & Text Shuttle
// Upload multiple images, videos, docs, links, or text notes -> Retrieve anywhere with a custom numeric code

import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import {
  UploadCloud,
  DownloadCloud,
  FileText,
  Image as ImageIcon,
  Video,
  File as GenericFile,
  ShieldCheck,
  Flame,
  Clock,
  Copy,
  Check,
  RefreshCw,
  X,
  AlertCircle,
  QrCode,
  Trash2,
  Plus,
  FolderArchive,
  Download,
  Link2,
  ExternalLink,
  AlignLeft,
} from 'lucide-react';
import {
  uploadToQuickDrop,
  lookupQuickDrop,
  downloadSingleFile,
  downloadAllAndBurn,
  downloadTextAsFile,
  burnQuickDrop,
  QuickDropBundleMeta,
  QuickDropFileItem,
  QuickDropProgressInfo,
  MAX_FILE_SIZE_BYTES,
  MAX_BUNDLE_SIZE_BYTES,
  MAX_TEXT_LENGTH,
} from '../services/quickdrop';

export interface QuickDropPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialCode?: string;
  initialTab?: 'upload' | 'retrieve';
  embedded?: boolean;
  externalNote?: string;
  onExternalNoteConsumed?: () => void;
  isExtensionPopup?: boolean;
  onOpenFullPanel?: () => void;
}

interface QuickDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialTab?: 'upload' | 'retrieve';
}

function formatBytes(bytes: number, decimals: number = 2): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(type: string, name: string) {
  const lower = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) {
    return <ImageIcon size={22} color="#D97757" />;
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi)$/i.test(lower)) {
    return <Video size={22} color="#4A8B88" />;
  }
  if (type.startsWith('text/') || /\.(pdf|doc|docx|xls|xlsx|txt|csv|json)$/i.test(lower)) {
    return <FileText size={22} color="#5E9473" />;
  }
  return <GenericFile size={22} color={Colors.text.secondary} />;
}

/**
 * Safely extract http/https URLs from text so users can open retrieved links in 1 tap.
 */
function extractSafeUrls(text: string): string[] {
  if (!text) return [];
  const regex = /https?:\/\/[^\s<>"'`]+/gi;
  const matches = text.match(regex) || [];
  const cleaned = matches
    .map((raw) => {
      let url = raw.replace(/[.,;!?"'>\]]+$/, '');
      if (url.endsWith(')') && !url.includes('(')) {
        url = url.slice(0, -1);
      }
      return url;
    })
    .filter((url) => /^https?:\/\/.+/i.test(url));
  return Array.from(new Set(cleaned));
}

async function copyTextSafe(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export const QuickDropPanel: React.FC<QuickDropPanelProps> = ({
  isOpen = true,
  onClose,
  initialCode = '',
  initialTab = 'upload',
  embedded = false,
  externalNote = '',
  onExternalNoteConsumed,
  isExtensionPopup = false,
  onOpenFullPanel,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'retrieve'>(initialTab);

  // Upload State (Multiple Files + Text/Links)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [noteText, setNoteText] = useState<string>('');
  const [customCode, setCustomCode] = useState<string>('');
  const [burnOnDownload, setBurnOnDownload] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<QuickDropProgressInfo | null>(null);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    code: string;
    bundleMeta: QuickDropBundleMeta;
    shareUrl: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Retrieve State
  const [searchCode, setSearchCode] = useState<string>(initialCode);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundBundle, setFoundBundle] = useState<QuickDropBundleMeta | null>(null);
  const [burnedNoteSnapshot, setBurnedNoteSnapshot] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgressMsg, setDownloadProgressMsg] = useState<string>('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedNote, setCopiedNote] = useState<boolean>(false);
  const [copiedUrlIndex, setCopiedUrlIndex] = useState<number | null>(null);

  // Generate random 6-digit code
  const generateRandomCode = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    setCustomCode(num.toString());
  };

  // Sync tab & initialCode when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialCode) {
        setSearchCode(initialCode);
        setActiveTab('retrieve');
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, initialCode, initialTab]);

  // Set default random code when switching to upload tab if empty
  useEffect(() => {
    if (activeTab === 'upload' && !customCode && !uploadSuccess) {
      generateRandomCode();
    }
  }, [activeTab]);

  // Append injected links/text from Chrome Extension (context menu / active tab capture)
  useEffect(() => {
    const incoming = externalNote.trim();
    if (!incoming || isUploading) return;
    setUploadSuccess(null);
    setActiveTab('upload');
    setNoteText((prev) => {
      const existing = prev.trim();
      if (!existing) return incoming;
      if (existing.includes(incoming)) return prev;
      return `${existing}\n${incoming}`;
    });
    if (onExternalNoteConsumed) onExternalNoteConsumed();
  }, [externalNote, isUploading, onExternalNoteConsumed]);

  const handlePickFilesClick = () => {
    if (isUploading) return;
    if (isExtensionPopup && onOpenFullPanel) {
      onOpenFullPanel();
      return;
    }
    fileInputRef.current?.click();
  };

  if (!embedded && !isOpen) return null;

  // Append new files with size limit validations
  const appendFiles = (newFiles: FileList | File[]) => {
    const list = Array.from(newFiles);

    for (const f of list) {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        setUploadError(
          `"${f.name}" is too large (${formatBytes(f.size)}). Max allowed is 15 MB per file for fast browser pickup.`
        );
        return;
      }
    }

    setSelectedFiles((prev) => {
      const existingKeys = new Set(prev.map((f) => `${f.name}_${f.size}`));
      const filtered = list.filter((f) => !existingKeys.has(`${f.name}_${f.size}`));
      const combined = [...prev, ...filtered];

      const totalBytes = combined.reduce((acc, f) => acc + f.size, 0);
      if (totalBytes > MAX_BUNDLE_SIZE_BYTES) {
        setUploadError(
          `Total drop size (${formatBytes(totalBytes)}) exceeds the 35 MB limit for anonymous browser shuttle.`
        );
        return prev;
      }

      return combined;
    });
    setUploadError(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setUploadError(null);
  };

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(e.dataTransfer.files);
    }
  };

  const cleanNoteText = noteText.trim();
  const hasFiles = selectedFiles.length > 0;
  const hasText = cleanNoteText.length > 0;
  const hasAnyUploadContent = hasFiles || hasText;
  const detectedUploadUrls = extractSafeUrls(noteText);

  // Handle Upload Submission
  const handleUpload = async () => {
    if (!hasAnyUploadContent) {
      setUploadError('Please paste links/text or select at least one file to drop.');
      return;
    }
    if (cleanNoteText.length > MAX_TEXT_LENGTH) {
      setUploadError(`Text note is too long (max ${MAX_TEXT_LENGTH.toLocaleString()} characters).`);
      return;
    }

    const cleanCode = customCode.trim().replace(/[-\s]/g, '');
    if (!cleanCode || cleanCode.length < 3) {
      setUploadError('Please enter a numeric code with at least 3 digits.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(null);
      setUploadProgressMsg('Starting encryption...');

      const { bundleMeta } = await uploadToQuickDrop(
        selectedFiles,
        cleanCode,
        burnOnDownload,
        (info) => {
          setUploadProgress(info);
          setUploadProgressMsg(info.message);
        },
        cleanNoteText
      );

      const baseUrl =
        window.location.protocol === 'chrome-extension:'
          ? 'https://thesecurebox.vercel.app'
          : window.location.origin;
      const shareUrl = `${baseUrl}/dropbox#code=${cleanCode}`;

      setUploadSuccess({
        code: cleanCode,
        bundleMeta,
        shareUrl,
      });
    } catch (err: any) {
      console.error('QuickDrop upload error:', err);
      setUploadError(err.message || 'Upload failed. Please check your internet connection.');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      setUploadProgressMsg('');
    }
  };

  // Handle Search / Lookup
  const handleSearch = async () => {
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');
    if (!cleanCode) {
      setSearchError('Please enter your numeric code.');
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);
      setFoundBundle(null);
      setBurnedNoteSnapshot(null);
      setDownloadSuccess(null);

      const meta = await lookupQuickDrop(cleanCode);
      if (!meta) {
        setSearchError(
          'No active items found for this code. They may have expired (7 days), already been burned, or the code was entered incorrectly.'
        );
      } else {
        setFoundBundle(meta);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Lookup failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Download Single File
  const handleDownloadSingle = async (fileItem: QuickDropFileItem) => {
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');
    try {
      setSearchError(null);
      await downloadSingleFile(cleanCode, fileItem);
    } catch (err: any) {
      setSearchError(err.message || `Failed to download ${fileItem.name}`);
    }
  };

  // Handle Download All Files & Burn
  const handleDownloadAll = async () => {
    if (!foundBundle) return;
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');

    try {
      setIsDownloading(true);
      setSearchError(null);

      const noteSnapshot = foundBundle.decryptedText || null;

      const { burned } = await downloadAllAndBurn(
        cleanCode,
        foundBundle,
        (index, total, name) => {
          setDownloadProgressMsg(`Decrypting & downloading ${index} of ${total}: ${name}`);
        }
      );

      if (burned) {
        if (noteSnapshot) {
          setBurnedNoteSnapshot(noteSnapshot);
        }
        setDownloadSuccess(
          'All items successfully decrypted, downloaded, and permanently BURNED from the cloud!'
        );
        setFoundBundle(null);
      } else {
        setDownloadSuccess('All files successfully decrypted and downloaded!');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setSearchError(err.message || 'Decryption failed. Please confirm the numeric code.');
    } finally {
      setIsDownloading(false);
      setDownloadProgressMsg('');
    }
  };

  // Handle Copy Text & Burn (for text/links-only or explicit note copy+burn)
  const handleCopyNoteAndMaybeBurn = async (shouldBurn: boolean) => {
    const text = foundBundle?.decryptedText ?? burnedNoteSnapshot;
    if (!text) return;

    await copyTextSafe(text);
    setCopiedNote(true);
    setTimeout(() => setCopiedNote(false), 2000);

    if (shouldBurn && foundBundle) {
      const cleanCode = searchCode.trim().replace(/[-\s]/g, '');
      const ok = await burnQuickDrop(cleanCode);
      if (ok) {
        setBurnedNoteSnapshot(text);
        setFoundBundle(null);
        setDownloadSuccess(
          'Links/text copied to clipboard & permanently BURNED from the cloud! (Local view kept below until closed.)'
        );
      }
    }
  };

  // Handle Save Note as .txt & optional Burn
  const handleSaveTextAndMaybeBurn = async (shouldBurn: boolean) => {
    const text = foundBundle?.decryptedText ?? burnedNoteSnapshot;
    if (!text) return;
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');

    downloadTextAsFile(text, cleanCode);

    if (shouldBurn && foundBundle) {
      const ok = await burnQuickDrop(cleanCode);
      if (ok) {
        setBurnedNoteSnapshot(text);
        setFoundBundle(null);
        setDownloadSuccess(
          'Saved as .txt file & permanently BURNED from the cloud!'
        );
      }
    }
  };

  // Handle Manual Delete / Burn
  const handleManualBurn = async () => {
    if (!foundBundle) return;
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');
    if (
      !confirm(
        'Are you sure you want to permanently delete everything in this drop? It cannot be recovered.'
      )
    ) {
      return;
    }

    const ok = await burnQuickDrop(cleanCode);
    if (ok) {
      setFoundBundle(null);
      setBurnedNoteSnapshot(null);
      setDownloadSuccess(
        'Everything in this drop has been permanently burned and deleted from the cloud.'
      );
    } else {
      setSearchError('Could not delete drop.');
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    copyTextSafe(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const totalSelectedSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  // Calculate live progress percentage
  let progressPercent = 0;
  if (uploadProgress && uploadProgress.total > 0) {
    const perItemWeight = 100 / uploadProgress.total;
    let stepRatio = 0.1;
    if (uploadProgress.phase === 'encrypting') stepRatio = 0.4;
    if (uploadProgress.phase === 'uploading') stepRatio = 0.8;
    if (uploadProgress.phase === 'finalizing') stepRatio = 1.0;

    progressPercent = Math.min(
      98,
      Math.round((uploadProgress.current - 1) * perItemWeight + perItemWeight * stepRatio)
    );
  }

  // Dynamic Submit Button Text
  let submitButtonLabel = 'Encrypt & Drop';
  if (hasFiles && hasText) {
    submitButtonLabel = `Encrypt & Drop Note + ${selectedFiles.length} File${
      selectedFiles.length > 1 ? 's' : ''
    }`;
  } else if (!hasFiles && hasText) {
    submitButtonLabel =
      detectedUploadUrls.length > 0 ? 'Encrypt & Drop Links / Text' : 'Encrypt & Drop Text Note';
  } else if (hasFiles) {
    submitButtonLabel =
      selectedFiles.length > 1
        ? `Encrypt & Drop ${selectedFiles.length} Files`
        : 'Encrypt & Drop File';
  }

  const displayedNoteText = foundBundle?.decryptedText ?? burnedNoteSnapshot;
  const displayedUrls = displayedNoteText ? extractSafeUrls(displayedNoteText) : [];

  const renderRetrievedNoteCard = (isLocalBurnedView: boolean, marginBottom: number) => {
    if (!displayedNoteText) return null;
    return (
      <div
        style={{
          padding: isLocalBurnedView ? '14px' : '12px',
          borderRadius: 12,
          backgroundColor: isLocalBurnedView ? Colors.bg.secondary : Colors.bg.elevated,
          border: `1px solid ${Colors.border}`,
          marginBottom,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlignLeft size={14} color={Colors.accent.primary} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isLocalBurnedView ? Colors.text.secondary : Colors.text.primary,
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
              }}
            >
              {isLocalBurnedView ? 'Local View Only · Wiped from Cloud' : 'Links & Text Note'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => handleCopyNoteAndMaybeBurn(false)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: `1px solid ${Colors.border}`,
                backgroundColor: isLocalBurnedView ? Colors.bg.elevated : Colors.bg.primary,
                color: copiedNote ? '#5E9473' : Colors.text.primary,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {copiedNote ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedNote ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveTextAndMaybeBurn(false)}
              style={{
                padding: '4px 9px',
                borderRadius: 6,
                border: `1px solid ${Colors.border}`,
                backgroundColor: isLocalBurnedView ? Colors.bg.elevated : Colors.bg.primary,
                color: Colors.accent.primary,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Save note as .txt file"
            >
              <Download size={12} />
              <span>.txt</span>
            </button>
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            backgroundColor: isLocalBurnedView ? Colors.bg.elevated : Colors.bg.primary,
            border: `1px solid ${Colors.border}`,
            fontSize: 13,
            color: Colors.text.primary,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 165,
            overflowY: 'auto',
            userSelect: 'text',
          }}
        >
          {displayedNoteText}
        </div>

        {displayedUrls.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <span
              style={{
                display: 'block',
                fontSize: 10,
                fontWeight: 700,
                color: Colors.text.secondary,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Detected Links ({displayedUrls.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayedUrls.map((url, idx) => (
                <div
                  key={url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 8,
                    backgroundColor: isLocalBurnedView ? Colors.bg.elevated : Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: Colors.accent.primary,
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                    }}
                  >
                    {url}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      copyTextSafe(url);
                      setCopiedUrlIndex(idx);
                      setTimeout(() => setCopiedUrlIndex(null), 1800);
                    }}
                    style={{
                      padding: '4px 7px',
                      borderRadius: 6,
                      border: `1px solid ${Colors.border}`,
                      backgroundColor: isLocalBurnedView ? Colors.bg.primary : Colors.bg.elevated,
                      color: copiedUrlIndex === idx ? '#5E9473' : Colors.text.secondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0,
                    }}
                    title="Copy URL"
                  >
                    {copiedUrlIndex === idx ? <Check size={12} /> : <Copy size={12} />}
                  </button>

                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      padding: '4px 9px',
                      borderRadius: 6,
                      backgroundColor: Colors.accent.primary,
                      color: '#FFFFFF',
                      fontSize: 11,
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    <span>Open</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        ...(embedded
          ? { width: '100%' }
          : {
              position: 'fixed' as const,
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
            }),
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (!embedded && e.target === e.currentTarget && !isUploading && onClose) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: embedded ? 660 : 560,
          maxHeight: embedded ? undefined : '92vh',
          margin: embedded ? '0 auto' : undefined,
          backgroundColor: Colors.bg.elevated,
          borderRadius: 18,
          border: `1px solid ${Colors.border}`,
          boxShadow: embedded ? '0 12px 34px rgba(20, 21, 24, 0.08)' : '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: embedded ? undefined : 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${Colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: Colors.bg.secondary,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(217, 119, 87, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: Colors.accent.primary,
              }}
            >
              <UploadCloud size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 17,
                    fontWeight: 700,
                    color: Colors.text.primary,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {embedded ? 'SecureBox QuickDrop' : 'QuickDrop'}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: 999,
                    backgroundColor: Colors.accent.soft,
                    color: Colors.accent.primary,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  Zero Login
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: Colors.text.secondary }}>
                Anonymous Cross-Device Media, Links & Text Shuttle
              </p>
            </div>
          </div>

          {!embedded && onClose && (
            <button
              onClick={onClose}
              disabled={isUploading}
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                border: `1px solid ${Colors.border}`,
                backgroundColor: Colors.bg.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: Colors.text.secondary,
                cursor: isUploading ? 'not-allowed' : 'pointer',
                opacity: isUploading ? 0.4 : 1,
              }}
              title="Close"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${Colors.border}`,
            backgroundColor: Colors.bg.primary,
          }}
        >
          <button
            onClick={() => !isUploading && setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              backgroundColor: activeTab === 'upload' ? Colors.bg.elevated : 'transparent',
              borderBottom:
                activeTab === 'upload'
                  ? `2px solid ${Colors.accent.primary}`
                  : '2px solid transparent',
              color: activeTab === 'upload' ? Colors.text.primary : Colors.text.secondary,
              fontWeight: activeTab === 'upload' ? 700 : 500,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <UploadCloud size={16} />
            <span>Upload & Drop</span>
          </button>

          <button
            onClick={() => !isUploading && setActiveTab('retrieve')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              backgroundColor: activeTab === 'retrieve' ? Colors.bg.elevated : 'transparent',
              borderBottom:
                activeTab === 'retrieve'
                  ? `2px solid ${Colors.accent.primary}`
                  : '2px solid transparent',
              color: activeTab === 'retrieve' ? Colors.text.primary : Colors.text.secondary,
              fontWeight: activeTab === 'retrieve' ? 700 : 500,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: isUploading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <DownloadCloud size={16} />
            <span>Search & Retrieve</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: UPLOAD (Files + Links & Text) */}
          {activeTab === 'upload' && (
            <div
              onPaste={(e) => {
                if (isUploading) return;
                const items = e.clipboardData?.items;
                if (!items) return;
                const pastedFiles: File[] = [];
                for (let i = 0; i < items.length; i++) {
                  const item = items[i];
                  if (item.kind === 'file') {
                    const f = item.getAsFile();
                    if (f) pastedFiles.push(f);
                  }
                }
                if (pastedFiles.length > 0) {
                  appendFiles(pastedFiles);
                }
              }}
            >
              {!uploadSuccess ? (
                <div>
                  {/* Hidden multiple file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        appendFiles(e.target.files);
                      }
                      e.target.value = '';
                    }}
                  />

                  {/* Links & Text Note Input */}
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <label
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: Colors.text.primary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Link2 size={14} color={Colors.accent.primary} />
                        <span>Links or Text Note</span>
                        <span style={{ fontSize: 11, fontWeight: 400, color: Colors.text.secondary }}>
                          (optional)
                        </span>
                      </label>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {detectedUploadUrls.length > 0 && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 999,
                              backgroundColor: 'rgba(94, 148, 115, 0.15)',
                              color: '#2E694E',
                            }}
                          >
                            {detectedUploadUrls.length} link{detectedUploadUrls.length > 1 ? 's' : ''}{' '}
                            detected
                          </span>
                        )}
                        {noteText.length > 0 && !isUploading && (
                          <button
                            type="button"
                            onClick={() => setNoteText('')}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: Colors.text.secondary,
                              fontSize: 11,
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: 0,
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      disabled={isUploading}
                      value={noteText}
                      onChange={(e) => {
                        setNoteText(e.target.value);
                        if (uploadError) setUploadError(null);
                      }}
                      placeholder="Paste URLs (https://...), meeting links, notes, or text snippets..."
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1px solid ${Colors.border}`,
                        backgroundColor: Colors.bg.primary,
                        fontSize: 13,
                        color: Colors.text.primary,
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        boxSizing: 'border-box',
                        lineHeight: 1.45,
                        opacity: isUploading ? 0.6 : 1,
                      }}
                    />
                    {noteText.length > 500 && (
                      <div
                        style={{
                          textAlign: 'right',
                          fontSize: 10,
                          color:
                            noteText.length > MAX_TEXT_LENGTH ? '#B91C1C' : Colors.text.secondary,
                          marginTop: 2,
                        }}
                      >
                        {noteText.length.toLocaleString()} / {MAX_TEXT_LENGTH.toLocaleString()} chars
                      </div>
                    )}
                  </div>

                  {/* Drag & Drop File Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={handlePickFilesClick}
                    style={{
                      border: `2px dashed ${isDragOver ? Colors.accent.primary : Colors.border}`,
                      borderRadius: 14,
                      padding: selectedFiles.length > 0 ? '14px 12px' : '18px 14px',
                      textAlign: 'center',
                      backgroundColor: isDragOver ? Colors.accent.soft : Colors.bg.secondary,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: 14,
                      opacity: isUploading ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: '50%',
                        backgroundColor: Colors.bg.elevated,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 6px auto',
                        color: Colors.accent.primary,
                      }}
                    >
                      <UploadCloud size={20} />
                    </div>
                    <p
                      style={{
                        margin: '0 0 2px 0',
                        fontSize: 13,
                        fontWeight: 600,
                        color: Colors.text.primary,
                      }}
                    >
                      {isExtensionPopup && onOpenFullPanel
                        ? 'Open Side Panel to pick files (or Ctrl+V image / drag here)'
                        : selectedFiles.length > 0
                          ? 'Click or drag more files to add'
                          : 'Click or drag & drop files (optional)'}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: Colors.text.secondary }}>
                      Images, Videos, PDFs, or Documents (multiple select · max 15 MB/file)
                    </p>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                          padding: '0 2px',
                        }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, color: Colors.text.primary }}>
                          SELECTED FILES ({selectedFiles.length}) · {formatBytes(totalSelectedSize)}
                        </span>
                        {!isUploading && (
                          <button
                            type="button"
                            onClick={handlePickFilesClick}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: Colors.accent.primary,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: 0,
                            }}
                          >
                            <Plus size={13} />
                            <span>Add More</span>
                          </button>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          maxHeight: 150,
                          overflowY: 'auto',
                          paddingRight: 4,
                        }}
                      >
                        {selectedFiles.map((f, idx) => (
                          <div
                            key={`${f.name}_${idx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 10,
                              backgroundColor: Colors.bg.secondary,
                              border: `1px solid ${Colors.border}`,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              {getFileIcon(f.type, f.name)}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <p
                                  style={{
                                    margin: 0,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: Colors.text.primary,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {f.name}
                                </p>
                                <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                                  {formatBytes(f.size)}
                                </span>
                              </div>
                            </div>

                            {!isUploading && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(idx);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: Colors.text.secondary,
                                  cursor: 'pointer',
                                  padding: 4,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                                title="Remove file"
                              >
                                <X size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Numeric Code Input */}
                  <div style={{ marginBottom: 16 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 6,
                      }}
                    >
                      <label style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                        Choose Your Numeric Pickup Code
                      </label>
                      {!isUploading && (
                        <button
                          type="button"
                          onClick={generateRandomCode}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: Colors.accent.primary,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: 0,
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>Randomize</span>
                        </button>
                      )}
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        disabled={isUploading}
                        value={customCode}
                        onChange={(e) =>
                          setCustomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))
                        }
                        placeholder="e.g. 748201 or your PIN"
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: `1px solid ${Colors.border}`,
                          backgroundColor: Colors.bg.primary,
                          fontSize: 16,
                          fontWeight: 700,
                          color: Colors.text.primary,
                          fontFamily: 'monospace',
                          letterSpacing: '2px',
                          boxSizing: 'border-box',
                          opacity: isUploading ? 0.6 : 1,
                        }}
                      />
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 11, color: Colors.text.secondary }}>
                      Pick any 4 to 8-digit number you can easily remember when you get to your other
                      device.
                    </p>
                  </div>

                  {/* Security & Lifecycle Badges */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: Colors.bg.secondary,
                      border: `1px solid ${Colors.border}`,
                      marginBottom: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Burn Toggle */}
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        disabled={isUploading}
                        checked={burnOnDownload}
                        onChange={(e) => setBurnOnDownload(e.target.checked)}
                        style={{ accentColor: Colors.accent.primary, width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Flame size={14} color="#EF4444" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                            Burn after retrieval
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: Colors.text.secondary }}>
                          Files & notes permanently wipe from the cloud the moment they are retrieved at
                          home.
                        </p>
                      </div>
                    </label>

                    {/* Expiration Note */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        paddingTop: 6,
                        borderTop: `1px solid ${Colors.border}`,
                      }}
                    >
                      <Clock size={13} color={Colors.text.secondary} />
                      <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                        Hard auto-delete: Any unretrieved drops are wiped automatically in 7 days.
                      </span>
                    </div>

                    {/* Zero-Knowledge Note */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={13} color="#5E9473" />
                      <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                        Client-side AES-256 encrypted before upload. Zero knowledge relay.
                      </span>
                    </div>
                  </div>

                  {/* ACTIVE PROGRESS CARD DURING UPLOAD */}
                  {isUploading && (
                    <div
                      style={{
                        padding: '14px 16px',
                        borderRadius: 12,
                        backgroundColor: 'rgba(217, 119, 87, 0.08)',
                        border: `1px solid ${Colors.accent.primary}`,
                        marginBottom: 16,
                        animation: 'fadeInScale 0.15s ease-out',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <RefreshCw size={14} color={Colors.accent.primary} className="animate-spin" />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: Colors.accent.primary,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {uploadProgress?.phase === 'encrypting'
                              ? 'Encrypting (AES-256)'
                              : uploadProgress?.phase === 'uploading'
                              ? 'Uploading to Cloud'
                              : uploadProgress?.phase === 'preparing'
                              ? 'Optimizing Image'
                              : 'Finalizing Drop'}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: Colors.text.primary }}>
                          {progressPercent}%
                        </span>
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: 6,
                          borderRadius: 999,
                          backgroundColor: 'rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                          marginBottom: 8,
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPercent}%`,
                            height: '100%',
                            backgroundColor: Colors.accent.primary,
                            borderRadius: 999,
                            transition: 'width 0.25s ease-out',
                          }}
                        />
                      </div>

                      <p
                        style={{
                          margin: 0,
                          fontSize: 12,
                          color: Colors.text.primary,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {uploadProgressMsg || 'Encrypting and transferring...'}
                      </p>
                    </div>
                  )}

                  {uploadError && (
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        backgroundColor: '#FEE2E2',
                        color: '#B91C1C',
                        fontSize: 12,
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <AlertCircle size={15} style={{ flexShrink: 0 }} />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Upload Button */}
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !hasAnyUploadContent}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 12,
                      border: 'none',
                      backgroundColor:
                        isUploading || !hasAnyUploadContent
                          ? Colors.bg.secondary
                          : Colors.accent.primary,
                      color:
                        isUploading || !hasAnyUploadContent ? Colors.text.secondary : '#FFFFFF',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: isUploading || !hasAnyUploadContent ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw size={17} className="animate-spin" />
                        <span>Processing & Transferring...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={18} />
                        <span>{submitButtonLabel}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* UPLOAD SUCCESS SCREEN */
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      backgroundColor: 'rgba(94, 148, 115, 0.15)',
                      color: '#5E9473',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 12px auto',
                    }}
                  >
                    <Check size={28} />
                  </div>

                  <h3
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: 18,
                      fontWeight: 700,
                      color: Colors.text.primary,
                    }}
                  >
                    {uploadSuccess.bundleMeta.hasText && uploadSuccess.bundleMeta.fileCount === 0
                      ? 'Links & Text Ready for Pickup!'
                      : uploadSuccess.bundleMeta.hasText && uploadSuccess.bundleMeta.fileCount > 0
                      ? `Note + ${uploadSuccess.bundleMeta.fileCount} File${
                          uploadSuccess.bundleMeta.fileCount > 1 ? 's' : ''
                        } Ready for Pickup!`
                      : `${uploadSuccess.bundleMeta.fileCount} File${
                          uploadSuccess.bundleMeta.fileCount > 1 ? 's' : ''
                        } Ready for Pickup!`}
                  </h3>
                  <p style={{ margin: '0 0 18px 0', fontSize: 13, color: Colors.text.secondary }}>
                    You can safely close this browser or walk away. Pick it up from any device.
                  </p>

                  {/* Big Code Card */}
                  <div
                    style={{
                      padding: '16px',
                      borderRadius: 14,
                      backgroundColor: Colors.bg.secondary,
                      border: `1.5px dashed ${Colors.accent.primary}`,
                      marginBottom: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: Colors.text.secondary,
                        textTransform: 'uppercase',
                      }}
                    >
                      Your Pickup Code
                    </span>
                    <div
                      style={{
                        fontSize: 32,
                        fontWeight: 800,
                        fontFamily: "'Space Grotesk', monospace",
                        color: Colors.accent.primary,
                        letterSpacing: '4px',
                        margin: '6px 0',
                      }}
                    >
                      {uploadSuccess.code}
                    </div>

                    <button
                      onClick={() => copyToClipboard(uploadSuccess.code, 'code')}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: `1px solid ${Colors.border}`,
                        backgroundColor: Colors.bg.elevated,
                        color: copiedCode ? '#5E9473' : Colors.text.primary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedCode ? 'Code Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>

                  {/* QR Code & Direct Link */}
                  <div
                    style={{
                      padding: '14px',
                      borderRadius: 12,
                      backgroundColor: Colors.bg.primary,
                      border: `1px solid ${Colors.border}`,
                      marginBottom: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <QrCode size={15} color={Colors.accent.primary} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: Colors.text.primary }}>
                        Scan on your phone to open immediately
                      </span>
                    </div>

                    <div
                      style={{
                        padding: 8,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 10,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                      }}
                    >
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
                          uploadSuccess.shareUrl
                        )}`}
                        alt="QuickDrop QR Code"
                        style={{ width: 140, height: 140, display: 'block' }}
                      />
                    </div>

                    <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                      <input
                        readOnly
                        value={uploadSuccess.shareUrl}
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: `1px solid ${Colors.border}`,
                          backgroundColor: Colors.bg.secondary,
                          fontSize: 12,
                          color: Colors.text.secondary,
                          fontFamily: 'monospace',
                        }}
                      />
                      <button
                        onClick={() => copyToClipboard(uploadSuccess.shareUrl, 'link')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: Colors.accent.primary,
                          color: '#FFFFFF',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                      >
                        {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Reset for another upload */}
                  <button
                    onClick={() => {
                      setUploadSuccess(null);
                      setSelectedFiles([]);
                      setNoteText('');
                      generateRandomCode();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: Colors.accent.primary,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: 8,
                    }}
                  >
                    Drop more links, notes, or files
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RETRIEVE & DOWNLOAD */}
          {activeTab === 'retrieve' && (
            <div>
              <p style={{ margin: '0 0 14px 0', fontSize: 13, color: Colors.text.secondary }}>
                Enter the numeric code you created when uploading to retrieve your links, notes, or
                files.
              </p>

              {/* Code Search Input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="Enter Code (e.g. 748201)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearch();
                  }}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: `1px solid ${Colors.border}`,
                    backgroundColor: Colors.bg.primary,
                    fontSize: 16,
                    fontWeight: 700,
                    color: Colors.text.primary,
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchCode.trim()}
                  style={{
                    padding: '0 18px',
                    borderRadius: 10,
                    border: 'none',
                    backgroundColor: Colors.accent.primary,
                    color: '#FFFFFF',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: isSearching || !searchCode.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    opacity: isSearching || !searchCode.trim() ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {isSearching ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <DownloadCloud size={16} />
                  )}
                  <span>Find</span>
                </button>
              </div>

              {searchError && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    backgroundColor: '#FEE2E2',
                    color: '#B91C1C',
                    fontSize: 12,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{searchError}</span>
                </div>
              )}

              {downloadSuccess && (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    backgroundColor: 'rgba(94, 148, 115, 0.15)',
                    border: '1px solid #5E9473',
                    color: '#2E694E',
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 16,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <Check size={18} style={{ flexShrink: 0 }} />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              {/* Decrypted Text / Links Snapshot (kept visible locally after cloud burn) */}
              {!foundBundle && burnedNoteSnapshot && renderRetrievedNoteCard(true, 16)}

              {/* Found Bundle Card */}
              {foundBundle && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    backgroundColor: Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {foundBundle.fileCount > 0 ? (
                          <FolderArchive size={18} color={Colors.accent.primary} />
                        ) : (
                          <Link2 size={18} color={Colors.accent.primary} />
                        )}
                        <span style={{ fontSize: 14, fontWeight: 700, color: Colors.text.primary }}>
                          {foundBundle.hasText && foundBundle.fileCount === 0
                            ? `Encrypted Links / Text Ready (${formatBytes(foundBundle.totalSize)})`
                            : foundBundle.hasText && foundBundle.fileCount > 0
                            ? `Note + ${foundBundle.fileCount} File${
                                foundBundle.fileCount > 1 ? 's' : ''
                              } Ready (${formatBytes(foundBundle.totalSize)})`
                            : `${foundBundle.fileCount} File${
                                foundBundle.fileCount > 1 ? 's' : ''
                              } Ready (${formatBytes(foundBundle.totalSize)})`}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                        Uploaded {new Date(foundBundle.uploadedAt).toLocaleDateString()} · Expires in
                        7 days
                      </span>
                    </div>

                    <button
                      onClick={handleManualBurn}
                      disabled={isDownloading}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        cursor: 'pointer',
                        padding: 6,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                      title="Permanently Burn All"
                    >
                      <Trash2 size={14} />
                      <span>Burn</span>
                    </button>
                  </div>

                  {/* Decrypted Links & Text Note Card */}
                  {foundBundle.hasText &&
                    displayedNoteText &&
                    renderRetrievedNoteCard(false, foundBundle.fileCount > 0 ? 14 : 16)}

                  {/* List of files with individual download buttons */}
                  {foundBundle.files.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        marginBottom: 16,
                      }}
                    >
                      {foundBundle.files.map((fileItem) => (
                        <div
                          key={fileItem.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 12px',
                            borderRadius: 10,
                            backgroundColor: Colors.bg.elevated,
                            border: `1px solid ${Colors.border}`,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              minWidth: 0,
                              flex: 1,
                            }}
                          >
                            {getFileIcon(fileItem.type, fileItem.name)}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: Colors.text.primary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {fileItem.name}
                              </p>
                              <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                                {formatBytes(fileItem.size)}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDownloadSingle(fileItem)}
                            disabled={isDownloading}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              border: `1px solid ${Colors.border}`,
                              backgroundColor: Colors.bg.primary,
                              color: Colors.accent.primary,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginLeft: 8,
                              flexShrink: 0,
                            }}
                          >
                            <Download size={13} />
                            <span>Save</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Status Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {foundBundle.burnOnDownload && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: 999,
                          backgroundColor: '#FEE2E2',
                          color: '#B91C1C',
                        }}
                      >
                        <Flame size={12} />
                        Burns after retrieval
                      </span>
                    )}

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: 999,
                        backgroundColor: Colors.bg.elevated,
                        color: Colors.text.secondary,
                        border: `1px solid ${Colors.border}`,
                      }}
                    >
                      <Clock size={12} />
                      Expires in 7 days
                    </span>
                  </div>

                  {/* Primary Action Footer */}
                  {foundBundle.fileCount > 0 ? (
                    <button
                      onClick={handleDownloadAll}
                      disabled={isDownloading}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: 10,
                        border: 'none',
                        backgroundColor: Colors.accent.primary,
                        color: '#FFFFFF',
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: isDownloading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {isDownloading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" />
                          <span>{downloadProgressMsg || 'Decrypting & Downloading...'}</span>
                        </>
                      ) : (
                        <>
                          <DownloadCloud size={16} />
                          <span>
                            {foundBundle.fileCount > 1
                              ? `Decrypt & Download All (${foundBundle.fileCount} Files)`
                              : 'Decrypt & Download File'}
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => handleCopyNoteAndMaybeBurn(foundBundle.burnOnDownload)}
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: 'none',
                          backgroundColor: Colors.accent.primary,
                          color: '#FFFFFF',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                        }}
                      >
                        <Copy size={15} />
                        <span>
                          {foundBundle.burnOnDownload
                            ? 'Copy All & Burn from Cloud'
                            : 'Copy All Links / Text'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSaveTextAndMaybeBurn(foundBundle.burnOnDownload)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 10,
                          border: `1px solid ${Colors.border}`,
                          backgroundColor: Colors.bg.elevated,
                          color: Colors.text.primary,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          flexShrink: 0,
                        }}
                        title={
                          foundBundle.burnOnDownload
                            ? 'Download .txt & Burn from cloud'
                            : 'Save as .txt'
                        }
                      >
                        <Download size={15} />
                        <span>.txt</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


export const QuickDropModal: React.FC<QuickDropModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
  initialTab = 'upload',
}) => {
  return (
    <QuickDropPanel
      isOpen={isOpen}
      onClose={onClose}
      initialCode={initialCode}
      initialTab={initialTab}
      embedded={false}
    />
  );
};
