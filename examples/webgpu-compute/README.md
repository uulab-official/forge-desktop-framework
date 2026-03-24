# WebGPU Compute Example

Demonstrates GPU-accelerated matrix multiplication using the WebGPU Compute Shader API within an Electron + React application, compared against a pure-Python CPU implementation.

## What This Demonstrates

- **WebGPU in Electron**: How to enable and use the WebGPU API inside an Electron desktop application
- **WGSL Compute Shaders**: Writing compute shaders in WebGPU Shading Language for parallel matrix operations
- **GPU vs CPU Comparison**: Side-by-side performance benchmarking of GPU compute vs CPU-based approaches
- **Buffer Management**: Creating, writing, dispatching, and reading back GPU storage buffers
- **Heatmap Visualization**: Canvas-based rendering of matrix computation results

## Architecture

```
Renderer (React)
  ├── useWebGPU hook       → Initializes adapter + device
  ├── gpuMatrixMultiply    → WGSL shader dispatch (GPU path)
  ├── cpuMatrixMultiply    → JavaScript loop (CPU path)
  └── HeatmapCanvas        → Visualizes result matrix

Main Process (Electron)
  └── worker:execute IPC   → Delegates to Python worker

Python Worker
  └── matrix_multiply      → Pure-Python O(n^3) multiply
```

## Enabling WebGPU

WebGPU must be explicitly enabled in Electron. The main process includes:

```ts
app.commandLine.appendSwitch('enable-unsafe-webgpu');
app.commandLine.appendSwitch('enable-features', 'Vulkan');
```

These switches must be set **before** `app.whenReady()`.

### System Requirements

- A GPU with Vulkan, Metal, or D3D12 support
- Up-to-date GPU drivers
- Electron 35+ (Chromium 135+)

### Fallback Strategy

If WebGPU is not available, the application:

1. Detects the absence of `navigator.gpu` at startup
2. Displays a clear message explaining how to enable WebGPU
3. The CPU-based JavaScript multiply remains functional as a fallback
4. The Python worker provides an additional CPU comparison path

## Running

```bash
pnpm install
pnpm dev
```

## Usage

1. Select a matrix size from the dropdown (64 to 512)
2. Click **Run GPU** to execute the WGSL compute shader
3. Click **Run CPU** to run the JavaScript CPU implementation
4. Compare the execution times and observe the speedup ratio
5. View the heatmap visualization of the result matrix
