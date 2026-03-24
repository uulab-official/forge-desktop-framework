import { useEffect, useRef } from 'react';

interface VideoPanelProps {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}

export function VideoPanel({ stream, label, muted = false }: VideoPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream ?? null;
    }
  }, [stream]);

  return (
    <div className="relative w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
      />

      {/* Label overlay */}
      <span className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        {label}
      </span>

      {/* Muted indicator */}
      {muted && (
        <span className="absolute top-2 right-2 bg-red-600/80 text-white text-xs px-2 py-1 rounded">
          Muted
        </span>
      )}

      {/* Placeholder when no stream */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
          No video
        </div>
      )}
    </div>
  );
}
