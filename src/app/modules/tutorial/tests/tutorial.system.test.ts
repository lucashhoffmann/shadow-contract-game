import { nextTutorialStep } from '@/app/modules/tutorial/systems/tutorial.system';
import { createArenaWorld } from '@/test/world.fixture';

describe('tutorial', () => {
  it('cada passo so avanca quando o mundo mostra a acao', () => {
    const world = createArenaWorld();
    world.status = 'intro';
    world.run.checkpoint = { ...world.player.pos };
    expect(nextTutorialStep(world, 'welcome')).toBe('welcome');

    world.status = 'playing';
    expect(nextTutorialStep(world, 'welcome')).toBe('move');

    world.player.pos.y += 1;
    expect(nextTutorialStep(world, 'move')).toBe('move');
    world.player.pos.y += 2;
    expect(nextTutorialStep(world, 'move')).toBe('crouch');

    world.player.crouching = true;
    expect(nextTutorialStep(world, 'crouch')).toBe('dash');

    world.player.dash = 0.2;
    expect(nextTutorialStep(world, 'dash')).toBe('door');

    world.run.roomIndex = 1;
    expect(nextTutorialStep(world, 'door')).toBe('kill');

    world.run.kills = 1;
    expect(nextTutorialStep(world, 'kill')).toBe('loot');

    world.player.money = 10;
    expect(nextTutorialStep(world, 'loot')).toBe('done');
    expect(nextTutorialStep(world, 'done')).toBe('done');
  });

  it('pula varios passos de uma vez quando ja estao cumpridos', () => {
    const world = createArenaWorld();
    world.run.roomIndex = 1;
    world.run.kills = 1;
    world.player.money = 5;
    expect(nextTutorialStep(world, 'door')).toBe('done');
  });
});
