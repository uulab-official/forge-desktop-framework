import { useState } from 'react';
import { useWebRTC } from './hooks/useWebRTC';
import { useMediaDevices } from './hooks/useMediaDevices';
import { VideoPanel } from './components/VideoPanel';
import { DataChannelChat } from './components/DataChannelChat';

export function App() {
  const {
    localStream,
    remoteStream,
    connected,
    messages,
    connect,
    disconnect,
    sendMessage,
  } = useWebRTC();

  const { devices, error: devicesError } = useMediaDevices();

  const [videoMuted, setVideoMuted] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');

  function toggleVideo() {
    if (!localStream) return;
    localStream.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setVideoMuted((v) => !v);
  }

  function toggleAudio() {
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setAudioMuted((v) => !v);
  }

  async function handleConnect() {
    if (connected || localStream) {
      disconnect();
      setVideoMuted(false);
      setAudioMuted(false);
    } else {
      await connect();
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">WebRTC Loopback Demo</h1>
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <span className="flex items-center gap-1.5 text-sm">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                connected ? 'bg-green-400' : 'bg-gray-500'
              }`}
            />
            {connected ? 'Connected' : 'Disconnected'}
          </span>

          {/* Connect / Disconnect button */}
          <button
            onClick={handleConnect}
            className={`px-4 py-1.5 rounded text-sm font-medium transition ${
              connected || localStream
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {connected || localStream ? 'Disconnect' : 'Connect'}
          </button>
        </div>
      </header>

      {devicesError && (
        <div className="mb-4 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-sm text-red-300">
          Device error: {devicesError}
        </div>
      )}

      {/* Main two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left panel -- Local */}
        <div className="space-y-4">
          <VideoPanel stream={localStream} label="Local" muted />

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={toggleVideo}
              disabled={!localStream}
              className={`px-3 py-1.5 rounded text-sm font-medium transition disabled:opacity-40 ${
                videoMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {videoMuted ? 'Camera Off' : 'Camera On'}
            </button>
            <button
              onClick={toggleAudio}
              disabled={!localStream}
              className={`px-3 py-1.5 rounded text-sm font-medium transition disabled:opacity-40 ${
                audioMuted
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              {audioMuted ? 'Mic Off' : 'Mic On'}
            </button>
          </div>

          {/* Device selectors */}
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">
              Camera
              <select
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">Default</option>
                {devices.cameras.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-gray-400">
              Microphone
              <select
                value={selectedMic}
                onChange={(e) => setSelectedMic(e.target.value)}
                className="mt-1 block w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">Default</option>
                {devices.microphones.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* Right panel -- Remote + Chat */}
        <div className="space-y-4">
          <VideoPanel stream={remoteStream} label="Remote" />

          <div className="h-64">
            <DataChannelChat
              connected={connected}
              messages={messages}
              onSend={sendMessage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
