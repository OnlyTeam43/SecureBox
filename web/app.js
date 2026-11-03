/**
 * web/app.js
 * Main Orchestrator for SecureBox / Brick Smash Web Application
 * Handles E2EE, Zero-Storage Offline Relay, Camouflage & Stealth Routing
 */

import {
  generateSecretKey,
  generateRoomId,
  importSecretKey,
  encryptData,
  decryptData,
  hashPin,
} from './crypto.js';

import {
  getOrCreateRoomState,
  sendEncryptedMessage,
  fetchAndClearOfflineMessages,
  subscribeToRoom,
  sendTypingStatus,
  sendWipeSignal,
} from './supabase.js';

import { BrickSmashGame } from './game.js';

class SecureBoxApp {
  constructor() {
    this.game = null;
    this.activeRoom = null;
    this.currentScreen = 'game-screen';
    this.roomChannel = null;
    this.enteredPin = '';
    this.pendingUnlockAction = null;
    this.typingTimeout = null;

    // Dom elements
    this.elements = {};
  }

  async init() {
    this.cacheElements();
    this.initGame();
    this.bindEvents();
    this.bindCamouflageTriggers();

    // Parse URL on startup
    await this.handleRoute();
  }

  cacheElements() {
    const ids = [
      'game-screen',
      'hub-screen',
      'join-screen',
      'chat-screen',
      'pin-modal',
      'share-modal',
      'brick-canvas',
      'pin-dots',
      'hub-handle-input',
      'hub-pin-input',
      'btn-create-room',
      'rooms-list-container',
      'join-handle-input',
      'join-pin-input',
      'btn-confirm-join',
      'join-room-id-badge',
      'chat-partner-name',
      'chat-status-dot',
      'chat-status-text',
      'chat-avatar',
      'chat-messages-container',
      'typing-indicator-box',
      'composer-text-input',
      'btn-send-message',
      'btn-game-toggle',
      'btn-lock-toggle',
      'btn-room-options',
      'file-input-attachment',
      'btn-attachment-picker',
      'share-link-input',
      'btn-copy-share-link',
      'btn-open-shared-chat',
      'btn-secret-unlock',
      'game-header-logo',
      'btn-hub-game-pill',
    ];

    ids.forEach((id) => {
      this.elements[id] = document.getElementById(id);
    });
  }

  initGame() {
    const canvas = this.elements['brick-canvas'];
    if (canvas) {
      this.game = new BrickSmashGame(canvas, () => {
        this.openPinModal(() => this.showHubOrChat());
      });
      this.game.start();
    }
  }

  bindEvents() {
    // Game controls & secret triggers
    if (this.elements['btn-secret-unlock']) {
      this.elements['btn-secret-unlock'].addEventListener('click', () => {
        this.openPinModal(() => this.showHubOrChat());
      });
    }

    if (this.elements['game-header-logo']) {
      let tapCount = 0;
      let lastTap = 0;
      this.elements['game-header-logo'].addEventListener('click', () => {
        const now = Date.now();
        if (now - lastTap < 600) {
          tapCount++;
          if (tapCount >= 3) {
            tapCount = 0;
            this.openPinModal(() => this.showHubOrChat());
          }
        } else {
          tapCount = 1;
        }
        lastTap = now;
      });
    }

    if (this.elements['btn-hub-game-pill']) {
      this.elements['btn-hub-game-pill'].addEventListener('click', () => {
        this.showScreen('game-screen');
      });
    }

    // Hub create room
    if (this.elements['btn-create-room']) {
      this.elements['btn-create-room'].addEventListener('click', () => this.handleCreateRoom());
    }

    // Join room
    if (this.elements['btn-confirm-join']) {
      this.elements['btn-confirm-join'].addEventListener('click', () => this.handleConfirmJoin());
    }

    // Chat header actions
    if (this.elements['btn-game-toggle']) {
      this.elements['btn-game-toggle'].addEventListener('click', () => {
        this.showScreen('game-screen');
      });
    }

    if (this.elements['btn-lock-toggle']) {
      this.elements['btn-lock-toggle'].addEventListener('click', () => {
        this.lockRoom();
      });
    }

    if (this.elements['btn-room-options']) {
      this.elements['btn-room-options'].addEventListener('click', () => {
        this.showRoomOptions();
      });
    }

    // Composer
    if (this.elements['btn-send-message']) {
      this.elements['btn-send-message'].addEventListener('click', () => this.handleSendMessage());
    }

    if (this.elements['composer-text-input']) {
      this.elements['composer-text-input'].addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        } else {
          this.handleTyping();
        }
      });
    }

    // Attachment
    if (this.elements['btn-attachment-picker'] && this.elements['file-input-attachment']) {
      this.elements['btn-attachment-picker'].addEventListener('click', () => {
        this.elements['file-input-attachment'].click();
      });

      this.elements['file-input-attachment'].addEventListener('change', (e) => {
        this.handleFileUpload(e);
      });
    }

    // Share modal actions
    if (this.elements['btn-copy-share-link']) {
      this.elements['btn-copy-share-link'].addEventListener('click', () => {
        const link = this.elements['share-link-input'].value;
        navigator.clipboard.writeText(link).then(() => {
          this.elements['btn-copy-share-link'].textContent = '✓ Copied to Clipboard';
          setTimeout(() => {
            this.elements['btn-copy-share-link'].textContent = 'Copy Room Link';
          }, 2500);
        });
      });
    }

    if (this.elements['btn-open-shared-chat']) {
      this.elements['btn-open-shared-chat'].addEventListener('click', () => {
        this.closeModal('share-modal');
        if (this.activeRoom) {
          this.enterRoom(this.activeRoom);
        }
      });
    }

    // Keypad digits
    document.querySelectorAll('.keypad-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-key');
        this.handleKeypadPress(key);
      });
    });

    // Support keyboard typing for PIN
    window.addEventListener('keydown', (e) => {
      const modal = this.elements['pin-modal'];
      if (modal && modal.classList.contains('active')) {
        if (e.key >= '0' && e.key <= '9') {
          this.handleKeypadPress(e.key);
        } else if (e.key === 'Backspace') {
          this.handleKeypadPress('del');
        } else if (e.key === 'Escape') {
          this.closeModal('pin-modal');
        }
      }
    });

    // Close buttons on modals
    document.querySelectorAll('.modal-close-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });
  }

  bindCamouflageTriggers() {
    // Auto-lock when user switches browser tab or window blurs
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.currentScreen === 'chat-screen') {
        this.lockRoom();
      }
    });

    // Auto-lock on inactivity (60s)
    let idleTimer = null;
    const resetIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (this.currentScreen === 'chat-screen') {
          this.lockRoom();
        }
      }, 60000);
    };

    ['touchstart', 'mousemove', 'keydown', 'click'].forEach((evt) => {
      window.addEventListener(evt, resetIdle, { passive: true });
    });
    resetIdle();
  }

  showScreen(screenId) {
    document.querySelectorAll('.view-screen').forEach((el) => {
      el.classList.remove('active');
    });

    const target = this.elements[screenId];
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }

    if (screenId === 'game-screen') {
      if (this.game) this.game.start();
      document.title = 'Brick Smash | Arcade Retro Game';
    } else {
      if (this.game) this.game.stop();
      if (screenId === 'chat-screen' && this.activeRoom) {
        document.title = `Chat - ${this.activeRoom.partnerHandle || 'Private'}`;
      } else {
        document.title = 'Brick Smash | Secure Hub';
      }
    }
  }

  openModal(modalId) {
    const modal = this.elements[modalId];
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = this.elements[modalId];
    if (modal) modal.classList.remove('active');
  }

  // ─────────────────────────────────────────────────────────────
  // ROUTING & ROOM PARSING
  // ─────────────────────────────────────────────────────────────
  async handleRoute() {
    const hash = window.location.hash.slice(1);
    const search = window.location.search.slice(1);

    // Support both hash: #id=...&key=... and hash: #/room/id/key
    const params = new URLSearchParams(hash.includes('=') ? hash : search);

    const roomId = params.get('id') || params.get('room');
    const secretKey = params.get('key') || params.get('k');

    if (roomId && secretKey) {
      await this.prepareRoomFromLink(roomId, secretKey);
    } else {
      // By default, stay disguised on the retro Brick Smash game screen!
      this.showScreen('game-screen');
    }
  }

  async prepareRoomFromLink(roomId, secretKey) {
    // Check if room is already saved in this browser
    const saved = this.getSavedRoom(roomId);

    if (saved) {
      // Already a member! Prompt PIN and enter
      this.openPinModal(() => {
        this.openSavedRoom(roomId);
      });
    } else {
      // New visitor: Onboarding guest join screen
      this.pendingJoin = { roomId, secretKey };
      if (this.elements['join-room-id-badge']) {
        this.elements['join-room-id-badge'].textContent = `Room ID: ${roomId.slice(0, 10)}...`;
      }
      this.showScreen('join-screen');
    }
  }

  showHubOrChat() {
    if (this.activeRoom) {
      this.showScreen('chat-screen');
    } else {
      this.renderSavedRooms();
      this.showScreen('hub-screen');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PIN SYSTEM & LOCAL CAMOUFLAGE
  // ─────────────────────────────────────────────────────────────
  openPinModal(onSuccess) {
    this.enteredPin = '';
    this.pendingUnlockAction = onSuccess;
    this.updatePinDots();
    this.openModal('pin-modal');
  }

  async handleKeypadPress(key) {
    if (key === 'del') {
      this.enteredPin = this.enteredPin.slice(0, -1);
      this.updatePinDots();
      return;
    }

    if (this.enteredPin.length >= 6) return;

    this.enteredPin += key;
    this.updatePinDots();

    // Verify after 4 or 6 digits
    if (this.enteredPin.length >= 4) {
      const storedHash = localStorage.getItem('securebox_pin_hash');

      if (!storedHash) {
        // No PIN set yet — register this as the master PIN!
        const newHash = await hashPin(this.enteredPin);
        localStorage.setItem('securebox_pin_hash', newHash);
        this.finishPinUnlock();
        return;
      }

      const inputHash = await hashPin(this.enteredPin);
      if (inputHash === storedHash) {
        this.finishPinUnlock();
      } else if (this.enteredPin.length === 6) {
        // Incorrect 6-digit PIN
        this.shakePinKeypad();
      }
    }
  }

  updatePinDots() {
    const dotsContainer = this.elements['pin-dots'];
    if (!dotsContainer) return;

    const dots = dotsContainer.children;
    for (let i = 0; i < dots.length; i++) {
      if (i < this.enteredPin.length) {
        dots[i].classList.add('filled');
      } else {
        dots[i].classList.remove('filled');
      }
    }
  }

  shakePinKeypad() {
    const card = document.querySelector('.pin-modal-card');
    if (card) {
      card.style.animation = 'none';
      void card.offsetWidth;
      card.style.animation = 'popIn 0.2s';
    }
    this.enteredPin = '';
    this.updatePinDots();
  }

  finishPinUnlock() {
    this.closeModal('pin-modal');
    if (typeof this.pendingUnlockAction === 'function') {
      const action = this.pendingUnlockAction;
      this.pendingUnlockAction = null;
      action();
    } else {
      this.showHubOrChat();
    }
  }

  lockRoom() {
    this.showScreen('game-screen');
    this.openPinModal(() => this.showHubOrChat());
  }

  // ─────────────────────────────────────────────────────────────
  // ROOM CREATION & JOIN FLOW
  // ─────────────────────────────────────────────────────────────
  async handleCreateRoom() {
    const handleInput = this.elements['hub-handle-input'];
    const pinInput = this.elements['hub-pin-input'];

    const handle = (handleInput?.value || '').trim();
    const pin = (pinInput?.value || '').trim();

    if (!handle) {
      alert('Please enter your display name / handle.');
      return;
    }
    if (pin.length < 4) {
      alert('Please set a secret PIN of at least 4 digits.');
      return;
    }

    // Save PIN hash
    const pHash = await hashPin(pin);
    localStorage.setItem('securebox_pin_hash', pHash);

    // Generate room & 256-bit AES secret key
    const roomId = generateRoomId();
    const secretKey = await generateSecretKey();

    // Register room in Supabase (1 of 2 members)
    const roomState = await getOrCreateRoomState(roomId, handle, true);
    if (!roomState.success) {
      alert(roomState.error || 'Failed to create room.');
      return;
    }

    const roomData = {
      roomId,
      secretKey,
      myHandle: handle,
      partnerHandle: null,
      isCreator: true,
      createdAt: Date.now(),
    };

    this.saveRoom(roomData);

    // Build share link (Key is in hash fragment! Server NEVER sees it)
    const baseUrl = window.location.origin + window.location.pathname;
    const shareLink = `${baseUrl}#id=${roomId}&key=${secretKey}`;

    if (this.elements['share-link-input']) {
      this.elements['share-link-input'].value = shareLink;
    }

    this.activeRoom = roomData;
    this.openModal('share-modal');
    this.renderSavedRooms();
  }

  async handleConfirmJoin() {
    if (!this.pendingJoin) return;

    const handle = (this.elements['join-handle-input']?.value || '').trim();
    const pin = (this.elements['join-pin-input']?.value || '').trim();

    if (!handle) {
      alert('Please enter your handle to join.');
      return;
    }
    if (pin.length < 4) {
      alert('Please choose a PIN of at least 4 digits.');
      return;
    }

    // Save PIN
    const pHash = await hashPin(pin);
    localStorage.setItem('securebox_pin_hash', pHash);

    const { roomId, secretKey } = this.pendingJoin;

    // Check & lock the room to 2/2 members
    const state = await getOrCreateRoomState(roomId, handle, false);
    if (!state.success) {
      alert(state.error || 'This room is closed or full.');
      this.showScreen('game-screen');
      return;
    }

    const roomData = {
      roomId,
      secretKey,
      myHandle: handle,
      partnerHandle: state.partner || 'Partner',
      isCreator: false,
      createdAt: Date.now(),
    };

    this.saveRoom(roomData);
    this.pendingJoin = null;

    // Enter room directly!
    await this.enterRoom(roomData);
  }

  // ─────────────────────────────────────────────────────────────
  // CHAT ROOM ENGINE
  // ─────────────────────────────────────────────────────────────
  async enterRoom(roomData) {
    this.activeRoom = roomData;

    // Import the secret AES-GCM key
    try {
      this.activeRoom.cryptoKey = await importSecretKey(roomData.secretKey);
    } catch (err) {
      alert('Failed to decrypt room key. The link might be invalid.');
      return;
    }

    // Set header info
    if (this.elements['chat-partner-name']) {
      this.elements['chat-partner-name'].textContent = roomData.partnerHandle || 'Waiting for partner...';
    }
    if (this.elements['chat-avatar']) {
      const initial = (roomData.partnerHandle || 'P').charAt(0).toUpperCase();
      this.elements['chat-avatar'].textContent = initial;
    }

    this.renderMessages();
    this.showScreen('chat-screen');

    // Subscribe to realtime WebSocket channel
    this.initRealtimeSubscription();

    // Fetch and clear any offline queued messages (Zero-Storage)
    await this.fetchOfflineRelay();
  }

  initRealtimeSubscription() {
    if (!this.activeRoom) return;

    if (this.roomChannel) {
      try {
        this.roomChannel.unsubscribe();
      } catch (_) {}
    }

    this.roomChannel = subscribeToRoom(this.activeRoom.roomId, this.activeRoom.myHandle, {
      onMessage: async (payload) => {
        await this.handleIncomingCiphertext(payload);
      },
      onTyping: ({ sender, isTyping }) => {
        const typingBox = this.elements['typing-indicator-box'];
        if (typingBox) {
          typingBox.textContent = isTyping ? `${sender} is typing...` : '';
        }
      },
      onPresenceChange: (activeUsers) => {
        const cleanPartner = (this.activeRoom.partnerHandle || '').toLowerCase();
        const isOnline = activeUsers.some((u) => u.toLowerCase() === cleanPartner);

        const dot = this.elements['chat-status-dot'];
        const text = this.elements['chat-status-text'];

        if (dot) dot.classList.toggle('online', isOnline);
        if (text) text.textContent = isOnline ? 'Online' : 'Offline';
      },
    });
  }

  async fetchOfflineRelay() {
    if (!this.activeRoom) return;

    const offlinePackets = await fetchAndClearOfflineMessages(
      this.activeRoom.roomId,
      this.activeRoom.myHandle
    );

    for (const packet of offlinePackets) {
      await this.handleIncomingCiphertext(packet);
    }
  }

  async handleIncomingCiphertext({ id, sender, iv, data, timestamp }) {
    if (!this.activeRoom || !this.activeRoom.cryptoKey) return;

    // Ignore if sender is myself
    if (sender && sender.toLowerCase() === this.activeRoom.myHandle.toLowerCase()) {
      return;
    }

    // If partner wasn't known yet, register their handle
    if (!this.activeRoom.partnerHandle && sender) {
      this.activeRoom.partnerHandle = sender;
      this.saveRoom(this.activeRoom);
      if (this.elements['chat-partner-name']) {
        this.elements['chat-partner-name'].textContent = sender;
      }
    }

    // Decrypt AES-GCM ciphertext
    try {
      const decryptedString = await decryptData(this.activeRoom.cryptoKey, { iv, data });
      const messageObj = JSON.parse(decryptedString);

      this.appendMessage({
        id: id || `msg_${Date.now()}`,
        sender: sender || 'Partner',
        text: messageObj.text || '',
        media: messageObj.media || null,
        timestamp: timestamp || Date.now(),
        isOutgoing: false,
      });
    } catch (err) {
      console.warn('Failed to decrypt message:', err);
    }
  }

  async handleSendMessage() {
    const input = this.elements['composer-text-input'];
    if (!input || !this.activeRoom) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this.sendTyping(false);

    await this.postMessage({ text, media: null });
  }

  async handleFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !this.activeRoom) return;

    // Max 4MB for high-speed encryption
    if (file.size > 4 * 1024 * 1024) {
      alert('Please choose an image under 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Image = event.target.result;
      await this.postMessage({ text: '', media: base64Image });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async postMessage({ text, media }) {
    const payload = {
      text,
      media,
      timestamp: Date.now(),
      sender: this.activeRoom.myHandle,
    };

    // Encrypt in-browser with AES-GCM
    const encrypted = await encryptData(this.activeRoom.cryptoKey, payload);

    // Save locally
    this.appendMessage({
      id: `msg_${Date.now()}`,
      sender: this.activeRoom.myHandle,
      text,
      media,
      timestamp: Date.now(),
      isOutgoing: true,
    });

    // Send via Supabase WebSocket + Ephemeral Relay
    await sendEncryptedMessage({
      roomId: this.activeRoom.roomId,
      sender: this.activeRoom.myHandle,
      recipient: this.activeRoom.partnerHandle,
      encryptedPayload: encrypted,
    });
  }

  handleTyping() {
    if (!this.activeRoom) return;
    this.sendTyping(true);
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.sendTyping(false);
    }, 2000);
  }

  sendTyping(isTyping) {
    if (!this.activeRoom) return;
    sendTypingStatus(this.activeRoom.roomId, this.activeRoom.myHandle, isTyping);
  }

  appendMessage(msg) {
    const storageKey = `room_chat_${this.activeRoom.roomId}`;
    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    // Prevent duplicate entries
    if (!history.some((m) => m.id === msg.id)) {
      history.push(msg);
      localStorage.setItem(storageKey, JSON.stringify(history));
    }

    this.renderMessageBubble(msg);
    this.scrollToBottom();
  }

  renderMessages() {
    const container = this.elements['chat-messages-container'];
    if (!container || !this.activeRoom) return;

    container.innerHTML = `
      <div class="encryption-banner">
        🔒 End-to-End Encrypted (AES-GCM-256). Zero Server Storage.
      </div>
    `;

    const storageKey = `room_chat_${this.activeRoom.roomId}`;
    const history = JSON.parse(localStorage.getItem(storageKey) || '[]');

    history.forEach((msg) => {
      this.renderMessageBubble(msg);
    });

    this.scrollToBottom();
  }

  renderMessageBubble(msg) {
    const container = this.elements['chat-messages-container'];
    if (!container) return;

    const isOut = msg.isOutgoing;
    const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bubble = document.createElement('div');
    bubble.className = `message-bubble ${isOut ? 'outgoing' : 'incoming'}`;

    let mediaHtml = '';
    if (msg.media) {
      mediaHtml = `<img src="${msg.media}" class="message-image" alt="Encrypted image" />`;
    }

    let textHtml = '';
    if (msg.text) {
      textHtml = `<div class="message-text">${this.escapeHtml(msg.text)}</div>`;
    }

    bubble.innerHTML = `
      <div class="message-content">
        ${mediaHtml}
        ${textHtml}
      </div>
      <div class="message-meta">
        <span>${timeStr}</span>
        ${isOut ? '<span>✓</span>' : ''}
      </div>
    `;

    container.appendChild(bubble);
  }

  scrollToBottom() {
    const container = this.elements['chat-messages-container'];
    if (container) {
      setTimeout(() => {
        container.scrollTop = container.scrollHeight;
      }, 50);
    }
  }

  showRoomOptions() {
    if (!this.activeRoom) return;

    const action = confirm(
      'ROOM OPTIONS:\n\n' +
      '• OK: Copy Invite Link\n' +
      '• Cancel: More Options (Wipe / Leave)'
    );

    if (action) {
      const baseUrl = window.location.origin + window.location.pathname;
      const shareLink = `${baseUrl}#id=${this.activeRoom.roomId}&key=${this.activeRoom.secretKey}`;
      navigator.clipboard.writeText(shareLink).then(() => {
        alert('Room Invite Link copied to clipboard!');
      });
    } else {
      const wipe = confirm(
        'SELF-DESTRUCT / WIPE ROOM:\n\n' +
        'Do you want to permanently wipe all messages from this device and signal your partner to wipe theirs?'
      );
      if (wipe) {
        sendWipeSignal(this.activeRoom.roomId);
        localStorage.removeItem(`room_chat_${this.activeRoom.roomId}`);
        alert('Chat erased.');
        this.renderMessages();
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INVENTORY & LOCAL STORAGE HELPERS
  // ─────────────────────────────────────────────────────────────
  getSavedRooms() {
    return JSON.parse(localStorage.getItem('securebox_rooms') || '{}');
  }

  getSavedRoom(roomId) {
    const rooms = this.getSavedRooms();
    return rooms[roomId] || null;
  }

  saveRoom(roomData) {
    const rooms = this.getSavedRooms();
    rooms[roomData.roomId] = {
      roomId: roomData.roomId,
      secretKey: roomData.secretKey,
      myHandle: roomData.myHandle,
      partnerHandle: roomData.partnerHandle,
      isCreator: roomData.isCreator,
      createdAt: roomData.createdAt || Date.now(),
    };
    localStorage.setItem('securebox_rooms', JSON.stringify(rooms));
  }

  deleteSavedRoom(roomId) {
    const rooms = this.getSavedRooms();
    delete rooms[roomId];
    localStorage.setItem('securebox_rooms', JSON.stringify(rooms));
    localStorage.removeItem(`room_chat_${roomId}`);
    this.renderSavedRooms();
  }

  renderSavedRooms() {
    const listContainer = this.elements['rooms-list-container'];
    if (!listContainer) return;

    const rooms = Object.values(this.getSavedRooms());

    if (rooms.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); padding: 18px 0; font-size: 13px;">
          No active rooms yet. Tap "Create Room" above to start talking!
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';
    rooms.forEach((r) => {
      const item = document.createElement('div');
      item.className = 'room-item';
      item.innerHTML = `
        <div class="room-info">
          <div class="room-name">💬 with ${r.partnerHandle || 'Partner (Invite sent)'}</div>
          <div class="room-meta">ID: ${r.roomId.slice(0, 10)}... • As @${r.myHandle}</div>
        </div>
        <div class="room-actions">
          <button class="btn-sm-enter" data-id="${r.roomId}">Enter</button>
          <button class="btn-sm-delete" data-id="${r.roomId}" title="Delete room">✕</button>
        </div>
      `;

      item.querySelector('.btn-sm-enter').addEventListener('click', () => {
        this.openSavedRoom(r.roomId);
      });

      item.querySelector('.btn-sm-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this room and its local history?')) {
          this.deleteSavedRoom(r.roomId);
        }
      });

      listContainer.appendChild(item);
    });
  }

  openSavedRoom(roomId) {
    const room = this.getSavedRoom(roomId);
    if (room) {
      this.enterRoom(room);
    }
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Bootstrap once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const app = new SecureBoxApp();
  app.init();
  window.__secureboxApp = app;
});
