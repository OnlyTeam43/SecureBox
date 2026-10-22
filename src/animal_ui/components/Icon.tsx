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
import { useColors } from '../theme/ThemeProvider';

// Outline icons, 24px grid, thin stroke: the same look as the Claude app.
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

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const colors = useColors();
  const Cmp = ICONS[name];
  return <Cmp size={size} color={color ?? colors.text} strokeWidth={strokeWidth} />;
}
