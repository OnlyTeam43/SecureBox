// client/src/components/QuickDropModal.tsx
// Zero-Login Ephemeral Media & Document Shuttle
// Upload images, videos, and docs on any PC -> Download securely anywhere with a custom numeric code

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
  Lock,
  ArrowRight,
  ExternalLink,
  Trash2,
} from 'lucide-react';
import {
  uploadToQuickDrop,
  lookupQuickDrop,
  downloadAndDecryptQuickDrop,
  deleteQuickDrop,
  QuickDropMeta,
  QuickDropFileRecord,
} from '../services/quickdrop';

interface QuickDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
  initialTab?: 'upload' | 'retrieve';
}

function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getFileIcon(type: string, name: string) {
  const lower = name.toLowerCase();
  if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(lower)) {
    return <ImageIcon size={28} color="#D97757" />;
  }
  if (type.startsWith('video/') || /\.(mp4|webm|mkv|mov|avi)$/i.test(lower)) {
    return <Video size={28} color="#4A8B88" />;
  }
  if (type.startsWith('text/') || /\.(pdf|doc|docx|xls|xlsx|txt|csv|json)$/i.test(lower)) {
    return <FileText size={28} color="#5E9473" />;
  }
  return <GenericFile size={28} color={Colors.text.secondary} />;
}

export const QuickDropModal: React.FC<QuickDropModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
  initialTab = 'upload',
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'retrieve'>(initialTab);

  // Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customCode, setCustomCode] = useState<string>('');
  const [burnOnDownload, setBurnOnDownload] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<{
    code: string;
    meta: QuickDropMeta;
    shareUrl: string;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Retrieve State
  const [searchCode, setSearchCode] = useState<string>(initialCode);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundRecord, setFoundRecord] = useState<QuickDropFileRecord | null>(null);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Copy Feedback
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Generate random 6-digit code
  const generateRandomCode = () => {
    const num = Math.floor(100000 + Math.random() * 900000);
    setCustomCode(num.toString());
  };

  // If initialCode changes, set search state
  useEffect(() => {
    if (initialCode) {
      setSearchCode(initialCode);
      setActiveTab('retrieve');
    }
  }, [initialCode]);

  // Set default random code when switching to upload tab if empty
  useEffect(() => {
    if (activeTab === 'upload' && !customCode && !uploadSuccess) {
      generateRandomCode();
    }
  }, [activeTab]);

  if (!isOpen) return null;

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadError(null);
    }
  };

  // Handle Upload Submission
  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select an image, video, or document to upload.');
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

      const { meta } = await uploadToQuickDrop(selectedFile, cleanCode, burnOnDownload);

      const baseUrl = window.location.origin;
      const shareUrl = `${baseUrl}/drop#code=${cleanCode}`;

      setUploadSuccess({
        code: cleanCode,
        meta,
        shareUrl,
      });
    } catch (err: any) {
      console.error('QuickDrop upload error:', err);
      setUploadError(err.message || 'Upload failed. Please check your internet connection.');
    } finally {
      setIsUploading(false);
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
      setFoundRecord(null);
      setDownloadSuccess(null);

      const record = await lookupQuickDrop(cleanCode);
      if (!record) {
        setSearchError('No active file found for this code. It may have expired (7 days), already been burned, or the code was entered incorrectly.');
      } else {
        setFoundRecord(record);
      }
    } catch (err: any) {
      setSearchError(err.message || 'Lookup failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Download & Decrypt
  const handleDownload = async () => {
    if (!foundRecord) return;
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');

    try {
      setIsDownloading(true);
      setSearchError(null);

      const { burned } = await downloadAndDecryptQuickDrop(cleanCode, foundRecord.meta);

      if (burned) {
        setDownloadSuccess('File successfully decrypted, downloaded, and permanently BURNED from the cloud!');
        setFoundRecord(null);
      } else {
        setDownloadSuccess('File successfully decrypted and downloaded!');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      setSearchError(err.message || 'Decryption failed. Please confirm the numeric code.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle Manual Delete / Burn
  const handleManualBurn = async () => {
    if (!foundRecord) return;
    const cleanCode = searchCode.trim().replace(/[-\s]/g, '');
    if (!confirm('Are you sure you want to permanently delete this file now? It cannot be recovered.')) {
      return;
    }

    const ok = await deleteQuickDrop(cleanCode);
    if (ok) {
      setFoundRecord(null);
      setDownloadSuccess('File has been permanently burned and deleted from the cloud.');
    } else {
      setSearchError('Could not delete file.');
    }
  };

  const copyToClipboard = (text: string, type: 'code' | 'link') => {
    navigator.clipboard.writeText(text);
    if (type === 'code') {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 540,
          maxHeight: '92vh',
          backgroundColor: Colors.bg.elevated,
          borderRadius: 18,
          border: `1px solid ${Colors.border}`,
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
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
                  QuickDrop
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
                Anonymous Cross-Device Media & Doc Transfer
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
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
              cursor: 'pointer',
            }}
            title="Close"
          >
            <X size={16} />
          </button>
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
            onClick={() => setActiveTab('upload')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              backgroundColor: activeTab === 'upload' ? Colors.bg.elevated : 'transparent',
              borderBottom: activeTab === 'upload' ? `2px solid ${Colors.accent.primary}` : '2px solid transparent',
              color: activeTab === 'upload' ? Colors.text.primary : Colors.text.secondary,
              fontWeight: activeTab === 'upload' ? 700 : 500,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <UploadCloud size={16} />
            <span>Upload & Drop</span>
          </button>

          <button
            onClick={() => setActiveTab('retrieve')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              backgroundColor: activeTab === 'retrieve' ? Colors.bg.elevated : 'transparent',
              borderBottom: activeTab === 'retrieve' ? `2px solid ${Colors.accent.primary}` : '2px solid transparent',
              color: activeTab === 'retrieve' ? Colors.text.primary : Colors.text.secondary,
              fontWeight: activeTab === 'retrieve' ? 700 : 500,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <DownloadCloud size={16} />
            <span>Search & Retrieve</span>
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: UPLOAD */}
          {activeTab === 'upload' && (
            <div>
              {!uploadSuccess ? (
                <div>
                  {/* Drag & Drop Zone */}
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: `2px dashed ${isDragOver ? Colors.accent.primary : Colors.border}`,
                      borderRadius: 14,
                      padding: '24px 16px',
                      textAlign: 'center',
                      backgroundColor: isDragOver ? Colors.accent.soft : Colors.bg.secondary,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      marginBottom: 16,
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setSelectedFile(e.target.files[0]);
                          setUploadError(null);
                        }
                      }}
                    />

                    {selectedFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                        <div
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 10,
                            backgroundColor: Colors.bg.elevated,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {getFileIcon(selectedFile.type, selectedFile.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p
                            style={{
                              margin: '0 0 2px 0',
                              fontSize: 14,
                              fontWeight: 600,
                              color: Colors.text.primary,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {selectedFile.name}
                          </p>
                          <p style={{ margin: 0, fontSize: 12, color: Colors.text.secondary }}>
                            {formatBytes(selectedFile.size)} · Click or drop another to replace
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            width: 52,
                            height: 52,
                            borderRadius: '50%',
                            backgroundColor: Colors.bg.elevated,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px auto',
                            color: Colors.accent.primary,
                          }}
                        >
                          <UploadCloud size={26} />
                        </div>
                        <p
                          style={{
                            margin: '0 0 6px 0',
                            fontSize: 14,
                            fontWeight: 600,
                            color: Colors.text.primary,
                          }}
                        >
                          Click to select or drag & drop files here
                        </p>
                        <p style={{ margin: 0, fontSize: 12, color: Colors.text.secondary }}>
                          Supports Images, Videos, PDFs, and Documents (up to 150 MB)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Custom Numeric Code Input */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                        Choose Your Numeric Pickup Code
                      </label>
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
                    </div>

                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={customCode}
                        onChange={(e) => setCustomCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
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
                        }}
                      />
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: 11, color: Colors.text.secondary }}>
                      Pick any 4 to 8-digit number you can easily remember when you get to your other device.
                    </p>
                  </div>

                  {/* Security & Lifecycle Badges */}
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      backgroundColor: Colors.bg.secondary,
                      border: `1px solid ${Colors.border}`,
                      marginBottom: 20,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    {/* Burn Toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={burnOnDownload}
                        onChange={(e) => setBurnOnDownload(e.target.checked)}
                        style={{ accentColor: Colors.accent.primary, width: 16, height: 16 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Flame size={14} color="#EF4444" />
                          <span style={{ fontSize: 13, fontWeight: 600, color: Colors.text.primary }}>
                            Burn after first download
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: Colors.text.secondary }}>
                          File permanently deletes from cloud the instant you download it at home.
                        </p>
                      </div>
                    </label>

                    {/* Expiration Note */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, borderTop: `1px solid ${Colors.border}` }}>
                      <Clock size={13} color={Colors.text.secondary} />
                      <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                        Hard auto-delete: Any unretrieved file is wiped automatically in 7 days.
                      </span>
                    </div>

                    {/* Zero-Knowledge Note */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={13} color="#5E9473" />
                      <span style={{ fontSize: 11, color: Colors.text.secondary }}>
                        Client-side AES-256 encrypted before upload. The cloud cannot read your files.
                      </span>
                    </div>
                  </div>

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
                      <AlertCircle size={15} />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {/* Upload Button */}
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !selectedFile}
                    style={{
                      width: '100%',
                      padding: '14px',
                      borderRadius: 12,
                      border: 'none',
                      backgroundColor: isUploading || !selectedFile ? Colors.bg.secondary : Colors.accent.primary,
                      color: isUploading || !selectedFile ? Colors.text.secondary : '#FFFFFF',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: isUploading || !selectedFile ? 'not-allowed' : 'pointer',
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
                        <span>Encrypting & Uploading...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud size={18} />
                        <span>Encrypt & Drop File</span>
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
                    File Ready for Pickup!
                  </h3>
                  <p style={{ margin: '0 0 18px 0', fontSize: 13, color: Colors.text.secondary }}>
                    You can safely close this browser or sign out. Pick it up from any device.
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
                    <span style={{ fontSize: 11, fontWeight: 700, color: Colors.text.secondary, textTransform: 'uppercase' }}>
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

                    {/* QR Code Image */}
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
                      setSelectedFile(null);
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
                    Drop another file
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RETRIEVE & DOWNLOAD */}
          {activeTab === 'retrieve' && (
            <div>
              <p style={{ margin: '0 0 14px 0', fontSize: 13, color: Colors.text.secondary }}>
                Enter the numeric code you created when uploading to find and decrypt your file.
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
                  {isSearching ? <RefreshCw size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
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
                  <Check size={18} />
                  <span>{downloadSuccess}</span>
                </div>
              )}

              {/* Found File Card */}
              {foundRecord && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 14,
                    backgroundColor: Colors.bg.secondary,
                    border: `1px solid ${Colors.border}`,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        backgroundColor: Colors.bg.elevated,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {getFileIcon(foundRecord.meta.type, foundRecord.meta.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: '0 0 2px 0',
                          fontSize: 15,
                          fontWeight: 700,
                          color: Colors.text.primary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {foundRecord.meta.name}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: Colors.text.secondary }}>
                        {formatBytes(foundRecord.meta.size)} · Uploaded {new Date(foundRecord.meta.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Status Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {foundRecord.meta.burnOnDownload && (
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
                        Burns after this download
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

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDownload}
                      disabled={isDownloading}
                      style={{
                        flex: 1,
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
                          <span>Decrypting & Saving...</span>
                        </>
                      ) : (
                        <>
                          <DownloadCloud size={16} />
                          <span>Decrypt & Download</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={handleManualBurn}
                      disabled={isDownloading}
                      style={{
                        padding: '12px',
                        borderRadius: 10,
                        border: `1px solid ${Colors.border}`,
                        backgroundColor: Colors.bg.elevated,
                        color: '#EF4444',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Permanently Burn File Now"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
