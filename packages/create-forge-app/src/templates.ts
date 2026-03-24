export interface Template {
  id: string;
  label: string;
  description: string;
  hint: string;
}

export const TEMPLATES: Template[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Bare minimum app — one input, one Python action',
    hint: 'Best for learning the core architecture',
  },
  {
    id: 'file-processor',
    label: 'File Processor',
    description: 'Batch file processing with drag-and-drop and job queue',
    hint: 'File analysis, batch rename, progress tracking',
  },
  {
    id: 'ai-tool',
    label: 'AI Tool',
    description: 'Local AI/ML integration pattern',
    hint: 'Sentiment analysis, summarizer, classifier (stdlib stubs)',
  },
  {
    id: 'video-tools',
    label: 'Video Tools',
    description: 'External binary integration (ffmpeg pattern)',
    hint: 'Video info, thumbnail extraction, transcription stub',
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Data dashboard with charts and tables',
    hint: 'Multiple worker actions, SVG charts, data analysis',
  },
  {
    id: 'multi-module',
    label: 'Multi-Module',
    description: 'Module/plugin pattern with multiple features',
    hint: 'Notes, calculator, converter — dynamic sidebar',
  },
  {
    id: 'chat',
    label: 'Chat',
    description: 'Real-time chat UI with smooth animations',
    hint: 'Chat bubbles, typing indicator, Python-backed responses',
  },
  {
    id: 'webrtc-demo',
    label: 'WebRTC',
    description: 'WebRTC peer connection with video and data channels',
    hint: 'Camera/mic capture, loopback video, data channel messaging',
  },
  {
    id: 'webgpu-compute',
    label: 'WebGPU Compute',
    description: 'GPU-accelerated computation with WebGPU',
    hint: 'Matrix multiply shader, GPU vs CPU benchmark, heatmap',
  },
];
