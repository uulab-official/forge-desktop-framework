import { useState, useEffect } from 'react';

interface MediaDeviceList {
  cameras: MediaDeviceInfo[];
  microphones: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export function useMediaDevices() {
  const [devices, setDevices] = useState<MediaDeviceList>({
    cameras: [],
    microphones: [],
    speakers: [],
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function enumerate() {
      try {
        // Request permission first so device labels are available
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        tempStream.getTracks().forEach((t) => t.stop());

        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices({
          cameras: all.filter((d) => d.kind === 'videoinput'),
          microphones: all.filter((d) => d.kind === 'audioinput'),
          speakers: all.filter((d) => d.kind === 'audiooutput'),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    enumerate();

    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, []);

  return { devices, error };
}
