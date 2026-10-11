import { Button } from '@/resources/components/ui/button';
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

const LEGEND: [label: string, text: string][] = [
  ['WASD / setas / arrastar', 'mover'],
  ['Espaco', 'salto de esquiva para frente'],
  ['F', 'quebrar a caixa ao alcance'],
  ['P', 'pausar e ver esta legenda'],
  ['Espada', 'por tras elimina na hora; inimigo em alerta leva 1 de dano'],
  ['Cone branco', 'patrulha. Amarelo: suspeito. Vermelho: alerta'],
  ['Terno', 'atira de longe, aguenta 2 tiros. Desvie das balas vermelhas'],
  ['Ninja', 'corre e golpeia de perto, aguenta 2 golpes'],
  ['Caixa', 'cobre de bala e quebra com tiro ou briga'],
  ['Adrenalina', 'cada eliminacao acelera voce por um instante'],
  ['Parede', 'bloqueia visao e bala'],
  ['B', 'abrir e fechar o bau da loja, no fim do contrato'],
];

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
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Atravesse as salas sem ser visto.
          </DialogDescription>
        </DialogHeader>
        <dl className='grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm'>
          {LEGEND.map(([label, text]) => (
            <div
              key={label}
              className='contents'
            >
              <dt className='text-primary font-black'>{label}</dt>
              <dd className='text-muted-foreground'>{text}</dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          {onRestart && (
            <Button
              variant='outline'
              onClick={onRestart}
            >
              Reiniciar
            </Button>
          )}
          <Button onClick={onAction}>{actionLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
