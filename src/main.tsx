import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { httpBackend } from './infrastructure/http-backend';
import { App } from './ui/App';
import { ServicesProvider } from './ui/backend-context';
import './ui/theme/tokens.css';
import './ui/theme/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider backend={httpBackend()}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
