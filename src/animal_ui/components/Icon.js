import React from 'react';
import {
  ArrowUp,
  Check,
  ChevronLeft,
  Headphones,
  HeadphoneOff,
  Lock,
  Mic,
  MicOff,
  MoreHorizontal,
  Phone,
  PhoneOff,
  Plus,
  Send,
  Settings,
  SwitchCamera,
  Video,
  VideoOff,
  X,
} from 'lucide-react-native';
import { useColors } from '../theme/ThemeProvider.js';

export const ICONS = {
  send: Send,
  sendUp: ArrowUp,
  mic: Mic,
  micOff: MicOff,
  phone: Phone,
  hangUp: PhoneOff,
  video: Video,
  videoOff: VideoOff,
  headphones: Headphones,
  headphonesOff: HeadphoneOff,
  flipCamera: SwitchCamera,
  back: ChevronLeft,
  add: Plus,
  close: X,
  check: Check,
  more: MoreHorizontal,
  lock: Lock,
  settings: Settings,
};

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
}) {
  const c = useColors();
  const Component = ICONS[name];
  if (!Component) return null;
  return <Component size={size} color={color ?? c.text} strokeWidth={strokeWidth} />;
}
