import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';

type LegendDialogProps = {
  open: boolean;
  title: string;
  actionLabel: string;
  onAction: () => void;
  onRestart?: () => void;
};

type Entry = [label: string, text: string];

const SECTIONS: [title: string, entries: Entry[]][] = [
  [
    'Controles',
    [
      ['WASD / setas / arrastar', 'mover'],
      [
        'Espaco',
        'salto de esquiva. Livre na sala inicial; depois gasta 1 dos 6',
      ],
      ['C / Ctrl', 'agachar: mais lento, inimigos ouvem menos'],
      ['F', 'quebrar a caixa ao alcance; com arma, facada no inimigo ao lado'],
      ['B', 'abrir e fechar o bau da loja, no fim do contrato'],
      ['Q', 'trocar entre espada e armas (ou clique na arma, no topo)'],
      ['P', 'pausar e ver esta legenda'],
    ],
  ],
  [
    'Furtividade',
    [
      ['Cone branco', 'patrulha. Amarelo: suspeito. Vermelho: alerta'],
      [
        'Orelha',
        'ele esta te ouvindo. Branca: notou algo. Amarela: vem investigar',
      ],
      ['Barulho', 'parado pouco, andando mais, salto e tiro muito mais'],
      ['Agachado', 'ele nota e investiga, mas nao entra em alerta pelo som'],
      ['De perto', 'colado nele, ele te percebe mesmo de costas'],
      ['Silenciador', 'tiro sem ele chama todo inimigo por perto'],
      ['Parede', 'bloqueia visao e bala, mas nao o som'],
    ],
  ],
  [
    'Combate',
    [
      [
        'Espada',
        'por tras elimina na hora; inimigo em alerta leva 30 a 45 de dano',
      ],
      [
        'Com arma',
        'atira sozinho de longe; colado no inimigo, so ataca no F (faca)',
      ],
      ['Tiro', 'perde forca com a distancia; escopeta so resolve de perto'],
      ['Numeros', '+ e o dano que voce causou; - vermelho e o que ele te deu'],
      ['Adrenalina', 'cada eliminacao acelera voce por um instante'],
    ],
  ],
  [
    'Inimigos e cenario',
    [
      ['Terno', 'atira de longe, aguenta 2 tiros. Desvie das balas vermelhas'],
      ['Ninja', 'corre e golpeia de perto, aguenta 2 golpes'],
      [
        'Caixa',
        'cobre de bala e quebra com tiro ou briga; pode soltar vida ou escudo',
      ],
      ['Coracao', 'recupera vida. Escudo: absorve dano antes da vida'],
    ],
  ],
];

// botao gordo de jogo, igual ao da home e da tela de derrota
const CHUNKY =
  'font-display text-outline cursor-pointer rounded-2xl border-4 border-white px-6 py-2 text-xl text-white uppercase shadow-[0_5px_0_#14141f] transition-transform hover:scale-105 active:translate-y-1 active:shadow-none';

// usado antes de cada run ("Como jogar") e na pausa ("Pausado")
export function LegendDialog({
  open,
  title,
  actionLabel,
  onAction,
  onRestart,
}: LegendDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onAction()}
    >
      <DialogContent
        showCloseButton={false}
        // So a legenda rola. Os botoes ficam fora do painel, flutuando embaixo:
        // sempre a vista, sem precisar rolar ate o fim para comecar.
        className='max-h-[94dvh] grid-rows-[minmax(0,1fr)_auto] gap-3 border-0 bg-transparent p-0 shadow-none sm:max-w-xl'
      >
        <div className='flex min-h-0 flex-col gap-4 overflow-y-auto rounded-3xl border-4 border-white bg-[#1f2033] p-6 shadow-[0_8px_0_#14141f]'>
          <DialogHeader className='items-center text-center'>
            <DialogTitle className='font-display text-outline text-4xl leading-none tracking-wide text-white uppercase sm:text-5xl'>
              {title}
            </DialogTitle>
            <DialogDescription className='font-display text-outline text-lg text-[#ff2d55]'>
              Atravesse as salas sem ser visto.
            </DialogDescription>
          </DialogHeader>
          {SECTIONS.map(([section, entries]) => (
            <section
              key={section}
              className='rounded-2xl bg-black/25 p-3'
            >
              <h3 className='font-display text-outline mb-2 text-lg tracking-wide text-[#ffd21f] uppercase'>
                {section}
              </h3>
              <dl className='grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1.5 text-sm'>
                {entries.map(([label, text]) => (
                  <div
                    key={label}
                    className='contents'
                  >
                    <dt className='rounded-md bg-white/10 px-2 py-0.5 font-black whitespace-nowrap text-white'>
                      {label}
                    </dt>
                    <dd className='text-white/75'>{text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <DialogFooter className='flex-row items-center justify-center gap-3 pb-2 sm:justify-center'>
          {onRestart && (
            <button
              type='button'
              className={`${CHUNKY} bg-[#3d4fd6]`}
              onClick={onRestart}
            >
              Reiniciar
            </button>
          )}
          <button
            type='button'
            className={`${CHUNKY} bg-[#2fd15a]`}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
