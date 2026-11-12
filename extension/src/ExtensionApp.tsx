// extension/src/ExtensionApp.tsx
// Chrome Extension Manifest V3 Shell for SecureBox Dropbox (QuickDrop)

import React, { useState, useEffect, useCallback } from 'react';
import { Link2, ExternalLink, Maximize2, PanelRight } from 'lucide-react';
import { QuickDropPanel } from '../../client/src/components/QuickDropModal';
import { BrickWallPeeker } from '../../client/src/components/BrickWallPeeker';
import './chrome-api.d';

const DRAFT_STORAGE_KEY = 'sbox_pending_draft';
const DRAFT_MAX_AGE_MS = 5 * 60 * 1000;

interface PendingDraft {
  text?: string;
  createdAt?: number;
}

export const ExtensionApp: React.FC = () => {
  const isPopup =
    typeof window !== 'undefined' &&
    window.location.pathname.toLowerCase().endsWith('popup.html');

  const [pendingNote, setPendingNote] = useState<string>('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    document.body.className = isPopup ? 'is-popup' : 'is-panel';
  }, [isPopup]);

  const showNotice = useCallback((msg: string) => {
    setStatusNotice(msg);
    setTimeout(() => setStatusNotice(null), 2600);
  }, []);

  // Load any link or highlighted text queued from right-click context menu
  useEffect(() => {
    const extStorage = window.chrome?.storage;
    if (!extStorage) return;

    const consumeDraft = (raw: PendingDraft | undefined) => {
      if (!raw || !raw.text) return;
      if (raw.createdAt && Date.now() - raw.createdAt > DRAFT_MAX_AGE_MS) {
        extStorage.local.remove(DRAFT_STORAGE_KEY);
        return;
      }
      setPendingNote(raw.text);
      extStorage.local.remove(DRAFT_STORAGE_KEY);
    };

    extStorage.local.get(DRAFT_STORAGE_KEY, (items) => {
      consumeDraft(items?.[DRAFT_STORAGE_KEY] as PendingDraft | undefined);
    });

    const onChanged = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string
    ) => {
      if (areaName !== 'local' || !changes[DRAFT_STORAGE_KEY]) return;
      consumeDraft(changes[DRAFT_STORAGE_KEY].newValue as PendingDraft | undefined);
    };

    extStorage.onChanged?.addListener(onChanged);
    return () => {
      extStorage.onChanged?.removeListener(onChanged);
    };
  }, []);

  const handleGrabActiveTab = () => {
    const tabsApi = window.chrome?.tabs;
    if (!tabsApi) {
      showNotice('Tab capture requires Chrome extension runtime.');
      return;
    }

    tabsApi.query({ active: true, currentWindow: true }, (tabs) => {
      const active = tabs?.[0];
      const url = active?.url?.trim() || '';
      if (!url || !/^https?:\/\//i.test(url)) {
        showNotice('Open a regular https:// webpage first to capture its link.');
        return;
      }
      setPendingNote(url);
      showNotice('Added active tab URL!');
    });
  };

  const openFullTab = () => {
    const ext = window.chrome;
    const url = ext?.runtime?.getURL('panel.html?view=tab');
    if (url && ext?.tabs) {
      ext.tabs.create({ url });
      if (isPopup) window.close();
    }
  };

  const openSidePanelOrTab = () => {
    const ext = window.chrome;
    if (!ext?.tabs || !ext?.sidePanel?.open) {
      openFullTab();
      return;
    }

    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const windowId = tabs?.[0]?.windowId;
      if (windowId && ext.sidePanel?.open) {
        ext.sidePanel
          .open({ windowId })
          .then(() => {
            if (isPopup) window.close();
          })
          .catch(() => openFullTab());
      } else {
        openFullTab();
      }
    });
  };

  return (
    <div
      style={{
        minHeight: isPopup ? undefined : '100vh',
        backgroundColor: '#FAF9F6',
        padding: isPopup ? '10px' : '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Compact Chrome Extension Toolbar Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
          padding: '8px 12px',
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E7E5E4',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BrickWallPeeker width={24} height={20} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#141518', lineHeight: 1.15 }}>
              SecureBox <span style={{ color: '#D96B43' }}>QuickDrop</span>
            </div>
            <div style={{ fontSize: 10, color: '#78716C', fontWeight: 500 }}>
              Chrome Extension · AES-256-GCM
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleGrabActiveTab}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 9px',
              borderRadius: 8,
              border: '1px solid #E7E5E4',
              backgroundColor: '#FAF9F6',
              color: '#D96B43',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Grab active tab URL into QuickDrop"
          >
            <Link2 size={12} />
            <span>+ Tab URL</span>
          </button>

          {isPopup && (
            <>
              <button
                type="button"
                onClick={openSidePanelOrTab}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 9px',
                  borderRadius: 8,
                  border: '1px solid #E7E5E4',
                  backgroundColor: '#141518',
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Open Chrome Side Panel (keeps file picker open)"
              >
                <PanelRight size={12} />
                <span>Side Panel</span>
              </button>

              <button
                type="button"
                onClick={openFullTab}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '5px 7px',
                  borderRadius: 8,
                  border: '1px solid #E7E5E4',
                  backgroundColor: '#FFFFFF',
                  color: '#57534E',
                  cursor: 'pointer',
                }}
                title="Open QuickDrop in Full Extension Tab"
              >
                <Maximize2 size={12} />
              </button>
            </>
          )}

          <a
            href="https://thesecurebox.vercel.app/dropbox"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '5px 8px',
              borderRadius: 8,
              border: '1px solid #E7E5E4',
              backgroundColor: '#FFFFFF',
              color: '#57534E',
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
            }}
            title="Open SecureBox QuickDrop on Web"
          >
            <span>Web</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </header>

      {statusNotice && (
        <div
          style={{
            padding: '7px 12px',
            borderRadius: 9,
            backgroundColor: '#F5EBE6',
            border: '1px solid #F0CFC2',
            color: '#9A4324',
            fontSize: 11,
            fontWeight: 600,
            textAlign: 'center',
          }}
        >
          {statusNotice}
        </div>
      )}

      {/* Embedded QuickDropPanel (shares 100% crypto, upload & retrieval flow with /dropbox) */}
      <QuickDropPanel
        isOpen
        embedded
        externalNote={pendingNote}
        onExternalNoteConsumed={() => setPendingNote('')}
        isExtensionPopup={isPopup}
        onOpenFullPanel={openSidePanelOrTab}
      />
    </div>
  );
};
