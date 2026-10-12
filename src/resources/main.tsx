import { COLORS } from '@/shared/colors';
import { useLanguage } from '@/shared/i18n';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/styles/index.css';
import App from './pages/app';
import { setupPwa } from './pwa';

for (const [name, color] of Object.entries(COLORS.ui)) {
  document.documentElement.style.setProperty(`--game-${name}`, color);
}
document.documentElement.lang = useLanguage.getState().language;
setupPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
