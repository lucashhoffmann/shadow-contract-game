import { Button } from '@/resources/components/ui/button';
import { LookEditor } from '@/resources/pages/character/components/look-editor.component';
import { useCharacterPage } from '@/resources/pages/character/use-character.page';

export function CharacterPage() {
  const { canvasRef, look, setLook, backToMenu } = useCharacterPage();

  return (
    <main className='flex h-full flex-col md:flex-row'>
      <div className='relative min-h-0 flex-1'>
        <canvas
          ref={canvasRef}
          aria-label='Preview do personagem'
          className='block h-full w-full cursor-grab touch-none active:cursor-grabbing'
        />
        <p className='text-muted-foreground pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm'>
          Arraste para girar
        </p>
      </div>
      <div className='flex flex-col items-center gap-4 overflow-y-auto p-6 md:justify-center'>
        <LookEditor
          look={look}
          onChange={setLook}
        />
        <Button
          size='lg'
          className='w-full max-w-xs font-black uppercase'
          onClick={backToMenu}
        >
          Voltar
        </Button>
      </div>
    </main>
  );
}
