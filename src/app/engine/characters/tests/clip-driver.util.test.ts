import type { CharacterPose } from '@/app/engine/characters/character-view.types';
import {
  clipNames,
  driveClips,
  splitClipNames,
  type ClipSet,
} from '@/app/engine/characters/clip-driver.util';

const SET: ClipSet = {
  idle: { name: 'idle' },
  move: { name: 'run' },
  crouch: { name: 'crouch' },
  sneak: { name: 'sneak' },
  attacks: [{ name: 'slash' }, { name: 'chop', from: 0.2, to: 0.7 }],
  spin: { name: 'spin' },
  dash: { name: 'dodge' },
  shot: { name: 'shoot' },
  death: { name: 'death' },
};
const REST: CharacterPose = {
  moving: 0,
  crouching: false,
  attack: null,
  dash: null,
  shot: null,
  swing: 0,
  spinning: false,
  dead: false,
};
// todo clipe dura 2 s
const drive = (pose: Partial<CharacterPose>, deadFor = 0, set = SET) =>
  driveClips(set, { ...REST, ...pose }, deadFor, () => 2);

describe('driveClips', () => {
  it('parado e correndo misturam os dois ciclos pelo quanto anda', () => {
    expect(drive({})).toEqual([
      { name: 'idle', weight: 1, time: null },
      { name: 'run', weight: 0, time: null },
    ]);
    expect(drive({ moving: 0.25 })).toEqual([
      { name: 'idle', weight: 0.75, time: null },
      { name: 'run', weight: 0.25, time: null },
    ]);
    // fora de 0 a 1 nao estoura o peso
    expect(drive({ moving: 7 }).map((c) => c.weight)).toEqual([0, 1]);
  });

  it('agachado troca os ciclos; sem clipe de agachar vale o comum', () => {
    expect(drive({ crouching: true, moving: 1 }).map((c) => c.name)).toEqual([
      'crouch',
      'sneak',
    ]);
    const plain = { ...SET, crouch: undefined, sneak: undefined };
    expect(
      drive({ crouching: true, moving: 1 }, 0, plain).map((c) => c.name),
    ).toEqual(['idle', 'run']);
  });

  it('golpe toca sozinho, no ponto que a fase manda', () => {
    expect(drive({ attack: 0.5, moving: 1 })).toEqual([
      { name: 'slash', weight: 1, time: 1 },
    ]);
    // fase fora de 0 a 1 fica na ponta do clipe
    expect(drive({ attack: 3 })[0].time).toBe(2);
  });

  it('`swing` escolhe o jeito de golpear, dando a volta na lista', () => {
    expect(drive({ attack: 0, swing: 1 })[0].name).toBe('chop');
    expect(drive({ attack: 0, swing: 2 })[0].name).toBe('slash');
    expect(drive({ attack: 0, swing: -1 })[0].name).toBe('chop');
  });

  it('trecho do clipe: a fase percorre so de `from` a `to`', () => {
    const at = (attack: number) => drive({ attack, swing: 1 })[0].time;
    expect(at(0)).toBeCloseTo(0.4);
    expect(at(0.5)).toBeCloseTo(0.9);
    expect(at(1)).toBeCloseTo(1.4);
  });

  it('giro so vale com clipe de giro; senao, o golpe da vez', () => {
    expect(drive({ attack: 0.1, spinning: true })[0].name).toBe('spin');
    const plain = { ...SET, spin: undefined };
    expect(drive({ attack: 0.1, spinning: true }, 0, plain)[0].name).toBe(
      'slash',
    );
  });

  it('prioridade: morte, golpe, salto, tiro', () => {
    const all = { attack: 0.5, shot: 0.5, dash: 0.5 };
    expect(drive({ ...all, dead: true })[0].name).toBe('death');
    expect(drive(all)[0].name).toBe('slash');
    expect(drive({ ...all, attack: null })[0].name).toBe('dodge');
    expect(drive({ shot: 0.5 })[0].name).toBe('shoot');
  });

  it('tiro sem separar o corpo toma tudo; separando, fica no tronco e as pernas seguem', () => {
    expect(drive({ shot: 0.5, moving: 1 })).toEqual([
      { name: 'shoot', weight: 1, time: 1 },
    ]);
    const layered = driveClips(
      SET,
      { ...REST, shot: 0.5, moving: 0.25 },
      0,
      () => 2,
      true,
    );
    expect(layered).toEqual([
      { name: 'idle', weight: 0.75, time: null, part: 'lower' },
      { name: 'run', weight: 0.25, time: null, part: 'lower' },
      { name: 'shoot', weight: 1, time: 1, part: 'upper' },
    ]);
  });

  it('separar o corpo so muda o tiro: andar e golpear seguem de corpo inteiro', () => {
    const whole = (pose: Partial<CharacterPose>) =>
      driveClips(SET, { ...REST, ...pose }, 0, () => 2, true);
    expect(whole({ moving: 1 }).every((c) => c.part === undefined)).toBe(true);
    expect(whole({ attack: 0.5 })[0].part).toBeUndefined();
  });

  it('acao sem clipe nao trava o corpo: seguem os ciclos', () => {
    const plain = { ...SET, dash: undefined, shot: undefined, attacks: [] };
    expect(
      drive({ attack: 0.5, shot: 0.5, dash: 0.5 }, 0, plain).map((c) => c.name),
    ).toEqual(['idle', 'run']);
  });

  it('morte anda com o tempo desde que morreu e para no fim do clipe', () => {
    expect(drive({ dead: true }, 0)[0].time).toBe(0);
    expect(drive({ dead: true }, 0.5)[0].time).toBeCloseTo(0.5);
    expect(drive({ dead: true }, 60)[0].time).toBe(2);
  });
});

describe('clipNames', () => {
  it('lista cada clipe usado uma vez so', () => {
    const repeated = { ...SET, spin: { name: 'slash' }, sneak: undefined };
    expect(clipNames(repeated).sort()).toEqual(
      [
        'chop',
        'crouch',
        'death',
        'dodge',
        'idle',
        'run',
        'shoot',
        'slash',
      ].sort(),
    );
  });
});

describe('splitClipNames', () => {
  it('tronco usa o clipe de tiro; pernas, os ciclos', () => {
    expect(splitClipNames(SET)).toEqual({
      upper: ['shoot'],
      lower: ['idle', 'run', 'crouch', 'sneak'],
    });
  });

  it('sem clipe de tiro nao ha o que separar', () => {
    expect(splitClipNames({ ...SET, shot: undefined })).toEqual({
      upper: [],
      lower: [],
    });
  });
});
