import { useGameStore } from '@/app/store/game-store/game.store';
import { GamePage } from '@/resources/pages/game/game.page';
import { HomePage } from '@/resources/pages/home/home.page';

// tres telas escolhidas pelo store; sem router ate existir URL para navegar
export default function App() {
  const screen = useGameStore((state) => state.screen);
  return screen === 'menu' ? <HomePage /> : <GamePage />;
}
