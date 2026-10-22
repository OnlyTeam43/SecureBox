// src/components/Icons.js
import React from 'react';
import Svg, { Path, Circle, Polyline, Rect, Line, Polygon } from 'react-native-svg';

export const PhoneIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </Svg>
);

export const VideoIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="23 7 16 12 23 17 23 7" />
    <Rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </Svg>
);

export const GalleryIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Circle cx="8.5" cy="8.5" r="1.5" />
    <Polyline points="21 15 16 10 5 21" />
  </Svg>
);

export const SendIcon = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="22" y1="2" x2="11" y2="13" />
    <Polygon points="22 2 15 22 11 13 2 9 22 2" />
  </Svg>
);

export const BackArrowIcon = ({ size = 24, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="19" y1="12" x2="5" y2="12" />
    <Polyline points="12 19 5 12 12 5" />
  </Svg>
);

export const TrashIcon = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="3 6 5 6 21 6" />
    <Path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </Svg>
);

export const ReplyIcon = ({ size = 18, color = '#c9506e' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 17 4 12 9 7" />
    <Path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </Svg>
);

export const CheckIcon = ({ size = 14, color = '#8a8187' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="20 6 9 17 4 12" />
  </Svg>
);

export const DoubleCheckIcon = ({ size = 15, color = '#8a8187' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M7 12l5 5l10-10" />
    <Path d="M2 12l5 5m5-5l5-5" />
  </Svg>
);

export const UserAvatarIcon = ({ size = 24, color = '#c9506e' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <Circle cx="12" cy="7" r="4" />
  </Svg>
);

export const ClockIcon = ({ size = 12, color = '#8a8187' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="10" />
    <Polyline points="12 6 12 12 16 14" />
  </Svg>
);

export const MessageTabIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </Svg>
);

export const CameraIcon = ({ size = 20, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <Circle cx="12" cy="13" r="4" />
  </Svg>
);

export const ShieldLockIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <Rect x="9" y="11" width="6" height="5" rx="1" />
    <Path d="M10 11V9a2 2 0 0 1 4 0v2" />
  </Svg>
);

export const SettingsIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="12" cy="12" r="3" />
    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Svg>
);

export const ChevronRightIcon = ({ size = 20, color = '#aaa' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9 18 15 12 9 6" />
  </Svg>
);

export const MicIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <Path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <Line x1="12" y1="19" x2="12" y2="23" />
    <Line x1="8" y1="23" x2="16" y2="23" />
  </Svg>
);

export const MicOffIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="1" y1="1" x2="23" y2="23" />
    <Path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
    <Path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
    <Line x1="12" y1="19" x2="12" y2="23" />
    <Line x1="8" y1="23" x2="16" y2="23" />
  </Svg>
);

export const SpeakerIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
    <Path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
  </Svg>
);

export const PhoneOffIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
    <Line x1="1" y1="1" x2="23" y2="23" />
  </Svg>
);

export const VideoOffIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Line x1="1" y1="1" x2="23" y2="23" />
    <Path d="M21 15.5l-5-3.5v-1l5-3.5v8z" />
    <Rect x="2" y="6" width="14" height="12" rx="2" ry="2" />
  </Svg>
);

export const CameraFlipIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M20 16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4" />
    <Polyline points="1 13 4 16 7 13" />
    <Path d="M4 8V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
    <Polyline points="23 11 20 8 17 11" />
    <Circle cx="12" cy="12" r="3" />
  </Svg>
);

export const UserCheckIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <Circle cx="8.5" cy="7" r="4" />
    <Polyline points="17 11 19 13 23 9" />
  </Svg>
);

export const ShareIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Circle cx="18" cy="5" r="3" />
    <Circle cx="6" cy="12" r="3" />
    <Circle cx="18" cy="19" r="3" />
    <Line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <Line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </Svg>
);

export const LinkIcon = ({ size = 22, color = '#222' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </Svg>
);

export const ChevronDownIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="6 9 12 15 18 9" />
  </Svg>
);

export const MoreHorizontalIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="5" cy="12" r="2.2" fill={color} />
    <Circle cx="12" cy="12" r="2.2" fill={color} />
    <Circle cx="19" cy="12" r="2.2" fill={color} />
  </Svg>
);

export const SolidVideoIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="6" width="13" height="12" rx="2.5" fill={color} />
    <Polygon points="22 8 16 12 22 16" fill={color} />
  </Svg>
);

export const SolidVideoOffIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="2" y1="2" x2="22" y2="22" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M10.5 6H13a2 2 0 0 1 2 2v2.5M15 15.5V16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <Polygon points="22 8 16 12 22 16" fill={color} />
  </Svg>
);

export const SolidSpeakerIcon = ({ size = 22, color = '#000' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9h3l4.5-4.5v15L7 15H4a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 4 9z" fill={color} />
    <Path d="M15.5 8.5a5 5 0 0 1 0 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M18.8 5.5a9.5 9.5 0 0 1 0 13" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const SolidMicIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="8.5" y="2" width="7" height="12" rx="3.5" fill={color} />
    <Path d="M5 10a7 7 0 0 0 14 0" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const SolidMicOffIcon = ({ size = 22, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Line x1="2" y1="2" x2="22" y2="22" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M9 4.5A3.5 3.5 0 0 1 15.5 6v3.5M15.5 11.5A3.5 3.5 0 0 1 9.5 14" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Path d="M5 10a7 7 0 0 0 11 5.8M19 10a7 7 0 0 1-.5 2.5" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <Line x1="8" y1="21" x2="16" y2="21" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const EndCallIcon = ({ size = 24, color = '#fff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 13.5c2.5-3.5 7-5 11-3.5 3 .9 5.5 2.5 7 3.5.8.5 1 1.6.4 2.4l-1.5 2.1c-.5.7-1.5.9-2.2.4-1.8-1.2-3.7-1.7-5.7-1.7s-3.9.5-5.7 1.7c-.7.5-1.7.3-2.2-.4L2.6 15.9c-.6-.8-.4-1.9.4-2.4z"
      fill={color}
    />
  </Svg>
);

export const CallIncomingIcon = ({ size = 16, color = '#25d366' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="16 17 7 17 7 8" />
    <Line x1="17" y1="7" x2="7" y2="17" />
  </Svg>
);

export const CallOutgoingIcon = ({ size = 16, color = '#0084ff' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="7 7 17 7 17 16" />
    <Line x1="7" y1="17" x2="17" y2="7" />
  </Svg>
);

export const CallMissedIcon = ({ size = 16, color = '#ff3b30' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="16 17 7 17 7 8" />
    <Line x1="17" y1="7" x2="7" y2="17" />
  </Svg>
);

export const BubbleTailOutgoing = ({ color = '#E02888' }) => (
  <Svg width={8} height={13} viewBox="0 0 8 13" style={{ position: 'absolute', right: -7, bottom: 0 }}>
    <Path d="M5.188 1H0v11.193l6.467-8.625C7.526 2.16 6.816 1 5.188 1z" fill={color} />
  </Svg>
);

export const BubbleTailIncoming = ({ color = '#1a1622' }) => (
  <Svg width={8} height={13} viewBox="0 0 8 13" style={{ position: 'absolute', left: -7, bottom: 0 }}>
    <Path d="M2.812 1H8v11.193L1.533 3.568C.474 2.16 1.184 1 2.812 1z" fill={color} />
  </Svg>
);

export const PanicIcon = ({ size = 20, color = '#ff3b30' }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <Polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
    <Line x1="12" y1="8" x2="12" y2="12" />
    <Line x1="12" y1="16" x2="12.01" y2="16" />
  </Svg>
);




