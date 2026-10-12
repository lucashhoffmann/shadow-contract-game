import { Download, Share } from 'lucide-react';

import { useInstallApp } from '@/resources/pages/home/components/install-app/use-install-app.component';
import { useTexts } from '@/shared/i18n';

// Oferece instalar o jogo como app. So em aparelho de toque.
export function InstallApp() {
  const t = useTexts();
  const { mode, install } = useInstallApp();

  if (mode === 'prompt') {
    return (
      <button
        type='button'
        onClick={install}
        className='text-outline relative hidden items-center gap-2 rounded-2xl border-4 border-white bg-[var(--game-primary)] px-5 py-2 text-lg text-white uppercase shadow-[0_5px_0_var(--game-ink)] transition-transform active:translate-y-1 active:shadow-none pointer-coarse:flex'
      >
        <Download
          aria-hidden
          className='size-5'
          strokeWidth={3}
        />
        {t.home.install}
      </button>
    );
  }
  if (mode === 'ios') {
    return (
      <p className='relative hidden max-w-xs items-center gap-2 rounded-xl bg-black/35 px-3 py-2 font-sans text-sm text-white pointer-coarse:flex'>
        <Share
          aria-hidden
          className='size-5 shrink-0'
        />
        {t.home.iosInstall}
      </p>
    );
  }
  return null;
}
