import { useGameStore } from '@/app/store/game-store/game.store';
import { CharacterPage } from '@/resources/pages/character/character.page';
import { GamePage } from '@/resources/pages/game/game.page';
import { HomePage } from '@/resources/pages/home/home.page';

// telas escolhidas pelo store; sem router ate existir URL para navegar
export default function App() {
  const screen = useGameStore((state) => state.screen);
  if (screen === 'menu') return <HomePage />;
  if (screen === 'character') return <CharacterPage />;
  return <GamePage />;
}
