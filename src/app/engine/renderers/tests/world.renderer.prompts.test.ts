import * as THREE from 'three';

import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import { spawnRoom } from '@/app/modules/level/systems/level.system';
import { SHOP_TEMPLATE } from '@/app/modules/level/templates/room.template';
import { createEmptyWorld } from '@/app/modules/world/systems/world.system';
import {
  DEFAULT_BLOOD_COLOR,
  DEFAULT_LOOK,
} from '@/app/store/game-store/game.store';
import { createArenaWorld } from '@/test/world.fixture';

function actions(setup: () => ReturnType<typeof createArenaWorld>) {
  const world = setup();
  const renderer = createWorldRenderer(
    new THREE.Scene(),
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  renderer.sync(world, 1);
  const found = renderer.prompts().map((prompt) => prompt.action);
  renderer.dispose();
  return found;
}

describe('prompts', () => {
  it('sem nada ao alcance nao ha icone para tocar', () => {
    expect(actions(() => createArenaWorld())).toEqual([]);
  });

  it('caixa ao alcance oferece interact (F)', () => {
    expect(
      actions(() => {
        // caixa no tile logo a frente do player
        const world = createArenaWorld({ 9: '#....o....#' });
        world.player.pos = { x: 5.5, y: 2.55 };
        return world;
      }),
    ).toEqual(['interact']);
  });

  it('bau ao alcance oferece open (B)', () => {
    expect(
      actions(() => {
        const world = createEmptyWorld(1);
        spawnRoom(world, 0, SHOP_TEMPLATE);
        world.player.pos = { x: 5.5, y: 6.5 };
        return world;
      }),
    ).toEqual(['open']);
  });
});
