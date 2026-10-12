import { ArrowLeft } from 'lucide-react';

import { Button } from '@/resources/components/ui/button';
import { WeaponPicker } from '@/resources/pages/character/components/weapon-picker.component';
import { LookEditor } from '@/resources/pages/character/components/look-editor.component';
import { useCharacterPage } from '@/resources/pages/character/use-character.page';

export function CharacterPage() {
  const { canvasRef, look, setLook, weapon, setWeapon, previews, backToMenu } =
    useCharacterPage();

  return (
    <main className='flex h-full flex-col md:flex-row'>
      {/* no celular o painel e mais alto que a tela: sem altura propria o
          preview encolhia ate sumir. Fica fixo no topo e o painel rola */}
      <div className='relative h-[38vh] shrink-0 md:h-auto md:min-h-0 md:flex-1'>
        <canvas
          ref={canvasRef}
          aria-label='Preview do personagem'
          className='block h-full w-full cursor-grab touch-none active:cursor-grabbing'
        />
        <p className='text-muted-foreground pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm'>
          Arraste para girar
        </p>
      </div>
      <div className='flex min-h-0 flex-1 flex-col items-center gap-4 overflow-y-auto p-6 md:flex-none md:justify-center'>
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
            (o painel e longo e rola). Desktop: no fim do painel */}
        <Button
          size='lg'
          className='fixed top-3 right-3 z-10 font-black uppercase shadow-lg md:static md:w-full md:max-w-xs md:shadow-xs'
          onClick={backToMenu}
        >
          <ArrowLeft
            aria-hidden
            strokeWidth={3}
          />
          Voltar
        </Button>
      </div>
    </main>
  );
}
