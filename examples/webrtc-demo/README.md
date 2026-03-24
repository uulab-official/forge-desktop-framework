# WebRTC Demo

A minimal WebRTC example running inside Electron, built with the Forge Desktop Framework.

## What this demo does

This example creates a **loopback** WebRTC connection: two `RTCPeerConnection` instances are created inside the same browser context and connected directly to each other — no signaling server required.

- **Local peer (pc1)** captures the camera and microphone via `getUserMedia`, adds tracks, and creates an offer.
- **Remote peer (pc2)** receives the offer, sends an answer, and renders the incoming media as the "remote" video feed.
- A **DataChannel** is established between the two peers, enabling text chat messages to be sent and received through the WebRTC data channel API.

Because both peers live in the same Electron renderer process, ICE candidates are exchanged directly in memory.

## Why WebRTC in Electron?

Electron ships a full Chromium engine, so the WebRTC APIs (`RTCPeerConnection`, `getUserMedia`, `RTCDataChannel`) are available out of the box. This makes Electron a good fit for building desktop video/audio applications without native plugins.

Key advantages:

- Access to all WebRTC features (SRTP, DTLS, SCTP data channels, screen capture).
- Chromium's media stack handles codec negotiation, echo cancellation, and noise suppression.
- Electron's Node.js integration lets the main process manage signaling over WebSockets, gRPC, or any other transport.

## Running the demo

```bash
# From the repository root
pnpm install
pnpm --filter @forge-example/webrtc-demo dev
```

Grant camera and microphone permissions when prompted. You should see your local camera feed on the left and the loopback feed on the right, with a chat panel below.

## Extending with a signaling server

To connect two separate machines instead of a loopback, you need a **signaling server** to exchange SDP offers/answers and ICE candidates. A typical approach:

1. **WebSocket server** — A small Node.js or Python server that relays JSON messages between peers.
2. **Room-based routing** — Peers join a room ID; the server forwards signaling messages to the other peer(s) in the same room.
3. **TURN server** — For peers behind symmetric NATs, configure a TURN server in the `iceServers` array (e.g., `coturn`).

Replace the direct `pc1 <-> pc2` candidate/SDP exchange in `useWebRTC.ts` with WebSocket messages to the signaling server, and you have a production-ready two-party video call.

## Project structure

```
webrtc-demo/
  electron/          Electron main + preload scripts
  src/
    App.tsx          Two-panel UI (local + remote video, chat)
    components/
      VideoPanel.tsx      Video element with label overlay
      DataChannelChat.tsx Data channel chat widget
    hooks/
      useWebRTC.ts        Loopback peer connection + data channel
      useMediaDevices.ts  Device enumeration helper
  worker/     Minimal Python worker (health check only)
```

## Python worker

The included Python worker only implements a `health_check` action. WebRTC itself is handled entirely in the browser — no Python backend is needed. The worker is included for consistency with the framework's architecture and can be extended if you need server-side processing (e.g., recording, transcription).
