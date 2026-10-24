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
  BackHandler,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing } from '../../theme';
import {
  UserAvatarIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  SolidVideoIcon,
  SolidVideoOffIcon,
  SolidSpeakerIcon,
  SolidMicIcon,
  SolidMicOffIcon,
  EndCallIcon,
  CameraFlipIcon,
} from '../../components/Icons';
import { useUserStore } from '../../store/useUserStore';
import { useBadgeStore } from '../../store/useBadgeStore';
import { callService } from '../../services/callService';
import { callAudioService } from '../../services/callAudioService';
import { webrtcService } from '../../services/webrtcService';
import { getContactByHandle, insertCallLog, updateCallLogDuration, recordCallEventMessage } from '../../db/database';
import { getAvatar } from '../../constants/avatars';
import { CharacterBall } from '../../animal_ui/components/CharacterBall.js';

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
    isResume = false,
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

  // Check if this screen is returning to an already established WebRTC call (minimized call)
  const existingActive = callService.getActiveCall();
  const isResumingOngoingCall =
    Boolean(isResume) &&
    Boolean(webrtcService.peerConnection) &&
    existingActive?.status === 'connected';

  const [callId, setCallId] = useState(initialCallId || existingActive?.callId || null);
  const [callStatus, setCallStatus] = useState(
    isResumingOngoingCall ? 'Connected' : isIncoming ? 'Connected' : 'Calling...'
  );
  const [isConnected, setIsConnected] = useState(isResumingOngoingCall || isIncoming);
  const [duration, setDuration] = useState(() => {
    if (isResumingOngoingCall && existingActive?.startTime) {
      return Math.max(0, Math.floor((Date.now() - existingActive.startTime) / 1000));
    }
    return 0;
  });
  const [isMuted, setIsMuted] = useState(webrtcService.isMuted || false);
  const [isSpeaker, setIsSpeaker] = useState(true);
  const [isVideoOff, setIsVideoOff] = useState(!webrtcService.isVideoEnabled);

  // Live video streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStreamUrl, setLocalStreamUrl] = useState(null);
  const [remoteStreamUrl, setRemoteStreamUrl] = useState(null);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [, setStreamTick] = useState(0);

  // Draggable Picture-in-Picture position
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: pan.x._value,
          y: pan.y._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();
        // If it was a quick tap with minimal movement, flip camera
        if (Math.abs(gestureState.dx) < 6 && Math.abs(gestureState.dy) < 6) {
          flipCamera();
        }
      },
    })
  ).current;

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerDotAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(12)).current;
  const waveAnim2 = useRef(new Animated.Value(24)).current;
  const waveAnim3 = useRef(new Animated.Value(16)).current;
  const waveAnim4 = useRef(new Animated.Value(28)).current;
  const waveAnim5 = useRef(new Animated.Value(14)).current;

  const durationTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const isEndingRef = useRef(false);
  const durationRef = useRef(0);

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Format MM:SS
  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Hardware back press handler on Android: Go back without terminating the call
  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  useEffect(() => {
    // Pulse animation for avatar & timer dot
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

    const dotPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(timerDotAnim, {
          toValue: 1.35,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(timerDotAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    dotPulse.start();

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
    const unsubscribeStreams = webrtcService.onStreamUpdate(({ localStream: lStream, remoteStream: rStream }) => {
      setLocalStream(lStream);
      setRemoteStream(rStream);

      const lUrl = lStream && typeof lStream.toURL === 'function' ? lStream.toURL() : null;
      const rUrl = rStream && typeof rStream.toURL === 'function' ? rStream.toURL() : null;
      const rHasVideo = !!(
        rStream &&
        typeof rStream.getVideoTracks === 'function' &&
        rStream.getVideoTracks().length > 0 &&
        rStream.getVideoTracks().some((t) => t.enabled)
      );

      console.log(`CallScreen: Stream update — localUrl=${!!lUrl}, remoteUrl=${!!rUrl}, hasRemoteVideo=${rHasVideo}`);
      setLocalStreamUrl(lUrl);
      setRemoteStreamUrl(rUrl);
      setHasRemoteVideo(rHasVideo);
      setStreamTick((t) => t + 1);
    });

    let activeCallId = initialCallId || existingActive?.callId;
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

      if (isResumingOngoingCall) {
        // Returning to an ongoing call: WebRTC and audio are already running!
        console.log('CallScreen: Resuming active call session', activeCallId);
        setIsConnected(true);
        setCallStatus('Connected');
        startDurationTimer();
      } else if (isIncoming) {
        // Already accepted in incoming modal, start duration timer & start WebRTC receiver
        setIsConnected(true);
        setCallStatus('Connected');
        callAudioService.playConnectedChime();
        callAudioService.setSpeakerphone(isVideo || isSpeaker);
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
          receiverNickname: contactNickname,
          receiverAvatarId: contactAvatar,
          callType,
        });
        setCallId(activeCallId);

        // Record outgoing call in local database
        await insertCallLog({
          id: activeCallId,
          contactHandle,
          contactNickname: contactNickname || contactHandle,
          contactAvatarId: contactAvatar,
          callType,
          direction: 'outgoing',
          timestamp: Date.now(),
          duration: 0,
          seen: 1,
        }).catch(() => {});
        useBadgeStore.getState().refreshBadges();

        // 35s timeout if no answer
        timeoutTimerRef.current = setTimeout(() => {
          handleCallTermination('No Answer');
        }, 35000);
      }

      // Listen for call signaling events
      if (activeCallId) {
        const unsubscribe = callService.subscribeToCall(activeCallId, (eventType, data) => {
          if (eventType === 'ringing') {
            setCallStatus('Ringing...');
          } else if (eventType === 'accepted') {
            if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
            setIsConnected(true);
            setCallStatus('Connected');
            callAudioService.playConnectedChime();
            callAudioService.setSpeakerphone(isVideo || isSpeaker);
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
      dotPulse.stop();
      wave.stop();
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (cleanupSub) cleanupSub();
      unsubscribeStreams();

      // IMPORTANT: Only tear down WebRTC and hang up call if user tapped End Call (or call terminated)
      if (isEndingRef.current) {
        callAudioService.stopAll();
        webrtcService.cleanup();
        if (activeCallId) {
          callService.endCall(activeCallId, contactHandle);
          updateCallLogDuration(activeCallId, durationRef.current || 0).catch(() => {});
          recordCallEventMessage({
            callId: activeCallId,
            partnerHandle: contactHandle,
            myHandle,
            callType,
            direction: isIncoming ? 'incoming' : 'outgoing',
            duration: durationRef.current || 0,
          }).catch(() => {});
        }
        useBadgeStore.getState().refreshBadges();
      }
    };
  }, []);

  // Re-join call room channel if app was minimized and resumed
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

    const finalId = callId || initialCallId;
    const finalDuration = durationRef.current || 0;
    if (finalId) {
      updateCallLogDuration(finalId, finalDuration).catch(() => {});
    }

    let direction = isIncoming ? 'incoming' : 'outgoing';
    if (finalDuration === 0 && !isConnected) {
      if (reason === 'No Answer') direction = 'no_answer';
      else if (reason === 'Call Declined' || reason === 'User Busy') direction = 'declined';
    }

    recordCallEventMessage({
      callId: finalId,
      partnerHandle: contactHandle,
      myHandle,
      callType,
      direction,
      duration: finalDuration,
    }).catch(() => {});

    useBadgeStore.getState().refreshBadges();

    webrtcService.cleanup();
    await callAudioService.playEndedChime();

    setTimeout(() => {
      navigation.goBack();
    }, 1200);
  };

  const handleEndCallPress = async () => {
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    setCallStatus('Ending Call...');
    webrtcService.cleanup();

    const finalId = callId || initialCallId;
    const finalDuration = durationRef.current || 0;
    if (finalId) {
      await callService.endCall(finalId, contactHandle);
      updateCallLogDuration(finalId, finalDuration).catch(() => {});
    }

    recordCallEventMessage({
      callId: finalId,
      partnerHandle: contactHandle,
      myHandle,
      callType,
      direction: isIncoming ? 'incoming' : 'outgoing',
      duration: finalDuration,
    }).catch(() => {});

    useBadgeStore.getState().refreshBadges();
    await callAudioService.playEndedChime();

    setTimeout(() => {
      navigation.goBack();
    }, 600);
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
  const showRemoteVideo = isVideo && isConnected && hasRemoteVideo && !!remoteStreamUrl && !!RTCView;
  const showLocalPip = isVideo && !!localStreamUrl && !isVideoOff && !!RTCView;

  const displayName =
    contactNickname ||
    contactHandle?.replace('@', '').trim() ||
    'Partner';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0d" translucent />

      {/* 1. Full-Screen Remote Video Feed (Edge-to-Edge) */}
      {showRemoteVideo ? (
        <RTCView
          streamURL={remoteStreamUrl}
          objectFit="cover"
          style={StyleSheet.absoluteFill}
          zOrder={0}
        />
      ) : null}

      {/* 2. Moveable / Draggable Picture-in-Picture Local Video Window */}
      {showLocalPip ? (
        <Animated.View
          style={[
            styles.pipContainer,
            {
              top: insets.top + 58,
              right: 16,
              transform: pan.getTranslateTransform(),
            },
          ]}
          {...panResponder.panHandlers}
        >
          <RTCView
            streamURL={localStreamUrl}
            objectFit="cover"
            style={styles.pipVideo}
            zOrder={1}
            mirror={true}
          />
          <TouchableOpacity
            style={styles.pipFlipBadge}
            onPress={flipCamera}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <CameraFlipIcon size={12} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>
      ) : null}

      {/* 3. Sleek Floating Header Bar (Minimize button, Name, and Mind-Hack Timer) */}
      <View
        style={[
          styles.headerRow,
          { paddingTop: insets.top + Spacing.sm },
          showRemoteVideo && styles.headerRowScrim,
        ]}
      >
        {/* Left: Minimize / Back Button (Leaves call active) */}
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.7}
        >
          <ChevronDownIcon size={22} color="#ffffff" />
        </TouchableOpacity>

        {/* Center: Contact Name & Mind-Hack Glass Timer */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName}
          </Text>

          <View style={styles.timerPill}>
            <Animated.View
              style={[
                styles.timerDot,
                isConnected ? styles.timerDotLive : styles.timerDotCalling,
                { transform: [{ scale: timerDotAnim }] },
              ]}
            />
            <Text style={styles.timerText}>
              {isConnected ? formatDuration(duration) : callStatus}
            </Text>
          </View>
        </View>

        {/* Right: Camera Flip Shortcut (if video call) or Equal Spacer */}
        {isVideo ? (
          <TouchableOpacity
            style={styles.headerIconButton}
            onPress={flipCamera}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
          >
            <CameraFlipIcon size={18} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* 4. Center Avatar & Soundwave Visualizer (Shown when voice call or waiting for video) */}
      {!showRemoteVideo && (
        <View style={styles.centerContainer}>
          <Animated.View style={[styles.avatarGlow, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatarCircle}>
              {contactAvatar === 'panda' || contactAvatar === 'cat' || contactAvatar === 'puppy' ? (
                <CharacterBall character={contactAvatar} size={88} />
              ) : isImageAvatar ? (
                <Image source={{ uri: contactAvatar }} style={styles.avatarPhoto} />
              ) : presetAvatar ? (
                <Image source={presetAvatar} style={styles.avatarPhoto} />
              ) : (
                <CharacterBall character="panda" size={88} />
              )}
            </View>
          </Animated.View>

          {isConnected && !isVideo && (
            <View style={styles.waveformContainer}>
              <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim3 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim4 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim5 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim2 }]} />
              <Animated.View style={[styles.waveBar, { height: waveAnim1 }]} />
            </View>
          )}
        </View>
      )}

      {/* 5. Floating Action Capsule Pill Bar (Matching Reference Image) */}
      <View style={[styles.bottomBarWrapper, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.actionCapsule}>
          {/* Button 1: More / Flip Options */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={isVideo ? flipCamera : undefined}
            activeOpacity={0.7}
          >
            <MoreHorizontalIcon size={22} color="#ffffff" />
          </TouchableOpacity>

          {/* Button 2: Video Cam Toggle */}
          <TouchableOpacity
            style={[styles.actionBtn, isVideoOff && styles.actionBtnActiveRed]}
            onPress={toggleVideo}
            activeOpacity={0.7}
          >
            {isVideoOff ? (
              <SolidVideoOffIcon size={22} color="#ff3b30" />
            ) : (
              <SolidVideoIcon size={22} color="#ffffff" />
            )}
          </TouchableOpacity>

          {/* Button 3: Speakerphone (White circle when active, dark circle when off) */}
          <TouchableOpacity
            style={[styles.actionBtn, isSpeaker ? styles.actionBtnSpeakerOn : styles.actionBtn]}
            onPress={toggleSpeaker}
            activeOpacity={0.7}
          >
            <SolidSpeakerIcon size={22} color={isSpeaker ? '#000000' : '#ffffff'} />
          </TouchableOpacity>

          {/* Button 4: Microphone Mute/Unmute */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={toggleMute}
            activeOpacity={0.7}
          >
            {isMuted ? (
              <SolidMicOffIcon size={22} color="#ffffff" />
            ) : (
              <SolidMicIcon size={22} color="#ffffff" />
            )}
          </TouchableOpacity>

          {/* Button 5: End Call (Vibrant Red Circle) */}
          <TouchableOpacity
            style={styles.endCallBtn}
            onPress={handleEndCallPress}
            activeOpacity={0.8}
          >
            <EndCallIcon size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0d',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // 1. Sleek Floating Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xs,
    zIndex: 10,
  },
  headerRowScrim: {
    backgroundColor: 'rgba(10, 10, 13, 0.45)',
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 38,
    height: 38,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },

  // Mind-Hack HUD Timer Capsule
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(25, 25, 32, 0.65)',
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  timerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  timerDotLive: {
    backgroundColor: '#25d366',
    shadowColor: '#25d366',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.95,
    shadowRadius: 5,
    elevation: 4,
  },
  timerDotCalling: {
    backgroundColor: '#f59e0b',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 3,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontVariant: ['tabular-nums'],
  },

  // 2. Draggable PIP Container
  pipContainer: {
    position: 'absolute',
    width: 108,
    height: 154,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    zIndex: 20,
    backgroundColor: '#121214',
  },
  pipVideo: {
    width: '100%',
    height: '100%',
  },
  pipFlipBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 12,
    padding: 5,
  },

  // 3. Center Avatar & Soundwaves (Audio / Connecting mode)
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  avatarGlow: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(224, 82, 122, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent.primary,
  },
  avatarCircle: {
    width: 136,
    height: 136,
    borderRadius: 68,
    backgroundColor: '#1d1421',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  avatarPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 68,
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

  // 4. Floating Action Capsule Pill Bar (Matching Reference Image)
  bottomBarWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  actionCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1b1b1e',
    borderRadius: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  actionBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#302f36',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActiveRed: {
    backgroundColor: 'rgba(255, 59, 48, 0.25)',
  },
  actionBtnSpeakerOn: {
    backgroundColor: '#ffffff',
  },
  endCallBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ff3b30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 6,
  },
});
