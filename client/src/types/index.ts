// client/src/types/index.ts

export type ScreenMode = 'game' | 'hub' | 'join' | 'chat';

export interface RoomMetadata {
  roomId: string;
  secretKey: string;
  myHandle: string;
  partnerHandle: string | null;
  isCreator: boolean;
  createdAt: number;
  expiresAt?: number;
  pinHash?: string;
}

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  media?: string | null;
  timestamp: number;
  isOutgoing: boolean;
  status?: 'sent' | 'delivered' | 'seen';
  replyTo?: {
    id: string;
    sender: string;
    text: string;
    media?: string | null;
  } | null;
}

export interface EncryptedPayload {
  iv: string;
  data: string;
}

export interface RoomStateResponse {
  success: boolean;
  isCreator: boolean;
  isFull: boolean;
  partner: string | null;
  error?: string;
}
