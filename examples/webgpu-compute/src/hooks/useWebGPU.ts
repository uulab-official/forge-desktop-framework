import { useState, useEffect } from 'react';

interface WebGPUState {
  supported: boolean;
  device: GPUDevice | null;
  adapter: GPUAdapter | null;
  error: string | null;
  isReady: boolean;
}

export function useWebGPU(): WebGPUState {
  const [supported, setSupported] = useState(false);
  const [device, setDevice] = useState<GPUDevice | null>(null);
  const [adapter, setAdapter] = useState<GPUAdapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let disposed = false;

    async function init() {
      if (!navigator.gpu) {
        setSupported(false);
        setError(
          'WebGPU is not supported in this environment. ' +
          'Make sure Electron is launched with --enable-unsafe-webgpu flag.',
        );
        return;
      }

      setSupported(true);

      try {
        const gpuAdapter = await navigator.gpu.requestAdapter();
        if (!gpuAdapter) {
          setError('Failed to obtain GPU adapter. No compatible GPU found.');
          return;
        }
        if (disposed) return;
        setAdapter(gpuAdapter);

        const gpuDevice = await gpuAdapter.requestDevice();
        if (disposed) return;
        setDevice(gpuDevice);
        setIsReady(true);

        gpuDevice.lost.then((info) => {
          setError(`GPU device lost: ${info.message}`);
          setIsReady(false);
          setDevice(null);
        });
      } catch (err) {
        if (!disposed) {
          setError(`WebGPU initialization failed: ${err}`);
        }
      }
    }

    init();
    return () => { disposed = true; };
  }, []);

  return { supported, device, adapter, error, isReady };
}
