import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import {
  buyItem,
  closeShop as closeWorldShop,
  createMarket,
} from '@/app/modules/shop/systems/shop.system';
import {
  beginRun,
  createWorld,
  stepWorld,
  togglePause as toggleWorldPause,
} from '@/app/modules/world/systems/world.system';
import type {
  AttackVariance,
  EnemyIntelligence,
  InputState,
  ItemId,
  Market,
  WeaponId,
  World,
  WorldStatus,
} from '@/app/modules/world/types/world.types';

// Contrato em docs/contracts.md (secao Store).

export type Screen =
  'menu' | 'character' | 'intro' | 'playing' | 'paused' | 'shop' | 'gameover';

export type Hud = {
  hp: number;
  maxHp: number;
  shield: number;
  money: number;
  room: number;
  kills: number;
  weaponId: WeaponId | null;
  ammo: number;
};

// aparencia do player: so visual, nao entra no World
export type PlayerLook = {
  cloth: string; // cores em '#rrggbb'
  accent: string;
  skin: string;
  head: number; // escalas, 1 = padrao
  legs: number;
  hands: number;
  feet: number;
  // espada e armas de fogo na mao; faixa propria (WEAPON_SCALE)
  weapon: number;
};

export const LOOK_SCALE = { min: 0.7, max: 1.4 };
export const WEAPON_SCALE = { min: 0.4, max: 1.4 };

export const DEFAULT_LOOK: PlayerLook = {
  cloth: '#ff8a3c',
  accent: '#1c1c28',
  skin: '#e8b796',
  head: 1,
  legs: 1,
  hands: 1,
  feet: 1,
  weapon: 1,
};

export const DEFAULT_BLOOD_COLOR = '#a61020';

const COLOR = /^#[0-9a-f]{6}$/i;

function validIntelligence(saved: unknown): Record<number, EnemyIntelligence> {
  const levels: Record<number, EnemyIntelligence> = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved))
    return levels;
  for (const [key, value] of Object.entries(saved)) {
    const level = Number(key);
    if (!Number.isSafeInteger(level) || level < 1 || level > 1000) continue;
    if (!value || typeof value !== 'object') continue;
    const profile = value as Partial<EnemyIntelligence>;
    const hearingThreshold =
      profile.hearingThreshold === undefined ? 1 : profile.hearingThreshold;
    if (
      [profile.hearing, profile.pursuit, profile.dash].every(
        (number) => typeof number === 'number' && number >= 1 && number <= 3,
      ) &&
      typeof hearingThreshold === 'number' &&
      hearingThreshold >= 0.6 &&
      hearingThreshold <= 1
    ) {
      levels[level] = {
        hearing: profile.hearing!,
        hearingThreshold,
        pursuit: profile.pursuit!,
        dash: profile.dash!,
      };
    }
  }
  return levels;
}

function validAttackVariance(saved: unknown): AttackVariance | null {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return null;
  const { min, max } = saved as Partial<AttackVariance>;
  return typeof min === 'number' &&
    min >= 0.5 &&
    min <= 1 &&
    typeof max === 'number' &&
    max >= 1 &&
    max <= 1.5
    ? { min, max }
    : null;
}

// descarta cor invalida e prende escala na faixa
function mergeLook(look: PlayerLook, patch: Partial<PlayerLook>): PlayerLook {
  const next = { ...look };
  for (const key of ['cloth', 'accent', 'skin'] as const) {
    const value = patch[key];
    if (value && COLOR.test(value)) next[key] = value;
  }
  for (const key of ['head', 'legs', 'hands', 'feet', 'weapon'] as const) {
    const value = patch[key];
    const range = key === 'weapon' ? WEAPON_SCALE : LOOK_SCALE;
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = Math.min(range.max, Math.max(range.min, value));
    }
  }
  return next;
}

type GameStore = {
  screen: Screen;
  hud: Hud;
  market: Market;
  best: number;
  look: PlayerLook;
  bloodColor: string;
  intelligence: Record<number, EnemyIntelligence>;
  attackVariance: AttackVariance | null;
  setLook: (patch: Partial<PlayerLook>) => void;
  setBloodColor: (color: string) => void;
  openCharacter: () => void;
  startRun: (seed?: number) => void;
  begin: () => void;
  togglePause: () => void;
  tick: (input: InputState, dt: number) => void;
  buy: (id: ItemId) => void;
  closeShop: () => void;
  backToMenu: () => void;
};

const EMPTY_HUD: Hud = {
  hp: 0,
  maxHp: 0,
  shield: 0,
  money: 0,
  room: 0,
  kills: 0,
  weaponId: null,
  ammo: 0,
};

const SCREEN_BY_STATUS: Record<WorldStatus, Screen> = {
  intro: 'intro',
  playing: 'playing',
  paused: 'paused',
  shop: 'shop',
  dead: 'gameover',
};

// World e input do joystick ficam fora do estado reativo: mudam a 60 Hz e so
// a engine precisa deles a cada frame
let world: World | null = null;

export const joystickInput: InputState = { moveX: 0, moveY: 0, dash: false };

export function getWorld(): World | null {
  return world;
}

export function setJoystickInput(moveX: number, moveY: number): void {
  joystickInput.moveX = moveX;
  joystickInput.moveY = moveY;
}

function readHud(w: World): Hud {
  return {
    hp: Math.max(0, w.player.hp),
    maxHp: w.player.maxHp,
    shield: w.player.shield,
    money: w.run.money,
    room: w.run.roomIndex,
    kills: w.run.kills,
    weaponId: w.player.weapon?.id ?? null,
    ammo: w.player.weapon?.ammo ?? 0,
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => {
      // so chama set quando algo visivel mudou, para a UI nao renderizar a 60 Hz
      const sync = () => {
        if (!world) return;
        const hud = readHud(world);
        const screen = SCREEN_BY_STATUS[world.status];
        const prev = get();
        const changed =
          screen !== prev.screen ||
          world.market !== prev.market ||
          world.intelligence !== prev.intelligence ||
          world.run.attackVariance !== prev.attackVariance ||
          (Object.keys(hud) as (keyof Hud)[]).some(
            (key) => hud[key] !== prev.hud[key],
          );
        if (!changed) return;
        set({
          hud,
          screen,
          market: world.market,
          intelligence: world.intelligence,
          attackVariance: world.run.attackVariance,
          best: Math.max(prev.best, hud.room),
        });
      };

      return {
        screen: 'menu',
        hud: EMPTY_HUD,
        market: createMarket(),
        best: 0,
        look: DEFAULT_LOOK,
        bloodColor: DEFAULT_BLOOD_COLOR,
        intelligence: {},
        attackVariance: null,
        // so antes da run: a engine le `look` uma vez, ao criar o renderer
        setLook: (patch) => {
          if (world) return;
          set({ look: mergeLook(get().look, patch) });
        },
        setBloodColor: (color) => {
          if (COLOR.test(color)) set({ bloodColor: color });
        },
        openCharacter: () => {
          if (!world) set({ screen: 'character' });
        },
        // toda run abre na legenda; `begin` solta a simulacao
        startRun: (seed = Date.now()) => {
          world = createWorld(seed, get().intelligence, get().attackVariance);
          world.status = 'intro';
          setJoystickInput(0, 0);
          sync();
        },
        begin: () => {
          if (!world) return;
          beginRun(world);
          sync();
        },
        togglePause: () => {
          if (!world) return;
          toggleWorldPause(world);
          sync();
        },
        tick: (input, dt) => {
          if (!world || world.status !== 'playing') return;
          stepWorld(world, input, dt);
          sync();
        },
        buy: (id) => {
          if (world && buyItem(world, id)) sync();
        },
        closeShop: () => {
          if (!world) return;
          closeWorldShop(world);
          sync();
        },
        backToMenu: () => {
          world = null;
          set({ screen: 'menu' });
        },
      };
    },
    {
      name: 'shadow-contract',
      partialize: (state) => ({
        best: state.best,
        look: state.look,
        bloodColor: state.bloodColor,
        intelligence: state.intelligence,
        attackVariance: state.attackVariance,
      }),
      // valor salvo passa pela mesma validacao de `setLook`
      merge: (saved, current) => {
        const { best, look, bloodColor, intelligence, attackVariance } =
          (saved ?? {}) as Partial<GameStore>;
        return {
          ...current,
          best: best ?? current.best,
          look: mergeLook(current.look, look ?? {}),
          bloodColor:
            typeof bloodColor === 'string' && COLOR.test(bloodColor)
              ? bloodColor
              : current.bloodColor,
          intelligence: validIntelligence(intelligence),
          attackVariance: validAttackVariance(attackVariance),
        };
      },
    },
  ),
);
