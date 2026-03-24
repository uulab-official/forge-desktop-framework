import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './globals.css';

// Register all modules before rendering
import './modules/notes';
import './modules/calculator';
import './modules/converter';

import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
