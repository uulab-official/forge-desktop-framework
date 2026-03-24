import { useState, useRef, useCallback } from 'react';

interface DataMessage {
  id: string;
  text: string;
  sender: 'local' | 'remote';
  timestamp: number;
}

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connected: boolean;
  messages: DataMessage[];
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (text: string) => void;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

let msgId = 0;

export function useWebRTC(): UseWebRTCReturn {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<DataMessage[]>([]);

  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const remoteDcRef = useRef<RTCDataChannel | null>(null);

  const connect = useCallback(async () => {
    // Get user media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    setLocalStream(stream);

    // Create two peer connections for loopback
    const pc1 = new RTCPeerConnection(ICE_SERVERS);
    const pc2 = new RTCPeerConnection(ICE_SERVERS);
    pc1Ref.current = pc1;
    pc2Ref.current = pc2;

    // Remote stream setup
    const remote = new MediaStream();
    setRemoteStream(remote);

    pc2.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remote.addTrack(track);
      });
    };

    // ICE candidate exchange (direct, no signaling server)
    pc1.onicecandidate = (e) => {
      if (e.candidate) pc2.addIceCandidate(e.candidate);
    };
    pc2.onicecandidate = (e) => {
      if (e.candidate) pc1.addIceCandidate(e.candidate);
    };

    // Add local tracks to pc1
    stream.getTracks().forEach((track) => {
      pc1.addTrack(track, stream);
    });

    // Data channel on pc1 (offerer)
    const dc = pc1.createDataChannel('chat', { ordered: true });
    dcRef.current = dc;

    dc.onopen = () => setConnected(true);
    dc.onclose = () => setConnected(false);

    // Data channel on pc2 (answerer)
    pc2.ondatachannel = (event) => {
      const remoteDc = event.channel;
      remoteDcRef.current = remoteDc;

      remoteDc.onmessage = (e) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${++msgId}`,
            text: e.data,
            sender: 'remote',
            timestamp: Date.now(),
          },
        ]);
      };
    };

    // SDP exchange
    const offer = await pc1.createOffer();
    await pc1.setLocalDescription(offer);
    await pc2.setRemoteDescription(offer);

    const answer = await pc2.createAnswer();
    await pc2.setLocalDescription(answer);
    await pc1.setRemoteDescription(answer);
  }, []);

  const disconnect = useCallback(() => {
    dcRef.current?.close();
    remoteDcRef.current?.close();
    pc1Ref.current?.close();
    pc2Ref.current?.close();

    localStream?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setRemoteStream(null);
    setConnected(false);
    dcRef.current = null;
    remoteDcRef.current = null;
    pc1Ref.current = null;
    pc2Ref.current = null;
  }, [localStream]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!dcRef.current || dcRef.current.readyState !== 'open') return;

      dcRef.current.send(text);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${++msgId}`,
          text,
          sender: 'local',
          timestamp: Date.now(),
        },
      ]);
    },
    [],
  );

  return {
    localStream,
    remoteStream,
    connected,
    messages,
    connect,
    disconnect,
    sendMessage,
  };
}
