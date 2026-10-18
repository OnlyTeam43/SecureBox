// src/screens/main/CallScreen.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Image,
  Platform,
  PermissionsAndroid,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import {
  UserAvatarIcon,
  MicIcon,
  MicOffIcon,
  SpeakerIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
  CameraFlipIcon,
} from '../../components/Icons';
import { useUserStore } from '../../store/useUserStore';
import { callService } from '../../services/callService';
import { callAudioService } from '../../services/callAudioService';
import { webrtcService } from '../../services/webrtcService';
import { getContactByHandle } from '../../db/database';
import { getAvatar } from '../../constants/avatars';

// Safely require RTCView if native WebRTC is compiled
let RTCView = null;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch (_) {}

export default function CallScreen({ route, navigation }) {
  const {
    callId: initialCallId,
    contactHandle,
    contactNickname,
    contactAvatarId,
    callType = 'voice',
    isIncoming = false,
  } = route.params || {};

  const insets = useSafeAreaInsets();
  const myHandle = useUserStore((s) => s.handle);
  const myNickname = useUserStore((s) => s.nickname);
  const myAvatarId = useUserStore((s) => s.avatarId || s.avatarUri);

  const [contactAvatar, setContactAvatar] = useState(contactAvatarId || null);

  useEffect(() => {
    if (contactAvatarId) {
      setContactAvatar(contactAvatarId);
    } else if (contactHandle) {
      const cleanH = contactHandle.replace('@', '').trim().toLowerCase();
      getContactByHandle(cleanH)
        .then((contact) => {
          if (contact?.avatarId) {
            setContactAvatar(contact.avatarId);
          }
        })
        .catch(() => {});
    }
  }, [contactHandle, contactAvatarId]);

  const [callId, setCallId] = useState(initialCallId || null);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'Connected' : 'Calling...');
  const [isConnected, setIsConnected] = useState(isIncoming);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Live video streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(12)).current;
  const waveAnim2 = useRef(new Animated.Value(24)).current;
  const waveAnim3 = useRef(new Animated.Value(16)).current;
  const waveAnim4 = useRef(new Animated.Value(28)).current;
  const waveAnim5 = useRef(new Animated.Value(14)).current;

  const durationTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const isEndingRef = useRef(false);

  // Format MM:SS
  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  useEffect(() => {
    // Pulse animation
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.12,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    // Waveform bars animation
    const wave = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(waveAnim1, { toValue: 32, duration: 400, useNativeDriver: false }),
          Animated.timing(waveAnim2, { toValue: 14, duration: 350, useNativeDriver: false }),
          Animated.timing(waveAnim3, { toValue: 38, duration: 450, useNativeDriver: false }),
          Animated.timing(waveAnim4, { toValue: 18, duration: 380, useNativeDriver: false }),
          Animated.timing(waveAnim5, { toValue: 30, duration: 420, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.timing(waveAnim1, { toValue: 14, duration: 400, useNativeDriver: false }),
          Animated.timing(waveAnim2, { toValue: 30, duration: 350, useNativeDriver: false }),
          Animated.timing(waveAnim3, { toValue: 16, duration: 450, useNativeDriver: false }),
          Animated.timing(waveAnim4, { toValue: 34, duration: 380, useNativeDriver: false }),
          Animated.timing(waveAnim5, { toValue: 12, duration: 420, useNativeDriver: false }),
        ]),
      ])
    );
    wave.start();

    // Listen to video streams from webrtcService
    const unsubscribeStreams = webrtcService.onStreamUpdate(({ localStream, remoteStream }) => {
      setLocalStream(localStream);
      setRemoteStream(remoteStream);
    });

    let activeCallId = initialCallId;
    const isVideo = callType === 'video';

    const requestCallPermissions = async (isVideoCall) => {
      if (Platform.OS === 'android') {
        try {
          const perms = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
          if (isVideoCall) {
            perms.push(PermissionsAndroid.PERMISSIONS.CAMERA);
          }
          await PermissionsAndroid.requestMultiple(perms);
        } catch (err) {
          console.warn('Call permissions request error:', err);
        }
      }
    };

    const setupCall = async () => {
      await requestCallPermissions(isVideo);

      if (isIncoming) {
        // Already accepted in modal, start duration timer & start WebRTC receiver
        setIsConnected(true);
        setCallStatus('Connected');
        callAudioService.playConnectedChime();
        startDurationTimer();
        webrtcService.startCall(activeCallId, contactHandle, false, isVideo, myHandle);
      } else {
        // Outgoing call initiation
        callAudioService.playOutgoingRing();
        setCallStatus('Calling...');

        activeCallId = await callService.startCall({
          callerHandle: myHandle,
          callerNickname: myNickname,
          callerAvatarId: myAvatarId,
          receiverHandle: contactHandle,
          callType,
        });
        setCallId(activeCallId);

        // 35s timeout if no answer
        timeoutTimerRef.current = setTimeout(() => {
          handleCallTermination('No Answer');
        }, 35000);
      }

      // Listen for call events
      if (activeCallId) {
        const unsubscribe = callService.subscribeToCall(activeCallId, (eventType, data) => {
          if (eventType === 'ringing') {
            setCallStatus('Ringing...');
          } else if (eventType === 'accepted') {
            if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
            setIsConnected(true);
            setCallStatus('Connected');
            callAudioService.playConnectedChime();
            startDurationTimer();
            // Start WebRTC initiator (caller)
            webrtcService.startCall(activeCallId, contactHandle, true, isVideo, myHandle);
          } else if (eventType === 'signal' && data?.signalData) {
            // WebRTC peer connection signal packet
            webrtcService.handleSignal(data.signalData);
          } else if (eventType === 'rejected') {
            const reason = data?.reason === 'busy' ? 'User Busy' : 'Call Declined';
            handleCallTermination(reason);
          } else if (eventType === 'ended') {
            handleCallTermination('Call Ended');
          }
        });

        return unsubscribe;
      }
    };

    let cleanupSub = null;
    setupCall().then((unsub) => {
      cleanupSub = unsub;
    });

    return () => {
      pulse.stop();
      wave.stop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (cleanupSub) cleanupSub();
      unsubscribeStreams();
      callAudioService.stopAll();
      webrtcService.cleanup();

      if (!isEndingRef.current && activeCallId) {
        callService.endCall(activeCallId, contactHandle);
      }
    };
  }, []);

  // Bug Fix #3: When the app is minimized mid-call and brought back, the Supabase
  // call room channel may have been dropped. Re-join it so signals still flow.
  useEffect(() => {
    const handleAppStateChange = async (nextState) => {
      if (nextState === 'active' && !isEndingRef.current) {
        const active = callService.getActiveCall();
        if (active && active.callId) {
          console.log('CallScreen: App foregrounded during call — re-joining call room');
          await callService.joinCallRoom(active.callId);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const startDurationTimer = () => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    setDuration(0);
    durationTimerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const handleCallTermination = async (reason) => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    setCallStatus(reason);
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

    webrtcService.cleanup();
    await callAudioService.playEndedChime();

    setTimeout(() => {
      navigation.goBack();
    }, 1500);
  };

  const handleEndCallPress = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    setCallStatus('Ending Call...');
    webrtcService.cleanup();
    if (callId) {
      await callService.endCall(callId, contactHandle);
    }
    await callAudioService.playEndedChime();

    setTimeout(() => {
      navigation.goBack();
    }, 800);
  };

  const toggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    webrtcService.setMuted(nextMute);
  };

  const toggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    webrtcService.setVideoEnabled(!nextVideoOff);
  };

  const flipCamera = () => {
    webrtcService.switchCamera();
  };

  const toggleSpeaker = async () => {
    const next = !isSpeaker;
    setIsSpeaker(next);
    await callAudioService.setSpeakerphone(next);
  };

  const isImageAvatar =
    contactAvatar &&
    (contactAvatar.startsWith('data:') ||
      contactAvatar.startsWith('file:') ||
      contactAvatar.startsWith('http'));
  const presetAvatar = !isImageAvatar && contactAvatar ? getAvatar(contactAvatar) : null;

  const isVideo = callType === 'video';
  const remoteStreamUrl = remoteStream && typeof remoteStream.toURL === 'function' ? remoteStream.toURL() : null;
  const localStreamUrl = localStream && typeof localStream.toURL === 'function' ? localStream.toURL() : null;
  const showRemoteVideo = isVideo && isConnected && !!remoteStreamUrl && RTCView;
  const showLocalPip = isVideo && !!localStreamUrl && !isVideoOff && RTCView;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0e0a10" translucent />

      {/* Full-Screen Remote Video Feed (Partner) */}
      {showRemoteVideo ? (
        <RTCView
          streamURL={remoteStreamUrl}
          objectFit="cover"
          style={StyleSheet.absoluteFill}
          zOrder={0}
        />
      ) : null}

      {/* Floating Picture-in-Picture Self Video Window */}
      {showLocalPip ? (
        <TouchableOpacity
          style={[styles.pipContainer, { top: insets.top + Spacing.md }]}
          activeOpacity={0.8}
          onPress={flipCamera}
        >
          <RTCView
            streamURL={localStreamUrl}
            objectFit="cover"
            style={styles.pipVideo}
            zOrder={1}
            mirror={true}
          />
          <View style={styles.pipFlipBadge}>
            <CameraFlipIcon size={12} color="#ffffff" />
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Top Header Overlay */}
      <View
        style={[
          styles.topInfo,
          { paddingTop: insets.top + Spacing.lg },
          showRemoteVideo && styles.topInfoOverlay,
        ]}
      >
        <View style={styles.modeBadge}>
          <Text style={styles.modeBadgeText}>
            {isVideo ? '📹 HD VIDEO CALL' : '📞 ENCRYPTED AUDIO CALL'}
          </Text>
        </View>
        <Text style={styles.name}>{contactNickname || 'Sweetheart'}</Text>
        <Text style={styles.handle}>@{contactHandle?.replace('@', '') || 'partner'}</Text>
        <Text style={[styles.status, isConnected && styles.statusConnected]}>
          {isConnected ? formatDuration(duration) : callStatus}
        </Text>
      </View>

      {/* Center Avatar & Soundwave Visualizer (Shown when voice call or waiting for video) */}
      {!showRemoteVideo && (
        <View style={styles.centerContainer}>
          <Animated.View style={[styles.avatarGlow, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatarCircle}>
              {isImageAvatar ? (
                <Image source={{ uri: contactAvatar }} style={styles.avatarPhoto} />
              ) : presetAvatar ? (
                <Image source={presetAvatar} style={styles.avatarPhoto} />
              ) : (
                <UserAvatarIcon size={68} color={Colors.accent.primary} />
              )}
            </View>
          </Animated.View>

          {isConnected ? (
            <View style={styles.waveformContainer}>
              <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim3 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim4 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim5 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
            </View>
          ) : (
            <Text style={styles.encryptionNote}>End-to-end peer encrypted</Text>
          )}
        </View>
      )}

      {/* Bottom Controls Bar */}
      <View
        style={[
          styles.controlsRow,
          { paddingBottom: insets.bottom + Spacing.xl },
          showRemoteVideo && styles.controlsRowOverlay,
        ]}
      >
        {/* Mute Button */}
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
          activeOpacity={0.7}
        >
          {isMuted ? (
            <MicOffIcon size={24} color="#ff3b30" />
          ) : (
            <MicIcon size={24} color="#ffffff" />
          )}
          <Text style={[styles.controlLabel, isMuted && { color: '#ff3b30' }]}>
            {isMuted ? 'Muted' : 'Mute'}
          </Text>
        </TouchableOpacity>

        {/* Video Call Specific Controls */}
        {isVideo && (
          <>
            {/* Cam On / Off Toggle */}
            <TouchableOpacity
              style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
              onPress={toggleVideo}
              activeOpacity={0.7}
            >
              {isVideoOff ? (
                <VideoOffIcon size={24} color="#ff3b30" />
              ) : (
                <VideoIcon size={24} color="#ffffff" />
              )}
              <Text style={[styles.controlLabel, isVideoOff && { color: '#ff3b30' }]}>
                {isVideoOff ? 'Cam Off' : 'Cam On'}
              </Text>
            </TouchableOpacity>

            {/* Flip Camera Button */}
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={flipCamera}
              activeOpacity={0.7}
            >
              <CameraFlipIcon size={24} color="#ffffff" />
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Speakerphone Toggle (shown for voice calls) */}
        {!isVideo && (
          <TouchableOpacity
            style={[styles.controlBtn, isSpeaker && styles.controlBtnActiveSpeaker]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <SpeakerIcon size={24} color={isSpeaker ? '#25d366' : '#ffffff'} />
            <Text style={[styles.controlLabel, isSpeaker && { color: '#25d366' }]}>
              {isSpeaker ? 'Speaker' : 'Earpiece'}
            </Text>
          </TouchableOpacity>
        )}

        {/* End Call Button */}
        <TouchableOpacity
          style={styles.endCallBtn}
          onPress={handleEndCallPress}
          activeOpacity={0.8}
        >
          <PhoneOffIcon size={30} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0e0a10',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topInfo: {
    alignItems: 'center',
    gap: Spacing.xs,
    width: '100%',
    zIndex: 2,
  },
  topInfoOverlay: {
    backgroundColor: 'rgba(14, 10, 16, 0.55)',
    paddingBottom: Spacing.md,
  },
  modeBadge: {
    backgroundColor: 'rgba(224, 82, 122, 0.22)',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(224, 82, 122, 0.5)',
    marginBottom: Spacing.xs,
  },
  modeBadgeText: {
    fontSize: 11,
    color: '#ffb3c6',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  name: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  handle: {
    fontSize: Typography.sizes.md,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  status: {
    fontSize: Typography.sizes.md,
    color: '#ffb3c6',
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  statusConnected: {
    color: '#25d366',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlow: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(224, 82, 122, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent.primary,
  },
  avatarCircle: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: '#1d1421',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 72,
  },
  encryptionNote: {
    marginTop: Spacing.xl,
    fontSize: Typography.sizes.xs,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    gap: 6,
    marginTop: Spacing.xl,
  },
  waveBar: {
    width: 4,
    backgroundColor: '#25d366',
    borderRadius: 2,
  },
  pipContainer: {
    position: 'absolute',
    right: Spacing.lg,
    width: 110,
    height: 155,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    zIndex: 10,
    backgroundColor: '#000',
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipFlipBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    padding: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: Spacing.lg,
    zIndex: 2,
  },
  controlsRowOverlay: {
    backgroundColor: 'rgba(14, 10, 16, 0.65)',
    paddingTop: Spacing.md,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
    borderColor: '#ff3b30',
  },
  controlBtnActiveSpeaker: {
    backgroundColor: 'rgba(37, 211, 102, 0.25)',
    borderColor: '#25d366',
  },
  controlLabel: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginTop: 3,
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#ff3b30',
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
});
