import * as THREE from 'three';
import { vi } from 'vitest';

import { loadCharacterView } from 'three-hex-engine/three';
import { PLAYER_MODEL } from '@/app/engine/characters/character-models.config';
import type { CharacterView } from 'three-hex-engine/three';
import { createWorldRenderer } from '@/app/engine/renderers/world.renderer';
import {
  DASH_COOLDOWN,
  SLASH_TIME,
} from '@/app/modules/world/constants/world.constants';
import type { EnemyKind } from '@/app/modules/world/types/world.types';
import {
  DEFAULT_BLOOD_COLOR,
  DEFAULT_LOOK,
} from '@/app/store/game-store/game.store';
import { addEnemy, createArenaWorld } from '@/test/world.fixture';

// o carregador de verdade baixa arquivo: aqui entra um corpo de mentira
vi.mock('three-hex-engine/three', async (original) => ({
  ...(await original<typeof import('three-hex-engine/three')>()),
  loadCharacterView: vi.fn(),
}));
// Modelos de mentira para todo mundo: o teste vale com o jogo usando modelo
// ou nao (character-models.config.ts pode estar vazio).
vi.mock('@/app/engine/characters/character-models.config', () => {
  const model = (url: string) => ({
    url,
    clipsUrl: 'clips',
    rig: { scale: 0.5, turn: 0, slots: {}, clips: {} },
  });
  return {
    PLAYER_MODEL: model('hero'),
    ENEMY_MODELS: {
      ninja: model('ninja'),
      suit: model('suit'),
      fat: model('fat'),
    },
  };
});

function fakeBody(name: string) {
  const object = new THREE.Group();
  object.name = name;
  // ponto da mao, ja com a espada que o carregador prende nele
  const hand = new THREE.Group();
  const blade = new THREE.Group();
  blade.name = `${name}Blade`;
  hand.add(blade);
  object.add(hand);
  return {
    object,
    hand,
    blade,
    pose: vi.fn(),
    slot: (slot: string) => (slot === 'rightHand' ? hand : null),
    highlight: vi.fn(),
    dispose: vi.fn(() => object.removeFromParent()),
  } satisfies CharacterView & { hand: THREE.Group; blade: THREE.Group };
}

// deixa a promessa do carregador resolver
const arrive = () => new Promise((resolve) => setTimeout(resolve, 0));

// um inimigo de `kind` e o player, cada um com o proprio corpo de mentira
function setup(kind: EnemyKind = 'ninja') {
  const foe = fakeBody('foeBody');
  const hero = fakeBody('heroBody');
  vi.mocked(loadCharacterView)
    .mockReset()
    .mockImplementation(async (model) => (model === PLAYER_MODEL ? hero : foe));
  const world = createArenaWorld();
  const enemy = addEnemy(world, 5.5, 8.5, Math.PI / 2, kind);
  const scene = new THREE.Scene();
  const renderer = createWorldRenderer(
    scene,
    DEFAULT_LOOK,
    DEFAULT_BLOOD_COLOR,
  );
  return { foe, hero, world, enemy, scene, renderer };
}
const lastPose = (body: ReturnType<typeof fakeBody>) =>
  body.pose.mock.calls.at(-1)![0];
// o corpo de pecas e o grupo cheio de filhos dentro do root
const parts = (body: ReturnType<typeof fakeBody>) =>
  body.object.parent!.children.find(
    (child) => child !== body.object && child.children.length > 0,
  )!;

describe('inimigo com corpo de modelo', () => {
  it('o corpo de pecas aparece ate o modelo chegar e some depois', async () => {
    const { foe, world, scene, renderer } = setup();
    renderer.sync(world, 1);
    expect(scene.getObjectByName('foeBody')).toBeUndefined();
    expect(foe.pose).not.toHaveBeenCalled();

    await arrive();
    renderer.sync(world, 1.1);
    // mesmo root dos marcadores: posicao e icones nao mudam
    expect(foe.object.parent!.getObjectByName('rageMarker')).toBeDefined();
    expect(parts(foe).visible).toBe(false);
    expect(foe.pose).toHaveBeenCalled();
    renderer.dispose();
  });

  it('quem golpeia recebe a fase do golpe que vem da simulacao', async () => {
    const { foe, world, enemy, renderer } = setup('ninja');
    renderer.sync(world, 1);
    await arrive();

    renderer.sync(world, 1.1);
    expect(lastPose(foe)).toMatchObject({ attack: null, shot: null });

    enemy.attack = SLASH_TIME / 4;
    renderer.sync(world, 1.2);
    expect(lastPose(foe).attack).toBeCloseTo(0.75);
    expect(lastPose(foe).shot).toBeNull();
    renderer.dispose();
  });

  it('quem atira ganha a arma na mao, aponta em alerta e dispara pelo clipe de tiro', async () => {
    const { foe, world, enemy, renderer } = setup('suit');
    renderer.sync(world, 1);
    await arrive();
    // a espada de mentira mais a arma de fogo do jogo
    expect(foe.hand.children).toHaveLength(2);

    renderer.sync(world, 1.1);
    expect(lastPose(foe).shot).toBeNull();

    enemy.state = 'alert';
    renderer.sync(world, 1.2);
    const aiming = lastPose(foe).shot!;
    expect(aiming).toBeGreaterThan(0);

    enemy.attack = SLASH_TIME / 2;
    renderer.sync(world, 1.3);
    expect(lastPose(foe).shot!).toBeGreaterThan(aiming);
    expect(lastPose(foe).attack).toBeNull();
    renderer.dispose();
  });

  it('morto: o modelo recebe `dead` e o root fica de pe (quem cai e o clipe)', async () => {
    const { foe, world, enemy, renderer } = setup();
    renderer.sync(world, 1);
    await arrive();
    enemy.state = 'dead';
    renderer.sync(world, 1.1);
    expect(lastPose(foe).dead).toBe(true);
    const root = foe.object.parent!;
    expect(root.rotation.z).toBe(0);
    expect(root.position.y).toBe(0);
    renderer.dispose();
  });

  it('furia destaca o corpo de modelo e a calma tira', async () => {
    const { foe, world, enemy, renderer } = setup();
    renderer.sync(world, 1);
    await arrive();
    renderer.sync(world, 1.1);
    expect(foe.highlight).toHaveBeenLastCalledWith(null);
    enemy.enraged = true;
    renderer.sync(world, 1.2);
    expect(foe.highlight).toHaveBeenLastCalledWith(expect.any(Number));
    renderer.dispose();
  });

  it('inimigo que sai de cena descarta o modelo, mesmo se ele chegar depois', async () => {
    const late = setup();
    late.renderer.sync(late.world, 1);
    late.world.enemies = [];
    late.renderer.sync(late.world, 1.1);
    await arrive();
    expect(late.foe.dispose).toHaveBeenCalled();
    expect(late.scene.getObjectByName('foeBody')).toBeUndefined();

    const seen = setup();
    seen.renderer.sync(seen.world, 1);
    await arrive();
    seen.renderer.sync(seen.world, 1.1);
    seen.world.enemies = [];
    seen.renderer.sync(seen.world, 1.2);
    expect(seen.foe.dispose).toHaveBeenCalled();
    late.renderer.dispose();
    seen.renderer.dispose();
  });

  it('arquivo que nao chega nao quebra o jogo: fica o corpo de pecas', async () => {
    const { world, scene, renderer } = setup();
    vi.mocked(loadCharacterView)
      .mockReset()
      .mockRejectedValue(new Error('rede'));
    const again = createWorldRenderer(scene, DEFAULT_LOOK, DEFAULT_BLOOD_COLOR);
    again.sync(world, 1);
    await arrive();
    expect(() => again.sync(world, 1.1)).not.toThrow();
    expect(scene.getObjectByName('foeBody')).toBeUndefined();
    expect(scene.getObjectByName('heroBody')).toBeUndefined();
    renderer.dispose();
    again.dispose();
  });
});

describe('player com corpo de modelo', () => {
  async function ready() {
    const made = setup();
    made.world.enemies = [];
    made.renderer.sync(made.world, 1);
    await arrive();
    made.renderer.sync(made.world, 1.1);
    return made;
  }

  it('entra no lugar do corpo de pecas e recebe agachar e golpe', async () => {
    const { hero, world, renderer } = await ready();
    expect(parts(hero).visible).toBe(false);
    expect(lastPose(hero)).toMatchObject({ crouching: false, attack: null });

    world.player.crouching = true;
    world.player.slash = SLASH_TIME / 2;
    renderer.sync(world, 1.2);
    expect(lastPose(hero).crouching).toBe(true);
    expect(lastPose(hero).attack).toBeCloseTo(0.5);
    renderer.dispose();
  });

  it('golpe que comeca no salto gira ate o fim, mesmo com a recarga acabando no meio', async () => {
    const { hero, world, renderer } = await ready();
    world.player.dashCooldown = DASH_COOLDOWN;
    world.player.slash = SLASH_TIME;
    renderer.sync(world, 1.2);
    expect(lastPose(hero).spinning).toBe(true);

    world.player.dashCooldown = 0;
    world.player.slash = SLASH_TIME / 2;
    renderer.sync(world, 1.3);
    expect(lastPose(hero).spinning).toBe(true);

    // golpe seguinte, fora do salto: corte comum
    world.player.slash = 0;
    renderer.sync(world, 1.4);
    world.player.slash = SLASH_TIME;
    renderer.sync(world, 1.5);
    expect(lastPose(hero).spinning).toBe(false);
    renderer.dispose();
  });

  it('com arma de fogo: a espada some, a arma vai para a mao do modelo e ele aponta', async () => {
    const { hero, world, renderer } = await ready();
    expect(hero.blade.visible).toBe(true);
    expect(lastPose(hero).shot).toBeNull();
    // o suporte das armas saiu do braco de pecas para a mao do modelo
    expect(hero.hand.children).toHaveLength(2);

    const pistol = { id: 'pistol' as const, ammo: 5 };
    world.player.arsenal = [pistol];
    world.player.weapon = pistol;
    renderer.sync(world, 1.2);
    expect(hero.blade.visible).toBe(false);
    expect(lastPose(hero).shot).toBeGreaterThan(0);
    renderer.dispose();
  });

  it('invisivel esconde o corpo de modelo e nao volta a mostrar o de pecas', async () => {
    const { hero, world, renderer } = await ready();
    world.player.invisible = 5;
    renderer.sync(world, 1.2);
    expect(hero.object.visible).toBe(false);
    expect(parts(hero).visible).toBe(false);

    world.player.invisible = 0;
    renderer.sync(world, 1.3);
    expect(hero.object.visible).toBe(true);
    renderer.dispose();
  });

  it('raiva depois de matar destaca o corpo; morto, recebe `dead` de pe', async () => {
    const { hero, world, renderer } = await ready();
    world.player.adrenaline = 1;
    renderer.sync(world, 1.2);
    expect(hero.highlight).toHaveBeenLastCalledWith(expect.any(Number));

    world.player.hp = 0;
    renderer.sync(world, 1.3);
    expect(lastPose(hero).dead).toBe(true);
    expect(hero.object.parent!.rotation.z).toBe(0);
    renderer.dispose();
  });
});
