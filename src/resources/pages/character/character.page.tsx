import { ArrowLeft } from 'lucide-react';

import { Button } from '@/resources/components/ui/button';
import { WeaponPicker } from '@/resources/pages/character/components/weapon-picker.component';
import { LookEditor } from '@/resources/pages/character/components/look-editor.component';
import { useCharacterPage } from '@/resources/pages/character/use-character.page';
import { useTexts } from '@/shared/i18n';

export function CharacterPage() {
  const t = useTexts();
  const { canvasRef, look, setLook, weapon, setWeapon, previews, backToMenu } =
    useCharacterPage();

  return (
    <main className='flex h-full flex-col md:flex-row'>
      {/* no celular o painel e mais alto que a tela: sem altura propria o
          preview encolhia ate sumir. Fica fixo no topo e o painel rola.
          min-w-0: sem ele o canvas segura a largura antiga ao estreitar a
          janela e empurra a tela para o lado */}
      <div className='relative h-[38vh] min-w-0 shrink-0 md:h-auto md:min-h-0 md:flex-1'>
        <canvas
          ref={canvasRef}
          aria-label={t.character.preview}
          className='block h-full w-full cursor-grab touch-none active:cursor-grabbing'
        />
        <p className='text-muted-foreground pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm'>
          {t.character.drag}
        </p>
      </div>
      <div className='flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-6 md:flex-none md:[justify-content:safe_center]'>
        <LookEditor
          look={look}
          onChange={setLook}
        />
        <WeaponPicker
          weapon={weapon}
          previews={previews}
          onChange={setWeapon}
        />
        {/* celular: preso no canto de cima, sobre o preview, sempre a mao
            (o painel e longo e rola). Desktop: colado no pe do painel, visivel
            mesmo quando o conteudo passa da altura da janela */}
        <Button
          size='lg'
          className='fixed top-3 right-3 z-10 font-black uppercase shadow-lg md:sticky md:top-auto md:right-auto md:bottom-0 md:w-full md:max-w-xs md:shrink-0'
          onClick={backToMenu}
        >
          <ArrowLeft
            aria-hidden
            strokeWidth={3}
          />
          {t.common.back}
        </Button>
      </div>
    </main>
  );
}
