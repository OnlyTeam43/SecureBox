// src/services/webrtcService.js
// Native WebRTC Engine for SecureBox P2P Voice & HD Video Calling

let RTCPeerConnection = null;
let RTCIceCandidate = null;
let RTCSessionDescription = null;
let mediaDevices = null;

try {
  const webrtc = require('react-native-webrtc');
  RTCPeerConnection = webrtc.RTCPeerConnection;
  RTCIceCandidate = webrtc.RTCIceCandidate;
  RTCSessionDescription = webrtc.RTCSessionDescription;
  mediaDevices = webrtc.mediaDevices;
} catch (err) {
  console.warn('Native react-native-webrtc not linked yet:', err.message);
}

import { callService } from './callService';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
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
    this.pendingCandidates = [];
    this.isMuted = false;
    this.isVideoEnabled = true;
    this.streamListeners = new Set();
  }

  isAvailable() {
    return !!(RTCPeerConnection && mediaDevices);
  }

  /**
   * Register listener for stream updates (local / remote video)
   */
  onStreamUpdate(callback) {
    this.streamListeners.add(callback);
    // Immediately emit current streams if available
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
  async startCall(callId, partnerHandle, isInitiator, isVideo = false) {
    if (!this.isAvailable()) {
      console.warn('WebRTC native modules are not available in this build.');
      return false;
    }

    this.cleanup();
    this.currentCallId = callId;
    this.partnerHandle = partnerHandle;
    this.isInitiator = isInitiator;
    this.isVideoCall = !!isVideo;
    this.pendingCandidates = [];
    this.isVideoEnabled = true;

    try {
      // 1. Get microphone & camera stream
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

      // 2. Initialize Peer Connection
      this.peerConnection = new RTCPeerConnection(RTC_CONFIG);

      // Add local audio and video tracks
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // 3. ICE Candidate gathering
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          callService.sendSignal(this.currentCallId, this.partnerHandle, {
            type: 'candidate',
            candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
          });
        }
      };

      // 4. Remote track received (voice & video from partner)
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          this.notifyStreamUpdate();
          console.log('WebRTC: Remote track received!');
        }
      };

      this.peerConnection.onconnectionstatechange = () => {
        console.log('WebRTC Connection state:', this.peerConnection?.connectionState);
      };

      // 5. If caller, create SDP offer
      if (this.isInitiator) {
        const offer = await this.peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.isVideoCall,
        });
        await this.peerConnection.setLocalDescription(offer);

        await callService.sendSignal(this.currentCallId, this.partnerHandle, {
          type: 'offer',
          sdp: offer.sdp,
        });
      }

      return true;
    } catch (err) {
      console.warn('WebRTC start error:', err);
      return false;
    }
  }

  /**
   * Handle incoming WebRTC signaling (offer, answer, candidate)
   */
  async handleSignal(signalData) {
    if (!this.peerConnection || !signalData) return;

    try {
      if (signalData.type === 'offer') {
        const desc = new RTCSessionDescription({ type: 'offer', sdp: signalData.sdp });
        await this.peerConnection.setRemoteDescription(desc);

        // Process any queued candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        }

        // Create answer
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        await callService.sendSignal(this.currentCallId, this.partnerHandle, {
          type: 'answer',
          sdp: answer.sdp,
        });
      } else if (signalData.type === 'answer') {
        const desc = new RTCSessionDescription({ type: 'answer', sdp: signalData.sdp });
        await this.peerConnection.setRemoteDescription(desc);

        // Process any queued candidates
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
        }
      } else if (signalData.type === 'candidate' && signalData.candidate) {
        if (this.peerConnection.remoteDescription && this.peerConnection.remoteDescription.type) {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(signalData.candidate));
        } else {
          this.pendingCandidates.push(signalData.candidate);
        }
      }
    } catch (err) {
      console.warn('WebRTC handleSignal error:', err);
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
    this.pendingCandidates = [];
    this.notifyStreamUpdate();
  }
}

export const webrtcService = new WebRTCManager();
