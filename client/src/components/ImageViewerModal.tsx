// client/src/components/ImageViewerModal.tsx
import React, { useState, useEffect } from 'react';
import { Colors } from '../theme/tokens';
import { X, ZoomIn, ZoomOut, Download, RotateCcw } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ imageUrl, onClose }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imageUrl, onClose]);

  if (!imageUrl) return null;

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.5, 4));
  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `securebox_image_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const onPointerUp = () => setIsDragging(false);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(15, 15, 14, 0.94)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Top Controls Bar */}
      <div
        style={{
          height: 60,
          padding: '0 16px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(26, 26, 24, 0.75)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
          flexShrink: 0,
        }}
      >
        {/* Left: Close Button */}
        <button
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
          title="Close (Esc)"
        >
          <X size={18} />
          <span>Close</span>
        </button>

        {/* Center: Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: zoom <= 1 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: zoom <= 1 ? 'default' : 'pointer',
            }}
            title="Zoom Out"
          >
            <ZoomOut size={17} />
          </button>

          <span
            onClick={handleResetZoom}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#FFFFFF',
              minWidth: 46,
              textAlign: 'center',
              cursor: 'pointer',
              padding: '4px 6px',
              borderRadius: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            }}
            title="Reset Zoom"
          >
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: zoom >= 4 ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: zoom >= 4 ? 'default' : 'pointer',
            }}
            title="Zoom In"
          >
            <ZoomIn size={17} />
          </button>

          {zoom > 1 && (
            <button
              onClick={handleResetZoom}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Reset Zoom"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>

        {/* Right: Download Button */}
        <button
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            backgroundColor: Colors.accent.primary,
            border: 'none',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Download Image to Device"
        >
          <Download size={16} />
          <span>Save</span>
        </button>
      </div>

      {/* Main Image Area with Zoom & Pan */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          padding: 16,
          boxSizing: 'border-box',
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        onDoubleClick={() => {
          if (zoom === 1) setZoom(2);
          else handleResetZoom();
        }}
      >
        <img
          src={imageUrl}
          alt="Encrypted view"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: 8,
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            pointerEvents: 'auto',
          }}
          draggable={false}
        />
      </div>

      {/* Bottom Hint */}
      <div
        style={{
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.5)',
          paddingBottom: 'env(safe-area-inset-bottom, 6px)',
          backgroundColor: 'rgba(26, 26, 24, 0.5)',
        }}
      >
        <span>Double-tap to zoom • Click Save to download</span>
      </div>
    </div>
  );
};
