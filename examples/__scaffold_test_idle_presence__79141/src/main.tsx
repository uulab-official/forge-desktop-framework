import { ForgeErrorBoundary } from '@forge/error-handler';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ForgeAppShell } from './forge/AppShell';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><ForgeErrorBoundary>
      <ForgeAppShell>
        <App />
      </ForgeAppShell>
    </ForgeErrorBoundary></StrictMode>,
);
