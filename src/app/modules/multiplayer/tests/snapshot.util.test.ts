import { createMultiWorld } from '@/app/modules/multiplayer/systems/multiplayer.system';
import {
  applySnapshot,
  cleanInput,
  clearPulses,
  encodeSnapshot,
  mergeInput,
  roomsKey,
} from '@/app/modules/multiplayer/utils/snapshot.util';
import { breakProp } from '@/app/modules/level/utils/grid.util';

const SEATS = [
  { name: 'Host', color: '#ff8a3c' },
  { name: 'Ana', color: '#39d0ff' },
];
// o que viaja pela rede e JSON
const wire = <T>(value: T): T => JSON.parse(JSON.stringify(value));

describe('snapshot', () => {
  it('convidado remonta o mundo e fica em foco no proprio jogador', () => {
    const world = createMultiWorld(1, SEATS);
    world.players[1].money = 80;
    const mine = applySnapshot(null, wire(encodeSnapshot(world, '')), 1);

    expect(mine.players).toEqual(world.players);
    expect(mine.player).toBe(mine.players[1]);
    expect(mine.player.money).toBe(80);
    expect(mine.rooms).toEqual(world.rooms);
    expect(mine.enemies).toEqual(world.enemies);
    expect(mine.mode).toBe('multi');
  });

  it('salas so viajam quando mudam; sem elas o convidado mantem as que tem', () => {
    const world = createMultiWorld(1, SEATS);
    const first = wire(encodeSnapshot(world, ''));
    const key = roomsKey(world);
    const second = wire(encodeSnapshot(world, key));
    expect(first.rooms).toBeDefined();
    expect(second.rooms).toBeUndefined();

    const mine = applySnapshot(applySnapshot(null, first, 0), second, 0);
    expect(mine.rooms).toEqual(world.rooms);

    world.props.push({
      id: 999,
      roomIndex: 0,
      pos: { x: 3.5, y: 3.5 },
      broken: false,
      variant: 0,
    } as (typeof world.props)[number]);
    breakProp(world, world.props.at(-1)!);
    world.rooms[0].tiles[1] = world.rooms[0].tiles[1].replace('.', 'o');
    expect(encodeSnapshot(world, key).rooms).toBeDefined();
  });

  it('registro da partida so viaja na derrota', () => {
    const world = createMultiWorld(1, SEATS);
    expect(encodeSnapshot(world, '').run.events).toBeUndefined();
    world.status = 'dead';
    expect(encodeSnapshot(world, '').run.events).toBe(world.run.events);
  });
});

describe('input do convidado', () => {
  it('pulso que chegou nao se perde ate o passo', () => {
    const held = mergeInput(
      { moveX: 0, moveY: 0, dash: false, interact: true },
      { moveX: 1, moveY: 0, dash: false },
    );
    expect(held).toMatchObject({ moveX: 1, interact: true });
    clearPulses(held);
    expect(held.interact).toBe(false);
  });

  it('host so aceita eixos de -1 a 1 e booleanos', () => {
    expect(cleanInput('x')).toBeNull();
    expect(
      cleanInput({ moveX: 99, moveY: 'a', dash: 'yes', interact: true }),
    ).toEqual({
      moveX: 1,
      moveY: 0,
      dash: false,
      crouch: false,
      interact: true,
      open: false,
    });
  });
});
