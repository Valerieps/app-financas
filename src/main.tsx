import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { httpBackend, httpDeviceLock } from './infrastructure/http-backend';
import { App } from './ui/App';
import { ServicesProvider } from './ui/backend-context';
import './ui/theme/tokens.css';
import './ui/theme/global.css';
import './ui/theme/desktop.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider backend={httpBackend()} deviceLock={httpDeviceLock()}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
