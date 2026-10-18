// src/services/webrtcService.js
// Native WebRTC Engine for SecureBox P2P Voice & HD Video Calling

let RTCPeerConnection = null;
let RTCIceCandidate = null;
let RTCSessionDescription = null;
let MediaStream = null;
let mediaDevices = null;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  MediaStream = webrtc.MediaStream;
  mediaDevices = webrtc.mediaDevices;
} catch (err) {
  console.warn('Native react-native-webrtc not linked yet:', err.message);
}

import { callService } from './callService';

let dynamicIceServers = null;

const DEFAULT_ICE_SERVERS = [
  // Fast, reliable public STUN servers (UDP port 19302 & 3478)
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const setCustomIceServers = (servers) => {
  if (Array.isArray(servers) && servers.length > 0) {
    dynamicIceServers = servers;
    console.log('WebRTC: Updated custom ICE servers:', servers.length);
  }
};

class WebRTCManager {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallId = null;
    this.partnerHandle = null;
    this.isInitiator = false;
    this.isVideoCall = false;
    this.pendingSignals = [];     // Signals received before peerConnection is ready
    this.pendingCandidates = [];  // ICE candidates received before remoteDescription is set
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.streamListeners = new Set();
    this.isStarting = false;
  }

  isAvailable() {
    return !!(RTCPeerConnection && mediaDevices);
  }

  /**
   * Register listener for stream updates (local / remote video)
   */
  onStreamUpdate(callback) {
    this.streamListeners.add(callback);
    callback({ localStream: this.localStream, remoteStream: this.remoteStream });
    return () => {
      this.streamListeners.delete(callback);
    };
  }

  notifyStreamUpdate() {
    this.streamListeners.forEach((cb) => {
      try {
        cb({ localStream: this.localStream, remoteStream: this.remoteStream });
      } catch (e) {
        console.warn('Stream listener error:', e);
      }
    });
  }

  /**
   * Start native WebRTC audio/video session
   */
  async startCall(callId, partnerHandle, isInitiator, isVideo = false, myHandle = null) {
    if (!this.isAvailable()) {
      console.warn('WebRTC native modules are not available in this build.');
      return false;
    }

    if (this.isStarting) {
      console.log('WebRTC startCall already in progress, skipping duplicate.');
      return true;
    }
    this.isStarting = true;

    this.currentCallId = callId;
    this.partnerHandle = partnerHandle;
    this.isInitiator = isInitiator;
    this.isVideoCall = !!isVideo;
    this.isVideoEnabled = true;
    this.myHandle = myHandle;

    try {
      console.log(`WebRTC: Starting call [callId=${callId}, isInitiator=${isInitiator}, isVideo=${isVideo}]`);

      // 1. Acquire microphone & camera
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: this.isVideoCall
          ? {
              facingMode: 'user',
              frameRate: 30,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
      };

      this.localStream = await mediaDevices.getUserMedia(constraints);
      this.notifyStreamUpdate();
      console.log('WebRTC: Local mediaStream acquired successfully.');

      // 2. Initialize Peer Connection
      const iceServers = dynamicIceServers || DEFAULT_ICE_SERVERS;
      this.peerConnection = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });

      // Add local audio and video tracks
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 3. ICE Candidate gathering
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const cand = event.candidate.toJSON ? event.candidate.toJSON() : event.candidate;
          const candidateStr = cand.candidate || '';
          const parts = candidateStr.split(' ');
          const candType = parts.length > 7 ? parts[7] : 'unknown';
          const candIp = parts.length > 4 ? parts[4] : '';
          const candPort = parts.length > 5 ? parts[5] : '';
          console.log(`WebRTC: Gathered ICE [type=${candType}] ${candIp}:${candPort}`);
          callService.sendSignal(
            this.currentCallId,
            this.partnerHandle,
            { type: 'candidate', candidate: cand },
            this.myHandle
          );
        } else {
          console.log('WebRTC: ICE Candidate gathering complete');
        }
      };

      // 4. Remote track received (voice & video from partner)
      this.peerConnection.ontrack = (event) => {
        console.log('WebRTC: Remote track received, kind:', event.track?.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        } else if (event.track) {
          if (!this.remoteStream && MediaStream) {
            this.remoteStream = new MediaStream();
          }
          if (this.remoteStream) {
            this.remoteStream.addTrack(event.track);
          }
        }
        this.notifyStreamUpdate();
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC Connection state:', this.peerConnection?.connectionState);
      };

      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('WebRTC ICE Connection state:', this.peerConnection?.iceConnectionState);
      };

      // 5. Process any signals that arrived while we were acquiring media
      console.log(`WebRTC: Flushing ${this.pendingSignals.length} buffered signals`);
      while (this.pendingSignals.length > 0) {
        const sig = this.pendingSignals.shift();
        await this.processSignal(sig);
      }

      // 6. If caller, create SDP offer; if receiver, notify caller that we are ready
      if (this.isInitiator) {
        await this.createAndSendOffer();
      } else {
        callService.sendSignal(
          this.currentCallId,
          this.partnerHandle,
          { type: 'peer_ready' },
          this.myHandle
        );
      }

      this.isStarting = false;
      return true;
    } catch (err) {
      console.warn('WebRTC start error:', err);
      this.isStarting = false;
      return false;
    }
  }

  async createAndSendOffer() {
    if (!this.peerConnection) return;
    try {
      // If already in have-local-offer, re-send the existing offer without duplicating
      if (this.peerConnection.signalingState === 'have-local-offer' && this.peerConnection.localDescription) {
        console.log('WebRTC: Re-sending existing local offer SDP');
        await callService.sendSignal(
          this.currentCallId,
          this.partnerHandle,
          { type: 'offer', sdp: this.peerConnection.localDescription.sdp },
          this.myHandle
        );
        return;
      }

      if (this.peerConnection.signalingState !== 'stable') {
        console.log(`WebRTC: State is ${this.peerConnection.signalingState}, waiting before offer.`);
        return;
      }

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideoCall,
      });
      await this.peerConnection.setLocalDescription(offer);

      console.log('WebRTC: Sending SDP offer to partner');
      await callService.sendSignal(
        this.currentCallId,
        this.partnerHandle,
        { type: 'offer', sdp: offer.sdp },
        this.myHandle
      );
    } catch (err) {
      console.warn('WebRTC createOffer error:', err);
    }
  }

  /**
   * Handle incoming WebRTC signaling (offer, answer, candidate, peer_ready)
   */
  async handleSignal(signalData) {
    if (!signalData) return;

    if (!this.peerConnection) {
      console.log('WebRTC: PeerConnection not ready yet, buffering signal:', signalData.type);
      this.pendingSignals.push(signalData);
      return;
    }

    await this.processSignal(signalData);
  }

  async processSignal(signalData) {
    if (!this.peerConnection || !signalData) return;

    try {
      if (signalData.type === 'peer_ready') {
        console.log('WebRTC: Received peer_ready from receiver, sending offer');
        if (this.isInitiator) {
          await this.createAndSendOffer();
        }
      } else if (signalData.type === 'offer') {
        console.log('WebRTC: Processing received offer');
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type === 'offer') {
          console.log('WebRTC: Remote offer already processed, skipping duplicate');
          return;
        }

        const desc = new RTCSessionDescription({ type: 'offer', sdp: signalData.sdp });
        await this.peerConnection.setRemoteDescription(desc);

        // Process any queued candidates that arrived before remoteDescription
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          try {
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
          } catch (e) {
            console.warn('Error adding queued ICE candidate:', e);
          }
        }

        // Create and send answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        console.log('WebRTC: Sending SDP answer');
        await callService.sendSignal(
          this.currentCallId,
          this.partnerHandle,
          { type: 'answer', sdp: answer.sdp },
          this.myHandle
        );
      } else if (signalData.type === 'answer') {
        console.log('WebRTC: Processing received answer');
        if (this.peerConnection.signalingState === 'have-local-offer') {
          const desc = new RTCSessionDescription({ type: 'answer', sdp: signalData.sdp });
          await this.peerConnection.setRemoteDescription(desc);

          while (this.pendingCandidates.length > 0) {
            const cand = this.pendingCandidates.shift();
            try {
              const candidateObj = typeof cand === 'string' ? { candidate: cand } : cand;
              await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj));
            } catch (e) {
              console.warn('Error adding queued ICE candidate:', e);
            }
          }
        }
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        const cStr = signalData.candidate?.candidate || '';
        const parts = cStr.split(' ');
        const cType = parts.length > 7 ? parts[7] : 'unknown';
        const cIp = parts.length > 4 ? parts[4] : '';
        const cPort = parts.length > 5 ? parts[5] : '';
        console.log(`WebRTC: Received remote ICE [type=${cType}] ${cIp}:${cPort}`);

        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          try {
            const candidateObj = typeof signalData.candidate === 'string'
              ? { candidate: signalData.candidate }
              : signalData.candidate;
            await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateObj));
          } catch (e) {
            console.warn('Error adding ICE candidate directly:', e);
          }
        } else {
          this.pendingCandidates.push(signalData.candidate);
        }
      }
    } catch (err) {
      console.warn('WebRTC processSignal error:', err);
    }
  }

  /**
   * Switch front and back camera during video call
   */
  switchCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        if (typeof videoTrack._switchCamera === 'function') {
          videoTrack._switchCamera();
        }
      }
    }
  }

  /**
   * Enable / disable local camera video
   */
  setVideoEnabled(enabled) {
    this.isVideoEnabled = !!enabled;
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = this.isVideoEnabled;
      });
    }
  }

  /**
   * Mute or unmute microphone
   */
  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
  }

  /**
   * Clean up tracks and close peer connection
   */
  cleanup() {
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track) => track.stop());
      } catch (_) {}
      this.localStream = null;
    }

    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (_) {}
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentCallId = null;
    this.partnerHandle = null;
    this.pendingSignals = [];
    this.pendingCandidates = [];
    this.isStarting = false;
    this.notifyStreamUpdate();
  }
}

export const webrtcService = new WebRTCManager();
