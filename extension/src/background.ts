// extension/src/background.ts
// Manifest V3 service worker for SecureBox Dropbox Chrome Extension
// Registers right-click context menus to send links, highlighted text, or active tab URLs into QuickDrop.

import './chrome-api.d';

const DRAFT_STORAGE_KEY = 'sbox_pending_draft';

const MENU_ITEMS = [
  {
    id: 'sbox_send_selection',
    title: 'Send Selected Text to SecureBox Dropbox',
    contexts: ['selection'] as Array<'selection'>,
  },
  {
    id: 'sbox_send_link',
    title: 'Send Link to SecureBox Dropbox',
    contexts: ['link'] as Array<'link'>,
  },
  {
    id: 'sbox_send_page',
    title: 'Send Current Page URL to SecureBox Dropbox',
    contexts: ['page'] as Array<'page'>,
  },
];

function registerContextMenus(): void {
  if (!chrome?.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    for (const item of MENU_ITEMS) {
      chrome.contextMenus?.create(item);
    }
  });
}

chrome?.runtime?.onInstalled?.addListener(() => {
  registerContextMenus();
  chrome?.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false }).catch(() => {});
});

chrome?.contextMenus?.onClicked.addListener((info, tab) => {
  let textToSend = '';
  if (info.menuItemId === 'sbox_send_link' && info.linkUrl) {
    textToSend = info.linkUrl;
  } else if (info.menuItemId === 'sbox_send_selection' && info.selectionText) {
    textToSend = info.selectionText.trim();
  } else if (info.menuItemId === 'sbox_send_page' && (tab?.url || info.pageUrl)) {
    textToSend = tab?.url || info.pageUrl || '';
  }

  if (!textToSend) return;

  chrome?.storage?.local.set(
    {
      [DRAFT_STORAGE_KEY]: {
        text: textToSend,
        createdAt: Date.now(),
      },
    },
    () => {
      if (tab?.windowId && chrome?.sidePanel?.open) {
        chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {
          const url = chrome?.runtime?.getURL('panel.html?view=tab');
          if (url) chrome?.tabs?.create({ url });
        });
      } else {
        const url = chrome?.runtime?.getURL('panel.html?view=tab');
        if (url) chrome?.tabs?.create({ url });
      }
    }
  );
});
