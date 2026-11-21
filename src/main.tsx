import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { installButtonSpring } from './spring';
import { registerServiceWorker } from './pwa';
import { blockZoom } from './noZoom';

installButtonSpring();
registerServiceWorker();
blockZoom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
