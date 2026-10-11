import { Button } from '@/resources/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/resources/components/ui/dialog';

type GameOverDialogProps = {
  open: boolean;
  room: number;
  kills: number;
  best: number;
  onRestart: () => void;
  onMenu: () => void;
};

export function GameOverDialog({
  open,
  room,
  kills,
  best,
  onRestart,
  onMenu,
}: GameOverDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Contrato encerrado</DialogTitle>
          <DialogDescription>
            Sala {room}, {kills} eliminados. Recorde: sala {best}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={onMenu}
          >
            Menu
          </Button>
          <Button onClick={onRestart}>Jogar de novo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
