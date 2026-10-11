import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/styles/index.css';
import App from './pages/app';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
