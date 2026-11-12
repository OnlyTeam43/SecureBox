// Minimal strict typing for Chrome Extension Manifest V3 APIs used by SecureBox Dropbox

export interface ChromeTabInfo {
  id?: number;
  windowId: number;
  url?: string;
  title?: string;
}

export interface ContextMenuClickInfo {
  menuItemId: string | number;
  selectionText?: string;
  linkUrl?: string;
  pageUrl?: string;
  srcUrl?: string;
}

export interface ChromeStorageChanges {
  [key: string]: {
    oldValue?: unknown;
    newValue?: unknown;
  };
}

declare global {
  interface Window {
    chrome?: ChromeGlobal;
  }
  const chrome: ChromeGlobal | undefined;
}

export interface ChromeGlobal {
  runtime?: {
    getURL: (path: string) => string;
    lastError?: { message?: string };
    onInstalled?: {
      addListener: (cb: () => void) => void;
    };
  };
  tabs?: {
    query: (
      queryInfo: { active: boolean; currentWindow: boolean },
      cb: (tabs: ChromeTabInfo[]) => void
    ) => void;
    create: (createProperties: { url: string }) => void;
  };
  sidePanel?: {
    open?: (options: { windowId: number }) => Promise<void>;
    setPanelBehavior?: (options: { openPanelOnActionClick: boolean }) => Promise<void>;
  };
  contextMenus?: {
    removeAll: (cb?: () => void) => void;
    create: (createProperties: {
      id: string;
      title: string;
      contexts: Array<'page' | 'selection' | 'link' | 'image'>;
    }) => void;
    onClicked: {
      addListener: (cb: (info: ContextMenuClickInfo, tab?: ChromeTabInfo) => void) => void;
    };
  };
  storage?: {
    local: {
      get: (
        keys: string | string[],
        cb: (items: Record<string, any>) => void
      ) => void;
      set: (items: Record<string, unknown>, cb?: () => void) => void;
      remove: (keys: string | string[], cb?: () => void) => void;
    };
    onChanged?: {
      addListener: (
        cb: (changes: ChromeStorageChanges, areaName: string) => void
      ) => void;
      removeListener: (
        cb: (changes: ChromeStorageChanges, areaName: string) => void
      ) => void;
    };
  };
}
